import { BidMap, Hero } from '@bitkingdom/bidking-compat';
import type {
  BidKingBoxInfoDataSnapshot,
  BidKingBoxPositionDataSnapshot,
  BidKingGameDataSnapshot,
  BidKingGameSkillDataSnapshot,
  BidKingGameUseItemOrPriceDataSnapshot,
  BidKingGameUserDataSnapshot,
  BidKingStockBoxDataSnapshot,
  BidKingStockContainerDataSnapshot,
  RevealedItem,
  RoundHistoryEntry,
  SkillFeedEntry
} from '@bitkingdom/shared';
import type { MatchRuntimeState, RuntimePlayer, RuntimeRound, WarehouseSlot } from '../types';

export function buildBidKingGameDataSnapshot(
  state: MatchRuntimeState,
  round: RuntimeRound,
  previousRounds: readonly RoundHistoryEntry[] = state.roundHistory
): BidKingGameDataSnapshot {
  const bidMapId = bidMapIdForState(state, round);
  const userLog = state.players.map((player) => buildGameUserLog(state, round, previousRounds, player));
  const leader = userLog.find((user) => user.playerId === round.bidFeedback?.leaderPlayerId);
  const skillLogs = buildSkillLogs(state, round, previousRounds);
  const now = state.updatedAt || Date.now();

  return {
    uid: `${state.id}:${round.id}`,
    mapId: bidMapId,
    round: round.index + 1,
    stockContainer: buildStockContainer(state, round),
    userLog,
    heroSkillLog: skillLogs.hero,
    mapSkillLog: skillLogs.map,
    itemSkillLog: skillLogs.item,
    nextRoundTime: round.phaseEndsAt,
    selectItemCount: selectedItemCount(userLog),
    roundCanUseItemCount: 1,
    gameCarryItemMax: 3,
    gameGoldRateMax: 0,
    gameType: state.coreMode ? 1 : 0,
    sendAuctionUserUid: leader?.userUid ?? 0,
    sendAuctionUserName: leader?.name ?? '',
    sendAuctionUserHead: leader?.headCid ?? 0,
    sendAuctionHeadBox: leader?.headBoxCid ?? 0,
    sendAuctionUserTitle: leader?.titleCid ?? 0,
    serverTime: now
  };
}

function buildGameUserLog(
  state: MatchRuntimeState,
  round: RuntimeRound,
  previousRounds: readonly RoundHistoryEntry[],
  player: RuntimePlayer
): BidKingGameUserDataSnapshot {
  const hero = Hero.find((candidate) => candidate.id === player.heroCid) ?? Hero[player.seat % Hero.length];
  const priceLog = [
    ...previousRounds.map((history) => history.bids.find((bid) => bid.playerId === player.id)),
    round.bids.find((bid) => bid.playerId === player.id)
  ]
    .map((bid, index): BidKingGameUseItemOrPriceDataSnapshot | undefined => (
      bid
        ? { round: index + 1, itemCidOrPrice: bid.amount, createdAt: bid.createdAt }
        : undefined
    ))
    .filter((entry): entry is BidKingGameUseItemOrPriceDataSnapshot => Boolean(entry));

  return {
    userUid: stableNumericId(player.id),
    playerId: player.id,
    name: player.name,
    heroCid: hero?.id ?? 0,
    useItemLog: battleItemUseLogs(state, player.id),
    priceLog,
    isStandDown: player.passed,
    isQuit: player.status === 'disconnected',
    headCid: 0,
    heroSkinCid: player.heroSkinCid ?? 0,
    selectItemList: player.selectedItemList?.map((entry) => ({ ...entry })) ?? [],
    headBoxCid: 0,
    titleCid: 0,
    remark: ''
  };
}

function battleItemUseLogs(state: MatchRuntimeState, playerId: string): BidKingGameUseItemOrPriceDataSnapshot[] {
  return state.events
    .filter((event) => event.type === 'battle_item_used' && event.actorId === playerId)
    .map((event): BidKingGameUseItemOrPriceDataSnapshot | undefined => {
      const payload = event.payload as { itemId?: unknown } | undefined;
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0;
      if (itemId <= 0) {
        return undefined;
      }
      return {
        round: roundNumberForEvent(state, event.roundId),
        itemCidOrPrice: itemId,
        createdAt: event.createdAt,
        sourceEventId: event.id
      };
    })
    .filter((entry): entry is BidKingGameUseItemOrPriceDataSnapshot => Boolean(entry));
}

function buildStockContainer(state: MatchRuntimeState, round: RuntimeRound): BidKingStockContainerDataSnapshot {
  const stockBoxes = round.container.warehouseSlots.map((slot, index): BidKingStockBoxDataSnapshot => {
    const itemCid = itemCidFromRevealedItem(slot.item);
    const position = { x: slot.x, y: slot.y };
    return {
      boxId: index + 1,
      position,
      item: {
        uid: stableNumericId(`${round.id}:${slot.item.id}`),
        cid: itemCid,
        count: 1,
        boxPositionData: footprintPositions(slot),
        rotate: false,
        canTrade: true,
        no: index + 1,
        isLock: false,
        quality: qualityFromItem(slot.item),
        sourceItemId: slot.item.id
      }
    };
  });

  return {
    stockId: stableNumericId(`${state.id}:${round.container.id}`),
    stockCid: bidMapIdForState(state, round),
    stockBoxes,
    cabinetLastGetRewardTime: 0,
    cabinetCumulativeReward: 0,
    cabinetBasicReward: 0,
    cabinetReward: 0
  };
}

function footprintPositions(slot: WarehouseSlot): BidKingBoxPositionDataSnapshot[] {
  const positions: BidKingBoxPositionDataSnapshot[] = [];
  for (let y = 0; y < slot.h; y += 1) {
    for (let x = 0; x < slot.w; x += 1) {
      positions.push({ x: slot.x + x, y: slot.y + y });
    }
  }
  return positions;
}

function buildSkillLogs(
  state: MatchRuntimeState,
  round: RuntimeRound,
  previousRounds: readonly RoundHistoryEntry[]
): { hero: BidKingGameSkillDataSnapshot[]; map: BidKingGameSkillDataSnapshot[]; item: BidKingGameSkillDataSnapshot[] } {
  const feed = [
    ...previousRounds.flatMap((history) => history.skillFeed ?? []),
    ...round.skillFeed
  ];
  const logs = feed.map((entry, index) => skillFeedToGameSkillLog(state, round, entry, index + 1));
  const eventItemLogs = battleItemEventSkillLogs(state, round);
  const eventFeedIds = new Set(eventItemLogs.map((entry) => entry.sourceFeedId).filter(Boolean));
  return {
    hero: logs.filter((entry) => entry.kind === 'hero').map((entry) => entry.log),
    map: logs.filter((entry) => entry.kind === 'map').map((entry) => entry.log),
    item: [
      ...logs
        .filter((entry) => entry.kind === 'item' && !eventFeedIds.has(entry.log.sourceFeedId))
        .map((entry) => entry.log),
      ...eventItemLogs
    ]
  };
}

function skillFeedToGameSkillLog(
  state: MatchRuntimeState,
  round: RuntimeRound,
  entry: SkillFeedEntry,
  uidSalt: number
): { kind: 'hero' | 'item' | 'map'; log: BidKingGameSkillDataSnapshot } {
  const player = entry.playerId ? state.players.find((candidate) => candidate.id === entry.playerId) : undefined;
  const hero = player ? Hero.find((candidate) => candidate.id === player.heroCid) ?? Hero[player.seat % Hero.length] : undefined;
  const hitSlots = hitSlotsForEntry(round, entry);
  const hitBoxList = hitSlots.map((slot, index) => boxInfoForSlot(slot, round, index));
  const hitItemTotalPrice = hitSlots.reduce((sum, slot) => sum + slot.item.value, 0);
  const boxCellCount = hitSlots.reduce((sum, slot) => sum + Math.max(1, slot.w * slot.h), 0);
  const itemQualities = [...new Set(hitSlots.map((slot) => qualityFromItem(slot.item)))];

  const log: BidKingGameSkillDataSnapshot = {
    skillCid: stableNumericId(entry.skillName) % 1_000_000,
    heroCid: hero?.id ?? 0,
    mapCid: entry.source === 'map' ? bidMapIdForState(state, round) : 0,
    itemCid: entry.source === 'item' ? stableNumericId(entry.sourceName) % 1_000_000 : 0,
    castTime: entry.createdAt,
    castRound: entry.round,
    hitItemIndex: hitSlots[0] ? round.container.warehouseSlots.indexOf(hitSlots[0]) + 1 : 0,
    hitBoxList,
    allHitItemAvgPrice: hitSlots.length > 0 ? hitItemTotalPrice / hitSlots.length : 0,
    allHitBoxAvgPrice: boxCellCount > 0 ? hitItemTotalPrice / boxCellCount : 0,
    allHitItemAvgBoxIndex: hitSlots.length > 0
      ? hitSlots.reduce((sum, slot) => sum + round.container.warehouseSlots.indexOf(slot) + 1, 0) / hitSlots.length
      : 0,
    hitItemTotalPrice,
    uid: stableNumericId(`${entry.id}:${uidSalt}`),
    totalHitBoxIndex: boxCellCount,
    hitItemTypeList: [...new Set(hitSlots.map((slot) => itemCidFromRevealedItem(slot.item)))],
    hitItemQuilityList: itemQualities,
    sourceFeedId: entry.id
  };
  return { kind: entry.source === 'item' ? 'item' : entry.source === 'map' ? 'map' : 'hero', log };
}

function battleItemEventSkillLogs(state: MatchRuntimeState, round: RuntimeRound): BidKingGameSkillDataSnapshot[] {
  return state.events
    .filter((event) => event.type === 'battle_item_used')
    .map((event, index): BidKingGameSkillDataSnapshot | undefined => {
      const payload = event.payload as {
        itemId?: unknown;
        effectPlan?: { skillId?: unknown; targetCount?: unknown };
        entry?: { id?: unknown };
      } | undefined;
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0;
      if (itemId <= 0) {
        return undefined;
      }
      const player = event.actorId ? state.players.find((candidate) => candidate.id === event.actorId) : undefined;
      const hero = player ? Hero.find((candidate) => candidate.id === player.heroCid) ?? Hero[player.seat % Hero.length] : undefined;
      const targetCount = typeof payload?.effectPlan?.targetCount === 'number' ? payload.effectPlan.targetCount : 1;
      const hitSlots = round.container.warehouseSlots.slice(0, Math.max(1, Math.min(targetCount, round.container.warehouseSlots.length)));
      const hitItemTotalPrice = hitSlots.reduce((sum, slot) => sum + slot.item.value, 0);
      const boxCellCount = hitSlots.reduce((sum, slot) => sum + Math.max(1, slot.w * slot.h), 0);
      return {
        skillCid: typeof payload?.effectPlan?.skillId === 'number' ? payload.effectPlan.skillId : 0,
        heroCid: hero?.id ?? 0,
        mapCid: 0,
        itemCid: itemId,
        castTime: event.createdAt,
        castRound: roundNumberForEvent(state, event.roundId),
        hitItemIndex: hitSlots[0] ? round.container.warehouseSlots.indexOf(hitSlots[0]) + 1 : 0,
        hitBoxList: hitSlots.map((slot, slotIndex) => boxInfoForSlot(slot, round, slotIndex)),
        allHitItemAvgPrice: hitSlots.length > 0 ? hitItemTotalPrice / hitSlots.length : 0,
        allHitBoxAvgPrice: boxCellCount > 0 ? hitItemTotalPrice / boxCellCount : 0,
        allHitItemAvgBoxIndex: hitSlots.length > 0
          ? hitSlots.reduce((sum, slot) => sum + round.container.warehouseSlots.indexOf(slot) + 1, 0) / hitSlots.length
          : 0,
        hitItemTotalPrice,
        uid: stableNumericId(`${event.id}:${index}`),
        totalHitBoxIndex: boxCellCount,
        hitItemTypeList: [...new Set(hitSlots.map((slot) => itemCidFromRevealedItem(slot.item)))],
        hitItemQuilityList: [...new Set(hitSlots.map((slot) => qualityFromItem(slot.item)))],
        sourceFeedId: typeof payload?.entry?.id === 'string' ? payload.entry.id : undefined,
        sourceEventId: event.id
      };
    })
    .filter((entry): entry is BidKingGameSkillDataSnapshot => Boolean(entry));
}

function hitSlotsForEntry(round: RuntimeRound, entry: SkillFeedEntry): WarehouseSlot[] {
  const targetIds = new Set(entry.targetItemIds ?? []);
  if (targetIds.size === 0) {
    return [];
  }
  return round.container.warehouseSlots.filter((slot) => targetIds.has(slot.item.id));
}

function boxInfoForSlot(slot: WarehouseSlot, round: RuntimeRound, index: number): BidKingBoxInfoDataSnapshot {
  const itemCid = itemCidFromRevealedItem(slot.item);
  return {
    boxId: round.container.warehouseSlots.indexOf(slot) + 1,
    itemUid: stableNumericId(`${round.id}:${slot.item.id}`),
    itemCid,
    itemSlotType: Math.max(1, slot.w * 10 + slot.h),
    itemType: [itemCid],
    itemQuility: qualityFromItem(slot.item),
    itemPrice: slot.item.value,
    itemBoxIndex: index + 1
  };
}

function selectedItemCount(userLog: readonly BidKingGameUserDataSnapshot[]): number {
  return userLog.reduce((sum, user) => sum + user.selectItemList.length, 0);
}

function roundNumberForEvent(state: MatchRuntimeState, roundId: string | undefined): number {
  const previous = state.roundHistory.find((history) => history.roundId === roundId);
  if (previous) {
    return previous.index + 1;
  }
  const currentRound = state.currentRound;
  if (currentRound && currentRound.id === roundId) {
    return currentRound.index + 1;
  }
  return 0;
}

function bidMapIdForState(state: MatchRuntimeState, round: RuntimeRound): number {
  if (state.coreBidMapId !== undefined) {
    return state.coreBidMapId;
  }
  const templateMatch = /bidmap_(\d+)/.exec(round.container.templateId);
  if (templateMatch?.[1]) {
    return Number(templateMatch[1]);
  }
  const firstBidMap = BidMap[0]?.id;
  return firstBidMap ?? stableNumericId(round.container.templateId);
}

function itemCidFromRevealedItem(item: RevealedItem): number {
  const compatMatch = /^compat_(\d+)(?:_|$)/.exec(item.id);
  if (compatMatch?.[1]) {
    return Number(compatMatch[1]);
  }
  const numericMatch = /(\d+)/.exec(item.id);
  return numericMatch?.[1] ? Number(numericMatch[1]) : stableNumericId(item.id);
}

function qualityFromItem(item: RevealedItem): number {
  switch (item.rarity) {
    case 'legendary':
      return 5;
    case 'rare':
      return 4;
    case 'fine':
      return 3;
    case 'common':
      return 2;
    case 'fake':
      return 0;
    case 'junk':
    default:
      return 1;
  }
}

function stableNumericId(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.max(1, hash >>> 0);
}
