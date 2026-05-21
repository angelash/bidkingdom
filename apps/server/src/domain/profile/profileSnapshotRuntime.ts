import {
  Activity,
  Area,
  ExchangeRestock,
  GuildArea,
  GuildResources,
  Item,
  NumberTable,
  Rank,
  ShopItem,
  Sim,
  activityClaimState,
  activityRewardRows,
  bidKingGuildResourceRuntime
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile, RankSnapshot } from '@bitkingdom/shared';
import { collectionIncomeSnapshot } from './profileCollectionRuntime';
import { languageNamesFromSeed } from './languageNameRuntime';
import { ensureProfileShape } from './profileShape';
import { parseNumberArray } from './profileNumber';

export interface AreaSnapshot {
  generatedAt: number;
  areas: Array<{
    areaId: string;
    areaName: string;
    guildAreaId?: string;
    guildResourceId?: string;
    guildResourceName?: string;
    guildResourceType?: number;
    guildResourceUsage?: string;
    guildResourceKey?: string;
    guildCount: number;
    points: number;
    recommendedNames: string[];
  }>;
}

export interface CollectionBonusSnapshot {
  playerId: string;
  codexCount: number;
  activeBonus: number;
  cabinetHourlyCoins: number;
  claimableCoins: number;
  collectionCountMax: number;
  duplicateRatesPerMille: number[];
  gainIntervalSeconds: number;
  incomeElapsedMs: number;
  lastCollectionIncomeAt: number;
  nextCollectionIncomeAt: number;
  tiers: Array<{
    id: number;
    counts: number;
    quality: number;
    bonus: number;
    active: boolean;
  }>;
}

export interface ExchangeRestockSnapshot {
  generatedAt: number;
  pools: Array<{
    exchangeId: string;
    shopId: number;
    shopItemIds: number[];
    itemIds: number[];
    itemNames: string[];
    offers: Array<{
      shopItemId: number;
      itemId: number;
      itemName: string;
      price: Array<{
        refId: number;
        quantity: number;
        name: string;
      }>;
    }>;
  }>;
}

export interface SimSnapshot {
  generatedAt: number;
  plans: Array<{
    id: string;
    bidRange: number[];
    base: number;
    itemId: string;
    botCount: number;
    roomBotCount: number;
    roundCount: number;
  }>;
}

export interface ActivityProgressSnapshot {
  playerId: string;
  generatedAt: number;
  redPointCount: number;
  activities: ActivityProgressEntry[];
}

export interface ActivityProgressEntry {
  activityId: string;
  name: string;
  description: string;
  type: number;
  sort: number;
  timeType: number;
  path: number;
  banner: string;
  panelName: string;
  image: string;
  pageIcon: string;
  rewardRows: number[][];
  hasReward: boolean;
  claimed: boolean;
  active: boolean;
  expired: boolean;
  claimable: boolean;
  redPoint: boolean;
  reason: string;
  progress: number;
  target: number;
  completed: boolean;
  progressLabel: string;
  actionTarget?: 'claim' | 'rank' | 'friend' | 'club' | 'pass';
  startedAt: number;
  durationSeconds?: number;
  expiresAt?: number;
  remainingMs?: number;
}

export function buildRankSnapshot(
  profiles: PlayerProfile[],
  rankId = Rank[0]?.id ?? 'local',
  page = 1,
  pageSize = 8
): RankSnapshot {
  const rankRow = Rank.find((row) => row.id === rankId) ?? Rank[0];
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const safePage = Math.max(1, Math.floor(page));
  const allEntries = profiles
    .map((profile) => {
      ensureProfileShape(profile);
      return {
        playerId: profile.playerId,
        name: profile.name,
        rankPoints: profile.rankPoints,
        level: profile.level,
        completedMatches: profile.completedMatches.length,
        coins: profile.coins,
        updatedAt: profile.updatedAt
      };
    })
    .sort((left, right) =>
      right.rankPoints - left.rankPoints ||
      right.completedMatches - left.completedMatches ||
      right.coins - left.coins ||
      right.updatedAt - left.updatedAt
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  const totalEntries = allEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / safePageSize));
  const pageEntries = allEntries.slice((Math.min(safePage, totalPages) - 1) * safePageSize, Math.min(safePage, totalPages) * safePageSize);
  return {
    rankId,
    title: rankRow?.packaged_name ?? '本地排行榜',
    description: rankRow?.packaged_desc ?? '',
    isRegional: rankRow?.columns[5] === '1',
    isDated: rankRow?.columns[6] === '1',
    isRoleBased: rankRow?.columns[7] === '1',
    sortDirection: rankRow?.columns[8] === '1' ? 'asc' : 'desc',
    rankType: Number(rankRow?.columns[9] ?? 0) || 0,
    generatedAt: Date.now(),
    page: Math.min(safePage, totalPages),
    pageSize: safePageSize,
    totalEntries,
    totalPages,
    entries: pageEntries
  };
}

export function buildAreaSnapshot(profiles: PlayerProfile[]): AreaSnapshot {
  const areas = Area.map((area) => {
    const guildArea = GuildArea.find((row) => row.id === area.id);
    const resource = GuildResources.find((row) => row.id === guildArea?.columns[3]);
    const resourceRuntime = resource ? bidKingGuildResourceRuntime(resource) : undefined;
    const members = profiles.filter((profile) => profile.guildMembership?.areaId === (guildArea?.id ?? area.id));
    return {
      areaId: area.id,
      areaName: area.packaged_name,
      guildAreaId: guildArea?.id,
      guildResourceId: resource?.id,
      guildResourceName: resource?.packaged_name,
      guildResourceType: resourceRuntime?.typeCode,
      guildResourceUsage: resourceRuntime?.usageLabel,
      guildResourceKey: resourceRuntime?.iconKey || resourceRuntime?.displayKey,
      guildCount: members.length,
      points: members.reduce((sum, profile) => sum + (profile.guildMembership?.points ?? 0), 0),
      recommendedNames: languageNamesFromSeed((Number(guildArea?.id ?? area.id) || 0) * 10, 3)
    };
  }).sort((left, right) => right.points - left.points || right.guildCount - left.guildCount || Number(left.areaId) - Number(right.areaId));
  return {
    generatedAt: Date.now(),
    areas
  };
}

export function buildCollectionBonus(profile: PlayerProfile): CollectionBonusSnapshot {
  const codexCount = profile.codex.length;
  const tiers = NumberTable.map((row) => ({
    id: row.Id,
    counts: row.counts,
    quality: row.quality,
    bonus: row.numberbonus,
    active: codexCount >= row.counts
  }));
  const income = collectionIncomeSnapshot(profile);
  return {
    playerId: profile.playerId,
    codexCount,
    activeBonus: tiers.filter((tier) => tier.active).reduce((sum, tier) => sum + tier.bonus, 0),
    cabinetHourlyCoins: income.cabinetHourlyCoins,
    claimableCoins: income.claimableCoins,
    collectionCountMax: income.collectionCountMax,
    duplicateRatesPerMille: income.duplicateRatesPerMille,
    gainIntervalSeconds: income.gainIntervalSeconds,
    incomeElapsedMs: income.elapsedMs,
    lastCollectionIncomeAt: income.lastClaimedAt,
    nextCollectionIncomeAt: income.nextClaimAt,
    tiers
  };
}

export function buildActivityProgressSnapshot(profile: PlayerProfile, now = Date.now()): ActivityProgressSnapshot {
  ensureProfileShape(profile);
  const activities = Activity
    .map((activity) => activityProgressEntry(profile, activity, now))
    .sort((left, right) => left.sort - right.sort || Number(left.activityId) - Number(right.activityId));
  return {
    playerId: profile.playerId,
    generatedAt: now,
    redPointCount: activities.filter((activity) => activity.redPoint).length,
    activities
  };
}

export function buildExchangeRestockSnapshot(): ExchangeRestockSnapshot {
  const pools = ExchangeRestock.map((row) => {
    const shopId = Number(row.id);
    const shopItems = ShopItem.filter((shopItem) => shopItem.shopid === shopId);
    const itemIds = uniqueNumbers([
      ...Item.filter((item) => item.exchangeId.includes(Number(row.id))).map((item) => item.id),
      ...shopItems.flatMap((shopItem) => shopItem.itemid.map((entry) => entry[0] ?? 0))
    ]).filter((itemId) => itemId > 0);
    const items = itemIds
      .map((itemId) => Item.find((item) => item.id === itemId))
      .filter((item): item is (typeof Item)[number] => Boolean(item));
    return {
      exchangeId: row.id,
      shopId,
      shopItemIds: shopItems.map((shopItem) => shopItem.id),
      itemIds: items.map((item) => item.id),
      itemNames: items.slice(0, 8).map((item) => item.packaged_name),
      offers: shopItems.slice(0, 8).map((shopItem) => {
        const itemId = shopItem.itemid[0]?.[0] ?? 0;
        return {
          shopItemId: shopItem.id,
          itemId,
          itemName: Item.find((item) => item.id === itemId)?.packaged_name ?? `道具${itemId}`,
          price: shopItem.price
            .map((price) => ({
              refId: Number(price[0] ?? 0),
              quantity: Number(price[1] ?? price[2] ?? 0),
              name: priceName(Number(price[0] ?? 0))
            }))
            .filter((price) => price.refId > 0 && price.quantity > 0)
        };
      })
    };
  });
  return {
    generatedAt: Date.now(),
    pools
  };
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)];
}

function priceName(refId: number): string {
  if (refId === 1) {
    return '铜钱';
  }
  return Item.find((item) => item.id === refId)?.packaged_name ?? `道具${refId}`;
}

export function buildSimSnapshot(): SimSnapshot {
  return {
    generatedAt: Date.now(),
    plans: Sim.map((row) => {
      const bidRange = parseNumberArray(row.columns[3]);
      return {
        id: row.id,
        bidRange,
        base: Number(row.columns[4] ?? 0) || 0,
        itemId: row.columns[5] ?? '',
        botCount: Number(row.columns[6] ?? 0) || 0,
        roomBotCount: Math.max(0, Math.min(3, Number(row.columns[6] ?? 0) || 0)),
        roundCount: Number(row.columns[7] ?? 0) || 0
      };
    })
  };
}

function activityProgressEntry(
  profile: PlayerProfile,
  activity: (typeof Activity)[number],
  now: number
): ActivityProgressEntry {
  const claimed = profile.claimedActivityRewards.includes(activity.id);
  const claim = activityClaimState(activity, {
    claimed,
    profileCreatedAt: profile.createdAt,
    now
  });
  const rewardRows = activityRewardRows(activity);
  const domain = activityProgressDomain(activity);
  const progress = activityProgressForDomain(profile, domain, claim);
  const completed = progress.current >= progress.target;
  return {
    activityId: activity.id,
    name: activity.packaged_name,
    description: activity.packaged_desc,
    type: Number(activity.columns[2] ?? 0) || 0,
    sort: Number(activity.columns[3] ?? 0) || 0,
    timeType: Number(activity.columns[6] ?? 0) || 0,
    path: Number(activity.columns[7] ?? 0) || 0,
    banner: activity.columns[8] ?? '',
    panelName: activity.columns[9] ?? '',
    image: activity.columns[10] ?? '',
    pageIcon: activity.columns[13] ?? '',
    rewardRows,
    hasReward: claim.hasReward,
    claimed,
    active: claim.active,
    expired: !claim.active,
    claimable: claim.claimable,
    redPoint: claim.redPoint,
    reason: claim.reason,
    progress: Math.min(progress.current, progress.target),
    target: progress.target,
    completed,
    progressLabel: progress.label,
    actionTarget: claim.claimable ? 'claim' : progress.actionTarget,
    startedAt: claim.window.startedAt,
    durationSeconds: claim.window.durationSeconds,
    expiresAt: claim.window.expiresAt,
    remainingMs: claim.window.remainingMs
  };
}

function activityProgressDomain(activity: (typeof Activity)[number]): 'reward' | 'rank' | 'social' | 'pass' {
  const panelName = (activity.columns[9] ?? '').toLowerCase();
  const type = Number(activity.columns[2] ?? 0) || 0;
  if (activityRewardRows(activity).length > 0) {
    return 'reward';
  }
  if (panelName.includes('rank') || type === 2) {
    return 'rank';
  }
  if (panelName.includes('social') || type === 3) {
    return 'social';
  }
  return 'pass';
}

function activityProgressForDomain(
  profile: PlayerProfile,
  domain: ReturnType<typeof activityProgressDomain>,
  claim: ReturnType<typeof activityClaimState>
): { current: number; target: number; label: string; actionTarget?: ActivityProgressEntry['actionTarget'] } {
  if (domain === 'reward') {
    const current = claim.claimed || claim.claimable ? 1 : 0;
    return {
      current,
      target: 1,
      label: claim.claimed ? '奖励已领取' : claim.claimable ? '奖励待领取' : claim.reason,
      actionTarget: claim.claimable ? 'claim' : undefined
    };
  }
  if (domain === 'rank') {
    const target = Math.max(100, Math.ceil((profile.rankPoints + 1) / 100) * 100);
    return {
      current: Math.max(0, profile.rankPoints),
      target,
      label: `段位积分 ${profile.rankPoints.toLocaleString()} / ${target.toLocaleString()}`,
      actionTarget: 'rank'
    };
  }
  if (domain === 'social') {
    const friendStep = profile.friends.length > 0 ? 1 : 0;
    const guildStep = profile.guildMembership ? 1 : 0;
    return {
      current: friendStep + guildStep,
      target: 2,
      label: `好友 ${profile.friends.length} · 协会 ${profile.guildMembership ? '已加入' : '未加入'}`,
      actionTarget: profile.guildMembership ? 'friend' : 'club'
    };
  }
  return {
    current: Math.min(1, profile.completedMatches.length),
    target: 1,
    label: `完成对局 ${profile.completedMatches.length}`,
    actionTarget: 'pass'
  };
}
