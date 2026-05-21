import { Achievement, Condition, LevelUp, Mission } from '@bitkingdom/bidking-compat';
import type { BidKingConditionRow, BidKingMissionRow } from '@bitkingdom/bidking-compat';
import { evaluateBidKingCondition, parseBidKingNumberRows } from '@bitkingdom/match-core';
import type { ConditionCheckResult, ConditionContext } from '@bitkingdom/match-core';
import type {
  AchievementProgressState,
  AuctionStatsState,
  FinalPlayerAuctionStats,
  FinalMatchSummary,
  MissionProgressState,
  PlayerProfile,
  ProfileTransaction
} from '@bitkingdom/shared';
import { allLevelRewardRows } from './profileRewardCatalog';
import { PROFILE_TASK_IDS } from './profileRuntimeConfig';
import { addInventory, canonicalCodexItemId, inventoryQuantity, inventoryRecord } from './profileInventory';
import { guildPointsForDonation } from './guildRuntime';

type AchievementMissionSource = {
  columns: readonly string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export type ProgressRewardRowsApplier = (
  profile: PlayerProfile,
  sourcePrefix: string,
  rewards: readonly (readonly number[])[],
  reason: string
) => void;

export type ProgressTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export type ProgressNumberChangeApplier = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: Extract<ProfileTransaction['resource'], 'coins' | 'rankPoints' | 'xp'>,
  amountChange: number
) => void;

export function completeTaskForProfile(
  profile: PlayerProfile,
  taskId: string,
  recordTransaction: ProgressTransactionRecorder
): boolean {
  const now = Date.now();
  const mission = missionRowForTask(taskId);
  const completionKey = missionCompletionKey(taskId, mission, now);
  if (profile.completedTasks.includes(completionKey)) {
    return false;
  }
  profile.completedTasks.push(completionKey);
  profile.updatedAt = now;
  refreshMissionProgress(profile, now);
  recordTransaction(profile, `task:${profile.playerId}:${completionKey}`, 'task_complete', 'task', 0, 1);
  return true;
}

export function claimMissionRewardForProfile(
  profile: PlayerProfile,
  taskId: string,
  applyRewardRows: ProgressRewardRowsApplier
): boolean {
  const now = Date.now();
  const mission = missionRowForTask(taskId);
  if (!mission) {
    throw new Error('任务配置不存在');
  }
  const progress = missionProgressForProfile(profile, taskId, mission, now);
  if (progress.claimed) {
    return false;
  }
  const completionKey = missionCompletionKey(taskId, mission, now);
  if (!profile.completedTasks.includes(completionKey) && progress.completed) {
    profile.completedTasks.push(completionKey);
  }
  if (!profile.completedTasks.includes(completionKey)) {
    throw new Error('任务尚未完成');
  }
  applyRewardRows(profile, missionRewardSourcePrefix(profile, taskId, mission, now), mission.reward, 'mission_reward');
  recordMissionClaim(profile, taskId, mission, now);
  profile.updatedAt = now;
  refreshMissionProgress(profile, now);
  return true;
}

export function claimAchievementRewardForProfile(
  profile: PlayerProfile,
  achievementId: string,
  applyRewardRows: ProgressRewardRowsApplier
): void {
  refreshMissionProgress(profile);
  const achievement = Achievement.find((row) => row.id === achievementId);
  if (!achievement) {
    throw new Error('成就配置不存在');
  }
  const missionIds = achievementMissionIds(achievement);
  const rewardMission = Mission.find(
    (mission) =>
      missionIds.includes(mission.Id) &&
      !profile.claimedAchievements?.includes(String(mission.Id)) &&
      isMissionSatisfied(profile, mission)
  );
  if (!rewardMission) {
    throw new Error('成就尚未完成或已领取');
  }
  applyRewardRows(profile, `achievement:${profile.playerId}:${achievement.id}:${rewardMission.Id}`, rewardMission.reward, 'achievement_reward');
  profile.claimedAchievements ??= [];
  profile.claimedAchievements.push(String(rewardMission.Id));
  profile.completedTasks = [...new Set([...profile.completedTasks, String(rewardMission.Id)])];
  profile.updatedAt = Date.now();
  refreshMissionProgress(profile);
}

export function claimLevelRewardForProfile(
  profile: PlayerProfile,
  level: number,
  applyRewardRows: ProgressRewardRowsApplier
): boolean {
  const safeLevel = Math.max(1, Math.floor(level));
  const row = LevelUp.find((entry) => entry.id === safeLevel);
  if (!row) {
    throw new Error('等级配置不存在');
  }
  if (profile.level < safeLevel) {
    throw new Error('掌柜等级不足');
  }
  profile.claimedLevelRewards ??= [];
  if (profile.claimedLevelRewards.includes(safeLevel)) {
    return false;
  }
  applyRewardRows(profile, `level:${profile.playerId}:${safeLevel}`, allLevelRewardRows(row), 'level_reward');
  profile.claimedLevelRewards.push(safeLevel);
  profile.updatedAt = Date.now();
  return true;
}

export function applyMatchSummaryForProfile(
  profile: PlayerProfile,
  summary: FinalMatchSummary,
  applyNumberChange: ProgressNumberChangeApplier,
  recordTransaction?: ProgressTransactionRecorder
): boolean {
  if (profile.completedMatches.includes(summary.matchId)) {
    return false;
  }
  const reward = summary.rewards.find((candidate) => candidate.playerId === profile.playerId) ?? { xp: 80, coins: 60, rankPoints: 0 };
  const awardedItems = awardedItemsForProfile(profile, summary);
  const existingCodex = new Set(profile.codex);
  const newCodex = awardedItems
    .map((item) => canonicalCodexItemId(item.id))
    .filter((itemId) => !existingCodex.has(itemId));
  for (const itemId of newCodex) {
    existingCodex.add(itemId);
  }
  const totalCoins = reward.coins;
  const matchTaskIds = new Set(profile.completedTasks);
  matchTaskIds.add('daily_complete_match');
  if (newCodex.length > 0) {
    matchTaskIds.add('daily_light_codex');
  }
  if (awardedItems.some((item) => ['rare', 'legendary'].includes(item.rarity))) {
    matchTaskIds.add('ach_rare_collector');
  }
  if (awardedItems.some((item) => item.rarity === 'legendary')) {
    matchTaskIds.add('ach_legendary_find');
  }
  if (summary.rankings.some((player) => player.playerId === profile.playerId && player.netWorth > 0)) {
    matchTaskIds.add('ach_first_profit');
  }

  applyGuildPointsForMatch(profile, summary, recordTransaction);
  mergeAuctionStats(profile, summary, Date.now());
  recordAuctionAcquiredItems(profile, awardedItems);
  awardMatchItemsToInventory(profile, summary.matchId, awardedItems, recordTransaction);

  applyNumberChange(profile, `match:${summary.matchId}:${profile.playerId}:xp`, 'match_reward_xp', 'xp', reward.xp);
  if (totalCoins > 0) {
    applyNumberChange(profile, `match:${summary.matchId}:${profile.playerId}:coins`, 'match_reward_coins', 'coins', totalCoins);
  }
  applyNumberChange(profile, `match:${summary.matchId}:${profile.playerId}:rank`, 'match_reward_rank', 'rankPoints', reward.rankPoints);
  profile.level = levelFromXp(profile.xp);
  profile.codex = [...existingCodex];
  profile.completedMatches.push(summary.matchId);
  profile.completedTasks = [...matchTaskIds];
  profile.lastRewards = {
    matchId: summary.matchId,
    xp: reward.xp,
    coins: totalCoins,
    rankPoints: reward.rankPoints,
    newCodex
  };
  profile.updatedAt = Date.now();
  refreshMissionProgress(profile);
  return true;
}

function awardedItemsForProfile(profile: PlayerProfile, summary: FinalMatchSummary) {
  return summary.awardedItemsByPlayerId
    ? summary.awardedItemsByPlayerId[profile.playerId] ?? []
    : summary.revealedItems;
}

function awardMatchItemsToInventory(
  profile: PlayerProfile,
  matchId: string,
  awardedItems: ReturnType<typeof awardedItemsForProfile>,
  recordTransaction?: ProgressTransactionRecorder
): void {
  const counts = new Map<string, number>();
  for (const item of awardedItems) {
    const itemId = canonicalCodexItemId(item.id);
    counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
  }
  for (const [itemId, quantity] of counts) {
    const before = inventoryQuantity(profile, itemId);
    addInventory(profile, 'warehouse', itemId, quantity, `match:${matchId}:${profile.playerId}:item:${itemId}`);
    recordTransaction?.(
      profile,
      `match:${matchId}:${profile.playerId}:item:${itemId}`,
      'match_award_item',
      'item',
      before,
      quantity
    );
  }
}

function recordAuctionAcquiredItems(profile: PlayerProfile, awardedItems: ReturnType<typeof awardedItemsForProfile>): void {
  profile.conditionStats ??= {
    usedItemCount: 0,
    dailyUsedItemCount: {},
    usedItemCountsById: {},
    tradeBoughtCount: 0,
    tradeSoldCount: 0,
    auctionAcquiredItemIds: [],
    shopAcquiredItemIds: [],
    missionEventCounts: {},
    missionEventDomainCounts: {},
    updatedAt: Date.now()
  };
  profile.conditionStats.auctionAcquiredItemIds ??= [];
  for (const item of awardedItems) {
    const itemId = Number(canonicalCodexItemId(item.id).replace(/^compat_/, ''));
    if (Number.isFinite(itemId) && itemId > 0) {
      profile.conditionStats.auctionAcquiredItemIds.push(itemId);
    }
  }
  profile.conditionStats.updatedAt = Date.now();
}

function applyGuildPointsForMatch(
  profile: PlayerProfile,
  summary: FinalMatchSummary,
  recordTransaction?: ProgressTransactionRecorder
): void {
  if (!profile.guildMembership) {
    return;
  }
  const stats = auctionStatsForProfile(profile, summary);
  const profit = Math.max(0, Math.floor(stats.netProfit || stats.totalProfit));
  if (profit <= 0) {
    return;
  }
  const points = guildPointsForDonation(profit);
  if (points <= 0) {
    return;
  }
  const before = profile.guildMembership.points;
  profile.guildMembership.points += points;
  recordTransaction?.(
    profile,
    `guild_points_match:${summary.matchId}:${profile.playerId}`,
    'guild_points_match',
    'task',
    before,
    points
  );
}

export function missionRowForTask(taskId: string): (typeof Mission)[number] | undefined {
  const index = PROFILE_TASK_IDS.findIndex((id) => id === taskId);
  if (index >= 0) {
    return missionTaskRows()[index];
  }
  return Mission.find((row) => String(row.Id) === taskId);
}

export function missionTaskRows(): typeof Mission {
  return Mission.filter((mission) => mission.display > 0 || mission.reward.length > 0);
}

function missionProgressRows(): typeof Mission {
  return Mission.filter(
    (mission) => mission.display > 0 || mission.reward.length > 0 || mission.conditions.length > 0 || mission.refreshtype > 0
  );
}

export function achievementMissionIds(row: AchievementMissionSource): number[] {
  const raw = row.columns[5] ?? '[]';
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'number')) {
      return parsed.filter((value) => value > 0);
    }
  } catch {
    // Fall through to the generic nested row parser.
  }
  return parseBidKingNumberRows(raw).flat().filter((value) => Number.isFinite(value) && value > 0);
}

export function refreshMissionProgress(profile: PlayerProfile, now = Date.now()): void {
  const missionProgress: Record<string, MissionProgressState> = {};

  for (const taskId of PROFILE_TASK_IDS) {
    const mission = missionRowForTask(taskId);
    if (!mission) {
      continue;
    }
    const progress = missionProgressForProfile(profile, taskId, mission, now);
    missionProgress[taskId] = progress;
    const completionKey = missionCompletionKey(taskId, mission, now);
    if (progress.completed && !profile.completedTasks.includes(completionKey)) {
      profile.completedTasks.push(completionKey);
    }
  }

  for (const mission of missionProgressRows()) {
    const missionKey = String(mission.Id);
    missionProgress[missionKey] ??= missionProgressForProfile(profile, missionKey, mission, now);
  }

  for (const missionId of achievementMissionIdSet()) {
    const mission = Mission.find((row) => row.Id === missionId);
    if (mission) {
      missionProgress[String(mission.Id)] = missionProgressForProfile(profile, String(mission.Id), mission, now);
    }
  }

  profile.missionProgress = missionProgress;
  profile.achievementProgress = Object.fromEntries(
    Achievement.map((achievement) => [achievement.id, achievementProgressForProfile(profile, achievement, now)])
  );
}

export function missionProgressForProfile(
  profile: PlayerProfile,
  taskId: string,
  mission: BidKingMissionRow = missionRowForTask(taskId) as BidKingMissionRow,
  now = Date.now()
): MissionProgressState {
  if (!mission) {
    return {
      taskId,
      missionId: 0,
      current: 0,
      required: 1,
      completed: profile.completedTasks.includes(taskId),
      claimed: profile.claimedMissionRewards.includes(taskId),
      claimable: false,
      redPoint: false,
      reason: '任务配置不存在'
    };
  }

  const results = missionConditionResults(profile, mission, now);
  const period = missionPeriodState(mission, now);
  const primary = results.find((result) => !result.ok) ?? results[0];
  const prerequisitesMet = missionPrerequisitesSatisfied(profile, mission);
  const conditionCompleted = results.every((result) => result.ok);
  const manuallyCompleted = missionCompleted(profile, taskId, mission, now);
  const completed = manuallyCompleted || (conditionCompleted && prerequisitesMet);
  const claimed = missionClaimed(profile, taskId, mission, now);
  const reason = missionProgressReason(primary, completed, claimed, prerequisitesMet);

  return {
    taskId,
    missionId: mission.Id,
    refreshType: mission.refreshtype || undefined,
    periodKey: period?.periodKey,
    resetAt: period?.resetAt,
    current: Math.max(0, Math.floor(primary?.currentValue ?? (completed ? 1 : 0))),
    required: Math.max(1, Math.floor(primary?.requiredValue ?? 1)),
    completed,
    claimed,
    claimable: completed && !claimed,
    redPoint: completed && !claimed,
    reason
  };
}

export function achievementProgressForProfile(
  profile: PlayerProfile,
  achievement: AchievementMissionSource & { id: string },
  now = Date.now()
): AchievementProgressState {
  const missionIds = achievementMissionIds(achievement);
  const states = missionIds
    .map((missionId) => Mission.find((mission) => mission.Id === missionId))
    .filter((mission): mission is BidKingMissionRow => Boolean(mission))
    .map((mission) => missionProgressForProfile(profile, String(mission.Id), mission, now));
  const completed = states.filter((state) => state.completed).length;
  const claimed = missionIds.filter((missionId) => profile.claimedAchievements?.includes(String(missionId))).length;
  const nextClaimable = states.find((state) => state.completed && !profile.claimedAchievements?.includes(String(state.missionId)));
  const nextIncomplete = states.find((state) => !state.completed);
  const total = missionIds.length;
  const reason = nextClaimable
    ? undefined
    : claimed >= total && total > 0
      ? '已领完'
      : nextIncomplete?.reason ?? '成就尚未完成';

  return {
    achievementId: achievement.id,
    total,
    completed,
    claimed,
    claimable: Boolean(nextClaimable),
    redPoint: Boolean(nextClaimable),
    nextMissionId: nextClaimable?.missionId ?? nextIncomplete?.missionId,
    reason
  };
}

export function isMissionSatisfied(profile: PlayerProfile, mission: (typeof Mission)[number]): boolean {
  return missionProgressForProfile(profile, String(mission.Id), mission).completed;
}

function achievementMissionIdSet(): number[] {
  return [...new Set(Achievement.flatMap((achievement) => achievementMissionIds(achievement)))];
}

function missionConditionResults(profile: PlayerProfile, mission: BidKingMissionRow, now: number): ConditionCheckResult[] {
  if (mission.conditions.length === 0) {
    return [{
      ok: true,
      conditionId: mission.Id,
      conditionType: 1,
      currentValue: 1,
      requiredValue: 1,
      label: mission.packaged_desc
    }];
  }
  const context = conditionContextForProfile(profile, now);
  return mission.conditions.map((conditionRow) => evaluateBidKingCondition(missionConditionRow(conditionRow, mission), context));
}

function missionConditionRow(conditionTuple: readonly number[], mission: BidKingMissionRow): BidKingConditionRow {
  const [conditionId = 0, requiredValue = 0, ...rawParams] = conditionTuple;
  const base = Condition.find((candidate) => candidate.id === conditionId);
  if (!base) {
    return {
      id: conditionId,
      type: 0,
      preorconditions: [],
      preorconditionsparam: [],
      preconditions: [],
      preconditionsparam: [],
      condition: conditionId,
      conditionparams: rawParams,
      divided: 1,
      maxvalue: Math.max(1, requiredValue),
      desc: `mission_${mission.Id}_${conditionId}`,
      packaged_desc: mission.packaged_desc
    };
  }
  return {
    ...base,
    conditionparams: missionConditionParams(base, rawParams),
    maxvalue: requiredValue > 0 ? requiredValue : base.maxvalue,
    packaged_desc: mission.packaged_desc || base.packaged_desc
  };
}

function missionConditionParams(base: BidKingConditionRow, rawParams: readonly number[]): readonly number[] {
  const params = rawParams.filter((value) => Number.isFinite(value));
  if (params.some((value) => value > 0)) {
    return params;
  }
  return base.conditionparams;
}

function conditionContextForProfile(profile: PlayerProfile, now: number): ConditionContext {
  const soldMarketOrders = profile.marketOrders.filter((order) => order.status === 'sold');
  const todayKey = profileDailyPeriodKey(now);
  return {
    completedMatches: profile.completedMatches.length,
    level: profile.level,
    collectionLevel: profile.level,
    now,
    inventory: inventoryRecord(profile),
    completedTaskCount: profile.completedTasks.length,
    usedItemCount: profile.conditionStats?.usedItemCount ?? 0,
    dailyUsedItemCount: profile.conditionStats?.dailyUsedItemCount[todayKey] ?? 0,
    usedItemCountsById: profile.conditionStats?.usedItemCountsById,
    auctionAcquiredItemIds: profile.conditionStats?.auctionAcquiredItemIds,
    shopAcquiredItemIds: profile.conditionStats?.shopAcquiredItemIds,
    tradeBoughtCount: profile.conditionStats?.tradeBoughtCount ?? 0,
    tradeSoldCount: profile.conditionStats?.tradeSoldCount ?? soldMarketOrders.length,
    successfulAuctionCount: profile.auctionStats?.successfulAuctionCount ?? profile.completedMatches.length,
    failedAuctionCount: profile.auctionStats?.failedAuctionCount ?? 0,
    highestAuctionBidAmount: profile.auctionStats?.highestBidAmount ?? 0,
    highestSingleAuctionProfit: profile.auctionStats?.highestSingleAuctionProfit ?? 0,
    currentTotalAssets: profile.auctionStats?.currentTotalAssets ?? profile.coins,
    totalAuctionProfit: profile.auctionStats?.totalProfit ?? 0,
    dailyAuctionProfit: profile.auctionStats?.dailyProfit[todayKey] ?? 0,
    highestAuctionItemValue: profile.auctionStats?.highestItemValue ?? 0,
    highestAuctionItemTotalValue: profile.auctionStats?.highestWinningItemTotalValue ?? 0,
    lowestAuctionItemTotalValue: profile.auctionStats?.lowestWinningItemTotalValue,
    completedMapIds: profile.auctionStats?.completedMapIds ?? [],
    completedBidMapIds: profile.auctionStats?.completedBidMapIds ?? [],
    successfulAuctionCountByMap: profile.auctionStats?.successfulAuctionCountByMap,
    lowestAuctionItemTotalValueByMap: profile.auctionStats?.lowestWinningItemTotalValueByMap,
    lowestAuctionItemTotalValueByBidMap: profile.auctionStats?.lowestWinningItemTotalValueByBidMap
  };
}

function mergeAuctionStats(profile: PlayerProfile, summary: FinalMatchSummary, now: number): void {
  const incoming = auctionStatsForProfile(profile, summary);
  const stats = ensureAuctionStats(profile, now);
  const todayKey = profileDailyPeriodKey(now);
  stats.totalProfit += incoming.totalProfit;
  stats.dailyProfit[todayKey] = (stats.dailyProfit[todayKey] ?? 0) + incoming.totalProfit;
  stats.successfulAuctionCount += incoming.successfulAuctionCount;
  stats.failedAuctionCount += incoming.failedAuctionCount ?? 0;
  stats.highestBidAmount = Math.max(stats.highestBidAmount, incoming.highestBidAmount ?? 0);
  stats.highestSingleAuctionProfit = Math.max(stats.highestSingleAuctionProfit, incoming.highestSingleAuctionProfit ?? 0);
  stats.currentTotalAssets = incoming.currentTotalAssets ?? stats.currentTotalAssets;
  stats.highestItemValue = Math.max(stats.highestItemValue, incoming.highestItemValue);
  stats.highestWinningItemTotalValue = Math.max(stats.highestWinningItemTotalValue, incoming.highestWinningItemTotalValue);
  stats.lowestWinningItemTotalValue = minPositive(stats.lowestWinningItemTotalValue, incoming.lowestWinningItemTotalValue);
  stats.completedMapIds = [
    ...new Set([...(stats.completedMapIds ?? []), ...(incoming.completedMapIds ?? [])])
  ];
  stats.completedBidMapIds = [
    ...new Set([...(stats.completedBidMapIds ?? []), ...(incoming.completedBidMapIds ?? [])])
  ];
  stats.successfulAuctionCountByMap ??= {};
  for (const [mapId, count] of Object.entries(incoming.successfulAuctionCountByMap ?? {})) {
    stats.successfulAuctionCountByMap[mapId] = (stats.successfulAuctionCountByMap[mapId] ?? 0) + count;
  }
  stats.lowestWinningItemTotalValueByMap ??= {};
  for (const [mapId, value] of Object.entries(incoming.lowestWinningItemTotalValueByMap ?? {})) {
    stats.lowestWinningItemTotalValueByMap[mapId] = minPositive(
      stats.lowestWinningItemTotalValueByMap[mapId],
      value
    ) ?? value;
  }
  stats.lowestWinningItemTotalValueByBidMap ??= {};
  for (const [bidMapId, value] of Object.entries(incoming.lowestWinningItemTotalValueByBidMap ?? {})) {
    stats.lowestWinningItemTotalValueByBidMap[bidMapId] = minPositive(
      stats.lowestWinningItemTotalValueByBidMap[bidMapId],
      value
    ) ?? value;
  }
  stats.updatedAt = now;
}

function ensureAuctionStats(profile: PlayerProfile, now: number): AuctionStatsState {
  profile.auctionStats ??= {
    totalProfit: 0,
    dailyProfit: {},
    successfulAuctionCount: 0,
    failedAuctionCount: 0,
    highestBidAmount: 0,
    highestSingleAuctionProfit: 0,
    currentTotalAssets: profile.coins,
    highestItemValue: 0,
    highestWinningItemTotalValue: 0,
    completedMapIds: [],
    completedBidMapIds: [],
    successfulAuctionCountByMap: {},
    lowestWinningItemTotalValueByMap: {},
    lowestWinningItemTotalValueByBidMap: {},
    updatedAt: now
  };
  profile.auctionStats.failedAuctionCount ??= 0;
  profile.auctionStats.highestBidAmount ??= 0;
  profile.auctionStats.highestSingleAuctionProfit ??= 0;
  profile.auctionStats.currentTotalAssets ??= profile.coins;
  profile.auctionStats.dailyProfit ??= {};
  profile.auctionStats.completedMapIds ??= [];
  profile.auctionStats.completedBidMapIds ??= [];
  profile.auctionStats.successfulAuctionCountByMap ??= {};
  profile.auctionStats.lowestWinningItemTotalValueByMap ??= {};
  profile.auctionStats.lowestWinningItemTotalValueByBidMap ??= {};
  return profile.auctionStats;
}

function auctionStatsForProfile(profile: PlayerProfile, summary: FinalMatchSummary): FinalPlayerAuctionStats {
  const explicit = summary.auctionStats?.find((candidate) => candidate.playerId === profile.playerId);
  if (explicit) {
    return explicit;
  }
  const ranking = summary.rankings.find((candidate) => candidate.playerId === profile.playerId);
  const initialValue = summary.netWorthCurve[0]?.values[profile.playerId] ?? 0;
  const fallbackProfit = Math.max(0, (ranking?.netWorth ?? 0) - initialValue);
  const highestItemValue = summary.revealedItems.reduce((max, item) => Math.max(max, item.displayValue || item.value), 0);
  return {
    playerId: profile.playerId,
    totalProfit: fallbackProfit,
    netProfit: fallbackProfit,
    successfulAuctionCount: ranking ? 1 : 0,
    failedAuctionCount: 0,
    highestBidAmount: 0,
    highestSingleAuctionProfit: fallbackProfit,
    currentTotalAssets: ranking?.netWorth ?? profile.coins,
    highestItemValue,
    highestWinningItemTotalValue: highestItemValue,
    lowestWinningItemTotalValue: highestItemValue > 0 ? highestItemValue : undefined,
    completedMapIds: [],
    completedBidMapIds: [],
    successfulAuctionCountByMap: {},
    lowestWinningItemTotalValueByMap: {},
    lowestWinningItemTotalValueByBidMap: {}
  };
}

function minPositive(left: number | undefined, right: number | undefined): number | undefined {
  if (right === undefined || right <= 0) {
    return left;
  }
  if (left === undefined || left <= 0) {
    return right;
  }
  return Math.min(left, right);
}

function missionPrerequisitesSatisfied(profile: PlayerProfile, mission: BidKingMissionRow): boolean {
  const prerequisites = mission.premissionids.filter((missionId) => missionId > 0);
  return prerequisites.every((missionId) => missionCompletedOrClaimed(profile, missionId));
}

function missionCompletedOrClaimed(profile: PlayerProfile, missionId: number): boolean {
  const missionKey = String(missionId);
  if (
    profile.completedTasks.includes(missionKey) ||
    profile.claimedMissionRewards.includes(missionKey) ||
    profile.claimedAchievements?.includes(missionKey)
  ) {
    return true;
  }
  return PROFILE_TASK_IDS.some((taskId) => {
    const mission = missionRowForTask(taskId);
    return mission?.Id === missionId && (
      profile.completedTasks.includes(taskId) ||
      profile.claimedMissionRewards.includes(taskId)
    );
  });
}

function missionCompleted(profile: PlayerProfile, taskId: string, mission: BidKingMissionRow, now: number): boolean {
  const completionKey = missionCompletionKey(taskId, mission, now);
  return profile.completedTasks.includes(completionKey) || profile.completedTasks.includes(String(mission.Id));
}

function missionCompletionKey(taskId: string, mission: BidKingMissionRow | undefined, now: number): string {
  if (!mission || !isRefreshableMission(mission)) {
    return taskId;
  }
  return missionPeriodClaimKey(mission, now);
}

function missionClaimed(profile: PlayerProfile, taskId: string, mission: BidKingMissionRow, now: number): boolean {
  if (isRefreshableMission(mission)) {
    return profile.missionRewardClaims?.[missionClaimRecordKey(mission)]?.periodKey === missionPeriodKey(mission, now);
  }
  return (
    profile.claimedMissionRewards.includes(taskId) ||
    profile.claimedMissionRewards.includes(String(mission.Id)) ||
    profile.claimedAchievements?.includes(String(mission.Id)) === true
  );
}

function recordMissionClaim(profile: PlayerProfile, taskId: string, mission: BidKingMissionRow, now: number): void {
  profile.missionRewardClaims ??= {};
  const claimKey = isRefreshableMission(mission) ? missionPeriodClaimKey(mission, now) : taskId;
  if (!profile.claimedMissionRewards.includes(claimKey)) {
    profile.claimedMissionRewards.push(claimKey);
  }
  if (isRefreshableMission(mission)) {
    profile.missionRewardClaims[missionClaimRecordKey(mission)] = {
      taskId,
      missionId: mission.Id,
      periodKey: missionPeriodKey(mission, now),
      claimedAt: now
    };
  }
}

function missionRewardSourcePrefix(profile: PlayerProfile, taskId: string, mission: BidKingMissionRow, now: number): string {
  const sourceKey = isRefreshableMission(mission) ? missionPeriodClaimKey(mission, now) : taskId;
  return `mission:${profile.playerId}:${sourceKey}:${mission.Id}`;
}

function missionClaimRecordKey(mission: BidKingMissionRow): string {
  return String(mission.Id);
}

function isRefreshableMission(mission: BidKingMissionRow): boolean {
  return mission.refreshtype > 0;
}

function missionPeriodClaimKey(mission: BidKingMissionRow, now: number): string {
  return `${mission.Id}@${missionPeriodKey(mission, now)}`;
}

function missionPeriodState(mission: BidKingMissionRow, now: number): { periodKey: string; resetAt: number } | undefined {
  if (!isRefreshableMission(mission)) {
    return undefined;
  }
  return {
    periodKey: missionPeriodKey(mission, now),
    resetAt: missionPeriodResetAt(mission, now)
  };
}

function missionPeriodKey(mission: BidKingMissionRow, now: number): string {
  if (mission.refreshtype === 2) {
    return `weekly:${periodStartDate(now, 7)}`;
  }
  return profileDailyPeriodKey(now);
}

function profileDailyPeriodKey(now: number): string {
  return `daily:${periodStartDate(now, 1)}`;
}

function missionPeriodResetAt(mission: BidKingMissionRow, now: number): number {
  const periodDays = mission.refreshtype === 2 ? 7 : 1;
  return periodStartUtcMs(now, periodDays) + periodDays * DAY_MS;
}

function periodStartDate(now: number, periodDays: 1 | 7): string {
  const start = periodStartUtcMs(now, periodDays) + SHANGHAI_OFFSET_MS;
  return new Date(start).toISOString().slice(0, 10);
}

function periodStartUtcMs(now: number, periodDays: 1 | 7): number {
  const shifted = now + SHANGHAI_OFFSET_MS;
  const dayStart = Math.floor(shifted / DAY_MS) * DAY_MS;
  if (periodDays === 1) {
    return dayStart - SHANGHAI_OFFSET_MS;
  }
  const day = new Date(dayStart).getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return dayStart - daysSinceMonday * DAY_MS - SHANGHAI_OFFSET_MS;
}

function missionProgressReason(
  primary: ConditionCheckResult | undefined,
  completed: boolean,
  claimed: boolean,
  prerequisitesMet: boolean
): string | undefined {
  if (claimed) {
    return '已领取';
  }
  if (!prerequisitesMet) {
    return '需先完成前置任务';
  }
  if (!completed) {
    return primary?.reason ?? '任务尚未完成';
  }
  return undefined;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

export function xpForLevel(level: number): number {
  return LevelUp.find((entry) => entry.id === level)?.collection_value ?? Math.max(120, level * level * 120);
}
