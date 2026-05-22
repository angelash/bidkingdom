import {
  Cabinet,
  Item,
  bidKingItemRuntimeFlags,
  itemFootprint
} from '@bitkingdom/bidking-compat';
import type {
  PlayerProfile,
  ProfileStockBoxState,
  ProfileStockContainerKind,
  ProfileStockContainerState
} from '@bitkingdom/shared';

const MAIN_WAREHOUSE_STOCK_ID = 5001;
const MAIN_WAREHOUSE_CID = 5001;
const WAREHOUSE_WIDTH = 10;
const WAREHOUSE_HEIGHT = 40;

type BidKingCabinetRow = (typeof Cabinet)[number];
type BidKingItemRow = (typeof Item)[number];

export interface StockCabinetIncomeSnapshot {
  baseClaimableCoins: number;
  hasCabinetItems: boolean;
  hourlyCoins: number;
}

export function ensureProfileStockState(profile: PlayerProfile, now = Date.now()): void {
  profile.stockContainers ??= [];
  profile.stockState ??= {
    nextBoxId: nextBoxIdFromContainers(profile.stockContainers),
    nextItemNo: nextItemNoFromContainers(profile.stockContainers)
  };
  profile.stockState.nextBoxId = Math.max(profile.stockState.nextBoxId ?? 1, nextBoxIdFromContainers(profile.stockContainers));
  profile.stockState.nextItemNo = Math.max(profile.stockState.nextItemNo ?? 1, nextItemNoFromContainers(profile.stockContainers));
  ensureWarehouseContainer(profile, now);

  if (profile.settings?.bidkingStockContainersV1 !== true) {
    migrateInventoryEntriesToWarehouse(profile, now);
    migrateLegacyCabinetEntries(profile, now);
    profile.stockState.migratedInventoryAt = now;
    profile.settings ??= {};
    profile.settings.bidkingStockContainersV1 = true;
  }

  refreshProfileStockCabinetRewards(profile, now);
  syncCabinetItemIdsFromStock(profile);
}

export function isStockBackedInventoryRef(refId: number | string): boolean {
  const item = bidKingItemByInventoryRef(refId);
  return Boolean(item && item.slot_type > 0);
}

export function addStockItemsForInventoryRef(
  profile: PlayerProfile,
  refId: number | string,
  quantity: number,
  sourceId: string,
  now = Date.now()
): number {
  const item = bidKingItemByInventoryRef(refId);
  const safeQuantity = Math.max(0, Math.floor(quantity));
  if (!item || item.slot_type <= 0 || safeQuantity <= 0) {
    return 0;
  }

  ensureProfileStockState(profile, now);
  const warehouse = ensureWarehouseContainer(profile, now);
  for (let index = 0; index < safeQuantity; index += 1) {
    warehouse.boxes.push(createStockBox(profile, item, warehouse, sourceId, now));
  }
  warehouse.updatedAt = now;
  profile.updatedAt = now;
  return safeQuantity;
}

export function consumeStockItemsForInventoryRef(
  profile: PlayerProfile,
  refId: number | string,
  quantity: number,
  now = Date.now(),
  kinds: readonly ProfileStockContainerKind[] = ['warehouse', 'cabinet']
): number {
  const item = bidKingItemByInventoryRef(refId);
  const safeQuantity = Math.max(0, Math.floor(quantity));
  if (!item || item.slot_type <= 0 || safeQuantity <= 0) {
    return 0;
  }

  ensureProfileStockState(profile, now);
  let remaining = safeQuantity;
  for (const kind of kinds) {
    for (const container of profile.stockContainers ?? []) {
      if (remaining <= 0 || container.kind !== kind) {
        continue;
      }
      const kept: ProfileStockBoxState[] = [];
      for (const box of container.boxes) {
        if (remaining > 0 && box.item.cid === item.id && !box.item.isLock) {
          remaining -= 1;
          continue;
        }
        kept.push(box);
      }
      if (kept.length !== container.boxes.length) {
        container.boxes = kept;
        container.updatedAt = now;
      }
    }
  }

  const consumed = safeQuantity - remaining;
  if (consumed > 0) {
    refreshProfileStockCabinetRewards(profile, now);
    syncCabinetItemIdsFromStock(profile);
    profile.updatedAt = now;
  }
  return consumed;
}

export interface ProfileStockItemSelection {
  stockId: number;
  boxId: number;
  itemCid: number;
}

export function selectStockItemForInventoryRef(
  profile: PlayerProfile,
  refId: number | string,
  excludedBoxIds: ReadonlySet<number> = new Set(),
  kinds: readonly ProfileStockContainerKind[] = ['warehouse'],
  now = Date.now()
): ProfileStockItemSelection | undefined {
  const item = bidKingItemByInventoryRef(refId);
  if (!item) {
    return undefined;
  }
  ensureProfileStockState(profile, now);
  for (const kind of kinds) {
    for (const container of profile.stockContainers ?? []) {
      if (container.kind !== kind) {
        continue;
      }
      const box = container.boxes.find((candidate) => (
        candidate.item.cid === item.id &&
        !candidate.item.isLock &&
        !excludedBoxIds.has(candidate.boxId)
      ));
      if (box) {
        return {
          stockId: container.stockId,
          boxId: box.boxId,
          itemCid: box.item.cid
        };
      }
    }
  }
  return undefined;
}

export function consumeStockItemBySelection(
  profile: PlayerProfile,
  selection: ProfileStockItemSelection,
  now = Date.now()
): boolean {
  ensureProfileStockState(profile, now);
  for (const container of profile.stockContainers ?? []) {
    if (container.stockId !== selection.stockId) {
      continue;
    }
    const index = container.boxes.findIndex((box) => box.boxId === selection.boxId && box.item.cid === selection.itemCid && !box.item.isLock);
    if (index < 0) {
      return false;
    }
    container.boxes.splice(index, 1);
    container.updatedAt = now;
    refreshProfileStockCabinetRewards(profile, now);
    syncCabinetItemIdsFromStock(profile);
    profile.updatedAt = now;
    return true;
  }
  return false;
}

export function placeStockItemInCabinet(profile: PlayerProfile, itemId: string, now = Date.now()): boolean {
  ensureProfileStockState(profile, now);
  const item = bidKingItemByInventoryRef(itemId);
  if (!item) {
    throw new Error('藏品配置不存在');
  }
  const existingCabinetBox = findStockBox(profile, item.id, ['cabinet']);
  if (existingCabinetBox) {
    syncCabinetItemIdsFromStock(profile);
    return false;
  }

  const warehouse = ensureWarehouseContainer(profile, now);
  const sourceIndex = warehouse.boxes.findIndex((box) => box.item.cid === item.id && !box.item.isLock);
  if (sourceIndex < 0) {
    throw new Error('仓库中没有该实体藏品，无法陈列');
  }
  const sourceBox = warehouse.boxes[sourceIndex]!;
  const cabinet = cabinetForItem(item) ?? Cabinet[0];
  if (!cabinet) {
    throw new Error('收藏柜配置不存在');
  }
  assertCabinetAcceptsItem(cabinet, item, sourceBox);

  const cabinetContainer = ensureCabinetContainer(profile, cabinet, now);
  if (cabinetContainer.boxes.length >= positiveLimit(cabinet.place_max, 15)) {
    throw new Error('收藏柜陈列数量已满');
  }
  const position = firstAvailablePosition(cabinetContainer, item);
  if (position < 0) {
    throw new Error('收藏柜空间不足');
  }

  warehouse.boxes.splice(sourceIndex, 1);
  sourceBox.position = position;
  sourceBox.item.rotate = false;
  cabinetContainer.boxes.push(sourceBox);
  warehouse.updatedAt = now;
  cabinetContainer.updatedAt = now;
  refreshProfileStockCabinetRewards(profile, now);
  syncCabinetItemIdsFromStock(profile);
  profile.updatedAt = now;
  return true;
}

export function clearStockItemFromCabinet(profile: PlayerProfile, itemId: string, now = Date.now()): boolean {
  ensureProfileStockState(profile, now);
  const item = bidKingItemByInventoryRef(itemId);
  if (!item) {
    return false;
  }
  const warehouse = ensureWarehouseContainer(profile, now);

  for (const container of profile.stockContainers ?? []) {
    if (container.kind !== 'cabinet') {
      continue;
    }
    const index = container.boxes.findIndex((box) => box.item.cid === item.id);
    if (index < 0) {
      continue;
    }
    const box = container.boxes[index]!;
    const position = firstAvailablePosition(warehouse, item);
    if (position < 0) {
      throw new Error('主仓库空间不足，无法撤下藏品');
    }
    container.boxes.splice(index, 1);
    box.position = position;
    warehouse.boxes.push(box);
    container.updatedAt = now;
    warehouse.updatedAt = now;
    refreshProfileStockCabinetRewards(profile, now);
    syncCabinetItemIdsFromStock(profile);
    profile.updatedAt = now;
    return true;
  }

  return false;
}

export function profileStockCabinetIncomeSnapshot(profile: PlayerProfile, now = Date.now()): StockCabinetIncomeSnapshot {
  ensureProfileStockState(profile, now);
  let hourlyCoins = 0;
  let baseClaimableCoins = 0;
  let hasCabinetItems = false;
  for (const container of profile.stockContainers ?? []) {
    if (container.kind !== 'cabinet' || !container.cabinet) {
      continue;
    }
    hasCabinetItems ||= container.boxes.length > 0;
    hourlyCoins += container.cabinet.basicRewardPerHour;
    baseClaimableCoins += container.cabinet.pendingReward;
  }
  return {
    baseClaimableCoins,
    hasCabinetItems,
    hourlyCoins
  };
}

export function claimProfileStockCabinetRewards(profile: PlayerProfile, now = Date.now()): void {
  ensureProfileStockState(profile, now);
  for (const container of profile.stockContainers ?? []) {
    if (container.kind !== 'cabinet' || !container.cabinet) {
      continue;
    }
    container.cabinet.cumulativeReward += container.cabinet.pendingReward;
    container.cabinet.pendingReward = 0;
    container.cabinet.lastRewardAt = now;
    container.updatedAt = now;
  }
  profile.updatedAt = now;
}

export function refreshProfileStockCabinetRewards(profile: PlayerProfile, now = Date.now()): void {
  for (const container of profile.stockContainers ?? []) {
    if (container.kind !== 'cabinet' || !container.cabinet) {
      continue;
    }
    const cabinet = Cabinet.find((row) => row.id === container.cabinet?.cabinetId);
    const hourlyCoins = cabinetHourlyCoins(container, cabinet);
    const maxElapsedMs = positiveLimit(cabinet?.timemax, 24 * 3600) * 1000;
    const elapsedMs = Math.min(maxElapsedMs, Math.max(0, now - container.cabinet.lastRewardAt));
    container.cabinet.basicRewardPerHour = hourlyCoins;
    container.cabinet.pendingReward = Math.floor(hourlyCoins * (elapsedMs / 3600_000));
  }
}

function migrateInventoryEntriesToWarehouse(profile: PlayerProfile, now: number): void {
  const warehouse = ensureWarehouseContainer(profile, now);
  for (const entry of profile.inventory ?? []) {
    const item = bidKingItemByInventoryRef(entry.refId);
    const quantity = Math.max(0, Math.floor(entry.quantity));
    if (!item || item.slot_type <= 0 || quantity <= 0) {
      continue;
    }
    const existing = countStockItem(profile, item.id);
    const missing = Math.max(0, quantity - existing);
    for (let index = 0; index < missing; index += 1) {
      warehouse.boxes.push(createStockBox(profile, item, warehouse, `inventory_migration:${entry.key}`, entry.updatedAt || now));
    }
  }
  warehouse.updatedAt = now;
}

function migrateLegacyCabinetEntries(profile: PlayerProfile, now: number): void {
  const legacyItemIds = profile.cabinetItemIds ?? [];
  for (const legacyItemId of legacyItemIds) {
    const item = bidKingItemByInventoryRef(legacyItemId);
    if (!item || findStockBox(profile, item.id, ['cabinet'])) {
      continue;
    }
    const cabinet = cabinetForItem(item) ?? Cabinet[0];
    if (!cabinet) {
      continue;
    }
    const cabinetContainer = ensureCabinetContainer(profile, cabinet, now);
    const warehouseBoxRef = findStockBox(profile, item.id, ['warehouse']);
    const box = warehouseBoxRef?.box ?? createStockBox(profile, item, cabinetContainer, `legacy_cabinet:${legacyItemId}`, now);
    const position = firstAvailablePosition(cabinetContainer, item);
    if (position < 0) {
      continue;
    }
    if (warehouseBoxRef) {
      warehouseBoxRef.container.boxes = warehouseBoxRef.container.boxes.filter((candidate) => candidate.boxId !== box.boxId);
    } else if (!profile.inventory.some((entry) => entry.refId === canonicalInventoryRef(item.id))) {
      profile.inventory.push({
        key: `warehouse:${canonicalInventoryRef(item.id)}`,
        type: 'warehouse',
        refId: canonicalInventoryRef(item.id),
        quantity: 1,
        updatedAt: now
      });
    }
    box.position = position;
    cabinetContainer.boxes.push(box);
    cabinetContainer.updatedAt = now;
  }
}

function createStockBox(
  profile: PlayerProfile,
  item: BidKingItemRow,
  container: ProfileStockContainerState,
  sourceId: string,
  now: number
): ProfileStockBoxState {
  profile.stockState ??= {
    nextBoxId: nextBoxIdFromContainers(profile.stockContainers ?? []),
    nextItemNo: nextItemNoFromContainers(profile.stockContainers ?? [])
  };
  const no = profile.stockState.nextItemNo++;
  return {
    boxId: profile.stockState.nextBoxId++,
    position: firstAvailablePosition(container, item),
    item: {
      uid: `${profile.playerId}:${item.id}:${no}`,
      cid: item.id,
      count: 1,
      rotate: false,
      canTrade: bidKingItemRuntimeFlags(item).tradable,
      no,
      isLock: false,
      quality: item.item_quality,
      sourceId,
      createdAt: now
    }
  };
}

function ensureWarehouseContainer(profile: PlayerProfile, now: number): ProfileStockContainerState {
  profile.stockContainers ??= [];
  let container = profile.stockContainers.find((candidate) => candidate.stockId === MAIN_WAREHOUSE_STOCK_ID);
  if (!container) {
    container = {
      stockId: MAIN_WAREHOUSE_STOCK_ID,
      cid: MAIN_WAREHOUSE_CID,
      kind: 'warehouse',
      name: '主仓库',
      width: WAREHOUSE_WIDTH,
      height: WAREHOUSE_HEIGHT,
      boxes: [],
      updatedAt: now
    };
    profile.stockContainers.push(container);
  }
  container.kind = 'warehouse';
  container.width ||= WAREHOUSE_WIDTH;
  container.height ||= WAREHOUSE_HEIGHT;
  container.boxes ??= [];
  return container;
}

function ensureCabinetContainer(profile: PlayerProfile, cabinet: BidKingCabinetRow, now: number): ProfileStockContainerState {
  profile.stockContainers ??= [];
  let container = profile.stockContainers.find((candidate) => candidate.stockId === cabinet.id);
  if (!container) {
    container = {
      stockId: cabinet.id,
      cid: cabinet.id,
      kind: 'cabinet',
      name: cabinet.packaged_name,
      width: cabinet.slot_count[0] ?? WAREHOUSE_WIDTH,
      height: cabinet.slot_count[1] ?? WAREHOUSE_HEIGHT,
      boxes: [],
      cabinet: {
        cabinetId: cabinet.id,
        lastRewardAt: now,
        cumulativeReward: 0,
        basicRewardPerHour: 0,
        pendingReward: 0
      },
      updatedAt: now
    };
    profile.stockContainers.push(container);
  }
  container.kind = 'cabinet';
  container.cid = cabinet.id;
  container.name = cabinet.packaged_name;
  container.width = cabinet.slot_count[0] ?? container.width;
  container.height = cabinet.slot_count[1] ?? container.height;
  container.boxes ??= [];
  container.cabinet ??= {
    cabinetId: cabinet.id,
    lastRewardAt: now,
    cumulativeReward: 0,
    basicRewardPerHour: 0,
    pendingReward: 0
  };
  return container;
}

function assertCabinetAcceptsItem(cabinet: BidKingCabinetRow, item: BidKingItemRow, box: ProfileStockBoxState): void {
  if (!item.item_type_ids.some((typeId) => cabinet.location_type.includes(typeId))) {
    throw new Error('藏品分类不符合收藏柜要求');
  }
  if (cabinet.quality_requirement.length > 0 && !cabinet.quality_requirement.includes(item.item_quality)) {
    throw new Error(`藏品品质不符合收藏柜要求：需要 ${cabinet.quality_requirement.join('/')}，当前 ${item.item_quality}`);
  }
  const footprint = itemFootprint(item.slot_type);
  if (footprint.w * footprint.h > positiveLimit(cabinet.max_slot_limit, footprint.w * footprint.h)) {
    throw new Error('藏品占格超过收藏柜限制');
  }
  if (item.in_case <= 0 && !box.item.canTrade && !bidKingItemRuntimeFlags(item).saleable) {
    throw new Error('藏品不可入柜');
  }
}

function firstAvailablePosition(container: ProfileStockContainerState, item: BidKingItemRow): number {
  const footprint = itemFootprint(item.slot_type);
  const width = Math.max(1, container.width);
  const height = Math.max(1, container.height);
  const occupied = new Set<number>();
  for (const box of container.boxes) {
    const boxItem = Item.find((candidate) => candidate.id === box.item.cid);
    const boxFootprint = boxItem ? itemFootprint(boxItem.slot_type) : { w: 1, h: 1 };
    for (let y = 0; y < boxFootprint.h; y += 1) {
      for (let x = 0; x < boxFootprint.w; x += 1) {
        occupied.add(box.position + x + y * width);
      }
    }
  }
  for (let y = 0; y <= height - footprint.h; y += 1) {
    for (let x = 0; x <= width - footprint.w; x += 1) {
      const position = x + y * width;
      if (footprintFits(position, footprint, width, occupied)) {
        return position;
      }
    }
  }
  return -1;
}

function footprintFits(
  position: number,
  footprint: { w: number; h: number },
  containerWidth: number,
  occupied: ReadonlySet<number>
): boolean {
  const startX = position % containerWidth;
  for (let y = 0; y < footprint.h; y += 1) {
    for (let x = 0; x < footprint.w; x += 1) {
      const cell = position + x + y * containerWidth;
      if ((startX + x) >= containerWidth || occupied.has(cell)) {
        return false;
      }
    }
  }
  return true;
}

function cabinetHourlyCoins(container: ProfileStockContainerState, cabinet?: BidKingCabinetRow): number {
  const itemCoins = container.boxes.reduce((sum, box) => {
    const item = Item.find((candidate) => candidate.id === box.item.cid);
    return sum + (item?.collection_coin ?? 0) * 3600;
  }, 0);
  return itemCoins + (container.boxes.length > 0 ? positiveLimit(cabinet?.coinbonus, 0) : 0);
}

function syncCabinetItemIdsFromStock(profile: PlayerProfile): void {
  const ids: string[] = [];
  for (const container of profile.stockContainers ?? []) {
    if (container.kind !== 'cabinet') {
      continue;
    }
    for (const box of container.boxes) {
      const id = canonicalInventoryRef(box.item.cid);
      if (!ids.includes(id)) {
        ids.push(id);
      }
    }
  }
  profile.cabinetItemIds = ids;
}

function findStockBox(
  profile: PlayerProfile,
  itemId: number,
  kinds: readonly ProfileStockContainerKind[]
): { box: ProfileStockBoxState; container: ProfileStockContainerState } | undefined {
  for (const container of profile.stockContainers ?? []) {
    if (!kinds.includes(container.kind)) {
      continue;
    }
    const box = container.boxes.find((candidate) => candidate.item.cid === itemId);
    if (box) {
      return { box, container };
    }
  }
  return undefined;
}

function countStockItem(profile: PlayerProfile, itemId: number): number {
  return (profile.stockContainers ?? []).reduce((sum, container) => (
    sum + container.boxes.filter((box) => box.item.cid === itemId).length
  ), 0);
}

function bidKingItemByInventoryRef(refId: number | string): BidKingItemRow | undefined {
  const raw = String(refId);
  const compatMatch = /^compat_(\d+)/.exec(raw);
  const sourceId = Number(compatMatch?.[1] ?? raw);
  return Number.isFinite(sourceId) ? Item.find((item) => item.id === sourceId) : undefined;
}

function cabinetForItem(item: BidKingItemRow): BidKingCabinetRow | undefined {
  return Cabinet.find((cabinet) => item.item_type_ids.some((typeId) => cabinet.location_type.includes(typeId)))
    ?? Cabinet[0];
}

function nextBoxIdFromContainers(containers: readonly ProfileStockContainerState[]): number {
  return Math.max(1, ...containers.flatMap((container) => container.boxes.map((box) => box.boxId + 1)));
}

function nextItemNoFromContainers(containers: readonly ProfileStockContainerState[]): number {
  return Math.max(1, ...containers.flatMap((container) => container.boxes.map((box) => box.item.no + 1)));
}

function canonicalInventoryRef(itemId: number): string {
  return `compat_${itemId}`;
}

function positiveLimit(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && value > 0 ? value : fallback;
}
