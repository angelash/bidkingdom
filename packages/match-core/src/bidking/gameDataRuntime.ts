import { BidMap, Hero, itemById } from '@bitkingdom/bidking-compat';
import type {
  BidKingBoxInfoDataSnapshot,
  BidKingBoxPositionDataSnapshot,
  BidKingGameDataSnapshot,
  BidKingGameSkillDataSnapshot,
  BidKingGameUseItemOrPriceDataSnapshot,
  BidKingGameUserDataSnapshot,
  BidKingStockBoxDataSnapshot,
  BidKingStockContainerDataSnapshot,
  BidKingUserSelectItemDataSnapshot,
  RevealedItem,
  RoundHistoryEntry,
  SkillFeedEntry
} from '@bitkingdom/shared';
import type { MatchRuntimeState, RuntimePlayer, RuntimeRound, WarehouseSlot } from '../types';
import { bidKingHeroIdForRoleId } from './heroRuntime';
import { bidKingGameDataSystemLimitsForSkillIds } from './systemEffectRuntime';

type BidKingGameSkillDataSnapshotWithMetadata = BidKingGameSkillDataSnapshot & {
  sourceFeedId?: string;
  sourceEventId?: string;
};

interface SkillLogHitStats {
  hitItemIndex: number;
  allHitItemAvgPrice: number;
  allHitBoxAvgPrice: number;
  allHitItemAvgBoxIndex: number;
  hitItemTotalPrice: number;
  totalHitBoxIndex: number;
  hitItemTypeList: number[];
  hitItemQuilityList: number[];
}

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
  const systemLimits = bidKingGameDataSystemLimitsForSkillIds(state.bidKingActiveSystemSkillIds);

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
    roundCanUseItemCount: systemLimits.roundCanUseItemCount,
    gameCarryItemMax: systemLimits.gameCarryItemMax,
    gameGoldRateMax: systemLimits.gameGoldRateMax,
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
  const hero = heroForPlayer(state, player);
  const useItemLog = battleItemUseLogs(state, player.id);
  const priceLog = [
    ...previousRounds.map((history): BidKingGameUseItemOrPriceDataSnapshot | undefined => {
      const bid = history.bids.find((entry) => entry.playerId === player.id);
      return bid ? { round: history.index + 1, itemCidOrPrice: bid.amount } : undefined;
    }),
    (() => {
      const bid = round.bids.find((entry) => entry.playerId === player.id);
      return bid ? { round: round.index + 1, itemCidOrPrice: bid.amount } : undefined;
    })()
  ]
    .filter((entry): entry is BidKingGameUseItemOrPriceDataSnapshot => Boolean(entry));

  return {
    userUid: stableNumericId(player.id),
    playerId: player.id,
    name: player.name,
    heroCid: hero?.id ?? 0,
    useItemLog,
    priceLog,
    isStandDown: player.passed,
    isQuit: player.status === 'disconnected',
    headCid: 0,
    heroSkinCid: player.heroSkinCid ?? 0,
    simSelectItemList: (player.simSelectItemList ?? []).map((entry) => ({ ...entry })),
    simBuffItemList: (player.simBuffItemList ?? []).map((entry) => ({ ...entry })),
    selectItemList: buildUserSelectItemList(player, useItemLog),
    headBoxCid: 0,
    titleCid: 0,
    remark: ''
  };
}

function buildUserSelectItemList(
  player: RuntimePlayer,
  useItemLog: readonly BidKingGameUseItemOrPriceDataSnapshot[]
): BidKingUserSelectItemDataSnapshot[] {
  const usedCountByItemCid = new Map<number, number>();
  for (const entry of useItemLog) {
    usedCountByItemCid.set(entry.itemCidOrPrice, (usedCountByItemCid.get(entry.itemCidOrPrice) ?? 0) + 1);
  }
  return (player.selectedItemList ?? []).map((entry) => {
    const itemCid = Math.max(0, Math.floor(entry.itemCid));
    const usedCount = usedCountByItemCid.get(itemCid) ?? 0;
    const isUsed = entry.isUsed || usedCount > 0;
    if (usedCount > 0) {
      usedCountByItemCid.set(itemCid, usedCount - 1);
    }
    return {
      itemCid,
      isUsed
    };
  });
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
        itemCidOrPrice: itemId
      };
    })
    .filter((entry): entry is BidKingGameUseItemOrPriceDataSnapshot => Boolean(entry));
}

function buildStockContainer(state: MatchRuntimeState, round: RuntimeRound): BidKingStockContainerDataSnapshot {
  const stockBoxes = round.container.warehouseSlots.map((slot, index): BidKingStockBoxDataSnapshot => {
    const itemCid = itemCidFromRevealedItem(slot.item);
    const boxId = bidKingSourceBoxIdForSlot(slot);
    const position = bidKingSourceBoxPositionForCell(slot.x, slot.y);
    return {
      boxId,
      position,
      item: {
        uid: stableNumericId(`${round.id}:${slot.item.id}`),
        cid: itemCid,
        count: 1,
        boxPositionData: footprintPositions(slot),
        rotate: slot.rotate ?? false,
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
      positions.push(bidKingSourceBoxPositionForCell(slot.x + x, slot.y + y));
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
    hero: logs.filter((entry) => entry.kind === 'hero').map((entry) => stripSkillLogMetadata(entry.log)),
    map: logs.filter((entry) => entry.kind === 'map').map((entry) => stripSkillLogMetadata(entry.log)),
    item: [
      ...logs
        .filter((entry) => entry.kind === 'item' && !eventFeedIds.has(entry.log.sourceFeedId))
        .map((entry) => stripSkillLogMetadata(entry.log)),
      ...eventItemLogs.map(stripSkillLogMetadata)
    ]
  };
}

function skillFeedToGameSkillLog(
  state: MatchRuntimeState,
  round: RuntimeRound,
  entry: SkillFeedEntry,
  uidSalt: number
): { kind: 'hero' | 'item' | 'map'; log: BidKingGameSkillDataSnapshotWithMetadata } {
  const player = entry.playerId ? state.players.find((candidate) => candidate.id === entry.playerId) : undefined;
  const hero = player ? heroForPlayer(state, player) : undefined;
  const hitSlots = hitSlotsForEntry(round, entry);
  const hitBoxList = entry.hitBoxList?.map(cloneBoxInfo)
    ?? hitSlots.map((slot, index) => boxInfoForSlot(slot, round, index));
  const hitStats = skillLogHitStatsForSlots(hitSlots);

  const log: BidKingGameSkillDataSnapshotWithMetadata = {
    skillCid: entry.skillCid ?? stableNumericId(entry.skillName) % 1_000_000,
    heroCid: hero?.id ?? 0,
    mapCid: entry.source === 'map' ? bidMapIdForState(state, round) : 0,
    itemCid: entry.source === 'item' ? stableNumericId(entry.sourceName) % 1_000_000 : 0,
    castTime: entry.createdAt,
    castRound: entry.round,
    hitBoxList,
    uid: stableNumericId(`${entry.id}:${uidSalt}`),
    ...hitStats,
    sourceFeedId: entry.id
  };
  return { kind: entry.source === 'item' ? 'item' : entry.source === 'map' ? 'map' : 'hero', log };
}

function battleItemEventSkillLogs(state: MatchRuntimeState, round: RuntimeRound): BidKingGameSkillDataSnapshotWithMetadata[] {
  return state.events
    .filter((event) => event.type === 'battle_item_used')
    .map((event, index): BidKingGameSkillDataSnapshotWithMetadata | undefined => {
      const payload = event.payload as {
        itemId?: unknown;
        effectPlan?: { skillId?: unknown; targetCount?: unknown };
        entry?: { id?: unknown; targetItemIds?: unknown; hitBoxList?: unknown };
      } | undefined;
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0;
      if (itemId <= 0) {
        return undefined;
      }
      const player = event.actorId ? state.players.find((candidate) => candidate.id === event.actorId) : undefined;
      const hero = player ? heroForPlayer(state, player) : undefined;
      const targetCount = typeof payload?.effectPlan?.targetCount === 'number' ? payload.effectPlan.targetCount : 1;
      const targetItemIds = eventTargetItemIds(payload?.entry);
      const hitSlots = targetItemIds.length > 0
        ? slotsForTargetItemIds(round, targetItemIds)
        : targetCount > 0
          ? round.container.warehouseSlots.slice(0, Math.max(1, Math.min(targetCount, round.container.warehouseSlots.length)))
          : [];
      const hitBoxList = eventHitBoxList(payload?.entry)
        ?? hitSlots.map((slot, slotIndex) => boxInfoForSlot(slot, round, slotIndex));
      const hitStats = skillLogHitStatsForSlots(hitSlots);
      return {
        skillCid: typeof payload?.effectPlan?.skillId === 'number' ? payload.effectPlan.skillId : 0,
        heroCid: hero?.id ?? 0,
        mapCid: 0,
        itemCid: itemId,
        castTime: event.createdAt,
        castRound: roundNumberForEvent(state, event.roundId),
        hitBoxList,
        uid: stableNumericId(`${event.id}:${index}`),
        ...hitStats,
        sourceFeedId: typeof payload?.entry?.id === 'string' ? payload.entry.id : undefined,
        sourceEventId: event.id
      };
    })
    .filter((entry): entry is BidKingGameSkillDataSnapshotWithMetadata => Boolean(entry));
}

function stripSkillLogMetadata(log: BidKingGameSkillDataSnapshotWithMetadata): BidKingGameSkillDataSnapshot {
  return {
    skillCid: log.skillCid,
    heroCid: log.heroCid,
    mapCid: log.mapCid,
    itemCid: log.itemCid,
    castTime: log.castTime,
    castRound: log.castRound,
    hitItemIndex: log.hitItemIndex,
    hitBoxList: log.hitBoxList,
    allHitItemAvgPrice: log.allHitItemAvgPrice,
    allHitBoxAvgPrice: log.allHitBoxAvgPrice,
    allHitItemAvgBoxIndex: log.allHitItemAvgBoxIndex,
    hitItemTotalPrice: log.hitItemTotalPrice,
    uid: log.uid,
    totalHitBoxIndex: log.totalHitBoxIndex,
    hitItemTypeList: log.hitItemTypeList,
    hitItemQuilityList: log.hitItemQuilityList
  };
}

function hitSlotsForEntry(round: RuntimeRound, entry: SkillFeedEntry): WarehouseSlot[] {
  return slotsForTargetItemIds(round, entry.targetItemIds ?? []);
}

function slotsForTargetItemIds(round: RuntimeRound, targetItemIds: readonly string[]): WarehouseSlot[] {
  const targetIds = new Set(targetItemIds);
  if (targetIds.size === 0) {
    return [];
  }
  return round.container.warehouseSlots.filter((slot) => targetIds.has(slot.item.id));
}

function skillLogHitStatsForSlots(hitSlots: readonly WarehouseSlot[]): SkillLogHitStats {
  const hitItemTotalPrice = hitSlots.reduce((sum, slot) => sum + slot.item.value, 0);
  const totalHitBoxIndex = hitSlots.reduce((sum, slot) => sum + Math.max(1, slot.w * slot.h), 0);
  return {
    hitItemIndex: hitSlots.length,
    allHitItemAvgPrice: hitSlots.length > 0 ? hitItemTotalPrice / hitSlots.length : 0,
    allHitBoxAvgPrice: totalHitBoxIndex > 0 ? hitItemTotalPrice / totalHitBoxIndex : 0,
    allHitItemAvgBoxIndex: hitSlots.length > 0 ? totalHitBoxIndex / hitSlots.length : 0,
    hitItemTotalPrice,
    totalHitBoxIndex,
    hitItemTypeList: uniqueItemTypes(hitSlots),
    hitItemQuilityList: [...new Set(hitSlots.map((slot) => qualityFromItem(slot.item)))]
  };
}

function eventTargetItemIds(entry: { targetItemIds?: unknown } | undefined): string[] {
  return Array.isArray(entry?.targetItemIds)
    ? entry.targetItemIds.filter((id): id is string => typeof id === 'string')
    : [];
}

function eventHitBoxList(entry: { hitBoxList?: unknown } | undefined): BidKingBoxInfoDataSnapshot[] | undefined {
  if (!Array.isArray(entry?.hitBoxList)) {
    return undefined;
  }
  return entry.hitBoxList
    .filter((box): box is BidKingBoxInfoDataSnapshot => (
      typeof box === 'object' &&
      box !== null &&
      typeof (box as BidKingBoxInfoDataSnapshot).boxId === 'number' &&
      typeof (box as BidKingBoxInfoDataSnapshot).itemUid === 'number' &&
      Array.isArray((box as BidKingBoxInfoDataSnapshot).itemType)
    ))
    .map(cloneBoxInfo);
}

function heroForPlayer(state: MatchRuntimeState, player: RuntimePlayer) {
  const mappedHeroId = player.heroCid ?? bidKingHeroIdForRoleId(player.roleId, state.config.roles);
  return Hero.find((candidate) => candidate.id === mappedHeroId) ?? Hero[player.seat % Hero.length];
}

function boxInfoForSlot(slot: WarehouseSlot, round: RuntimeRound, _index: number): BidKingBoxInfoDataSnapshot {
  const itemCid = itemCidFromRevealedItem(slot.item);
  const item = itemById(itemCid);
  return {
    boxId: bidKingSourceBoxIdForSlot(slot),
    itemUid: stableNumericId(`${round.id}:${slot.item.id}`),
    itemCid,
    itemSlotType: item?.slot_type ?? Math.max(1, slot.w * 10 + slot.h),
    itemType: itemTypeIdsFromItem(slot.item),
    itemQuility: qualityFromItem(slot.item),
    itemPrice: slot.item.value,
    itemBoxIndex: Math.max(1, (item?.slot_type ? Math.floor(item.slot_type / 10) * (item.slot_type % 10) : slot.w * slot.h))
  };
}

export function bidKingSourceBoxInfoForSlot(
  slot: WarehouseSlot,
  roundId: string,
  effectCategory?: number
): BidKingBoxInfoDataSnapshot {
  const itemCid = itemCidFromRevealedItem(slot.item);
  const item = itemById(itemCid);
  const itemSlotType = item?.slot_type ?? Math.max(1, slot.w * 10 + slot.h);
  const itemBoxIndex = Math.max(1, item ? Math.floor(item.slot_type / 10) * (item.slot_type % 10) : slot.w * slot.h);
  const base: BidKingBoxInfoDataSnapshot = {
    boxId: bidKingSourceBoxIdForSlot(slot),
    itemUid: stableNumericId(`${roundId}:${slot.item.id}`),
    itemCid: 0,
    itemSlotType: 0,
    itemType: [],
    itemQuility: 0,
    itemPrice: 0,
    itemBoxIndex: 0
  };

  if (effectCategory === 1 || effectCategory === 22) {
    return { ...base, itemSlotType };
  }
  if (effectCategory === 5) {
    return { ...base, itemPrice: slot.item.value };
  }
  if (effectCategory === 6) {
    return { ...base, itemCid, itemQuility: qualityFromItem(slot.item) };
  }
  if (effectCategory === 7 || effectCategory === 12) {
    return { ...base, itemQuility: qualityFromItem(slot.item) };
  }
  if (effectCategory === 11) {
    return { ...base, itemBoxIndex };
  }
  if (effectCategory === 13) {
    return { ...base, itemType: itemTypeIdsFromItem(slot.item) };
  }
  if (effectCategory === 14) {
    return { ...base, itemPrice: slot.item.value };
  }
  return base;
}

function cloneBoxInfo(box: BidKingBoxInfoDataSnapshot): BidKingBoxInfoDataSnapshot {
  return {
    ...box,
    itemType: [...box.itemType]
  };
}

export function bidKingSourceBoxIdForSlot(slot: WarehouseSlot): number {
  return slot.y * 10 + slot.x;
}

function bidKingSourceBoxPositionForCell(column: number, row: number): BidKingBoxPositionDataSnapshot {
  return {
    x: row,
    y: column
  };
}

function uniqueItemTypes(slots: readonly WarehouseSlot[]): number[] {
  return [...new Set(slots.flatMap((slot) => itemTypeIdsFromItem(slot.item)))];
}

function itemTypeIdsFromItem(item: RevealedItem): number[] {
  const itemCid = itemCidFromRevealedItem(item);
  const itemTypes = itemById(itemCid)?.item_type_ids;
  return itemTypes ? [...itemTypes] : [itemCid];
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
