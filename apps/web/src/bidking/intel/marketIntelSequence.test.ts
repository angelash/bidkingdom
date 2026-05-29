import { describe, expect, it } from 'vitest';
import type { SkillFeedEntry, WarehouseSlotView } from '@bitkingdom/shared';
import { bidKingLiveIntelItems } from '../catalog/codexRuntime';
import {
  MARKET_INTEL_ROW_VISIBLE_MS,
  MARKET_INTEL_STEP_MS,
  marketIntelSequenceState,
  type MarketIntelSequenceTiming
} from './marketIntelSequence';
import { progressiveWarehouseSlotsForIntel } from './warehouseIntelSequence';

describe('market intel sequence', () => {
  it('keeps field intelligence as a first-round one-shot in the visible feed', () => {
    const entries = [
      skillEntry({ id: 'map_r1', round: 1, source: 'map', skillName: '首轮场地' }),
      skillEntry({ id: 'hero_r2', round: 2, source: 'hero', skillName: '名士' }),
      skillEntry({ id: 'map_r2', round: 2, source: 'map', skillName: '第二轮场地' })
    ];
    const state = marketIntelSequenceState(round(entries, 1, 6000), 10_000);

    expect(state.cumulative.map((entry) => entry.id)).toEqual(['map_r1', 'hero_r2']);
  });

  it('reveals current-round messages only after the tip has moved into the list', () => {
    const entries = [
      skillEntry({ id: 'map_r1', round: 1, source: 'map', createdAt: 1000 }),
      skillEntry({ id: 'hero_r2_a', round: 2, source: 'hero', createdAt: 5000 }),
      skillEntry({ id: 'hero_r2_b', round: 2, source: 'hero', createdAt: 5000 })
    ];

    expect(marketIntelSequenceState(round(entries, 1, 5000), 5000 + MARKET_INTEL_ROW_VISIBLE_MS - 1).visible.map((entry) => entry.id))
      .toEqual(['map_r1']);
    expect(marketIntelSequenceState(round(entries, 1, 5000), 5000 + MARKET_INTEL_ROW_VISIBLE_MS).visible.map((entry) => entry.id))
      .toEqual(['map_r1', 'hero_r2_a']);
    expect(marketIntelSequenceState(round(entries, 1, 5000), 5000 + MARKET_INTEL_STEP_MS + MARKET_INTEL_ROW_VISIBLE_MS).visible.map((entry) => entry.id))
      .toEqual(['map_r1', 'hero_r2_a', 'hero_r2_b']);
  });

  it('applies warehouse knowledge at the same time the message lands in the list', () => {
    const targetItem = bidKingLiveIntelItems.find((item) => item.sourceItemId && item.footprint.w > 1)
      ?? bidKingLiveIntelItems.find((item) => item.sourceItemId);
    expect(targetItem).toBeTruthy();
    const entries = [
      skillEntry({
        id: 'hero_r2_a',
        round: 2,
        source: 'hero',
        createdAt: 5000,
        hitBoxList: [{
          boxId: 0,
          itemUid: 11,
          itemCid: targetItem!.sourceItemId!,
          itemSlotType: 0,
          itemType: [101],
          itemQuility: 0,
          itemPrice: 0,
          itemBoxIndex: targetItem!.footprint.w * targetItem!.footprint.h
        }]
      })
    ];
    const hiddenBefore = progressiveWarehouseSlotsForIntel(round(entries, 1, 5000, [hiddenSlot()]), 5000 + MARKET_INTEL_ROW_VISIBLE_MS - 1);
    const visibleAfter = progressiveWarehouseSlotsForIntel(round(entries, 1, 5000, [hiddenSlot()]), 5000 + MARKET_INTEL_ROW_VISIBLE_MS);

    expect(hiddenBefore[0]).toMatchObject({ visibleShape: false, w: 1, h: 1 });
    expect(hiddenBefore[0]?.visibleRarity).toBeUndefined();
    expect(visibleAfter[0]).toMatchObject({
      visibleShape: true,
      w: targetItem!.footprint.w,
      h: targetItem!.footprint.h,
      visibleRarity: targetItem!.rarity,
      itemName: targetItem!.name,
      markedBySkill: true
    });
  });

  it('uses the placed footprint from hit boxes when a revealed item was rotated', () => {
    const targetItem = bidKingLiveIntelItems.find((item) => item.sourceItemId && item.footprint.w !== item.footprint.h);
    expect(targetItem).toBeTruthy();
    const placedW = targetItem!.footprint.h;
    const placedH = targetItem!.footprint.w;
    const entries = [
      skillEntry({
        id: 'hero_r2_rotated',
        round: 2,
        source: 'hero',
        createdAt: 5000,
        hitBoxList: [{
          boxId: 0,
          itemUid: 11,
          itemCid: targetItem!.sourceItemId!,
          itemSlotType: placedW * 10 + placedH,
          itemType: [101],
          itemQuility: 0,
          itemPrice: 0,
          itemBoxIndex: placedW * placedH
        }]
      })
    ];

    const visibleAfter = progressiveWarehouseSlotsForIntel(
      round(entries, 1, 5000, [hiddenSlot()]),
      5000 + MARKET_INTEL_ROW_VISIBLE_MS
    );

    expect(visibleAfter[0]).toMatchObject({
      visibleShape: true,
      w: placedW,
      h: placedH,
      visibleRarity: targetItem!.rarity,
      itemName: targetItem!.name,
      markedBySkill: true
    });
  });

  it('keeps current-round warehouse knowledge hidden in auction until each local tip lands', () => {
    const targetItem = bidKingLiveIntelItems.find((item) => item.sourceItemId && item.footprint.w > 1)
      ?? bidKingLiveIntelItems.find((item) => item.sourceItemId);
    expect(targetItem).toBeTruthy();
    const entries = [
      fullItemEntry('map_r1', 'map', 0, targetItem!.sourceItemId!),
      fullItemEntry('hero_r1', 'hero', 1, targetItem!.sourceItemId!)
    ];
    const localStartAt = 20_000;
    const timing: MarketIntelSequenceTiming = {
      sequenceStartedAt: localStartAt,
      openingDelayMs: 0,
      entryFirstSeenAt: new Map(entries.map((entry) => [entry.id, localStartAt]))
    };
    const auctionRound = round(entries, 0, 70_000, [knownSlot(0, targetItem!), knownSlot(1, targetItem!)], 'auction');

    const beforeFirst = progressiveWarehouseSlotsForIntel(
      auctionRound,
      localStartAt + MARKET_INTEL_ROW_VISIBLE_MS - 1,
      timing
    );
    const afterFirst = progressiveWarehouseSlotsForIntel(
      auctionRound,
      localStartAt + MARKET_INTEL_ROW_VISIBLE_MS,
      timing
    );
    const beforeSecond = progressiveWarehouseSlotsForIntel(
      auctionRound,
      localStartAt + MARKET_INTEL_STEP_MS + MARKET_INTEL_ROW_VISIBLE_MS - 1,
      timing
    );
    const afterSecond = progressiveWarehouseSlotsForIntel(
      auctionRound,
      localStartAt + MARKET_INTEL_STEP_MS + MARKET_INTEL_ROW_VISIBLE_MS,
      timing
    );

    expect(beforeFirst[0]).toMatchObject({ visibleShape: false });
    expect(afterFirst[0]).toMatchObject({ visibleShape: true, itemName: targetItem!.name });
    expect(beforeSecond[1]).toMatchObject({ visibleShape: false });
    expect(afterSecond[1]).toMatchObject({ visibleShape: true, itemName: targetItem!.name });
  });
});

function round(
  skillFeed: SkillFeedEntry[],
  index: number,
  phaseEndsAt: number,
  warehouseSlots: WarehouseSlotView[] = [],
  phase = 'intel'
) {
  return {
    id: `round_${index + 1}`,
    index,
    phase,
    skillFeed,
    warehouseSlots,
    revealedItems: [],
    container: { estimateHidden: true },
    phaseEndsAt
  } as any;
}

function skillEntry(overrides: Partial<SkillFeedEntry>): SkillFeedEntry {
  return {
    id: overrides.id ?? 'entry',
    round: overrides.round ?? 1,
    source: overrides.source ?? 'hero',
    sourceName: '来源',
    skillName: overrides.skillName ?? '技能',
    text: '情报内容',
    visibility: 'public',
    createdAt: overrides.createdAt ?? 1000,
    hitBoxList: overrides.hitBoxList,
    targetItemIds: overrides.targetItemIds
  };
}

function fullItemEntry(
  id: string,
  source: SkillFeedEntry['source'],
  boxId: number,
  itemCid: number
): SkillFeedEntry {
  return skillEntry({
    id,
    round: 1,
    source,
    createdAt: 1000,
    hitBoxList: [{
      boxId,
      itemUid: boxId + 1,
      itemCid,
      itemSlotType: 0,
      itemType: [101],
      itemQuility: 0,
      itemPrice: 0,
      itemBoxIndex: 1
    }]
  });
}

function hiddenSlot(): WarehouseSlotView {
  return {
    slotId: 'slot_1',
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    visibleShape: false
  };
}

function knownSlot(x: number, item: { id: string; name: string; category: string; rarity: WarehouseSlotView['visibleRarity']; displayValue: number; iconKey: string; footprint: { w: number; h: number } }): WarehouseSlotView {
  return {
    slotId: `slot_${x + 1}`,
    itemId: item.id,
    x,
    y: 0,
    w: item.footprint.w,
    h: item.footprint.h,
    visibleShape: true,
    visibleRarity: item.rarity,
    visibleCategory: item.category,
    visibleValueRange: { min: item.displayValue, max: item.displayValue },
    itemName: item.name,
    iconKey: item.iconKey,
    markedBySkill: true
  };
}
