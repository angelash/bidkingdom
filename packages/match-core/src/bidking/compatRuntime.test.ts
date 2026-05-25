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
  Shop,
  ShopItem,
  Skill,
  SkillEffect,
  SkillGroup,
  bidKingBattleItemDisplayName,
  bidKingRawTableDisplayName,
  bidKingSkillDisplayName,
  dropsForGroup,
  itemById,
  skillById,
  skillEffectById,
  validateBidKingParity
} from '@bitkingdom/bidking-compat';
import type {
  BidKingGameDataSnapshot,
  BidKingGameSkillDataSnapshot,
  BidKingSimGameLogSnapshot,
  SkillFeedEntry
} from '@bitkingdom/shared';
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
import { battleItemCooldownRemaining, battleItemEffectPlanForItem, skillForBattleItem, skillGroupForBattleItem, useBattleItem } from '../items';
import type { BattleItemEffectPlan } from '../items';
import { bidKingHeroIdForRoleId } from './heroRuntime';
import { BID_KING_BIDDER_ROLE_BINDINGS } from './bidderCatalog';
import { buildBidKingGameDataSnapshot } from './gameDataRuntime';
import {
  bidKingKnowledgeByItemIdFromSkillFeed,
  bidKingItemRowForSlot,
  bidKingSkillRequiresTargetBox,
  bidKingSourceHitBoxList,
  bidKingSourceTargetCountForCandidateCount,
  selectBidKingSlotsBySkill,
  type BidKingKnownInfoState
} from './skillTargeting';
import {
  bidKingSkillEffectAffectsWarehouseKnowledge,
  bidKingSkillEffectPublicFields,
  bidKingSkillEffectRuntimeProfile
} from './skillEffectRuntime';
import {
  bidKingApplySimGameDataUpdate,
  bidKingApplySimGameLogRefresh,
  bidKingApplySimSystemEffectOperation,
  bidKingBuySimShopItem,
  bidKingCanBuySimShopItem,
  bidKingCanUseSimBuffItem,
  bidKingChooseGameWinItem,
  bidKingSimHeroSkillCastRequestsForOperation,
  bidKingSimItemStateModeChangeForOperation,
  bidKingSimGameLogForTrainingState,
  bidKingSimGameWinItemCandidatePoolForLevel,
  bidKingSimGameWinItemDropGroupIdForLevel,
  bidKingSimPostGameRewardsForOperation,
  bidKingSimShopItemCost,
  bidKingSimShopItemsSorted,
  bidKingSimShopRemainingBuyCount,
  bidKingSimBuffItemMaxPower,
  bidKingSimBuffItemUseCost,
  bidKingSimTrainingStateForGameLog,
  bidKingSimTrainingStateForPlayer,
  bidKingUseSimBuffItem,
  bidKingUseSimSelectItem,
  bidKingWriteSimTrainingStateToPlayer
} from './simItemRuntime';
import {
  bidKingSimSkillMatchesTrigger,
  bidKingSimSkillTriggerProfileForSkill,
  bidKingSimSkillTriggerProfilesForItem
} from './simSkillTriggerRuntime';
import {
  bidKingApplySimSkillTriggerEvent,
  bidKingApplySimTrainingGameLogRefresh,
  bidKingApplySimTrainingNextRoundGameData,
  bidKingApplySimTrainingTestSkillCastResponse,
  bidKingApplySimTrainingWinItemChoice,
  bidKingExplicitSimSkillTriggerSources,
  bidKingSimSkillTriggerSourcesForState,
  bidKingSimTrainingBidPriceRequest,
  bidKingSimTrainingGameLogRefreshRequest,
  bidKingSimTrainingGameOverResult,
  bidKingSimTrainingItemRequiresTargetBox,
  bidKingSimTrainingNoPlaySkillLogs,
  bidKingSimTrainingTestSkillCastRequest,
  bidKingSimTrainingUnplayedSkillLogs,
  bidKingSimTrainingWinItemChoiceRequest,
  bidKingUseSimTrainingBuffItem,
  bidKingUseSimTrainingSelectItem
} from './simTrainingEventRuntime';
import {
  bidKingApplySystemSkillEffectLimits,
  bidKingGameDataSystemLimitsForSkillIds,
  bidKingSystemEffectOperationForSkillEffect,
  bidKingSystemEffectOperationsForSkillIds
} from './systemEffectRuntime';

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
    expect(match.currentRound?.container.hiddenItems.length).toBeGreaterThanOrEqual(16);
    expect(match.currentRound?.warehouseSlots.length).toBe(match.currentRound?.container.hiddenItems.length);
    expect(match.currentRound?.container.publicClues).toEqual([]);
    expect(match.currentRound?.container.minimumBid).toBeGreaterThan(0);
    expect([50000, 60000]).toContain(match.currentRound?.container.auctionDurationMs);
    expect(match.players[0]?.privateClues.some((clue) => clue.source === 'skill')).toBe(true);
    expect(match.currentRound?.skillFeed.some((entry) => entry.source === 'map')).toBe(true);
    expect(match.currentRound?.skillFeed.some((entry) => entry.playerId === 'p1' && entry.source === 'hero')).toBe(true);
    const publicRound = buildSnapshot(match, 'p1').public.currentRound;
    expect(publicRound?.container.estimateHidden).toBe(true);
    expect(publicRound?.container.estimateMin).toBe(0);
    expect(publicRound?.container.estimateMax).toBe(0);
    expect(publicRound?.publicClues).toEqual([]);
    const publicFeed = publicRound?.skillFeed ?? [];
    expect(publicFeed.some((entry) => entry.source === 'map')).toBe(true);
    expect(publicFeed.some((entry) => entry.playerId === 'p2')).toBe(false);
  });

  it('tags core match events with source protocol references without exposing sealed bid amounts', () => {
    const match = createMatch({
      id: 'compat-protocol-trace',
      players,
      seed: 1235,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);
    const roundStarted = match.events.find((event) => event.type === 'round_started');
    expect(roundStarted?.sourceProtocols?.map((protocol) => protocol.name)).toEqual(['S2C_33_game_start_notify']);

    setRoundPhase(match, 'auction', 60000, 1050);
    submitBid(match, 'p1', 120_000, 1100);
    const bidEvent = match.events.find((event) => event.type === 'bid_submitted');
    expect(bidEvent?.sourceProtocols?.map((protocol) => protocol.name)).toEqual([
      'C2S_34_game_bid',
      'S2C_35_game_bid',
      'S2C_119_game_user_bid_price_notify'
    ]);
    expect((bidEvent?.payload as { amount?: number } | undefined)?.amount).toBeUndefined();
  });

  it('keeps open core bid amounts hidden until the round feedback is produced', () => {
    const match = createMatch({
      id: 'compat-open-bid-visibility',
      players,
      seed: 1236,
      coreMode: true,
      coreAuctionMode: 'open'
    });
    startNextRound(match, 1000);
    setRoundPhase(match, 'auction', 60000, 1050);
    submitBid(match, 'p1', 120_000, 1100);
    submitBid(match, 'p2', 90_000, 1200);

    const pendingSnapshot = buildSnapshot(match, 'p1').public.currentRound;
    expect(pendingSnapshot?.bids.map((bid) => ({ playerId: bid.playerId, amount: bid.amount, visible: bid.visible }))).toEqual([
      { playerId: 'p1', amount: 0, visible: false },
      { playerId: 'p2', amount: 0, visible: false }
    ]);
    expect(pendingSnapshot?.bidFeedback).toBeUndefined();
    expect(pendingSnapshot?.currentBid).toBe(0);
    expect(pendingSnapshot?.currentLeaderId).toBeUndefined();

    settleCurrentRound(match, 1300);

    const feedbackSnapshot = buildSnapshot(match, 'p1').public.currentRound;
    expect(feedbackSnapshot?.bids.map((bid) => ({ playerId: bid.playerId, amount: bid.amount, visible: bid.visible }))).toEqual([
      { playerId: 'p1', amount: 120_000, visible: true },
      { playerId: 'p2', amount: 90_000, visible: true }
    ]);
    expect(feedbackSnapshot?.bidFeedback?.publicRanking.map((entry) => ({
      playerId: entry.playerId,
      amount: entry.amount,
      visibleAmount: entry.visibleAmount
    }))).toEqual([
      { playerId: 'p1', amount: 120_000, visibleAmount: true },
      { playerId: 'p2', amount: 90_000, visibleAmount: true }
    ]);
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
    expect(feedEntry?.effectName).toContain('轮廓');
    expect(feedEntry?.effectName).toContain('品质');
    expect(feedEntry?.text).toContain('轮廓');
    expect(feedEntry?.text).toContain('品质');
    expect(feedEntry?.hitBoxList?.length).toBe(feedEntry?.targetCount);
    expect(feedEntry?.hitBoxList?.[0]?.itemSlotType).toBeGreaterThan(0);
    expect(feedEntry?.hitBoxList?.[0]?.itemCid).toBe(0);
    expect(feedEntry?.hitBoxList?.[0]?.itemPrice).toBe(0);
    expect(feedEntry?.hitBoxList?.[0]?.itemQuility).toBeGreaterThan(0);
    expect(match.currentRound?.skillFeed.some((entry) => entry.playerId === 'p1' && entry.source === 'hero')).toBe(true);
    expect(buildSnapshot(match, 'p1').public.players[0]?.bidRanks?.[0]?.usedSkillName).toBeTruthy();
  });

  it('triggers Hero.cast_type automatic skills on later rounds with accumulated known-state targeting', () => {
    const hero = Hero.find((candidate) => candidate.id === 104)!;
    const match = createMatch({
      id: 'compat-multi-round-hero-skill',
      players: players.map((player) => player.id === 'p1' ? { ...player, heroCid: hero.id } : player),
      seed: 91014,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    match.players.forEach((player) => {
      player.cash = 1_000_000;
    });
    startNextRound(match, 1000);

    const firstSkill = skillById(hero.cast_type[0]!)!;
    const firstFeed = match.currentRound?.skillFeed.find((entry) => entry.source === 'hero' && entry.playerId === 'p1');
    const firstTargets = firstFeed?.targetItemIds ?? [];
    expect(firstFeed?.skillCid).toBe(firstSkill.id);
    expect(firstFeed?.round).toBe(1);
    expect(firstTargets).toHaveLength(2);

    advanceCoreAuctionRound(match, 1500);

    const secondSkill = skillById(hero.cast_type[1]!)!;
    const secondFeed = match.currentRound?.skillFeed.find((entry) => entry.source === 'hero' && entry.playerId === 'p1');
    const secondTargets = secondFeed?.targetItemIds ?? [];
    const secondEvent = match.events.find((event) => {
      const payload = event.payload as { entry?: SkillFeedEntry } | undefined;
      return event.type === 'skill_triggered'
        && event.actorId === 'p1'
        && payload?.entry?.skillCid === secondSkill.id;
    });

    expect(match.currentRound?.index).toBe(1);
    expect(secondFeed?.skillCid).toBe(secondSkill.id);
    expect(secondFeed?.round).toBe(2);
    expect(secondFeed?.visibility).toBe('private');
    expect(secondFeed?.hitBoxList?.length).toBe(secondFeed?.targetCount);
    expect(secondTargets).toHaveLength(2);
    expect(secondTargets.some((itemId) => firstTargets.includes(itemId))).toBe(false);
    expect(match.players[0]?.privateClues.some((clue) => clue.id.includes(`_auto_p1_2_${hero.id}_${secondSkill.id}`))).toBe(true);
    expect(secondEvent).toBeDefined();
  });

  it('interprets percentage skill counts as ten-thousand ratios for source hero skills', () => {
    const hero = Hero.find((candidate) => candidate.id === 207)!;
    const ratioSkill = skillById(10002073)!;
    const match = createMatch({
      id: 'compat-percentage-skill-count',
      players: players.map((player) => player.id === 'p1' ? { ...player, heroCid: hero.id } : player),
      seed: 91015,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    match.players.forEach((player) => {
      player.cash = 1_000_000;
    });
    startNextRound(match, 1000);
    advanceCoreAuctionRound(match, 1500);
    advanceCoreAuctionRound(match, 2500);
    advanceCoreAuctionRound(match, 3500);

    const candidateCount = match.currentRound!.container.warehouseSlots
      .filter((slot) => bidKingItemRowForSlot(slot)?.item_type_id === ratioSkill.skilltargetvalue[0])
      .length;
    const expectedTargetCount = bidKingSourceTargetCountForCandidateCount(ratioSkill, candidateCount);
    const feed = match.currentRound?.skillFeed.find((entry) => entry.source === 'hero' && entry.playerId === 'p1');

    expect(ratioSkill.skill_count_type).toBe(2);
    expect(ratioSkill.skill_count).toBe(3333);
    expect(feed?.skillCid).toBe(ratioSkill.id);
    expect(feed?.targetCount).toBe(expectedTargetCount);
    expect(feed?.targetCount).toBeLessThan(3333);
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
    match.players.forEach((player) => {
      player.cash = 1_000_000;
    });
    startNextRound(match, 1000);

    expect(match.currentRound?.skillFeed.some((entry) => entry.source === 'hero' && entry.playerId === 'p1')).toBe(false);
    expect(match.events.some((event) => event.type === 'skill_triggered' && event.actorId === 'p1')).toBe(false);
    expect(match.players[0]?.privateClues.some((clue) => clue.text.includes(delayedHero.packaged_name))).toBe(false);

    const triggerRoundIndex = delayedHero.cast_type.findIndex((skillId) => skillId > 0);
    for (let index = 0; index < triggerRoundIndex; index += 1) {
      advanceCoreAuctionRound(match, 1500 + index * 1000);
    }

    const delayedSkill = skillById(delayedHero.cast_type[triggerRoundIndex]!)!;
    const delayedFeed = match.currentRound?.skillFeed.find((entry) => entry.source === 'hero' && entry.playerId === 'p1');
    const delayedEvent = match.events.find((event) => {
      const payload = event.payload as { entry?: SkillFeedEntry } | undefined;
      return event.type === 'skill_triggered'
        && event.actorId === 'p1'
        && payload?.entry?.skillCid === delayedSkill.id;
    });
    expect(match.currentRound?.index).toBe(triggerRoundIndex);
    expect(delayedFeed?.skillCid).toBe(delayedSkill.id);
    expect(delayedFeed?.round).toBe(triggerRoundIndex + 1);
    expect(match.players[0]?.privateClues.some((clue) => clue.id.includes(`_auto_p1_${triggerRoundIndex + 1}_${delayedHero.id}_${delayedSkill.id}`))).toBe(true);
    expect(delayedEvent).toBeDefined();
  });

  it('matches every bidder catalog hero to its source cast_type trigger rounds', () => {
    for (const binding of BID_KING_BIDDER_ROLE_BINDINGS) {
      const hero = Hero.find((candidate) => candidate.id === binding.sourceHeroId)!;
      const match = createMatch({
        id: `compat-bidder-cast-type-${hero.id}`,
        players: players.map((player) => player.id === 'p1' ? { ...player, heroCid: hero.id } : player),
        seed: 93000 + hero.id,
        totalRounds: 5,
        coreMode: true,
        coreAuctionMode: 'sealed'
      });
      match.players.forEach((player) => {
        player.cash = 1_000_000;
      });
      startNextRound(match, 1000);

      for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
        const expectedSkillId = hero.cast_type[roundIndex] ?? 0;
        const exactFeedId = `${match.currentRound!.id}_hero_skill_p1_${expectedSkillId}`;
        const mainFeed = match.currentRound?.skillFeed.find((entry) => entry.id === exactFeedId);
        const p1HeroFeeds = match.currentRound?.skillFeed.filter((entry) => (
          entry.source === 'hero' && entry.playerId === 'p1'
        )) ?? [];

        if (expectedSkillId > 0) {
          expect(mainFeed?.skillCid).toBe(expectedSkillId);
          expect(mainFeed?.round).toBe(roundIndex + 1);
        } else {
          expect(p1HeroFeeds).toEqual([]);
        }

        if (roundIndex < 4) {
          advanceCoreAuctionRound(match, 1500 + roundIndex * 1000);
        }
      }
    }
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
    const countLog = buildBidKingGameDataSnapshot(match, match.currentRound!).heroSkillLog.find((entry) => entry.skillCid === 100106);
    const plan = battleItemEffectPlanForItem(BattleItem[0]!, { skill: identitySkill, effect: identityEffect });
    expect(clue?.text).toContain('命中数量');
    expect(clue?.text).not.toContain('合计价值');
    expect(countFeed?.effectCategory).toBe(4);
    expect(countFeed?.targetCount).toBe(countFeed?.hitBoxList?.length);
    expect(countLog?.hitItemIndex).toBe(countFeed?.targetItemIds?.length);
    expect(countLog?.hitItemIndex).toBe(countFeed?.hitBoxList?.length);
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

  it('emits composite panel effects for bidder skills with split original descriptions', () => {
    const cases = [
      { heroId: 110, skillId: 100110, suffix: 'jewelry_shape', category: 1, maxTargets: 4 },
      { heroId: 106, skillId: 100106, suffix: 'trend_digital_shape', category: 1 },
      { heroId: 203, skillId: 100203, suffix: 'antique_rank', category: 7, maxTargets: 2 },
      { heroId: 206, skillId: 100206, suffix: 'book_painting_shape', category: 1 }
    ];

    for (const entryCase of cases) {
      const match = createMatch({
        id: `compat-composite-${entryCase.heroId}`,
        players: players.map((player) => player.id === 'p1' ? { ...player, heroCid: entryCase.heroId } : player),
        seed: 92000 + entryCase.heroId,
        coreMode: true,
        coreAuctionMode: 'sealed'
      });
      startNextRound(match, 1000);

      const compositeFeed = match.currentRound?.skillFeed.find((entry) => (
        entry.playerId === 'p1' &&
        entry.skillCid === entryCase.skillId &&
        entry.id.endsWith(entryCase.suffix)
      ));
      expect(compositeFeed?.effectCategories).toEqual([entryCase.category]);
      expect(compositeFeed?.targetCount ?? 0).toBeGreaterThan(0);
      if (entryCase.maxTargets) {
        expect(compositeFeed?.targetCount ?? 0).toBeLessThanOrEqual(entryCase.maxTargets);
      }
    }
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

  it('classifies SkillEffect categories by source client behavior boundaries', () => {
    const warehouseCategories = [...new Set(
      SkillEffect
        .filter((effect) => bidKingSkillEffectAffectsWarehouseKnowledge(effect.Category))
        .map((effect) => effect.Category)
    )].sort((left, right) => left - right);
    const aggregateCategories = [2, 3, 4, 8, 9, 10];
    const textOnlyCategories = [12, 13, 14];
    const systemCategories = [16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 28];

    expect(warehouseCategories).toEqual([1, 5, 6, 7, 11, 22]);
    expect(aggregateCategories.every((category) => bidKingSkillEffectRuntimeProfile(category).runtimeKind === 'aggregate')).toBe(true);
    expect(textOnlyCategories.every((category) => bidKingSkillEffectRuntimeProfile(category).runtimeKind === 'text')).toBe(true);
    expect(systemCategories.every((category) => bidKingSkillEffectRuntimeProfile(category).runtimeKind === 'system')).toBe(true);
    expect(bidKingSkillEffectRuntimeProfile(15).runtimeKind).toBe('unsupported');
    expect(bidKingSkillEffectPublicFields([5]).itemPrice).toBe(true);
    expect(bidKingSkillEffectPublicFields([14]).itemPrice).toBe(false);
    expect(bidKingSkillEffectPublicFields([13]).itemType).toBe(false);
  });

  it('keeps non-warehouse SkillEffect categories out of BattleItem clue targeting semantics', () => {
    const textTypePlan = battleItemEffectPlanForItem(BattleItem[0]!, { effect: skillEffectById(13000) });
    const systemSkill = skillById(3056)!;
    const systemEffect = skillEffectById(16001)!;
    const systemPlan = battleItemEffectPlanForItem(BattleItem[0]!, { skill: systemSkill, effect: systemEffect });

    expect(textTypePlan.revealKind).toBe('category');
    expect(textTypePlan.implementationStatus).toBe('implemented');
    expect(systemPlan.revealKind).toBe('system');
    expect(systemPlan.targetMode).toBe('system_effect');
    expect(systemPlan.targetPlayerRequired).toBe(false);
    expect(systemPlan.implementationStatus).toBe('simplified');
    expect(systemPlan.description).toContain('非仓库情报效果');
  });

  it('applies source system SkillEffect limits to GameData and round item-use gates', () => {
    expect(bidKingGameDataSystemLimitsForSkillIds([])).toEqual({
      roundCanUseItemCount: 1,
      gameCarryItemMax: 3,
      gameGoldRateMax: 0
    });
    expect(bidKingGameDataSystemLimitsForSkillIds([3049]).roundCanUseItemCount).toBe(2);
    expect(bidKingGameDataSystemLimitsForSkillIds([3056]).gameCarryItemMax).toBe(6);

    const defaultMatch = createMatch({
      id: 'compat-battle-item-round-limit-default',
      players,
      seed: 3335,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(defaultMatch, 1000);
    setRoundPhase(defaultMatch, 'intel', 3200, 1200);
    useBattleItem(defaultMatch, 'p1', BattleItem[0]!, 1300);

    expect(buildSnapshot(defaultMatch, 'p1').private?.battleItemUseLimitThisRound).toBe(1);
    expect(buildSnapshot(defaultMatch, 'p1').private?.battleItemUsesRemainingThisRound).toBe(0);
    expect(() => useBattleItem(defaultMatch, 'p1', BattleItem[0]!, 1400)).toThrow(/use limit/);

    const boostedMatch = createMatch({
      id: 'compat-battle-item-round-limit-boosted',
      players,
      seed: 3336,
      coreMode: true,
      coreAuctionMode: 'sealed',
      bidKingActiveSystemSkillIds: [3049, 3056]
    });
    startNextRound(boostedMatch, 1000);
    setRoundPhase(boostedMatch, 'intel', 3200, 1200);
    const gameData = buildBidKingGameDataSnapshot(boostedMatch, boostedMatch.currentRound!);

    expect(gameData.roundCanUseItemCount).toBe(2);
    expect(gameData.gameCarryItemMax).toBe(6);
    useBattleItem(boostedMatch, 'p1', BattleItem[0]!, 1300);
    useBattleItem(boostedMatch, 'p1', BattleItem[0]!, 1400);
    expect(buildSnapshot(boostedMatch, 'p1').private?.battleItemUsesThisRound).toBe(2);
    expect(() => useBattleItem(boostedMatch, 'p1', BattleItem[0]!, 1500)).toThrow(/use limit/);
  });

  it('decodes source system SkillEffect 25/27/28 as sim item and hero-skill operations', () => {
    const gain = bidKingSystemEffectOperationsForSkillIds([3067])[0];
    const discard = bidKingSystemEffectOperationsForSkillIds([3066])[0];
    const specifiedHeroSkill = bidKingSystemEffectOperationsForSkillIds([3042])[0];
    const randomHeroSkill = bidKingSystemEffectOperationsForSkillIds([3041])[0];
    const fatima = Hero.find((hero) => hero.id === 101)!;
    const fatimaSkillIds = fatima.cast_type.filter((skillId) => skillId > 0);
    const systemOpSkillIds = Skill
      .filter((skill) => skill.skilleffect_position.some((effectId) => {
        const category = skillEffectById(effectId)?.Category;
        return category === 25 || category === 27 || category === 28;
      }))
      .map((skill) => skill.id);

    expect(systemOpSkillIds).toEqual([3041, 3042, 3054, 3065, 3066, 3067, 3068, 3071]);
    expect(bidKingSystemEffectOperationsForSkillIds(systemOpSkillIds)).toHaveLength(systemOpSkillIds.length);
    expect(gain).toEqual(expect.objectContaining({
      kind: 'gain_sim_item',
      skillId: 3067,
      skillOpt: 21,
      effectId: 25000,
      category: 25,
      sourceParam: [11, 8001, 1],
      itemTypeId: 11,
      itemId: 8001,
      itemCount: 1,
      itemName: itemById(8001)?.packaged_name
    }));
    expect(itemById(8001)?.skills).toEqual([3001]);
    expect(BattleItem.some((item) => item.id === 8001)).toBe(false);

    expect(discard).toEqual(expect.objectContaining({
      kind: 'discard_sim_item',
      skillId: 3066,
      skillOpt: 21,
      effectId: 27000,
      category: 27,
      sourceParam: [1, 11, 0],
      selectorMode: 1,
      itemTypeId: 11,
      itemId: 0
    }));

    expect(specifiedHeroSkill).toEqual(expect.objectContaining({
      kind: 'use_hero_skill',
      mode: 'specified_skin',
      skillId: 3042,
      skillOpt: 11,
      effectId: 28001,
      category: 28,
      sourceParam: [1, 1410101],
      heroSkinCid: 1410101,
      heroCid: 101,
      heroSkillIds: fatimaSkillIds
    }));
    expect(bidKingSystemEffectOperationForSkillEffect(skillEffectById(28001)!)[0]).toEqual(expect.objectContaining({
      kind: 'use_hero_skill',
      mode: 'specified_skin',
      heroSkinCid: 1410101,
      heroCid: 101,
      heroSkillIds: fatimaSkillIds
    }));

    expect(randomHeroSkill).toEqual(expect.objectContaining({
      kind: 'use_hero_skill',
      mode: 'random_other_hero',
      skillId: 3041,
      skillOpt: 11,
      skillOptParam1: [[3, 0]],
      skillOptParam2: [[1, 110]],
      effectId: 28002,
      category: 28,
      sourceParam: [2],
      heroSkillIds: []
    }));
    for (const effectId of [25000, 27000, 28001, 28002]) {
      const effect = skillEffectById(effectId)!;
      expect(bidKingSkillEffectAffectsWarehouseKnowledge(effect.Category)).toBe(false);
      expect(bidKingSkillEffectPublicFields([effect.Category])).toEqual({
        itemSlotType: false,
        itemCid: false,
        itemPrice: false,
        itemQuility: false,
        itemBoxIndex: false,
        itemType: false
      });
    }
  });

  it('decodes remaining source sim system SkillEffects without inventing active skill links', () => {
    const categoriesWithoutCurrentSkillLinks = new Set([17, 18, 19, 20, 24, 26]);
    const linkedByCategory = new globalThis.Map<number, number[]>();
    for (const skill of Skill) {
      for (const effectId of skill.skilleffect_position) {
        const category = skillEffectById(effectId)?.Category;
        if (typeof category !== 'number') {
          continue;
        }
        linkedByCategory.set(category, [...(linkedByCategory.get(category) ?? []), skill.id]);
      }
    }

    for (const category of categoriesWithoutCurrentSkillLinks) {
      expect(linkedByCategory.get(category) ?? []).toEqual([]);
    }
    expect(linkedByCategory.get(23)).toEqual([3069, 3070, 3072, 3073, 3074, 3075, 3076, 3077, 3078, 3079, 3080, 3081]);

    const baseLimits = { roundCanUseItemCount: 1, gameCarryItemMax: 3, gameGoldRateMax: 2000 };
    expect(bidKingApplySystemSkillEffectLimits(baseLimits, skillEffectById(17000)!).gameGoldRateMax).toBe(3000);
    expect(bidKingApplySystemSkillEffectLimits(baseLimits, skillEffectById(17001)!).gameGoldRateMax).toBe(3000);
    expect(bidKingGameDataSystemLimitsForSkillIds([]).gameGoldRateMax).toBe(0);

    expect(bidKingSystemEffectOperationForSkillEffect(skillEffectById(17000)!)[0]).toEqual(expect.objectContaining({
      kind: 'modify_sim_limit',
      limit: 'gold_interest_cap',
      modifier: { mode: 'per_mille', value: 500 }
    }));
    expect(bidKingSystemEffectOperationForSkillEffect(skillEffectById(18002)!)[0]).toEqual(expect.objectContaining({
      kind: 'modify_sim_limit',
      limit: 'shop_buy_grid_count',
      modifier: { mode: 'flat', value: 1 }
    }));
    expect(bidKingSystemEffectOperationForSkillEffect(skillEffectById(19000)!)[0]).toEqual(expect.objectContaining({
      kind: 'sim_shop_discount',
      discountRatePerMille: 800,
      chancePerMille: 500
    }));
    expect(bidKingSystemEffectOperationForSkillEffect(skillEffectById(20001)!)[0]).toEqual(expect.objectContaining({
      kind: 'post_game_reward',
      outcome: 'win',
      rewardTypeId: 1,
      rewardValue: 500
    }));
    expect(bidKingSystemEffectOperationForSkillEffect(skillEffectById(20002)!)[0]).toEqual(expect.objectContaining({
      kind: 'post_game_reward',
      outcome: 'loss',
      rewardTypeId: 1,
      rewardValue: 100
    }));
    expect(bidKingSystemEffectOperationForSkillEffect(skillEffectById(23001)!)[0]).toEqual(expect.objectContaining({
      kind: 'charge_sim_buff_item',
      modifier: { mode: 'per_mille', value: 1000 }
    }));
    expect(bidKingSystemEffectOperationsForSkillIds([3070])[0]).toEqual(expect.objectContaining({
      kind: 'charge_sim_buff_item',
      skillId: 3070,
      skillOpt: 33,
      skillOptParam1: [[1, 11]],
      modifier: { mode: 'flat', value: 1 }
    }));
    expect(bidKingSystemEffectOperationForSkillEffect(skillEffectById(24000)!)[0]).toEqual(expect.objectContaining({
      kind: 'open_sim_shop',
      shopId: 6,
      shopName: Shop.find((shop) => shop.id === 6)?.packaged_name
    }));
    expect(bidKingSystemEffectOperationForSkillEffect(skillEffectById(26001)!)[0]).toEqual(expect.objectContaining({
      kind: 'change_sim_item_state',
      stateMode: 1
    }));
    expect(bidKingSystemEffectOperationForSkillEffect(skillEffectById(26002)!)[0]).toEqual(expect.objectContaining({
      kind: 'change_sim_item_state',
      stateMode: 2
    }));
  });

  it('models source SimSelectItemList and SimBuffItemList as separate training item state', () => {
    const match = createMatch({
      id: 'compat-sim-item-state',
      players: players.map((player) => player.id === 'p1'
        ? {
            ...player,
            simSelectItemList: [
              { itemUid: 1, itemCid: 8046 },
              { itemUid: 2, itemCid: 8001 }
            ],
            simBuffItemList: [
              { itemCid: 8059, itemCount: 1, power: 4, cd: 0 },
              { itemCid: 8058, itemCount: 1, power: 5, cd: 0 }
            ]
          }
        : player),
      seed: 33310,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);

    const gameData = buildBidKingGameDataSnapshot(match, match.currentRound!);
    const p1Log = gameData.userLog.find((entry) => entry.playerId === 'p1')!;
    const privateSnapshot = buildSnapshot(match, 'p1').private!;

    expect(p1Log.simSelectItemList).toEqual([
      { itemUid: 1, itemCid: 8046 },
      { itemUid: 2, itemCid: 8001 }
    ]);
    expect(p1Log.simBuffItemList).toEqual([
      { itemCid: 8059, itemCount: 1, power: 4, cd: 0 },
      { itemCid: 8058, itemCount: 1, power: 5, cd: 0 }
    ]);
    expect(privateSnapshot.simSelectItemList).toEqual(p1Log.simSelectItemList);
    expect(privateSnapshot.simBuffItemList).toEqual(p1Log.simBuffItemList);

    const baseState = {
      simSelectItemList: p1Log.simSelectItemList,
      simBuffItemList: p1Log.simBuffItemList
    };
    const gained = bidKingApplySimSystemEffectOperation(
      baseState,
      bidKingSystemEffectOperationsForSkillIds([3067])[0]!
    );
    expect(gained.simSelectItemList.at(-1)).toEqual({ itemUid: 3, itemCid: 8001 });

    const discarded = bidKingApplySimSystemEffectOperation(
      gained,
      bidKingSystemEffectOperationsForSkillIds([3066])[0]!
    );
    expect(discarded.simSelectItemList.map((entry) => entry.itemUid)).toEqual([2, 3]);

    const usedSelect = bidKingUseSimSelectItem(discarded, 2);
    expect(usedSelect.usedItem).toEqual({ itemUid: 2, itemCid: 8001 });
    expect(usedSelect.state.simSelectItemList).toEqual([{ itemUid: 3, itemCid: 8001 }]);

    expect(bidKingSimBuffItemMaxPower(8059)).toBe(5);
    expect(bidKingSimBuffItemUseCost(8059)).toBe(5);
    expect(bidKingCanUseSimBuffItem({ itemCid: 8059, itemCount: 1, power: 4, cd: 0 })).toBe(false);
    expect(bidKingCanUseSimBuffItem({ itemCid: 8059, itemCount: 1, power: 5, cd: 0 })).toBe(true);
    expect(bidKingCanUseSimBuffItem({ itemCid: 8058, itemCount: 1, power: 5, cd: 0 })).toBe(false);

    const charged = bidKingApplySimSystemEffectOperation(
      baseState,
      bidKingSystemEffectOperationForSkillEffect(skillEffectById(23002)!)[0]!,
      { sourceItemCid: 8059 }
    );
    expect(charged.simBuffItemList.find((entry) => entry.itemCid === 8059)?.power).toBe(5);

    const usedBuff = bidKingUseSimBuffItem(charged, 8059);
    expect(usedBuff.usedBuff).toEqual({ itemCid: 8059, itemCount: 1, power: 5, cd: 0 });
    expect(usedBuff.state.simBuffItemList.find((entry) => entry.itemCid === 8059)?.power).toBe(0);
  });

  it('models source SimShopStatus, SimGold, and GameWinItemList training state', () => {
    const match = createMatch({
      id: 'compat-sim-shop-state',
      players: players.map((player) => player.id === 'p1'
        ? {
            ...player,
            simGold: 500,
            gameWinItemList: [8059, 8058],
            simShopStatus: {
              shopCid: 6,
              nextRefreshTime: 0,
              shopItemList: [
                { itemUid: 11, shopItemCid: 6002, canBuyCount: 1, buyCount: 0, discountRate: 1000 },
                { itemUid: 10, shopItemCid: 6001, canBuyCount: 1, buyCount: 0, discountRate: 800 },
                { itemUid: 12, shopItemCid: 6001, canBuyCount: 0, buyCount: 9, discountRate: 700 }
              ]
            },
            simSelectItemList: [
              { itemUid: 1, itemCid: 8046 },
              { itemUid: 2, itemCid: 8001 }
            ],
            simBuffItemList: [
              { itemCid: 8059, itemCount: 1, power: 0, cd: 0 }
            ]
          }
        : player),
      seed: 33311,
      coreMode: true,
      coreAuctionMode: 'sealed'
    });
    startNextRound(match, 1000);

    const p1 = match.players.find((player) => player.id === 'p1')!;
    const privateSnapshot = buildSnapshot(match, 'p1').private!;
    const trainingState = bidKingSimTrainingStateForPlayer(p1);

    expect(ShopItem.find((row) => row.id === 6001)?.price[0]?.[1]).toBe(500);
    expect(privateSnapshot.simGold).toBe(500);
    expect(privateSnapshot.gameWinItemList).toEqual([8059, 8058]);
    expect(privateSnapshot.simShopStatus?.shopCid).toBe(6);
    expect(bidKingSimShopItemsSorted(trainingState.simShopStatus).map((entry) => entry.itemUid)).toEqual([12, 10, 11]);
    expect(bidKingSimShopItemCost(trainingState.simShopStatus!.shopItemList[1]!)).toBe(400);
    expect(bidKingSimShopRemainingBuyCount(trainingState.simShopStatus!.shopItemList[2]!)).toBe(5);

    const buy = bidKingBuySimShopItem(trainingState, 10, {
      gameCarryItemMax: 2,
      discardItemUid: 1
    });
    expect(buy.failure).toBeUndefined();
    expect(buy.cost).toBe(400);
    expect(buy.purchasedItem).toEqual({ itemUid: 10, itemCid: 100100 });
    expect(buy.state.simGold).toBe(100);
    expect(buy.state.simSelectItemList).toEqual([
      { itemUid: 2, itemCid: 8001 },
      { itemUid: 10, itemCid: 100100 }
    ]);
    expect(buy.state.simShopStatus?.shopItemList.find((entry) => entry.itemUid === 10)?.buyCount).toBe(1);
    expect(bidKingCanBuySimShopItem(buy.state, 10, { gameCarryItemMax: 3 }).failure).toBe('sold_out');
    expect(bidKingCanBuySimShopItem(trainingState, 11, { gameCarryItemMax: 2 }).failure).toBe('carry_full');
    expect(bidKingCanBuySimShopItem({ ...trainingState, simGold: 69 }, 11, { gameCarryItemMax: 3 }).failure)
      .toBe('insufficient_gold');

    const chosen = bidKingChooseGameWinItem(trainingState, 8059);
    expect(chosen.chosenItemCid).toBe(8059);
    expect(chosen.state.gameWinItemList).toEqual([8058]);
    expect(chosen.state.simBuffItemList).toEqual(trainingState.simBuffItemList);
    expect(bidKingChooseGameWinItem(chosen.state, 8059).failure).toBe('missing_item');

    expect(bidKingSimTrainingWinItemChoiceRequest(8059)).toEqual({
      protocolId: 134,
      protocolName: 'C2S_134_sim_game_select_win_item',
      itemCid: 8059,
      discardItemUid: 0
    });
    const choice = bidKingApplySimTrainingWinItemChoice(trainingState, 8059);
    expect(choice.request).toEqual({
      protocolId: 134,
      protocolName: 'C2S_134_sim_game_select_win_item',
      itemCid: 8059,
      discardItemUid: 0
    });
    expect(choice.updateBoundary).toEqual({
      responseProtocolId: 135,
      responseProtocolName: 'S2C_135_sim_game_select_win_item',
      responseFields: ['ErrorCode'],
      successRefreshMethod: 'PlayerGameData.InitSimGame',
      candidateSource: 'S2C_131_get_sim_game_log.GameWinItemList',
      chooseUi: 'ChooseEffect_Main.Choose'
    });
    expect(choice.state.gameWinItemList).toEqual([8058]);
    expect(choice.state.simGold).toBe(trainingState.simGold);
    expect(choice.state.simSelectItemList).toEqual(trainingState.simSelectItemList);
    expect(bidKingApplySimTrainingWinItemChoice(choice.state, 8059).failure).toBe('missing_item');

    bidKingWriteSimTrainingStateToPlayer(p1, chosen.state);
    expect(buildSnapshot(match, 'p1').private?.gameWinItemList).toEqual([8058]);
  });

  it('keeps sim post-game rewards, item state changes, hero-skill reuse, and UpdateGameData on source boundaries', () => {
    const baseState = {
      simGold: 500,
      gameWinItemList: [8059],
      simShopStatus: undefined,
      simSelectItemList: [
        { itemUid: 1, itemCid: 8046 }
      ],
      simBuffItemList: [
        { itemCid: 8059, itemCount: 1, power: 4, cd: 0 }
      ]
    };

    const winReward = bidKingSimPostGameRewardsForOperation(
      bidKingSystemEffectOperationForSkillEffect(skillEffectById(20001)!)[0]!,
      'win'
    );
    expect(winReward).toEqual([{
      resource: 'coins',
      rewardType: 1,
      refId: 1,
      quantity: 500,
      inventoryType: 'coins'
    }]);
    expect(bidKingSimPostGameRewardsForOperation(
      bidKingSystemEffectOperationForSkillEffect(skillEffectById(20001)!)[0]!,
      'loss'
    )).toEqual([]);
    expect(bidKingSimPostGameRewardsForOperation(
      bidKingSystemEffectOperationForSkillEffect(skillEffectById(20002)!)[0]!,
      'loss'
    )[0]).toEqual(expect.objectContaining({ refId: 1, quantity: 100 }));

    expect(bidKingSimItemStateModeChangeForOperation(
      bidKingSystemEffectOperationForSkillEffect(skillEffectById(26001)!)[0]!
    )).toEqual({ stateMode: 1 });
    expect(bidKingApplySimSystemEffectOperation(
      baseState,
      bidKingSystemEffectOperationForSkillEffect(skillEffectById(26002)!)[0]!
    )).toEqual({
      simSelectItemList: baseState.simSelectItemList,
      simBuffItemList: baseState.simBuffItemList
    });

    const specifiedHeroSkill = bidKingSystemEffectOperationForSkillEffect(skillEffectById(28001)!)[0]!;
    expect(bidKingSimHeroSkillCastRequestsForOperation(specifiedHeroSkill, {
      gameUid: 'sim-game-1',
      itemCid: 8041,
      roundIndex: 0
    })).toEqual([{
      gameUid: 'sim-game-1',
      itemCid: 8041,
      skillCid: 100101,
      heroCid: 101,
      mapCid: undefined,
      mode: 'specified_skin'
    }]);
    expect(bidKingSimHeroSkillCastRequestsForOperation(specifiedHeroSkill, {
      roundIndex: 1
    })[0]?.skillCid).toBe(1001011);
    expect(bidKingSimHeroSkillCastRequestsForOperation(
      bidKingSystemEffectOperationForSkillEffect(skillEffectById(28002)!)[0]!
    )).toEqual([]);
    expect(bidKingSimHeroSkillCastRequestsForOperation(
      bidKingSystemEffectOperationForSkillEffect(skillEffectById(28002)!)[0]!,
      { randomHeroCid: 104, randomHeroSkillIds: [0, 1001041], roundIndex: 1 }
    )).toEqual([expect.objectContaining({
      skillCid: 1001041,
      heroCid: 104,
      mode: 'random_other_hero'
    })]);

    const updated = bidKingApplySimGameDataUpdate(baseState, {
      uid: 'sim-game-1',
      mapId: 201,
      round: 2,
      stockContainer: {
        stockId: 0,
        stockCid: 0,
        stockBoxes: [],
        cabinetLastGetRewardTime: 0,
        cabinetCumulativeReward: 0,
        cabinetBasicReward: 0,
        cabinetReward: 0
      },
      userLog: [{
        userUid: 1,
        playerId: 'p1',
        name: '玩家一',
        heroCid: 101,
        useItemLog: [],
        priceLog: [],
        isStandDown: false,
        isQuit: false,
        headCid: 0,
        heroSkinCid: 0,
        simSelectItemList: [{ itemUid: 2, itemCid: 8001 }],
        simBuffItemList: [{ itemCid: 8059, itemCount: 1, power: 5, cd: 0 }],
        selectItemList: [],
        headBoxCid: 0,
        titleCid: 0,
        remark: ''
      }],
      heroSkillLog: [],
      mapSkillLog: [],
      itemSkillLog: [],
      nextRoundTime: 0,
      selectItemCount: 0,
      roundCanUseItemCount: 1,
      gameCarryItemMax: 3,
      gameGoldRateMax: 0,
      gameType: 1,
      sendAuctionUserUid: 0,
      sendAuctionUserName: '',
      sendAuctionUserHead: 0,
      sendAuctionHeadBox: 0,
      sendAuctionUserTitle: 0,
      serverTime: 0
    }, 'p1');
    expect(updated.simGold).toBe(500);
    expect(updated.gameWinItemList).toEqual([8059]);
    expect(updated.simSelectItemList).toEqual([{ itemUid: 2, itemCid: 8001 }]);
    expect(updated.simBuffItemList).toEqual([{ itemCid: 8059, itemCount: 1, power: 5, cd: 0 }]);
  });

  it('locks the source skill_opt and skill_active_type trigger matrix for sim item skills', () => {
    const nonzeroOptProfiles = Skill
      .filter((skill) => skill.skill_opt !== 0)
      .map((skill) => bidKingSimSkillTriggerProfileForSkill(skill)!);
    expect(nonzeroOptProfiles.filter((profile) => profile.trigger === 'unknown')).toEqual([]);

    expect(bidKingSimSkillTriggerProfileForSkill(3041)).toEqual(expect.objectContaining({
      skillId: 3041,
      activeType: 0,
      skillOpt: 11,
      trigger: 'game_start',
      sourceParam1: [[3, 0]],
      sourceParam2: [[1, 110]],
      chancePerMille: 1000
    }));
    expect(bidKingSimSkillTriggerProfileForSkill(3042)).toEqual(expect.objectContaining({
      skillId: 3042,
      skillOpt: 11,
      trigger: 'game_start',
      sourceParam1: [[0]],
      sourceParam2: [[0]]
    }));

    const depleted = bidKingSimSkillTriggerProfilesForItem(8051)[0]!;
    expect(depleted).toEqual(expect.objectContaining({
      itemCid: 8051,
      skillId: 3054,
      trigger: 'sim_item_depleted',
      acceptedSourceItemTypeIds: [11],
      skillCooldown: 10
    }));
    expect(bidKingSimSkillMatchesTrigger(depleted, {
      event: 'sim_item_depleted',
      sourceItemTypeId: 11,
      chanceRollPerMille: 999
    })).toBe(true);

    const roundDiscard = bidKingSimSkillTriggerProfilesForItem(8054)[0]!;
    expect(roundDiscard).toEqual(expect.objectContaining({
      skillId: 3066,
      trigger: 'round_start',
      acceptedRounds: [1, 2, 3, 4, 5, 6, 7, 8, 9]
    }));
    expect(bidKingSimSkillMatchesTrigger(roundDiscard, { event: 'round_start', roundNumber: 9 })).toBe(true);
    expect(bidKingSimSkillMatchesTrigger(roundDiscard, { event: 'round_start', roundNumber: 10 })).toBe(false);
    expect(bidKingSimSkillTriggerProfileForSkill(3049)).toEqual(expect.objectContaining({
      trigger: 'round_start',
      acceptedRounds: [0],
      skillRound: 1
    }));
    expect(bidKingSimSkillTriggerProfileForSkill(3056)).toEqual(expect.objectContaining({
      trigger: 'round_start',
      acceptedRounds: [1, 2, 3, 4, 5, 6, 7, 8]
    }));

    const gainRelic = bidKingSimSkillTriggerProfilesForItem(8056)[0]!;
    expect(gainRelic).toEqual(expect.objectContaining({
      skillId: 3068,
      trigger: 'gain_relic',
      acceptedSourceItemTypeIds: [8],
      chancePerMille: 500
    }));
    expect(bidKingSimSkillMatchesTrigger(gainRelic, {
      event: 'gain_relic',
      sourceItemTypeId: 8,
      chanceRollPerMille: 499
    })).toBe(true);
    expect(bidKingSimSkillMatchesTrigger(gainRelic, {
      event: 'gain_relic',
      sourceItemTypeId: 8,
      chanceRollPerMille: 500
    })).toBe(false);
    expect(bidKingSimSkillMatchesTrigger(gainRelic, {
      event: 'gain_relic',
      sourceItemTypeId: 11,
      chanceRollPerMille: 0
    })).toBe(false);

    expect(bidKingSimSkillTriggerProfileForSkill(3028)).toEqual(expect.objectContaining({
      trigger: 'reveal_quality'
    }));
    expect(bidKingSimSkillTriggerProfileForSkill(3030)).toEqual(expect.objectContaining({
      trigger: 'reveal_outline',
      chancePerMille: 100,
      targetBoxRequired: true
    }));
    expect(bidKingSimSkillMatchesTrigger(bidKingSimSkillTriggerProfileForSkill(3030)!, {
      event: 'reveal_outline',
      chanceRollPerMille: 0
    })).toBe(false);
    expect(bidKingSimSkillMatchesTrigger(bidKingSimSkillTriggerProfileForSkill(3030)!, {
      event: 'reveal_outline',
      targetBoxId: 12,
      chanceRollPerMille: 99
    })).toBe(true);
    expect(bidKingSimSkillTriggerProfileForSkill(3031)).toEqual(expect.objectContaining({
      trigger: 'reveal_outline',
      acceptedTargetItemTypeIds: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
      chancePerMille: 300
    }));

    const batteryProfiles = bidKingSimSkillTriggerProfilesForItem(8057);
    expect(batteryProfiles.find((profile) => profile.skillId === 3069)).toEqual(expect.objectContaining({
      trigger: 'reveal_outline',
      chancePerMille: 1000
    }));
    expect(batteryProfiles.find((profile) => profile.skillId === 3071)).toEqual(expect.objectContaining({
      activeType: 2,
      trigger: 'unknown'
    }));

    const chargerProfiles = bidKingSimSkillTriggerProfilesForItem(8058);
    expect(chargerProfiles.find((profile) => profile.skillId === 3070)).toEqual(expect.objectContaining({
      trigger: 'use_sim_item',
      acceptedSourceItemTypeIds: [11]
    }));
    expect(bidKingCanUseSimBuffItem({ itemCid: 8058, itemCount: 1, power: 5, cd: 0 })).toBe(false);

    const revealMirrorProfiles = bidKingSimSkillTriggerProfilesForItem(8059);
    const revealMirrorCharge = revealMirrorProfiles.find((profile) => profile.skillId === 3072)!;
    expect(revealMirrorCharge).toEqual(expect.objectContaining({
      trigger: 'reveal_full_info',
      acceptedTargetItemTypeIds: [101]
    }));
    expect(bidKingSimSkillMatchesTrigger(revealMirrorCharge, {
      event: 'reveal_full_info',
      targetItemTypeId: 101
    })).toBe(true);
    expect(bidKingSimSkillMatchesTrigger(revealMirrorCharge, {
      event: 'reveal_full_info',
      targetItemTypeId: 102
    })).toBe(false);
    expect(revealMirrorProfiles.find((profile) => profile.skillId === 3082)).toEqual(expect.objectContaining({
      trigger: 'active_use',
      activeType: 1
    }));
    expect(skillById(3082)?.skilltarget).toBe(1);
    expect(skillById(3082)?.skilleffect_position).toEqual([6000]);
    expect(bidKingCanUseSimBuffItem({ itemCid: 8059, itemCount: 1, power: 5, cd: 0 })).toBe(true);

    expect(bidKingSimSkillTriggerProfilesForItem(8068).map((profile) => ({
      skillId: profile.skillId,
      trigger: profile.trigger,
      acceptedTargetItemTypeIds: profile.acceptedTargetItemTypeIds
    }))).toEqual([
      { skillId: 3081, trigger: 'reveal_full_info', acceptedTargetItemTypeIds: [110] },
      { skillId: 3091, trigger: 'active_use', acceptedTargetItemTypeIds: undefined }
    ]);
  });

  it('applies source sim skill trigger events without inventing server GameSkillData', () => {
    const baseState = {
      simGold: 500,
      gameWinItemList: [],
      simShopStatus: undefined,
      simSelectItemList: [
        { itemUid: 1, itemCid: 100100 },
        { itemUid: 2, itemCid: 100101 }
      ],
      simBuffItemList: [
        { itemCid: 8057, itemCount: 1, power: 4, cd: 0 },
        { itemCid: 8058, itemCount: 1, power: 4, cd: 0 },
        { itemCid: 8059, itemCount: 1, power: 4, cd: 0 }
      ]
    };

    expect(bidKingSimSkillTriggerSourcesForState(baseState).map((source) => ({
      itemCid: source.itemCid,
      itemUid: source.itemUid,
      kind: source.kind
    }))).toEqual([
      { itemCid: 8057, itemUid: undefined, kind: 'sim_buff' },
      { itemCid: 8058, itemUid: undefined, kind: 'sim_buff' },
      { itemCid: 8059, itemUid: undefined, kind: 'sim_buff' },
      { itemCid: 100100, itemUid: 1, kind: 'sim_select' },
      { itemCid: 100101, itemUid: 2, kind: 'sim_select' }
    ]);

    const gameStart = bidKingApplySimSkillTriggerEvent(baseState, { event: 'game_start' }, {
      sources: bidKingExplicitSimSkillTriggerSources([8053, 8041]),
      gameUid: 'sim-game-1',
      roundIndex: 0
    });
    expect(gameStart.triggeredSkills.map((trigger) => trigger.profile.skillId)).toEqual([3065, 3042]);
    expect(gameStart.appliedOperations.map((operation) => operation.kind)).toEqual(['gain_sim_item']);
    expect(gameStart.pendingOperations.map((operation) => operation.kind)).toEqual(['use_hero_skill']);
    expect(gameStart.state.simSelectItemList.at(-1)).toEqual({ itemUid: 3, itemCid: 8001 });
    expect(gameStart.heroSkillCastRequests).toEqual([{
      gameUid: 'sim-game-1',
      itemCid: 8041,
      skillCid: 100101,
      heroCid: 101,
      mapCid: undefined,
      mode: 'specified_skin'
    }]);
    expect(gameStart.state.simGold).toBe(500);

    const roundStart = bidKingApplySimSkillTriggerEvent(baseState, { event: 'round_start', roundNumber: 1 }, {
      sources: bidKingExplicitSimSkillTriggerSources([8054, 8055])
    });
    expect(roundStart.triggeredSkills.map((trigger) => trigger.profile.skillId)).toEqual([3066, 3067]);
    expect(roundStart.state.simSelectItemList).toEqual([
      { itemUid: 2, itemCid: 100101 },
      { itemUid: 3, itemCid: 8001 }
    ]);
    expect(bidKingApplySimSkillTriggerEvent(baseState, { event: 'round_start', roundNumber: 10 }, {
      sources: bidKingExplicitSimSkillTriggerSources([8054, 8055])
    }).triggeredSkills).toEqual([]);

    const gainRelicMiss = bidKingApplySimSkillTriggerEvent(baseState, {
      event: 'gain_relic',
      sourceItemTypeId: 8,
      chanceRollPerMille: 500
    }, {
      sources: bidKingExplicitSimSkillTriggerSources([8056])
    });
    expect(gainRelicMiss.triggeredSkills).toEqual([]);

    const gainRelicHit = bidKingApplySimSkillTriggerEvent(baseState, {
      event: 'gain_relic',
      sourceItemTypeId: 8,
      chanceRollPerMille: 499
    }, {
      sources: bidKingExplicitSimSkillTriggerSources([8056])
    });
    expect(gainRelicHit.triggeredSkills.map((trigger) => trigger.profile.skillId)).toEqual([3068]);
    expect(gainRelicHit.state.simSelectItemList.at(-1)).toEqual({ itemUid: 3, itemCid: 8001 });

    const useItemWithoutType = bidKingApplySimSkillTriggerEvent(baseState, { event: 'use_sim_item' }, {
      sources: bidKingExplicitSimSkillTriggerSources([8058])
    });
    expect(useItemWithoutType.triggeredSkills).toEqual([]);
    expect(useItemWithoutType.state.simBuffItemList.find((entry) => entry.itemCid === 8058)?.power).toBe(4);

    const useItemWithType = bidKingApplySimSkillTriggerEvent(baseState, {
      event: 'use_sim_item',
      sourceItemTypeId: 11
    }, {
      sources: bidKingExplicitSimSkillTriggerSources([8058])
    });
    expect(useItemWithType.triggeredSkills.map((trigger) => trigger.profile.skillId)).toEqual([3070]);
    expect(useItemWithType.state.simBuffItemList.find((entry) => entry.itemCid === 8058)?.power).toBe(5);

    const revealOutline = bidKingApplySimSkillTriggerEvent(baseState, { event: 'reveal_outline' }, {
      sources: bidKingExplicitSimSkillTriggerSources([8057])
    });
    expect(revealOutline.triggeredSkills.map((trigger) => trigger.profile.skillId)).toEqual([3069]);
    expect(revealOutline.state.simBuffItemList.find((entry) => entry.itemCid === 8057)?.power).toBe(5);

    const wrongFullInfoType = bidKingApplySimSkillTriggerEvent(baseState, {
      event: 'reveal_full_info',
      targetItemTypeId: 102
    }, {
      sources: bidKingExplicitSimSkillTriggerSources([8059])
    });
    expect(wrongFullInfoType.triggeredSkills).toEqual([]);

    const rightFullInfoType = bidKingApplySimSkillTriggerEvent(baseState, {
      event: 'reveal_full_info',
      targetItemTypeId: 101
    }, {
      sources: bidKingExplicitSimSkillTriggerSources([8059])
    });
    expect(rightFullInfoType.triggeredSkills.map((trigger) => trigger.profile.skillId)).toEqual([3072]);
    expect(rightFullInfoType.state.simBuffItemList.find((entry) => entry.itemCid === 8059)?.power).toBe(5);
    expect(rightFullInfoType.pendingOperations).toEqual([]);

    const activeUse = bidKingApplySimSkillTriggerEvent(baseState, { event: 'active_use' }, {
      sources: bidKingExplicitSimSkillTriggerSources([8059])
    });
    expect(activeUse.triggeredSkills.map((trigger) => trigger.profile.skillId)).toEqual([3082]);
    expect(activeUse.operations).toEqual([]);
    expect(activeUse.state).toEqual(baseState);
  });

  it('models source C2S_128 and C2S_156 sim item use entry boundaries', () => {
    const baseState = {
      simGold: 500,
      gameWinItemList: [],
      simShopStatus: undefined,
      simSelectItemList: [
        { itemUid: 1, itemCid: 100100 },
        { itemUid: 2, itemCid: 8051 }
      ],
      simBuffItemList: [
        { itemCid: 8058, itemCount: 1, power: 4, cd: 0 },
        { itemCid: 8059, itemCount: 1, power: 5, cd: 0 }
      ]
    };

    const useSelect = bidKingUseSimTrainingSelectItem(baseState, 1, { targetBoxId: 12 });
    expect(useSelect.failure).toBeUndefined();
    expect(useSelect.request).toEqual({
      protocolId: 128,
      protocolName: 'C2S_128_sim_game_use_item',
      itemUid: 1,
      itemCid: 100100,
      targetBoxId: 12
    });
    expect(useSelect.updateBoundary).toEqual({
      responseProtocolId: 129,
      responseProtocolName: 'S2C_129_sim_game_use_item',
      responseFields: ['ErrorCode', 'UpdateGameData'],
      updateGameDataField: 'UpdateGameData',
      syncMethod: 'PlayerGameData.UpdateSimGameData',
      skillLogSource: 'GetNoPlaySkills(simGameLog.GameData)',
      skillLogOrder: ['ItemSkillLog', 'MapSkillLog', 'HeroSkillLog'],
      skillLogSort: false,
      skillLogGeneratedBy: 'server'
    });
    expect(useSelect.activeUseTrigger?.triggeredSkills.map((trigger) => trigger.profile.skillId)).toEqual([100]);
    expect(useSelect.useItemTrigger?.triggeredSkills.map((trigger) => trigger.profile.skillId)).toEqual([3070]);
    expect(useSelect.depletedTrigger?.triggeredSkills.map((trigger) => trigger.profile.skillId)).toEqual([3054]);
    expect(useSelect.state.simSelectItemList).toEqual([
      { itemUid: 2, itemCid: 8051 },
      { itemUid: 3, itemCid: 8001 }
    ]);
    expect(useSelect.state.simBuffItemList.find((entry) => entry.itemCid === 8058)?.power).toBe(5);
    expect(useSelect.state.simGold).toBe(500);
    expect(baseState.simSelectItemList).toEqual([
      { itemUid: 1, itemCid: 100100 },
      { itemUid: 2, itemCid: 8051 }
    ]);

    const useBuff = bidKingUseSimTrainingBuffItem(baseState, 8059, { targetBoxId: 7 });
    expect(useBuff.failure).toBeUndefined();
    expect(useBuff.request).toEqual({
      protocolId: 156,
      protocolName: 'C2S_156_sim_game_use_buff_item',
      itemCid: 8059,
      targetBoxId: 7
    });
    expect(useBuff.updateBoundary).toEqual({
      responseProtocolId: 157,
      responseProtocolName: 'S2C_157_sim_game_use_buff_item',
      responseFields: ['ErrorCode', 'UpdateGameData'],
      updateGameDataField: 'UpdateGameData',
      syncMethod: 'PlayerGameData.UpdateSimGameData',
      skillLogSource: 'GetNoPlaySkills(simGameLog.GameData)',
      skillLogOrder: ['ItemSkillLog', 'MapSkillLog', 'HeroSkillLog'],
      skillLogSort: false,
      skillLogGeneratedBy: 'server'
    });
    expect(useBuff.activeUseTrigger?.triggeredSkills.map((trigger) => trigger.profile.skillId)).toEqual([3082]);
    expect(useBuff.useItemTrigger?.triggeredSkills).toEqual([]);
    expect(useBuff.state.simBuffItemList.find((entry) => entry.itemCid === 8059)?.power).toBe(0);
    expect(useBuff.state.simSelectItemList).toEqual(baseState.simSelectItemList);

    expect(bidKingUseSimTrainingSelectItem(baseState, 999).failure).toBe('missing_sim_select_item');
    const targetBoxItemState = {
      ...baseState,
      simSelectItemList: [{ itemUid: 29, itemCid: 8029 }]
    };
    expect(bidKingUseSimTrainingSelectItem(targetBoxItemState, 29).failure).toBe('missing_target_box');
    expect(bidKingUseSimTrainingSelectItem(targetBoxItemState, 29, { targetBoxId: 0 }).request).toEqual({
      protocolId: 128,
      protocolName: 'C2S_128_sim_game_use_item',
      itemUid: 29,
      itemCid: 8029,
      targetBoxId: 0
    });
    expect(bidKingUseSimTrainingBuffItem(baseState, 9999).failure).toBe('missing_sim_buff_item');
    expect(bidKingUseSimTrainingBuffItem(baseState, 8058).failure).toBe('buff_item_not_active');
    expect(bidKingUseSimTrainingBuffItem({
      ...baseState,
      simBuffItemList: [{ itemCid: 8059, itemCount: 1, power: 5, cd: 1 }]
    }, 8059).failure).toBe('buff_item_on_cooldown');
    expect(bidKingUseSimTrainingBuffItem({
      ...baseState,
      simBuffItemList: [{ itemCid: 8059, itemCount: 1, power: 4, cd: 0 }]
    }, 8059).failure).toBe('insufficient_buff_power');
  });

  it('models source C2S_126 next-round training response and round-start replay boundaries', () => {
    const baseState = {
      simGold: 500,
      gameWinItemList: [8059],
      simShopStatus: undefined,
      simSelectItemList: [
        { itemUid: 1, itemCid: 100100 }
      ],
      simBuffItemList: [
        { itemCid: 8058, itemCount: 1, power: 4, cd: 0 }
      ]
    };
    const skillLog = (
      uid: number,
      skillCid: number,
      castTime: number,
      castRound: number,
      itemCid = 0
    ): BidKingGameSkillDataSnapshot => ({
      uid,
      skillCid,
      heroCid: 0,
      mapCid: 0,
      itemCid,
      castTime,
      castRound,
      hitItemIndex: 0,
      hitBoxList: [],
      allHitItemAvgPrice: 0,
      allHitBoxAvgPrice: 0,
      allHitItemAvgBoxIndex: 0,
      hitItemTotalPrice: 0,
      totalHitBoxIndex: 0,
      hitItemTypeList: [],
      hitItemQuilityList: []
    });
    const nextRoundGameData: BidKingGameDataSnapshot = {
      uid: 'sim-game-2',
      mapId: 201,
      round: 2,
      stockContainer: {
        stockId: 0,
        stockCid: 0,
        stockBoxes: [],
        cabinetLastGetRewardTime: 0,
        cabinetCumulativeReward: 0,
        cabinetBasicReward: 0,
        cabinetReward: 0
      },
      userLog: [{
        userUid: 1,
        playerId: 'p1',
        name: '玩家一',
        heroCid: 101,
        useItemLog: [],
        priceLog: [{ round: 1, itemCidOrPrice: 100 }],
        isStandDown: false,
        isQuit: false,
        headCid: 0,
        heroSkinCid: 0,
        simSelectItemList: [
          { itemUid: 10, itemCid: 8054 },
          { itemUid: 11, itemCid: 8055 },
          { itemUid: 12, itemCid: 100100 }
        ],
        simBuffItemList: [{ itemCid: 8058, itemCount: 1, power: 4, cd: 0 }],
        selectItemList: [],
        headBoxCid: 0,
        titleCid: 0,
        remark: ''
      }],
      heroSkillLog: [skillLog(1, 100101, 100, 2)],
      mapSkillLog: [
        skillLog(4, 3002, 50, 1),
        skillLog(3, 3001, 300, 2)
      ],
      itemSkillLog: [skillLog(2, 3066, 200, 2, 8054)],
      nextRoundTime: 123456,
      selectItemCount: 0,
      roundCanUseItemCount: 1,
      gameCarryItemMax: 3,
      gameGoldRateMax: 0,
      gameType: 1,
      sendAuctionUserUid: 0,
      sendAuctionUserName: '',
      sendAuctionUserHead: 0,
      sendAuctionHeadBox: 0,
      sendAuctionUserTitle: 0,
      serverTime: 0
    };

    expect(bidKingSimTrainingBidPriceRequest(123.9)).toEqual({
      protocolId: 126,
      protocolName: 'C2S_126_sim_game_bid_price',
      price: 123
    });

    const simGameLog: BidKingSimGameLogSnapshot = {
      maxWinLevel: 4,
      simGold: 777,
      gameWinItemList: [8058, 8059],
      simShopStatus: {
        shopCid: 6,
        nextRefreshTime: 9,
        shopItemList: [{ itemUid: 21, shopItemCid: 6001, canBuyCount: 1, buyCount: 0, discountRate: 900 }]
      },
      gameData: nextRoundGameData,
      level: 3,
      simSelectItemList: [{ itemUid: 31, itemCid: 8001 }],
      simBuffItemList: [{ itemCid: 8059, itemCount: 2, power: 5, cd: 0 }],
      selectItemCount: 7,
      roundCanUseItemCount: 2,
      gameCarryItemMax: 4,
      gameGoldRateMax: 3000
    };
    expect(bidKingSimTrainingGameLogRefreshRequest()).toEqual({
      protocolId: 130,
      protocolName: 'C2S_130_get_sim_game_log'
    });
    const logState = bidKingSimTrainingStateForGameLog(simGameLog);
    expect(logState.simSelectItemList).toEqual([{ itemUid: 31, itemCid: 8001 }]);
    expect(logState.simGameData?.uid).toBe('sim-game-2');
    expect(bidKingSimGameLogForTrainingState(logState)).toEqual(simGameLog);

    const directRefresh = bidKingApplySimGameLogRefresh(baseState, simGameLog);
    expect(directRefresh.simGold).toBe(777);
    expect(directRefresh.gameWinItemList).toEqual([8058, 8059]);
    expect(directRefresh.simShopStatus?.shopItemList[0]?.discountRate).toBe(900);
    expect(directRefresh.simSelectItemList).toEqual([{ itemUid: 31, itemCid: 8001 }]);
    expect(directRefresh.simBuffItemList).toEqual([{ itemCid: 8059, itemCount: 2, power: 5, cd: 0 }]);
    expect(directRefresh.level).toBe(3);
    expect(directRefresh.maxWinLevel).toBe(4);
    expect(directRefresh.selectItemCount).toBe(7);
    expect(directRefresh.roundCanUseItemCount).toBe(2);
    expect(directRefresh.gameCarryItemMax).toBe(4);
    expect(directRefresh.gameGoldRateMax).toBe(3000);

    const initRefresh = bidKingApplySimTrainingGameLogRefresh(baseState, simGameLog);
    expect(initRefresh.request).toEqual({
      protocolId: 130,
      protocolName: 'C2S_130_get_sim_game_log'
    });
    expect(initRefresh.updateBoundary).toEqual({
      responseProtocolId: 131,
      responseProtocolName: 'S2C_131_get_sim_game_log',
      assignmentMethod: 'PlayerGameData.InitSimGame',
      replaceMode: 'simGameLog = GetSimGameLog()',
      authoritativeFields: [
        'MaxWinLevel',
        'SimGold',
        'GameWinItemList',
        'SimShopStatus',
        'GameData',
        'Level',
        'SimSelectItemList',
        'SimBuffItemList',
        'SelectItemCount',
        'RoundCanUseItemCount',
        'GameCarryItemMax',
        'GameGoldRateMax'
      ]
    });
    expect(initRefresh.state.simSelectItemList).toEqual(simGameLog.simSelectItemList);
    expect(initRefresh.state.simSelectItemList).not.toEqual(nextRoundGameData.userLog[0]!.simSelectItemList);

    expect(bidKingSimGameWinItemDropGroupIdForLevel(1)).toBe(801);
    const winItemPool = bidKingSimGameWinItemCandidatePoolForLevel(1)!;
    expect(winItemPool).toEqual(expect.objectContaining({
      level: 1,
      simDropGroupId: 801,
      tableSource: 'Table_Sim.simdorp -> Table_Drop.items_list',
      authoritativeField: 'S2C_131_get_sim_game_log.GameWinItemList',
      generationAuthority: 'server'
    }));
    expect(winItemPool.candidateItemCids).toHaveLength(64);
    expect(winItemPool.candidateItemCids.slice(0, 3)).toEqual([8001, 8002, 8003]);
    expect(winItemPool.candidateItemCids).toContain(8068);
    expect(winItemPool.candidateItemCids).not.toContain(8045);
    expect(winItemPool.dropItems.every((entry) => entry.item_type === 8 && entry.drop_weight === 10)).toBe(true);
    expect(initRefresh.state.gameWinItemList).toEqual(simGameLog.gameWinItemList);
    expect(initRefresh.state.gameWinItemList).not.toEqual(winItemPool.candidateItemCids);

    const nextRound = bidKingApplySimTrainingNextRoundGameData(baseState, nextRoundGameData, {
      playerId: 'p1',
      playedSkillUids: [1, 4]
    });

    expect(nextRound.updateBoundary).toEqual({
      responseProtocolId: 127,
      responseProtocolName: 'S2C_127_sim_game_bid_price',
      isNextRoundField: 'IsNextRound',
      nextRoundGameDataField: 'NextRoundGameData',
      syncMethod: 'PlayerGameData.UpdateSimGameData',
      roundStartMethod: 'Battle_Handler.S2C_OnRoundStartOnTraining2',
      skillLogSource: 'MapSkillLog + HeroSkillLog + ItemSkillLog',
      skillLogOrder: ['MapSkillLog', 'HeroSkillLog', 'ItemSkillLog'],
      skillLogSort: 'CastTime'
    });
    expect(nextRound.roundNumber).toBe(2);
    expect(nextRound.nextRoundTime).toBe(123456);
    expect(nextRound.roundMapSkillLogs.map((log) => log.uid)).toEqual([3]);
    expect(nextRound.unplayedSkillLogs.map((log) => log.uid)).toEqual([2, 3]);
    expect(bidKingSimTrainingUnplayedSkillLogs(nextRoundGameData, [1, 4]).map((log) => log.uid)).toEqual([2, 3]);
    const itemUseLogOrderGameData: BidKingGameDataSnapshot = {
      ...nextRoundGameData,
      heroSkillLog: [skillLog(22, 100101, 50, 2)],
      mapSkillLog: [skillLog(21, 3001, 100, 2)],
      itemSkillLog: [skillLog(20, 3066, 300, 2, 8054)]
    };
    expect(bidKingSimTrainingUnplayedSkillLogs(itemUseLogOrderGameData).map((log) => log.uid)).toEqual([22, 21, 20]);
    expect(bidKingSimTrainingNoPlaySkillLogs(itemUseLogOrderGameData).map((log) => log.uid)).toEqual([20, 21, 22]);
    expect(nextRound.roundStartTrigger?.triggeredSkills.map((trigger) => trigger.profile.skillId)).toEqual([3066, 3067]);
    expect(nextRound.state.simSelectItemList).toEqual([
      { itemUid: 11, itemCid: 8055 },
      { itemUid: 12, itemCid: 100100 },
      { itemUid: 13, itemCid: 8001 }
    ]);
    expect(nextRound.state.simBuffItemList).toEqual([{ itemCid: 8058, itemCount: 1, power: 4, cd: 0 }]);
    expect(nextRound.state.simGold).toBe(500);
    expect(nextRound.state.gameWinItemList).toEqual([8059]);

    expect(bidKingSimTrainingTestSkillCastRequest({
      gameUid: 'sim-game-2',
      itemCid: 8059,
      skillCid: 3082,
      heroCid: 101,
      mapCid: 201
    })).toEqual({
      protocolId: 290,
      protocolName: 'C2S_290_test_game_cast_skill',
      gameUid: 'sim-game-2',
      itemCid: 8059,
      skillCid: 3082,
      heroCid: 101,
      mapCid: 201
    });
    const testSkillCast = bidKingApplySimTrainingTestSkillCastResponse(baseState, {
      itemSkillLog: [skillLog(10, 3082, 400, 2, 8059)],
      heroSkillLog: [skillLog(11, 100101, 100, 2)],
      mapSkillLog: [skillLog(12, 3001, 50, 2)],
      skillLog: [skillLog(13, 3072, 200, 2, 8059)],
      newGameData: nextRoundGameData
    }, {
      playerId: 'p1'
    });
    expect(testSkillCast.updateBoundary).toEqual({
      responseProtocolId: 291,
      responseProtocolName: 'S2C_291_test_game_cast_skill',
      responseFields: [
        'ErrorCode',
        'ItemSkillLog',
        'NewGameData',
        'HeroSkillLog',
        'MapSkillLog',
        'SkillLog'
      ],
      playOrder: ['ItemSkillLog', 'HeroSkillLog', 'MapSkillLog', 'SkillLog'],
      newGameDataField: 'NewGameData',
      generatedBy: 'server'
    });
    expect(testSkillCast.playedSkillLogs.map((log) => log.uid)).toEqual([10, 11, 12, 13]);
    expect(testSkillCast.state.simGameData?.uid).toBe('sim-game-2');
    expect(testSkillCast.state.simSelectItemList).toEqual(nextRoundGameData.userLog[0]!.simSelectItemList);
    expect(testSkillCast.state.simGold).toBe(500);
    expect(testSkillCast.state.gameWinItemList).toEqual([8059]);

    const gameOver = bidKingSimTrainingGameOverResult(baseState, false, 88.8, {
      rewardOperations: [
        bidKingSystemEffectOperationForSkillEffect(skillEffectById(20001)!)[0]!,
        bidKingSystemEffectOperationForSkillEffect(skillEffectById(20002)!)[0]!
      ]
    });
    expect(gameOver.updateBoundary).toEqual({
      responseProtocolId: 127,
      responseProtocolName: 'S2C_127_sim_game_bid_price',
      isNextRoundField: 'IsNextRound',
      isWinField: 'IsWin',
      nextRoundGameDataConsumed: false,
      gameOverMethod: 'Battle_Handler.S2C_OnGameOver',
      refreshMethod: 'Battle_Main.Training: PlayerGameData.InitSimGame',
      winItemChoiceMethod: 'ChooseEffect_Main.Choose -> PlayerManager.ChooseSpecialItem'
    });
    expect(gameOver.outcome).toBe('loss');
    expect(gameOver.finalPrice).toBe(88);
    expect(gameOver.rewardPlans).toEqual([{
      resource: 'coins',
      rewardType: 1,
      refId: 1,
      quantity: 100,
      inventoryType: 'coins'
    }]);
    expect(gameOver.state.simGold).toBe(500);
    expect(gameOver.state.simSelectItemList).toEqual(baseState.simSelectItemList);

    const syncedOnly = bidKingApplySimTrainingNextRoundGameData(baseState, nextRoundGameData, {
      playerId: 'p1',
      applyRoundStartTriggers: false
    });
    expect(syncedOnly.roundStartTrigger).toBeUndefined();
    expect(syncedOnly.state.simSelectItemList).toEqual(nextRoundGameData.userLog[0]!.simSelectItemList);
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

  it('maps BattleItem rows through source itemName_<itemId> Skill rows instead of inferred groups', () => {
    const missingDirectSkills: number[] = [];
    const wrongPlans: number[] = [];

    for (const item of BattleItem) {
      const skill = skillForBattleItem(item);
      if (!skill) {
        missingDirectSkills.push(item.id);
        continue;
      }
      const plan = battleItemEffectPlanForItem(item);
      if (plan.skillId !== skill.id || plan.skillName !== bidKingSkillDisplayName(skill)) {
        wrongPlans.push(item.id);
      }
    }

    const allVision = BattleItem.find((item) => item.id === 100100)!;
    const totalValue = BattleItem.find((item) => item.id === 100121)!;
    expect(missingDirectSkills).toEqual([]);
    expect(wrongPlans).toEqual([]);
    expect(skillForBattleItem(allVision)?.id).toBe(100);
    expect(battleItemEffectPlanForItem(allVision)).toEqual(expect.objectContaining({
      skillId: 100,
      effectCategory: 1,
      requestedTargetCount: 999,
      targetMode: 'skill_target'
    }));
    expect(skillForBattleItem(totalValue)?.id).toBe(500);
    expect(battleItemEffectPlanForItem(totalValue).effectCategory).toBe(10);
  });

  it('uses source BattleItem target count semantics and source-shaped hit boxes', () => {
    const match = createMatch({
      id: 'compat-battle-item-source-hitbox',
      players,
      seed: 3335,
      coreMode: true,
      coreAuctionMode: 'sealed',
      coreBidMapId: 2101
    });
    startNextRound(match, 1000);
    setRoundPhase(match, 'intel', 3200, 1200);

    const item = BattleItem.find((row) => row.id === 100100)!;
    useBattleItem(match, 'p1', item, 1300);

    const slots = match.currentRound?.container.warehouseSlots ?? [];
    const entry = match.currentRound?.skillFeed.at(-1);
    const eventPayload = match.events.at(-1)?.payload as { effectPlan?: BattleItemEffectPlan } | undefined;

    expect(entry?.source).toBe('item');
    expect(entry?.skillCid).toBe(100);
    expect(entry?.effectCategory).toBe(1);
    expect(entry?.targetCount).toBe(slots.length);
    expect(entry?.targetItemIds).toHaveLength(slots.length);
    expect(entry?.hitBoxList).toHaveLength(slots.length);
    expect(entry?.hitBoxList?.every((box) => (
      box.boxId >= 0 &&
      box.itemUid > 0 &&
      box.itemSlotType > 0 &&
      box.itemCid === 0 &&
      box.itemPrice === 0 &&
      box.itemQuility === 0 &&
      box.itemBoxIndex === 0 &&
      box.itemType.length === 0
    ))).toBe(true);
    expect(eventPayload?.effectPlan).toEqual(expect.objectContaining({
      requestedTargetCount: 999,
      targetCount: slots.length,
      skillId: 100
    }));
  });

  it('archives BattleItem aggregate SkillEffect fields without leaking full item boxes', () => {
    const match = createMatch({
      id: 'compat-battle-item-aggregate',
      players,
      seed: 3336,
      coreMode: true,
      coreAuctionMode: 'sealed',
      coreBidMapId: 2101
    });
    startNextRound(match, 1000);
    setRoundPhase(match, 'intel', 3200, 1200);

    const item = BattleItem.find((row) => row.id === 100103)!;
    useBattleItem(match, 'p1', item, 1300);

    const round = match.currentRound!;
    const slots = round.container.warehouseSlots;
    const totalCells = slots.reduce((sum, slot) => sum + slot.item.footprint.w * slot.item.footprint.h, 0);
    const totalValue = slots.reduce((sum, slot) => sum + slot.item.value, 0);
    const entry = round.skillFeed.at(-1);
    const gameData = buildBidKingGameDataSnapshot(match, round);
    const itemSkillLog = gameData.itemSkillLog.find((log) => log.itemCid === item.id);

    expect(entry?.skillCid).toBe(200);
    expect(entry?.effectCategory).toBe(2);
    expect(entry?.hitBoxList).toHaveLength(slots.length);
    expect(entry?.hitBoxList?.every((box) => (
      box.itemCid === 0 &&
      box.itemSlotType === 0 &&
      box.itemQuility === 0 &&
      box.itemPrice === 0 &&
      box.itemBoxIndex === 0 &&
      box.itemType.length === 0
    ))).toBe(true);
    expect(itemSkillLog?.skillCid).toBe(200);
    expect(itemSkillLog?.hitItemIndex).toBe(slots.length);
    expect(itemSkillLog?.totalHitBoxIndex).toBe(totalCells);
    expect(itemSkillLog?.hitItemTotalPrice).toBe(totalValue);
    expect(itemSkillLog?.allHitItemAvgBoxIndex).toBe(totalCells / slots.length);
    expect(itemSkillLog?.allHitBoxAvgPrice).toBe(totalValue / totalCells);
    expect(itemSkillLog?.allHitItemAvgPrice).toBe(totalValue / slots.length);
    expect(itemSkillLog?.hitBoxList.every((box) => box.itemCid === 0 && box.itemPrice === 0)).toBe(true);
  });

  it('supports source target 7 area filters for BattleItem average value skills', () => {
    const match = createMatch({
      id: 'compat-battle-item-area-target',
      players,
      seed: 3337,
      coreMode: true,
      coreAuctionMode: 'sealed',
      coreBidMapId: 2101
    });
    startNextRound(match, 1000);
    setRoundPhase(match, 'intel', 3200, 1200);

    const item = BattleItem.find((row) => row.id === 100169)!;
    const plan = battleItemEffectPlanForItem(item);
    expect(plan).toEqual(expect.objectContaining({
      skillId: 10014,
      skillTarget: 7,
      effectCategory: 8,
      targetPlayerRequired: false
    }));

    useBattleItem(match, 'p1', item, 1300);

    const round = match.currentRound!;
    const entry = round.skillFeed.at(-1);
    const targetIds = new Set(entry?.targetItemIds ?? []);
    const hitSlots = round.container.warehouseSlots.filter((slot) => targetIds.has(slot.item.id));
    const gameData = buildBidKingGameDataSnapshot(match, round);
    const itemSkillLog = gameData.itemSkillLog.find((log) => log.itemCid === item.id);
    const expectedAverage = hitSlots.reduce((sum, slot) => sum + slot.item.value, 0) / Math.max(1, hitSlots.length);

    expect(hitSlots.length).toBeGreaterThan(0);
    expect(hitSlots.every((slot) => slot.item.footprint.w * slot.item.footprint.h === 1)).toBe(true);
    expect(entry?.skillCid).toBe(10014);
    expect(entry?.effectCategory).toBe(8);
    expect(itemSkillLog?.allHitItemAvgPrice).toBe(expectedAverage);
  });

  it('applies source target 6 prefilter and sort tuple for hero skills', () => {
    const match = createMatch({
      id: 'compat-skill-target-six',
      players: players.map((player) => player.id === 'p1' ? { ...player, heroCid: 110 } : player),
      seed: 3338,
      coreMode: true,
      coreAuctionMode: 'sealed',
      coreBidMapId: 2101
    });
    startNextRound(match, 1000);

    const entry = match.currentRound?.skillFeed.find((feed) => feed.source === 'hero' && feed.playerId === 'p1');
    const hitItemId = entry?.targetItemIds?.[0];
    const hitSlot = match.currentRound?.container.warehouseSlots.find((slot) => slot.item.id === hitItemId);
    const maxQuality = Math.max(...(match.currentRound?.container.warehouseSlots.map((slot) => {
      const itemId = /^compat_(\d+)_/.exec(slot.item.id)?.[1];
      return itemId ? itemById(Number(itemId))?.item_quality ?? 0 : 0;
    }) ?? [0]));
    const hitQuality = (() => {
      const itemId = /^compat_(\d+)_/.exec(hitSlot?.item.id ?? '')?.[1];
      return itemId ? itemById(Number(itemId))?.item_quality ?? 0 : 0;
    })();

    expect(entry?.skillCid).toBe(100110);
    expect(hitQuality).toBe(maxQuality);
  });

  it('filters source target 10 by per-player known information state', () => {
    const match = createMatch({
      id: 'compat-skill-target-ten',
      players,
      seed: 3339,
      coreMode: true,
      coreAuctionMode: 'sealed',
      coreBidMapId: 2101
    });
    startNextRound(match, 1000);

    const slots = match.currentRound?.container.warehouseSlots ?? [];
    const shapeOnly = slots[0]!;
    const rankOnly = slots[1]!;
    const fullKnown = slots[2]!;
    const shapeAndRank = slots[3]!;
    const knownInfoByItemId = new globalThis.Map<string, BidKingKnownInfoState>([
      [shapeOnly.item.id, { shapeKnown: true, rankKnown: false, allKnown: false }],
      [rankOnly.item.id, { shapeKnown: false, rankKnown: true, allKnown: false }],
      [fullKnown.item.id, { shapeKnown: true, rankKnown: true, allKnown: true }],
      [shapeAndRank.item.id, { shapeKnown: true, rankKnown: true, allKnown: false }]
    ]);

    const fullyUnknown = selectBidKingSlotsBySkill(slots, match, skillById(1001041)!, { knownInfoByItemId });
    const unknownQuality = selectBidKingSlotsBySkill(slots, match, skillById(1001071)!, { knownInfoByItemId });
    const knownQuality = selectBidKingSlotsBySkill(slots, match, skillById(1002082)!, { knownInfoByItemId });
    const knownShapeAndQuality = selectBidKingSlotsBySkill(slots, match, skillById(3043)!, { knownInfoByItemId });
    const noKnownQuality = selectBidKingSlotsBySkill(slots, match, skillById(1002082)!, {
      knownInfoByItemId: new globalThis.Map<string, BidKingKnownInfoState>()
    });

    expect(fullyUnknown.every((slot) => ![shapeOnly, rankOnly, fullKnown, shapeAndRank].includes(slot))).toBe(true);
    expect(unknownQuality.some((slot) => slot.item.id === shapeOnly.item.id)).toBe(true);
    expect(unknownQuality.every((slot) => ![rankOnly, fullKnown, shapeAndRank].includes(slot))).toBe(true);
    expect(knownQuality.map((slot) => slot.item.id)).toEqual([
      rankOnly.item.id,
      fullKnown.item.id,
      shapeAndRank.item.id
    ]);
    expect(knownShapeAndQuality.map((slot) => slot.item.id)).toEqual([
      fullKnown.item.id,
      shapeAndRank.item.id
    ]);
    expect(noKnownQuality).toEqual([]);
  });

  it('does not replace empty source skill targets with random warehouse slots', () => {
    const match = createMatch({
      id: 'compat-empty-source-target',
      players,
      seed: 3343,
      coreMode: true,
      coreAuctionMode: 'sealed',
      coreBidMapId: 2101
    });
    startNextRound(match, 1000);

    const slots = match.currentRound?.container.warehouseSlots ?? [];
    const presentTypes = new Set(slots.map((slot) => bidKingItemRowForSlot(slot)?.item_type_id).filter(Boolean));
    const absentType = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110]
      .find((typeId) => !presentTypes.has(typeId))
      ?? 999999;
    const absentTypeSkill = {
      ...skillById(100105)!,
      skilltarget: 1,
      skilltargetvalue: [absentType],
      skilltarget2: 0,
      skilltargetvalue2: [0],
      skilltarget3: 0,
      skilltargetvalue3: [0],
      skill_count: 0,
      skilleffect_position: [1000]
    };
    const noQualityStateSkill = skillById(1002082)!;

    expect(selectBidKingSlotsBySkill(slots, match, absentTypeSkill)).toEqual([]);
    expect(selectBidKingSlotsBySkill(slots, match, noQualityStateSkill, {
      knownInfoByItemId: new globalThis.Map<string, BidKingKnownInfoState>()
    })).toEqual([]);
  });

  it('treats source skilltarget 8 as selected target box instead of target player', () => {
    const match = createMatch({
      id: 'compat-skill-target-eight',
      players,
      seed: 3342,
      coreMode: true,
      coreAuctionMode: 'sealed',
      coreBidMapId: 2101
    });
    startNextRound(match, 1000);

    const slots = match.currentRound?.container.warehouseSlots ?? [];
    const chosen = slots.find((slot) => slot.x > 0 || slot.y > 0) ?? slots[0]!;
    const targetBoxId = chosen.y * 10 + chosen.x;
    const anyOutlineQuality = skillById(3030)!;
    const typedOutlineQuality = skillById(3032)!;

    expect(bidKingSkillRequiresTargetBox(anyOutlineQuality)).toBe(true);
    expect(bidKingSimTrainingItemRequiresTargetBox(8029)).toBe(true);
    expect(bidKingSimTrainingItemRequiresTargetBox(8059)).toBe(false);
    expect(battleItemEffectPlanForItem(BattleItem[0]!).targetPlayerRequired).toBe(false);
    expect(selectBidKingSlotsBySkill(slots, match, anyOutlineQuality)).toEqual([]);
    expect(selectBidKingSlotsBySkill(slots, match, anyOutlineQuality, {
      targetBoxId
    }).map((slot) => slot.item.id)).toEqual([chosen.item.id]);
    expect(selectBidKingSlotsBySkill(slots, match, typedOutlineQuality, {
      targetBoxIds: [targetBoxId]
    }).map((slot) => slot.item.id)).toEqual([chosen.item.id]);
  });

  it('keeps text-only SkillEffect categories out of persistent warehouse knowledge', () => {
    const match = createMatch({
      id: 'compat-text-only-skill-effects',
      players,
      seed: 3341,
      coreMode: true,
      coreAuctionMode: 'sealed',
      coreBidMapId: 2101
    });
    startNextRound(match, 1000);
    const round = match.currentRound!;
    round.skillFeed = [];

    const baseSnapshot = buildSnapshot(match, 'p1').public.currentRound!;
    const baseWarehouseSlots = baseSnapshot.warehouseSlots ?? [];
    const target = round.container.warehouseSlots.find((slot) => {
      const view = baseWarehouseSlots.find((candidate) => candidate.slotId === slot.slotId);
      return view && !view.visibleRarity && !view.visibleCategory && !view.visibleValueRange && !view.markedBySkill;
    }) ?? round.container.warehouseSlots.at(-1)!;
    const baseView = baseWarehouseSlots.find((slot) => slot.slotId === target.slotId)!;
    const sourceItemId = Number(/^compat_(\d+)_/.exec(target.item.id)?.[1] ?? 0);
    const sourceItem = itemById(sourceItemId);
    const qualityTextSkill = skillById(200052)!;
    const qualityBox = bidKingSourceHitBoxList(round, [target], qualityTextSkill)[0]!;
    const typeBox = {
      ...qualityBox,
      itemQuility: 0,
      itemType: sourceItem?.item_type_ids ? [...sourceItem.item_type_ids] : [sourceItemId],
      itemPrice: 0
    };
    const priceDigitsBox = {
      ...qualityBox,
      itemQuility: 0,
      itemType: [],
      itemPrice: target.item.value
    };
    const entries: SkillFeedEntry[] = [
      {
        id: `${round.id}_text_quality`,
        round: round.index + 1,
        source: 'map',
        sourceName: '拍场',
        skillName: '品质文本',
        skillCid: qualityTextSkill.id,
        effectId: 12000,
        effectCategory: 12,
        text: '本场竞拍最高品质为测试值。',
        visibility: 'public',
        targetItemIds: [target.item.id],
        hitBoxList: [qualityBox],
        createdAt: 1200
      },
      {
        id: `${round.id}_text_type`,
        round: round.index + 1,
        source: 'map',
        sourceName: '拍场',
        skillName: '品类文本',
        skillCid: 13000,
        effectId: 13000,
        effectCategory: 13,
        text: '目标品类为测试值。',
        visibility: 'public',
        targetItemIds: [target.item.id],
        hitBoxList: [typeBox],
        createdAt: 1201
      },
      {
        id: `${round.id}_text_price_digits`,
        round: round.index + 1,
        source: 'map',
        sourceName: '拍场',
        skillName: '价格位数',
        skillCid: 14000,
        effectId: 14000,
        effectCategory: 14,
        text: '目标价格为若干位数。',
        visibility: 'public',
        targetItemIds: [target.item.id],
        hitBoxList: [priceDigitsBox],
        createdAt: 1202
      }
    ];
    round.skillFeed.push(...entries);

    const publicRound = buildSnapshot(match, 'p1').public.currentRound!;
    const publicWarehouseSlots = publicRound.warehouseSlots ?? [];
    const publicSkillFeed = publicRound.skillFeed ?? [];
    const updatedView = publicWarehouseSlots.find((slot) => slot.slotId === target.slotId)!;
    const publicQualityBox = publicSkillFeed.find((entry) => entry.id.endsWith('_text_quality'))?.hitBoxList?.[0];
    const publicTypeBox = publicSkillFeed.find((entry) => entry.id.endsWith('_text_type'))?.hitBoxList?.[0];
    const publicPriceDigitsBox = publicSkillFeed.find((entry) => entry.id.endsWith('_text_price_digits'))?.hitBoxList?.[0];
    const gameData = buildBidKingGameDataSnapshot(match, round);
    const qualityLog = gameData.mapSkillLog.find((entry) => entry.skillCid === 200052);
    const typeLog = gameData.mapSkillLog.find((entry) => entry.skillCid === 13000);
    const priceDigitsLog = gameData.mapSkillLog.find((entry) => entry.skillCid === 14000);
    const knownFromQualityText = bidKingKnowledgeByItemIdFromSkillFeed(round.container.warehouseSlots, [entries[0]!], 'p1').get(target.item.id);

    expect(baseView.visibleRarity).toBeUndefined();
    expect(baseView.visibleCategory).toBeUndefined();
    expect(baseView.visibleValueRange).toBeUndefined();
    expect(updatedView.visibleRarity).toBeUndefined();
    expect(updatedView.visibleCategory).toBeUndefined();
    expect(updatedView.visibleValueRange).toBeUndefined();
    expect(updatedView.markedBySkill).toBeUndefined();
    expect(publicQualityBox?.itemQuility).toBe(0);
    expect(publicTypeBox?.itemType).toEqual([]);
    expect(publicPriceDigitsBox?.itemPrice).toBe(0);
    expect(qualityLog?.hitBoxList[0]?.itemQuility).toBeGreaterThan(0);
    expect(typeLog?.hitBoxList[0]?.itemType.length).toBeGreaterThan(0);
    expect(priceDigitsLog?.hitBoxList[0]?.itemPrice).toBe(target.item.value);
    expect(knownFromQualityText?.rankKnown).not.toBe(true);
  });

  it('archives source-shaped GameData logs for BidKing replay and settlement evidence', () => {
    const match = createMatch({
      id: 'compat-game-data',
      players: players.map((player, index) => index === 0
        ? {
            ...player,
            heroCid: Hero[1]!.id,
            heroSkinCid: 1410201,
            selectedItemList: [{ itemCid: BattleItem[0]!.id, isUsed: false, stockId: 5001, boxId: 7 }]
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
    const itemEvent = match.events.find((event) => event.type === 'battle_item_used');
    expect(itemEvent?.sourceProtocols?.map((protocol) => protocol.name)).toEqual([
      'C2S_38_game_use_item',
      'S2C_39_game_use_item'
    ]);
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
    expect(p1Log?.selectItemList).toEqual([{ itemCid: BattleItem[0]!.id, isUsed: true }]);
    expect(gameData?.selectItemCount).toBe(1);
    expect(p1Log?.priceLog.at(-1)?.round).toBe(5);
    expect(p1Log?.priceLog.at(-1)?.itemCidOrPrice).toBeGreaterThanOrEqual(500_000);
    expect(Object.keys(p1Log?.priceLog.at(-1) ?? {}).sort()).toEqual(['itemCidOrPrice', 'round']);
    expect(p1Log?.useItemLog.at(-1)?.round).toBe(5);
    expect(p1Log?.useItemLog.at(-1)?.itemCidOrPrice).toBe(BattleItem[0]!.id);
    expect(Object.keys(p1Log?.useItemLog.at(-1) ?? {}).sort()).toEqual(['itemCidOrPrice', 'round']);
    expect(firstStockBox?.boxId).toBe(firstWarehouseSlot ? firstWarehouseSlot.y * 10 + firstWarehouseSlot.x : undefined);
    expect(firstStockBox?.position).toEqual(firstWarehouseSlot ? { x: firstWarehouseSlot.y, y: firstWarehouseSlot.x } : undefined);
    expect(firstStockBox?.item.boxPositionData[0]).toEqual(firstWarehouseSlot ? { x: firstWarehouseSlot.y, y: firstWarehouseSlot.x } : undefined);
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
    expect(Object.keys(autoSkillLog ?? {})).not.toContain('sourceFeedId');
    expect(Object.keys(autoSkillLog ?? {})).not.toContain('sourceEventId');
    const itemSkillLog = gameData?.itemSkillLog.find((entry) => entry.itemCid === BattleItem[0]!.id);
    expect(itemSkillLog).toBeDefined();
    expect(Object.keys(itemSkillLog ?? {})).not.toContain('sourceFeedId');
    expect(Object.keys(itemSkillLog ?? {})).not.toContain('sourceEventId');
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
        rarity: item.rarity
      }))
    })),
    transactions: match.transactions
  });
}

function advanceCoreAuctionRound(match: ReturnType<typeof createMatch>, now: number): void {
  const minimumBid = match.currentRound?.container.minimumBid ?? 0;
  const bid = Math.max(minimumBid, 50000 + (match.currentRound?.index ?? 0) * 5000);
  setRoundPhase(match, 'auction', 60000, now);
  submitBid(match, 'p1', bid, now + 100);
  submitBid(match, 'p2', bid, now + 200);
  settleCurrentRound(match, now + 300);
  finishRound(match, now + 400);
  startNextRound(match, now + 500);
}

function normalizeClueReviewIds<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (key, entry) => (
    key === 'clueId' && typeof entry === 'string'
      ? entry.replace(/_(\d+)$/, '_n')
      : entry
  ))) as T;
}
