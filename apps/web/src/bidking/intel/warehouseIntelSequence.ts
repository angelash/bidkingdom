import { itemFootprint } from '@bitkingdom/bidking-compat';
import type { PlayerSnapshot, Rarity, SkillFeedEntry, WarehouseSlotView } from '@bitkingdom/shared';
import { bidKingLiveIntelItems } from '../catalog/codexRuntime';
import { marketIntelSequenceState, type MarketIntelSequenceTiming } from './marketIntelSequence';

type PublicRound = NonNullable<PlayerSnapshot['public']['currentRound']>;

export function progressiveWarehouseSlotsForIntel(
  round: PublicRound,
  now: number,
  timing: MarketIntelSequenceTiming = {}
): WarehouseSlotView[] {
  const slots = round.warehouseSlots ?? [];
  const sequence = marketIntelSequenceState(round, now, timing);
  if (round.phase !== 'intel' && !sequence.isSequencing) {
    return slots;
  }
  const currentRoundNumber = round.index + 1;
  const historyEntries = sequence.cumulative.filter((entry) => entry.round < currentRoundNumber);
  const visibleEntries = sequence.visible.filter((entry) => entry.round === currentRoundNumber);
  const baseline = warehouseSlotsForVisibleSkillEntries(hiddenWarehouseSlots(slots), historyEntries);
  return warehouseSlotsForVisibleSkillEntries(baseline, visibleEntries);
}

export function warehouseSlotsForVisibleSkillEntries(
  slots: readonly WarehouseSlotView[],
  visibleEntries: readonly SkillFeedEntry[]
): WarehouseSlotView[] {
  return slots.map((slot) => {
    let view: WarehouseSlotView = { ...slot };
    for (const entry of visibleEntries) {
      view = applyVisibleSkillEntry(view, entry);
    }
    return view;
  });
}

function hiddenWarehouseSlots(slots: readonly WarehouseSlotView[]): WarehouseSlotView[] {
  return slots.map((slot) => ({
    slotId: slot.slotId,
    x: slot.x,
    y: slot.y,
    w: 1,
    h: 1,
    visibleShape: false
  }));
}

function applyVisibleSkillEntry(
  view: WarehouseSlotView,
  entry: SkillFeedEntry
): WarehouseSlotView {
  const boxId = view.y * 10 + view.x;
  const hitBox = entry.hitBoxList?.find((box) => box.boxId === boxId);
  const targetMatched = Boolean(view.itemId && entry.targetItemIds?.includes(view.itemId));
  if (!hitBox && !targetMatched) {
    return view;
  }

  let next = { ...view };
  let revealed = false;
  const item = hitBox?.itemCid ? bidKingLiveIntelItems.find((candidate) => candidate.sourceItemId === hitBox.itemCid) : undefined;
  const footprint = item
    ? item.footprint
    : hitBox?.itemSlotType
      ? itemFootprint(hitBox.itemSlotType)
      : undefined;
  if (footprint || targetMatched) {
    next = {
      ...next,
      w: Math.max(1, footprint?.w ?? next.w),
      h: Math.max(1, footprint?.h ?? next.h),
      visibleShape: true
    };
    revealed = true;
  }
  if (hitBox?.itemBoxIndex) {
    next = {
      ...next,
      visibleSizeCount: hitBox.itemBoxIndex
    };
    revealed = true;
  }
  if (hitBox?.itemQuility || targetMatched) {
    next = {
      ...next,
      visibleRarity: item?.rarity ?? (hitBox?.itemQuility ? rarityFromQuality(hitBox.itemQuility) : next.visibleRarity)
    };
    revealed = true;
  }
  if (hitBox?.itemPrice) {
    next = {
      ...next,
      visibleValueRange: {
        min: hitBox.itemPrice,
        max: hitBox.itemPrice
      }
    };
    revealed = true;
  }
  if (hitBox?.itemCid) {
    next = {
      ...next,
      itemId: item?.id ?? next.itemId,
      visibleRarity: item?.rarity ?? next.visibleRarity,
      visibleCategory: item?.category ?? next.visibleCategory,
      visibleValueRange: item
        ? {
            min: item.displayValue,
            max: item.displayValue
          }
        : next.visibleValueRange,
      itemName: item?.name ?? next.itemName,
      iconKey: item?.iconKey ?? next.iconKey
    };
    revealed = true;
  }
  if (!revealed) {
    return view;
  }
  return {
    ...next,
    markedBySkill: true,
    markReason: skillMarkReason(entry)
  };
}

function rarityFromQuality(quality: number): Rarity {
  if (quality <= 1) {
    return 'junk';
  }
  if (quality === 2) {
    return 'common';
  }
  if (quality === 3) {
    return 'fine';
  }
  if (quality === 4) {
    return 'rare';
  }
  if (quality === 5) {
    return 'legendary';
  }
  return 'mythic';
}

function skillMarkReason(entry: SkillFeedEntry): string {
  if (entry.source === 'map') {
    return '拍场技能';
  }
  if (entry.source === 'item') {
    return '试宝令';
  }
  return '名士掌眼';
}
