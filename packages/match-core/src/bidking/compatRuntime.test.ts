import { describe, expect, it } from 'vitest';
import {
  BattleItem,
  BIDKING_AUCTION_ROUNDS_RATE,
  BidMap,
  Emoji,
  Hero,
  Map,
  RankAi,
  RankMap,
  Skill,
  SkillEffect,
  SkillGroup,
  bidKingBattleItemDisplayName,
  bidKingRawTableDisplayName,
  bidKingSkillDisplayName,
  dropsForGroup,
  skillById,
  skillEffectById,
  validateBidKingParity
} from '@bitkingdom/bidking-compat';
import { chooseBotAction } from '../bots';
import { finishRound, settleCurrentRound, submitBid } from '../auction';
import {
  bidKingBidLossRebateAmount,
  bidKingBidLossRebateRuntime,
  bidKingCollectionRuleRuntime,
  bidKingMailMaxCount
} from './economyRuleRuntime';
import {
  bidKingMarketBidIncrement,
  bidKingMarketListingCost,
  bidKingMarketListingFee,
  bidKingMarketOrderDurationHours,
  bidKingMarketRuleRuntime
} from './marketRuleRuntime';
import { buildSnapshot, createMatch, setRoundPhase, startNextRound } from '../match';
import { useSkill } from '../skills';
import { battleItemCooldownRemaining, battleItemEffectPlanForItem, skillGroupForBattleItem, useBattleItem } from '../items';
import type { BattleItemEffectPlan } from '../items';
import { bidKingHeroIdForRoleId } from './heroRuntime';

const players = [
  { id: 'p1', name: '玩家一', kind: 'human' as const, roleId: 'appraiser' },
  { id: 'p2', name: '玩家二', kind: 'bot' as const, roleId: 'smuggler' },
  { id: 'p3', name: '玩家三', kind: 'bot' as const, roleId: 'psychologist' },
  { id: 'p4', name: '玩家四', kind: 'bot' as const, roleId: 'restorer' }
];

describe('BidKing compatible core runtime', () => {
  it('keeps table parity targets valid', () => {
    expect(validateBidKingParity()).toEqual([]);
    expect(BIDKING_AUCTION_ROUNDS_RATE).toEqual([2000, 1600, 1300, 1100, 0]);
  });

  it('restores original economy constants for market, mail, cabinet, and loss rebate runtime', () => {
    const market = bidKingMarketRuleRuntime();
    const collection = bidKingCollectionRuleRuntime();
    const rebate = bidKingBidLossRebateRuntime();

    expect(market.listingDurationHours).toEqual([24, 48, 72]);
    expect(bidKingMarketOrderDurationHours('trade')).toBe(24);
    expect(bidKingMarketOrderDurationHours('auction')).toBe(48);
    expect(bidKingMarketListingFee(8800)).toBe(44);
    expect(bidKingMarketListingCost(8800, 24)).toBe(88);
    expect(bidKingMarketBidIncrement(4000)).toBe(200);
    expect(market.slotBase).toBe(5);
    expect(market.slotMax).toBe(10);
    expect(market.auctionCounts).toBe(100);
    expect(bidKingMailMaxCount()).toBe(100);
    expect(collection.collectionCountMax).toBe(10);
    expect(collection.gainIntervalSeconds).toBe(10);
    expect(collection.duplicateRatesPerMille.slice(0, 3)).toEqual([1000, 500, 250]);
    expect(rebate).toEqual({ threshold: 10000, ratePerMille: 100 });
    expect(bidKingBidLossRebateAmount(20000)).toBe(2000);
  });

  it('creates the core warehouse from original BidMap/Drop/Item compatible tables', () => {
    const match = createMatch({
      id: 'compat-match',
      players,
      seed: 1234,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);
    expect(match.currentRound?.container.templateId).toMatch(/^bidmap_/);
    expect(match.currentRound?.openingCandidates).toHaveLength(8);
    expect(match.currentRound?.container.hiddenItems.length).toBeGreaterThanOrEqual(16);
    expect(match.currentRound?.warehouseSlots.length).toBe(match.currentRound?.container.hiddenItems.length);
    expect(match.currentRound?.auctioneerChoices).toHaveLength(4);
    expect(match.currentRound?.container.minimumBid).toBeGreaterThan(0);
    expect([50000, 60000]).toContain(match.currentRound?.container.auctionDurationMs);
    expect(match.players[0]?.privateClues.some((clue) => clue.source === 'skill')).toBe(true);
    expect(match.currentRound?.skillFeed.some((entry) => entry.source === 'map')).toBe(true);
    expect(match.currentRound?.skillFeed.some((entry) => entry.playerId === 'p1' && entry.source === 'hero')).toBe(true);
    const publicFeed = buildSnapshot(match, 'p1').public.currentRound?.skillFeed ?? [];
    expect(publicFeed.some((entry) => entry.source === 'map')).toBe(true);
    expect(publicFeed.some((entry) => entry.playerId === 'p2')).toBe(false);
  });

  it('honors a selected original BidMap id for the core warehouse', () => {
    const match = createMatch({
      id: 'compat-selected-bidmap',
      players,
      seed: 2468,
      coreMode: true,
      coreAuctionMode: 'sealed',
      coreBidMapId: 4402
    });
    startNextRound(match, 1000);
    expect(match.currentRound?.container.templateId).toBe('bidmap_4402');
    expect(match.currentRound?.auctionMode).toBe('sealed');
    expect(match.currentRound?.container.publicInfo.source).toContain('旧藏');
    expect(match.currentRound?.container.publicInfo.source).not.toContain('掉落组');
  });

  it('mirrors source item drops and 10-column warehouse placement', () => {
    const bidMap = BidMap.find((row) => row.id === 2101)!;
    const match = createMatch({
      id: 'compat-source-drops',
      players: players.slice(0, 2),
      seed: 1,
      coreMode: true,
      coreAuctionMode: 'sealed',
      coreBidMapId: bidMap.id
    });
    startNextRound(match, 1000);

    const slots = match.currentRound?.container.warehouseSlots ?? [];
    expect(match.currentRound?.container.templateId).toBe('bidmap_2101');
    const occupied = new Set<string>();
    for (const slot of slots) {
      expect(slot.x + slot.w).toBeLessThanOrEqual(10);
      expect(slot.y + slot.h).toBeLessThanOrEqual(60);
      for (let y = slot.y; y < slot.y + slot.h; y += 1) {
        for (let x = slot.x; x < slot.x + slot.w; x += 1) {
          const key = `${x}:${y}`;
          expect(occupied.has(key)).toBe(false);
          occupied.add(key);
        }
      }
    }
    expect(slots.length).toBeGreaterThan(bidMap.item_count_max);
    expect(slots.some((slot) => slot.rotate)).toBe(true);
  });

  it('uses the original strict BidMap auction round rates for the core close decision', () => {
    const match = createMatch({
      id: 'compat-close-rule',
      players,
      seed: 5678,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);
    match.players.forEach((player) => {
      player.cash = 1_000_000;
    });
    setRoundPhase(match, 'auction', 60000, 1200);
    const secondBid = Math.max(match.currentRound?.container.minimumBid ?? 0, 50000);
    submitBid(match, 'p1', secondBid * 2, 1300);
    submitBid(match, 'p2', secondBid, 1400);
    settleCurrentRound(match, 1500);
    expect(match.currentRound?.bidFeedback?.closeThreshold).toBe(1);
    expect(match.currentRound?.bidFeedback?.shouldClose).toBe(false);
    expect(match.currentRound?.bidFeedback?.decision).toEqual(expect.objectContaining({
      source: 'BidMap.auction_rounds_rate',
      threshold: 1,
      thresholdPercent: 100,
      decision: 'continue'
    }));
    expect(match.currentRound?.settlement?.isFinal).toBe(false);
  });

  it('archives the BidKing core extra-round decision when final bids tie', () => {
    const match = createMatch({
      id: 'compat-extra-round',
      players,
      seed: 8642,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);
    match.players.forEach((player) => {
      player.cash = 1_000_000;
    });
    match.currentRound!.index = 4;
    match.roundIndex = 4;
    setRoundPhase(match, 'auction', 60000, 1200);
    const bid = Math.max(match.currentRound?.container.minimumBid ?? 0, 60000);
    submitBid(match, 'p1', bid, 1300);
    submitBid(match, 'p2', bid, 1400);
    settleCurrentRound(match, 1500);

    expect(match.currentRound?.bidFeedback?.extraRound).toBe(true);
    expect(match.currentRound?.bidFeedback?.decision).toEqual(expect.objectContaining({
      source: 'BidMap.auction_rounds_rate',
      decision: 'extra_round',
      isTie: true,
      leaderAmount: bid,
      secondAmount: bid
    }));
    expect(match.totalRounds).toBeGreaterThanOrEqual(6);
    expect(match.currentRound?.settlement?.isFinal).toBe(false);
    expect(match.events.at(-1)?.type).toBe('round_feedback');
  });

  it('locks BidKing core bids after the first submission in a round', () => {
    const match = createMatch({
      id: 'compat-one-bid',
      players,
      seed: 1357,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);
    match.players.forEach((player) => {
      player.cash = 1_000_000;
    });
    setRoundPhase(match, 'auction', 60000, 1200);
    const firstBid = Math.max(match.currentRound?.container.minimumBid ?? 0, 60000);
    submitBid(match, 'p1', firstBid, 1300);
    expect(() => submitBid(match, 'p1', firstBid + 2000, 1400)).toThrow(/Already bid this round/);
  });

  it('uses compatible Hero and Skill tables for first-round automatic hero skills', () => {
    const match = createMatch({
      id: 'compat-skill',
      players,
      seed: 91011,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);
    const hero = Hero.find((candidate) => candidate.id === bidKingHeroIdForRoleId(players[0]!.roleId, match.config.roles))!;
    const skill = skillById(hero.cast_type[0]!)!;
    const effect = skillEffectById(skill.skilleffect_position[0]!)!;
    const skillEvent = match.events.find((event) => event.type === 'skill_triggered' && event.actorId === 'p1');
    const skillPayload = skillEvent?.payload as { entry?: { skillCid?: number; effectCategory?: number; effectId?: number } } | undefined;
    const feedEntry = match.currentRound?.skillFeed.find((entry) => entry.source === 'hero' && entry.playerId === 'p1');
    expect(match.players[0]?.skillUsedThisRound).toBe(false);
    expect(match.players[0]?.privateClues.at(-1)?.text).toContain(hero.packaged_name);
    expect(skillPayload?.entry?.skillCid).toBe(skill.id);
    expect(skillPayload?.entry?.effectCategory).toBe(effect.Category);
    expect(skillPayload?.entry?.effectId).toBe(effect.EffectId);
    expect(feedEntry?.skillCid).toBe(skill.id);
    expect(feedEntry?.effectCategory).toBe(effect.Category);
    expect(feedEntry?.hitBoxList?.length).toBe(feedEntry?.targetCount);
    expect(feedEntry?.hitBoxList?.[0]?.itemSlotType).toBeGreaterThan(0);
    expect(feedEntry?.hitBoxList?.[0]?.itemCid).toBe(0);
    expect(feedEntry?.hitBoxList?.[0]?.itemPrice).toBe(0);
    expect(feedEntry?.hitBoxList?.[0]?.itemQuility).toBeGreaterThan(0);
    expect(match.currentRound?.skillFeed.some((entry) => entry.playerId === 'p1' && entry.source === 'hero')).toBe(true);
    expect(buildSnapshot(match, 'p1').public.players[0]?.bidRanks?.[0]?.usedSkillName).toBeTruthy();
  });

  it('does not collapse empty Hero.cast_type slots into first-round skills', () => {
    const delayedHero = Hero.find((hero) => (hero.cast_type[0] ?? 0) === 0 && hero.cast_type.some((skillId) => skillId > 0));
    if (!delayedHero) {
      throw new Error('BidKing fixtures must include a hero with delayed cast_type skills');
    }
    const match = createMatch({
      id: 'compat-delayed-hero-skill',
      players: players.map((player) => player.id === 'p1' ? { ...player, heroCid: delayedHero.id } : player),
      seed: 91013,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);

    expect(match.currentRound?.skillFeed.some((entry) => entry.source === 'hero' && entry.playerId === 'p1')).toBe(false);
    expect(match.events.some((event) => event.type === 'skill_triggered' && event.actorId === 'p1')).toBe(false);
    expect(match.players[0]?.privateClues.some((clue) => clue.text.includes(delayedHero.packaged_name))).toBe(false);
  });

  it('preserves source SkillEffect count and identity categories for skills and items', () => {
    const countHero = Hero.find((hero) => hero.cast_type.includes(100106));
    const identitySkill = skillById(200021);
    const identityEffect = skillEffectById(identitySkill?.skilleffect_position[0] ?? 0);
    if (!countHero || !identitySkill || !identityEffect) {
      throw new Error('BidKing fixtures must include count and identity skill effects');
    }
    const match = createMatch({
      id: 'compat-skill-effect-categories',
      players: players.map((player) => player.id === 'p1' ? { ...player, heroCid: countHero.id } : player),
      seed: 91012,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);

    const clue = match.players[0]?.privateClues.at(-1);
    const countFeed = match.currentRound?.skillFeed.find((entry) => entry.source === 'hero' && entry.playerId === 'p1');
    const plan = battleItemEffectPlanForItem(BattleItem[0]!, { skill: identitySkill, effect: identityEffect });
    expect(clue?.text).toContain('命中数量');
    expect(clue?.text).not.toContain('合计价值');
    expect(countFeed?.effectCategory).toBe(4);
    expect(countFeed?.targetCount).toBe(countFeed?.hitBoxList?.length);
    expect(countFeed?.hitBoxList?.every((box) => (
      box.itemCid === 0 &&
      box.itemSlotType === 0 &&
      box.itemQuility === 0 &&
      box.itemPrice === 0 &&
      box.itemBoxIndex === 0 &&
      box.itemType.length === 0
    ))).toBe(true);
    expect(plan.revealKind).toBe('identity');
    expect(plan.identityHint).toBe(true);
    expect(plan.implementationStatus).toBe('implemented');
    expect(plan.description).toContain('藏品本体');
  });

  it('links every Hero cast skill and every Skill effect to original SkillEffect rows', () => {
    const missingHeroSkills: Array<{ heroId: number; skillId: number }> = [];
    const missingSkillEffects: Array<{ skillId: number; effectId: number }> = [];

    for (const hero of Hero) {
      for (const skillId of hero.cast_type.filter((id) => id > 0)) {
        if (!skillById(skillId)) {
          missingHeroSkills.push({ heroId: hero.id, skillId });
        }
      }
    }

    for (const skill of Skill) {
      for (const effectId of skill.skilleffect_position.filter((id) => id > 0)) {
        if (!skillEffectById(effectId)) {
          missingSkillEffects.push({ skillId: skill.id, effectId });
        }
      }
    }

    expect(missingHeroSkills).toEqual([]);
    expect(missingSkillEffects).toEqual([]);
    expect(new Set(SkillEffect.map((effect) => effect.Category)).size).toBeGreaterThan(1);
  });

  it('links visible BidMap rows to Map parents, Drop leaves, RankMap rules, and map SkillGroup rows', () => {
    const invalidBidMaps: Array<{ bidMapId: number; reason: string }> = [];
    let directRankMapCount = 0;

    for (const bidMap of BidMap.filter((row) => row.is_visiable === 1)) {
      if (!Map.some((row) => row.id === bidMap.parent_map_id)) {
        invalidBidMaps.push({ bidMapId: bidMap.id, reason: 'missing parent Map' });
      }
      if (RankMap.some((row) => row.id === bidMap.id)) {
        directRankMapCount += 1;
      } else if (RankMap.length === 0) {
        invalidBidMaps.push({ bidMapId: bidMap.id, reason: 'missing RankMap fallback' });
      }
      const [routeType, routeGroupId] = bidMap.drop_group_id;
      if (routeType === 9999 && routeGroupId && dropsForGroup(routeGroupId).length === 0) {
        invalidBidMaps.push({ bidMapId: bidMap.id, reason: 'missing Drop group' });
      }
      for (const groupId of bidMap.map_random_skill.filter((id) => id > 0)) {
        const group = SkillGroup.find((row) => row.groupid === groupId);
        if (!group || group.skill_group.every(([skillId]) => !skillById(skillId))) {
          invalidBidMaps.push({ bidMapId: bidMap.id, reason: `missing map SkillGroup ${groupId}` });
        }
      }
    }

    expect(invalidBidMaps).toEqual([]);
    expect(directRankMapCount).toBeGreaterThan(0);
  });

  it('uses RankAi tuning and Emoji rows for BidKing core bot actions', () => {
    const match = createMatch({
      id: 'compat-bot-ai',
      players,
      seed: 12345,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);
    const bot = match.players.find((player) => player.kind === 'bot')!;
    bot.skillCooldown = 1;
    bot.skillUsesRemaining = 0;
    setRoundPhase(match, 'reveal', 3200, 1200);

    const action = chooseBotAction(match, bot.id, 'mentor');

    expect(RankAi.length).toBeGreaterThan(0);
    expect(RankAi.every((row) => row.risk_appetite >= 0 && row.risk_appetite <= 1)).toBe(true);
    expect(action.type).toBe('emote');
    const expectedHeroId = bidKingHeroIdForRoleId(bot.roleId, match.config.roles);
    const expectedRankAi = RankAi.find((row) =>
      row.role_id === expectedHeroId &&
      row.round_count === match.roundIndex + 1
    )!;
    expect(action.audit?.rankAiRowId).toBe(expectedRankAi.id);
    expect(action.audit?.riskAppetite).toBeGreaterThan(0);
    expect(action.audit?.rankAiMinBidRatio).toEqual(expect.any(Number));
    expect(action.audit?.rankAiPkRatio).toEqual(expect.any(Number));
    expect(action.audit?.rankAiBidTimeSeconds).toEqual(expect.any(Number));
    expect(Emoji.map((row) => bidKingRawTableDisplayName(row))).toContain(action.emote);
  });

  it('uses RankAi item usage groups to choose bot battle items', () => {
    const match = createMatch({
      id: 'rank-ai-item-2',
      players: [
        { id: 'p1', name: '玩家一', kind: 'human' as const, roleId: 'appraiser', heroCid: 101 },
        { id: 'b1', name: '机器人', kind: 'bot' as const, roleId: 'appraiser', heroCid: 101 }
      ],
      seed: 1002,
      totalRounds: 5,
      coreMode: true,
      coreBidMapId: 2101
    });
    startNextRound(match, 1000);
    setRoundPhase(match, 'intel', 3200, 1200);
    const bot = match.players.find((player) => player.id === 'b1')!;
    bot.skillCooldown = 99;
    bot.skillUsesRemaining = 0;

    const action = chooseBotAction(match, bot.id, 'clue_reader');

    expect(action.type).toBe('battle_item');
    expect(BattleItem.some((item) => item.id === action.itemId)).toBe(true);
    expect(action.itemUsageGroupId).toBeGreaterThan(0);
    expect(action.audit).toEqual(expect.objectContaining({
      rankAiRowId: 1011,
      rankAiItemUseProbability: 700,
      rankAiItemUsageGroupId: action.itemUsageGroupId,
      battleItemId: action.itemId
    }));
    expect(action.audit?.behaviorTree).toContain('IntelBattleItemSequence');
  });

  it('binds core bot bidding to heroCid and source RankAi bid ratios', () => {
    const botHero = Hero[9]!;
    const match = createMatch({
      id: 'probe-bot-ai',
      players: players.map((player) => player.id === 'p2' ? { ...player, heroCid: botHero.id } : player),
      seed: 12345,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);
    match.players.forEach((player) => {
      player.cash = 1_000_000;
    });
    const bot = match.players.find((player) => player.id === 'p2')!;
    bot.skillCooldown = 1;
    bot.skillUsesRemaining = 0;
    for (const item of BattleItem) {
      bot.battleItemCooldowns[String(item.id)] = 1;
    }
    setRoundPhase(match, 'auction', 60000, 1200);

    const action = chooseBotAction(match, bot.id, 'mentor');

    const seatHero = Hero[bot.seat % Hero.length]!;
    const expectedRankAi = RankAi.find((row) =>
      row.role_id === botHero.id &&
      row.round_count === match.roundIndex + 1
    )!;
    expect(botHero.id).not.toBe(seatHero.id);
    expect(action.audit?.rankAiRowId).toBe(expectedRankAi.id);
    expect(action.audit?.rankAiRoleId).toBe(botHero.id);
    expect(action.audit?.rankAiMinBidRatio).toBeGreaterThan(1000);
    expect(action.audit?.maxBidRatio).toBeGreaterThan(1);
    expect(action.audit?.targetBidRatio).toBeGreaterThan(1);
    expect(action.type).toBe('bid');
    expect(action.audit?.actionBidRatio).toBeGreaterThan(1);
  });

  it('disables manual hero skills in BidKing core mode', () => {
    const match = createMatch({
      id: 'compat-skill-before-bid',
      players,
      seed: 2222,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);
    match.players.forEach((player) => {
      player.cash = 1_000_000;
    });
    setRoundPhase(match, 'auction', 60000, 1200);
    expect(() => useSkill(match, 'p1', 'p2', 1400)).toThrow(/automatic/);
  });

  it('uses equipped BattleItem rows as private in-round intel', () => {
    const match = createMatch({
      id: 'compat-battle-item',
      players,
      seed: 3333,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);
    setRoundPhase(match, 'intel', 3200, 1200);
    useBattleItem(match, 'p1', BattleItem[0]!, 1300);
    const group = SkillGroup.find((row) => row.groupid === BattleItem[0]!.skill_group + 100);
    const groupSkillNames = new Set(group?.skill_group.map(([skillId]) => {
      const skill = skillById(skillId);
      return skill ? bidKingSkillDisplayName(skill) : undefined;
    }).filter(Boolean));
    const itemEntry = match.currentRound?.skillFeed.at(-1);
    const eventPayload = match.events.at(-1)?.payload as { effectPlan?: BattleItemEffectPlan } | undefined;
    const itemName = bidKingBattleItemDisplayName(BattleItem[0]!);

    expect(match.players[0]?.privateClues.at(-1)?.text).toContain(itemName);
    expect(itemEntry?.source).toBe('item');
    expect(groupSkillNames.has(itemEntry?.skillName.split(' · ')[0])).toBe(true);
    expect(eventPayload?.effectPlan?.itemId).toBe(BattleItem[0]!.id);
    expect(eventPayload?.effectPlan?.targetCount).toBeGreaterThan(0);
    expect(eventPayload?.effectPlan?.description).toContain(itemName);
    expect((buildSnapshot(match, 'p1').public.currentRound?.skillFeed ?? []).some((entry) => entry.source === 'item')).toBe(true);
    expect((buildSnapshot(match, 'p2').public.currentRound?.skillFeed ?? []).some((entry) => entry.source === 'item')).toBe(false);
  });

  it('archives source-shaped GameData logs for BidKing replay and settlement evidence', () => {
    const match = createMatch({
      id: 'compat-game-data',
      players: players.map((player, index) => index === 0
        ? {
            ...player,
            heroCid: Hero[1]!.id,
            heroSkinCid: 1410201,
            selectedItemList: [{ stockId: 5001, boxId: 7, itemCid: BattleItem[0]!.id }]
          }
        : player),
      seed: 3340,
      totalRounds: 5,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);
    match.players.forEach((player) => {
      player.cash = 1_000_000;
    });
    match.currentRound!.index = 4;
    match.roundIndex = 4;
    setRoundPhase(match, 'intel', 3200, 1200);
    const autoHero = Hero[1]!;
    const autoSkill = skillById(autoHero.cast_type.filter((skillId) => skillId > 0)[0]!)!;
    useBattleItem(match, 'p1', BattleItem[0]!, 1300);
    setRoundPhase(match, 'auction', 60000, 1400);
    submitBid(match, 'p1', Math.max(match.currentRound?.container.minimumBid ?? 0, 500_000), 1500);
    submitBid(match, 'p2', Math.max(match.currentRound?.container.minimumBid ?? 0, 100_000), 1600);
    settleCurrentRound(match, 1700);
    const warehouseSlotsBeforeArchive = match.currentRound?.container.warehouseSlots.map((slot) => ({ ...slot })) ?? [];
    finishRound(match, 1800);
    startNextRound(match, 1900);

    const gameData = match.roundHistory[0]?.bidKingGameData;
    const p1Log = gameData?.userLog.find((entry) => entry.playerId === 'p1');
    const firstStockBox = gameData?.stockContainer.stockBoxes[0];
    const firstWarehouseSlot = warehouseSlotsBeforeArchive[0];

    expect(gameData?.uid).toBe('compat-game-data:compat-game-data_round_1');
    expect(gameData?.round).toBe(5);
    expect(gameData?.mapId).toBeGreaterThan(0);
    expect(gameData?.stockContainer.stockBoxes.length).toBe(match.roundHistory[0]?.revealedItems.length);
    expect(gameData?.userLog).toHaveLength(4);
    expect(p1Log?.heroCid).toBe(Hero[1]!.id);
    expect(p1Log?.heroSkinCid).toBe(1410201);
    expect(p1Log?.selectItemList).toEqual([{ stockId: 5001, boxId: 7, itemCid: BattleItem[0]!.id }]);
    expect(gameData?.selectItemCount).toBe(1);
    expect(p1Log?.priceLog.at(-1)?.itemCidOrPrice).toBeGreaterThanOrEqual(500_000);
    expect(p1Log?.useItemLog.at(-1)?.itemCidOrPrice).toBe(BattleItem[0]!.id);
    expect(firstStockBox?.boxId).toBe(firstWarehouseSlot ? firstWarehouseSlot.y * 10 + firstWarehouseSlot.x : undefined);
    expect(firstStockBox?.item.rotate).toBe(firstWarehouseSlot?.rotate ?? false);
    expect(gameData?.stockContainer.stockBoxes.some((box) => box.item.rotate)).toBe(warehouseSlotsBeforeArchive.some((slot) => slot.rotate));
    const autoSkillLog = gameData?.heroSkillLog.find((entry) => entry.skillCid === autoSkill.id);
    const firstHitBox = autoSkillLog?.hitBoxList[0];
    const autoEffect = skillEffectById(autoSkill.skilleffect_position[0]!)!;
    expect(autoSkillLog?.allHitItemAvgBoxIndex).toBeGreaterThan(0);
    expect(firstHitBox?.boxId).toBeGreaterThanOrEqual(0);
    expect(autoEffect.Category).toBe(1);
    expect(firstHitBox?.itemSlotType).toBeGreaterThan(0);
    expect(firstHitBox?.itemCid).toBe(0);
    expect(firstHitBox?.itemPrice).toBe(0);
    expect(firstHitBox?.itemQuility).toBeGreaterThan(0);
    expect(firstHitBox?.itemBoxIndex).toBe(0);
    expect(firstHitBox?.itemType).toEqual([]);
    expect(autoSkillLog?.hitItemTypeList.length).toBeGreaterThan(0);
    expect(gameData?.itemSkillLog.some((entry) => entry.itemCid === BattleItem[0]!.id)).toBe(true);
    expect(buildSnapshot(match, 'p1').public.finalSummary?.bidKingReplay).toHaveLength(1);
  });

  it('tracks BattleItem cooldowns in private snapshots', () => {
    const match = createMatch({
      id: 'compat-battle-item-cooldown',
      players,
      seed: 3334,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);
    setRoundPhase(match, 'intel', 3200, 1200);
    match.players[0]!.battleItemCooldowns[String(BattleItem[0]!.id)] = 2;

    expect(battleItemCooldownRemaining(match, 'p1', BattleItem[0]!.id)).toBe(2);
    expect(() => useBattleItem(match, 'p1', BattleItem[0]!, 1300)).toThrow(/cooldown/);
    expect(buildSnapshot(match, 'p1').private?.battleItemCooldowns?.[String(BattleItem[0]!.id)]).toBe(2);

    startNextRound(match, 1400);

    expect(battleItemCooldownRemaining(match, 'p1', BattleItem[0]!.id)).toBe(1);
    expect(buildSnapshot(match, 'p1').private?.battleItemCooldowns?.[String(BattleItem[0]!.id)]).toBe(1);
  });

  it('maps every BattleItem skill group to at least one Skill and SkillEffect row', () => {
    const missingGroups: number[] = [];
    const missingEffects: number[] = [];
    const missingPlans: number[] = [];
    const revealKinds = new Set<BattleItemEffectPlan['revealKind']>();
    const implementationStatuses = new Set<BattleItemEffectPlan['implementationStatus']>();
    let skillTargetAwarePlans = 0;

    for (const item of BattleItem) {
      const group = skillGroupForBattleItem(item);
      const skills = group?.skill_group
        .map(([skillId]) => skillById(skillId))
        .filter(Boolean) ?? [];
      if (skills.length === 0) {
        missingGroups.push(item.id);
        continue;
      }
      for (const skill of skills) {
        const effectId = skill?.skilleffect_position[0];
        if (effectId && !skillEffectById(effectId)) {
          missingEffects.push(item.id);
        }
      }
      const plan = battleItemEffectPlanForItem(item);
      revealKinds.add(plan.revealKind);
      implementationStatuses.add(plan.implementationStatus);
      if (plan.skillTarget !== 0 || plan.secondaryTargets.some((target) => target.target !== 0)) {
        skillTargetAwarePlans += 1;
      }
      if (
        !plan.skillId
        || !plan.effectId
        || plan.targetCount < 1
        || plan.requestedTargetCount < 1
        || plan.cooldownRounds < 0
        || plan.durationRounds < 0
        || plan.description.length === 0
      ) {
        missingPlans.push(item.id);
      }
    }

    expect(missingGroups).toEqual([]);
    expect(missingEffects).toEqual([]);
    expect(missingPlans).toEqual([]);
    expect(revealKinds.size).toBeGreaterThan(1);
    expect(implementationStatuses.has('implemented')).toBe(true);
    expect(skillTargetAwarePlans).toBeGreaterThan(0);
  });

  it('replays the same BidKing core seed and action script deterministically', () => {
    expect(runDeterministicCoreReplay(4444)).toEqual(runDeterministicCoreReplay(4444));
  });
});

function runDeterministicCoreReplay(seed: number): string {
  const match = createMatch({
    id: `compat-replay-${seed}`,
    players,
    seed,
    totalRounds: 5,
    coreMode: true,
    coreAuctionMode: 'sealed'
  });
  for (const player of match.players) {
    player.cash = 1_000_000;
  }
  startNextRound(match, 1000);

  let previousBaseBid = 0;
  for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
    setRoundPhase(match, 'auction', 60000, 1200 + roundIndex * 1000);
    const minimumBid = match.currentRound?.container.minimumBid ?? 0;
    const baseBid = Math.max(previousBaseBid + 5000, minimumBid, 50000 + roundIndex * 5000);
    previousBaseBid = baseBid;
    submitBid(match, 'p1', baseBid + 4000, 1300 + roundIndex * 1000);
    submitBid(match, 'p2', baseBid, 1400 + roundIndex * 1000);
    settleCurrentRound(match, 1500 + roundIndex * 1000);
    finishRound(match, 1700 + roundIndex * 1000);
    startNextRound(match, 1800 + roundIndex * 1000);
  }

  return JSON.stringify({
    status: match.status,
    finalSummary: match.finalSummary,
    roundHistory: match.roundHistory.map((round) => ({
      id: round.roundId,
      bids: round.bids,
      bidFeedback: round.bidFeedback,
      settlement: normalizeClueReviewIds(round.settlement),
      revealedItems: round.revealedItems.map((item) => ({
        id: item.id,
        value: item.value,
        rarity: item.rarity,
        isFake: item.isFake
      }))
    })),
    transactions: match.transactions
  });
}

function normalizeClueReviewIds<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (key, entry) => (
    key === 'clueId' && typeof entry === 'string'
      ? entry.replace(/_(\d+)$/, '_n')
      : entry
  ))) as T;
}
