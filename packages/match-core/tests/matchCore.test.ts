import { gameConfig } from '@bitkingdom/config';
import { BattleItem } from '@bitkingdom/bidking-compat';
import { describe, expect, it } from 'vitest';
import { finishRound, passAuction, revealNextItem, settleCurrentRound, submitBid } from '../src/auction';
import { chooseBotAction } from '../src/bots';
import { createMatch, buildSnapshot, setRoundPhase, startNextRound } from '../src/match';
import { bidKingSourceRoles } from '../src/bidking/heroRuntime';
import { useSkill } from '../src/skills';

function makeMatch() {
  const roles = bidKingSourceRoles(gameConfig.roles);
  const match = createMatch({
    id: 'test_match',
    seed: 12345,
    players: [
      { id: 'p1', name: '甲', kind: 'human', roleId: roles[0]!.id },
      { id: 'p2', name: '乙', kind: 'human', roleId: roles[1]!.id },
      { id: 'b1', name: '丙', kind: 'bot', roleId: roles[2]!.id },
      { id: 'b2', name: '丁', kind: 'bot', roleId: roles[3]!.id }
    ],
    coreAuctionMode: 'sealed',
    coreBidMapId: 2601,
    config: gameConfig,
    now: 1000
  });
  startNextRound(match, 2000);
  return match;
}

function makeCoreMatch() {
  const roles = bidKingSourceRoles(gameConfig.roles);
  const match = createMatch({
    id: 'core_match',
    seed: 24680,
    players: [
      { id: 'p1', name: '甲', kind: 'human', roleId: roles[0]!.id },
      { id: 'p2', name: '乙', kind: 'human', roleId: roles[1]!.id },
      { id: 'b1', name: '丙', kind: 'bot', roleId: roles[2]!.id },
      { id: 'b2', name: '丁', kind: 'bot', roleId: roles[3]!.id }
    ],
    totalRounds: 5,
    coreMode: true,
    coreAuctionMode: 'sealed',
    coreBidMapId: 2601,
    config: gameConfig,
    now: 1000
  });
  for (const player of match.players) {
    player.cash = 10_000_000;
  }
  startNextRound(match, 2000);
  return match;
}

describe('match core', () => {
  it('builds a player snapshot without hidden items or other private clues', () => {
    const match = makeMatch();
    const snapshot = buildSnapshot(match, 'p1');

    expect(snapshot.public.players).toHaveLength(4);
    expect(snapshot.public.currentRound?.container.name).toBeTruthy();
    expect(snapshot.public.currentRound?.revealedItems).toEqual([]);
    expect(snapshot.private?.privateClues.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(snapshot);
    const hiddenName = match.currentRound!.container.hiddenItems[0]!.name;
    const otherPrivateClue = match.players.find((player) => player.id === 'p2')!.privateClues[0]!.text;
    expect(serialized).not.toContain(hiddenName);
    expect(serialized).not.toContain(otherPrivateClue);
  });

  it('settles core sealed auction with first price payment', () => {
    const match = makeMatch();
    match.roundIndex = 4;
    match.totalRounds = 5;
    match.currentRound!.index = 4;
    match.currentRound!.isFinalAuction = true;
    match.currentRound!.auctionMode = 'sealed';
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'p1', 80000, 3100);
    submitBid(match, 'p2', 56000, 3200);
    passAuction(match, 'b1', 3300);
    submitBid(match, 'b2', 41000, 3400);
    settleCurrentRound(match, 4000);

    expect(match.currentRound!.settlement?.winnerId).toBe('p1');
    expect(match.currentRound!.settlement?.payment).toBe(80000);
    expect(match.transactions.some((tx) => tx.reason === 'auction_payment')).toBe(true);
  });

  it('runs core mode as one warehouse across five progressive bid rounds', () => {
    const match = makeCoreMatch();
    const warehouseId = match.currentRound!.container.id;
    const hiddenItemCount = match.currentRound!.container.hiddenItems.length;

    expect(match.currentRound!.phase).toBe('intel');
    expect(match.currentRound!.container.publicClues).toEqual([]);
    expect(match.currentRound!.openingCandidates?.length).toBeGreaterThan(1);
    expect(match.currentRound!.intelligenceClue).toBeTruthy();
    const firstSnapshotRound = buildSnapshot(match, 'p1').public.currentRound!;
    expect(firstSnapshotRound.container.estimateHidden).toBe(true);
    expect(firstSnapshotRound.container.estimateMin).toBe(0);
    expect(firstSnapshotRound.container.estimateMax).toBe(0);
    expect(firstSnapshotRound.publicClues.length).toBeGreaterThan(0);
    expect(firstSnapshotRound.intelligenceClue?.source).toBe('public');
    expect(firstSnapshotRound.intelligenceChoices).toHaveLength(4);
    expect(firstSnapshotRound.intelligenceChoices?.filter((choice) => choice.text).length).toBe(1);
    expect(firstSnapshotRound.skillFeed?.some((entry) => entry.visibility === 'public')).toBe(true);
    expect(firstSnapshotRound.skillFeed?.some((entry) => entry.playerId === 'p1' && entry.visibility === 'private')).toBe(true);
    expect(firstSnapshotRound.warehouseSlots?.some((slot) => slot.markedBySkill)).toBe(false);

    for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
      expect(match.currentRound!.container.id).toBe(warehouseId);
      expect(match.currentRound!.auctionMode).toBe('sealed');
      expect(match.currentRound!.isFinalAuction).toBe(roundIndex === 4);
      expect(match.currentRound!.warehouseSlots.length).toBe(hiddenItemCount);

      setRoundPhase(match, 'auction', 30000, 3000 + roundIndex * 1000);
      if (roundIndex === 0) {
        expect(buildSnapshot(match, 'p1').public.currentRound?.warehouseSlots?.some((slot) => slot.markedBySkill)).toBe(true);
      }
      const minimumBid = match.currentRound!.container.minimumBid ?? 0;
      const secondBid = Math.max(minimumBid, 36000 + roundIndex * 3000);
      submitBid(match, 'p1', secondBid + 4000, 3100 + roundIndex * 1000);
      submitBid(match, 'p2', secondBid, 3200 + roundIndex * 1000);
      settleCurrentRound(match, 3400 + roundIndex * 1000);

      if (roundIndex < 4) {
        expect(match.currentRound!.settlement?.isFinal).toBe(false);
        expect(match.currentRound!.phase).toBe('settlement');
        expect(match.players.find((player) => player.id === 'p1')!.holdings).toHaveLength(0);
        expect(match.transactions).toHaveLength(0);
        finishRound(match, 3800 + roundIndex * 1000);
        startNextRound(match, 4000 + roundIndex * 1000);
        continue;
      }

      expect(match.currentRound!.settlement?.isFinal).toBe(true);
      expect(match.currentRound!.settlement?.winnerId).toBe('p1');
      expect(match.players.find((player) => player.id === 'p1')!.holdings).toHaveLength(hiddenItemCount);
      expect(match.transactions.some((tx) => tx.reason === 'auction_payment')).toBe(true);
    }
  });

  it('keeps opening intelligence one-shot and exposes cumulative skill feed on later rounds', () => {
    const match = makeCoreMatch();
    const firstRound = buildSnapshot(match, 'p1').public.currentRound!;
    const firstVisibleFeedIds = (firstRound.skillFeed ?? []).map((entry) => entry.id);

    expect(firstRound.index).toBe(0);
    expect(firstRound.intelligenceClue).toBeTruthy();
    expect(firstRound.intelligenceChoices).toHaveLength(4);
    expect(firstVisibleFeedIds.length).toBeGreaterThan(0);

    setRoundPhase(match, 'auction', 30000, 3000);
    const minimumBid = match.currentRound!.container.minimumBid ?? 0;
    submitBid(match, 'p1', minimumBid + 14_000, 3100);
    submitBid(match, 'p2', minimumBid + 8_000, 3200);
    submitBid(match, 'b1', minimumBid + 2_000, 3300);
    submitBid(match, 'b2', minimumBid, 3400);
    settleCurrentRound(match, 3600);
    finishRound(match, 3800);
    startNextRound(match, 4000);

    expect(match.currentRound!.skillFeed.some((entry) => entry.source === 'map')).toBe(false);
    match.currentRound!.skillFeed.push({
      id: 'forced_round2_map_regression_guard',
      round: 2,
      source: 'map',
      sourceName: '江东客舱',
      skillName: '不该出现的场地情报',
      text: '第二轮不得新增场地情报。',
      visibility: 'public',
      createdAt: 4000
    });

    const secondRound = buildSnapshot(match, 'p1').public.currentRound!;
    const secondVisibleFeedIds = new Set((secondRound.skillFeed ?? []).map((entry) => entry.id));

    expect(secondRound.index).toBe(1);
    expect(secondRound.intelligenceClue).toBeUndefined();
    expect(secondRound.intelligenceChoices).toBeUndefined();
    expect((secondRound.skillFeed ?? []).some((entry) => entry.source === 'map' && entry.round === 2)).toBe(false);
    for (const id of firstVisibleFeedIds) {
      expect(secondVisibleFeedIds.has(id)).toBe(true);
    }
  });

  it('keeps BidKing opening warehouse knowledge sparse until skills reveal it', () => {
    const match = makeCoreMatch();
    const round = match.currentRound!;
    const snapshotRound = buildSnapshot(match, 'p1').public.currentRound!;

    expect(round.warehouseSlots.every((slot) =>
      slot.visibleShape === false &&
      slot.w === 1 &&
      slot.h === 1 &&
      slot.visibleRarity === undefined &&
      slot.visibleCategory === undefined &&
      slot.visibleValueRange === undefined &&
      slot.itemName === undefined &&
      slot.iconKey === undefined
    )).toBe(true);

    expect((snapshotRound.warehouseSlots ?? []).some((slot) => slot.markedBySkill)).toBe(false);

    setRoundPhase(match, 'auction', 30000, 3000);
    const auctionRound = buildSnapshot(match, 'p1').public.currentRound!;
    const markedSlots = (auctionRound.warehouseSlots ?? []).filter((slot) => slot.markedBySkill);
    expect(markedSlots.length).toBeGreaterThan(0);
    expect(markedSlots.some((slot) => slot.visibleShape && slot.visibleRarity !== undefined)).toBe(true);

    const unmarkedSlots = (auctionRound.warehouseSlots ?? []).filter((slot) => !slot.markedBySkill);
    expect(unmarkedSlots.length).toBeGreaterThan(0);
    expect(unmarkedSlots.every((slot) =>
      slot.visibleShape === false &&
      slot.w === 1 &&
      slot.h === 1 &&
      slot.visibleRarity === undefined &&
      slot.visibleCategory === undefined &&
      slot.visibleValueRange === undefined &&
      slot.itemName === undefined &&
      slot.iconKey === undefined
    )).toBe(true);

    expect(round.container.publicClues).toEqual([]);
    expect(match.players.flatMap((player) => player.privateClues).every((clue) =>
      clue.source === 'skill' && !clue.id.includes('private_value') && !clue.id.includes('private_best')
    )).toBe(true);
  });

  it('pins quality-only warehouse knowledge to the item origin without revealing footprint', () => {
    const match = makeCoreMatch();
    const round = match.currentRound!;
    const targetSlot = round.container.warehouseSlots.find((slot) => slot.w > 1 || slot.h > 1)
      ?? round.container.warehouseSlots[0]!;
    round.skillFeed = [{
      id: `${round.id}_quality_pin_test`,
      round: round.index + 1,
      source: 'map',
      sourceName: '测试拍场',
      skillName: '品质标记',
      effectCategory: 7,
      text: '测试：只显示品质。',
      visibility: 'public',
      targetItemIds: [targetSlot.item.id],
      hitBoxList: [{
        boxId: targetSlot.y * 10 + targetSlot.x,
        itemUid: 1,
        itemCid: 0,
        itemSlotType: 0,
        itemType: [],
        itemQuility: 1,
        itemPrice: 0,
        itemBoxIndex: 0
      }],
      createdAt: 3000
    }];
    setRoundPhase(match, 'intel', 5000, 3000);

    const intelQualityRound = buildSnapshot(match, 'p1').public.currentRound!;
    const intelQualityView = intelQualityRound.warehouseSlots?.find((slot) => slot.slotId === targetSlot.slotId);
    expect(intelQualityView).toEqual(expect.objectContaining({
      x: targetSlot.x,
      y: targetSlot.y,
      w: 1,
      h: 1,
      visibleShape: false
    }));

    setRoundPhase(match, 'auction', 30000, 3500);
    const qualityRound = buildSnapshot(match, 'p1').public.currentRound!;
    const qualityView = qualityRound.warehouseSlots?.find((slot) => slot.slotId === targetSlot.slotId);
    expect(qualityView).toEqual(expect.objectContaining({
      x: targetSlot.x,
      y: targetSlot.y,
      w: 1,
      h: 1,
      visibleShape: false,
      visibleRarity: targetSlot.item.rarity,
      markedBySkill: true
    }));

    round.skillFeed.push({
      id: `${round.id}_shape_pin_test`,
      round: round.index + 1,
      source: 'hero',
      playerId: 'p1',
      sourceName: '测试名士',
      skillName: '轮廓标记',
      effectCategory: 1,
      text: '测试：显示轮廓。',
      visibility: 'public',
      targetItemIds: [targetSlot.item.id],
      hitBoxList: [{
        boxId: targetSlot.y * 10 + targetSlot.x,
        itemUid: 1,
        itemCid: 0,
        itemSlotType: targetSlot.w * 10 + targetSlot.h,
        itemType: [],
        itemQuility: 0,
        itemPrice: 0,
        itemBoxIndex: 0
      }],
      createdAt: 3200
    });

    const shapedRound = buildSnapshot(match, 'p1').public.currentRound!;
    const shapedView = shapedRound.warehouseSlots?.find((slot) => slot.slotId === targetSlot.slotId);
    expect(shapedView).toEqual(expect.objectContaining({
      x: targetSlot.x,
      y: targetSlot.y,
      w: targetSlot.w,
      h: targetSlot.h,
      visibleShape: true,
      visibleRarity: targetSlot.item.rarity,
      markedBySkill: true
    }));
  });

  it('settles core open auction without deposit refund bookkeeping', () => {
    const match = makeMatch();
    match.roundIndex = 4;
    match.totalRounds = 5;
    match.currentRound!.index = 4;
    match.currentRound!.isFinalAuction = true;
    match.currentRound!.auctionMode = 'open';
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'p1', 30000, 3100);
    submitBid(match, 'p2', 36000, 3200);
    settleCurrentRound(match, 4000);

    expect(match.currentRound!.settlement?.winnerId).toBe('p2');
    expect(match.currentRound!.settlement?.participants.find((entry) => entry.playerId === 'p1')?.profit).toBe(0);
    expect(match.transactions.some((tx) => tx.reason === 'auction_deposit_refund')).toBe(false);
  });

  it('rejects core bids above cash available', () => {
    const match = makeMatch();
    const player = match.players.find((candidate) => candidate.id === 'p1')!;
    player.cash = 31000;
    match.currentRound!.auctionMode = 'sealed';
    setRoundPhase(match, 'auction', 30000, 3000);

    expect(() => submitBid(match, 'p1', 40000, 3100)).toThrow(/可用现金/);
    expect(match.currentRound!.bids).toHaveLength(0);
    expect(player.cash).toBe(31000);
  });

  it('accepts core bids within cash available and pays first price', () => {
    const match = makeMatch();
    const player = match.players.find((candidate) => candidate.id === 'p1')!;
    player.cash = 31000;
    match.currentRound!.auctionMode = 'sealed';
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'p1', 29000, 3100);
    expect(match.currentRound!.bids.find((bid) => bid.playerId === 'p1')?.amount).toBe(29000);
    expect(match.currentRound!.currentBid).toBe(0);
    settleCurrentRound(match, 4000);
    expect(player.cash).toBe(2000);
  });

  it('keeps open auction amounts hidden until round feedback and allows lower one-shot bids', () => {
    const match = makeMatch();
    match.roundIndex = 4;
    match.totalRounds = 5;
    match.currentRound!.index = 4;
    match.currentRound!.isFinalAuction = true;
    match.currentRound!.auctionMode = 'open';
    match.currentRound!.container.minimumBid = 100000;
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'p1', 50000, 3100);
    submitBid(match, 'p2', 30000, 3200);

    expect(match.currentRound!.currentBid).toBe(0);
    expect(match.currentRound!.currentLeaderId).toBeUndefined();

    const p1Round = buildSnapshot(match, 'p1').public.currentRound!;
    expect(p1Round.bids.find((bid) => bid.playerId === 'p1')).toEqual(expect.objectContaining({
      amount: 0,
      visible: false
    }));
    expect(p1Round.bids.find((bid) => bid.playerId === 'p2')).toEqual(expect.objectContaining({
      amount: 0,
      visible: false
    }));
    expect(buildSnapshot(match, 'p1').public.players.find((player) => player.id === 'p2')?.bidRanks?.find((rank) => rank.round === 5)).toEqual(expect.objectContaining({
      submitted: true,
      amount: undefined,
      visibleAmount: false
    }));

    const p2Round = buildSnapshot(match, 'p2').public.currentRound!;
    expect(p2Round.bids.find((bid) => bid.playerId === 'p1')).toEqual(expect.objectContaining({
      amount: 0,
      visible: false
    }));
    expect(p2Round.bids.find((bid) => bid.playerId === 'p2')).toEqual(expect.objectContaining({
      amount: 0,
      visible: false
    }));
    expect(buildSnapshot(match, 'p2').public.players.find((player) => player.id === 'p1')?.bidRanks?.find((rank) => rank.round === 5)).toEqual(expect.objectContaining({
      submitted: true,
      amount: undefined,
      visibleAmount: false
    }));

    settleCurrentRound(match, 4000);

    const feedbackRound = buildSnapshot(match, 'p1').public.currentRound!;
    expect(feedbackRound.settlement?.winnerId).toBe('p1');
    expect(feedbackRound.bids.map((bid) => [bid.playerId, bid.amount, bid.visible])).toEqual([
      ['p1', 50000, true],
      ['p2', 30000, true]
    ]);
    expect(feedbackRound.bidFeedback?.publicRanking.map((entry) => [entry.playerId, entry.rank, entry.amount])).toEqual([
      ['p1', 1, 50000],
      ['p2', 2, 30000]
    ]);
  });

  it('allows positive bids below configured BidKing minimum ranges', () => {
    const match = makeMatch();
    match.currentRound!.auctionMode = 'sealed';
    match.currentRound!.container.minimumBid = 100000;
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'p1', 1000, 3100);

    expect(match.currentRound!.bids.find((bid) => bid.playerId === 'p1')?.amount).toBe(1000);
  });

  it('settles the last scheduled core round even when nobody gives a valid bid', () => {
    const match = makeCoreMatch();
    match.roundIndex = 4;
    match.totalRounds = 5;
    match.currentRound!.index = 4;
    setRoundPhase(match, 'auction', 30000, 3000);

    for (const player of match.players) {
      passAuction(match, player.id, 3100 + player.seat);
    }
    settleCurrentRound(match, 4000);

    expect(match.currentRound!.settlement?.isFinal).toBe(true);
    expect(match.currentRound!.settlement?.winnerId).toBeUndefined();
    expect(match.currentRound!.settlement?.payment).toBe(0);
    expect(match.currentRound!.settlement?.title).toBe('全员观望');
    expect(match.currentRound!.phase).toBe('reveal');
    expect(match.transactions).toHaveLength(0);
  });

  it('applies BidKing loss rebate at match end when a participating player loses beyond the configured threshold', () => {
    const match = makeMatch();
    match.totalRounds = 1;
    match.currentRound!.isFinalAuction = true;
    const lowValueItem = {
      ...match.currentRound!.container.hiddenItems[0]!,
      value: 5_000,
      displayValue: 5_000
    };
    match.currentRound!.container.hiddenItems = [lowValueItem];
    match.currentRound!.container.warehouseSlots = [{
      slotId: 'slot_1',
      item: lowValueItem,
      x: 0,
      y: 0,
      w: 1,
      h: 1
    }];
    match.currentRound!.warehouseSlots = [{
      slotId: 'slot_1',
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      visibleShape: false
    }];
    match.currentRound!.auctionMode = 'open';
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'p1', 50000, 3100);
    settleCurrentRound(match, 4000);

    const rawProfit = lowValueItem.value - 50000;
    const expectedRebate = Math.floor(Math.abs(rawProfit) * 0.1);
    expect(match.currentRound!.settlement?.lossRebateRefund ?? 0).toBe(0);
    expect(match.currentRound!.settlement?.profit).toBe(rawProfit);
    expect(match.transactions.some((tx) => tx.reason === 'bid_loss_rebate')).toBe(false);

    finishRound(match, 5000);
    startNextRound(match, 6000);

    expect(match.finalSummary?.lossRecoveryByPlayerId?.p1).toBe(expectedRebate);
  });

  it('prevents modifying bids in every auction mode', () => {
    for (const mode of ['open', 'sealed'] as const) {
      const match = makeMatch();
      match.currentRound!.auctionMode = mode;
      setRoundPhase(match, 'auction', 10000, 3000);

      submitBid(match, 'p1', 30000, 3100);

      expect(() => submitBid(match, 'p1', 32000, 3200)).toThrow(/Already bid this round/);
      expect(() => passAuction(match, 'p1', 3300)).toThrow(/Already bid this round/);
    }
  });

  it('records pass as the one auction action for the round', () => {
    const match = makeMatch();
    match.currentRound!.auctionMode = 'sealed';
    setRoundPhase(match, 'auction', 10000, 3000);

    passAuction(match, 'p1', 3100);
    submitBid(match, 'p2', 0, 3150);

    expect(match.currentRound!.bids.filter((bid) => bid.playerId === 'p1')).toHaveLength(1);
    expect(match.currentRound!.bids.find((bid) => bid.playerId === 'p1')?.amount).toBe(0);
    expect(match.players.find((player) => player.id === 'p1')?.hasSubmittedBid).toBe(true);
    expect(match.players.find((player) => player.id === 'p2')?.passed).toBe(true);
    expect(match.currentRound!.bids.find((bid) => bid.playerId === 'p2')?.amount).toBe(0);
    expect(() => passAuction(match, 'p1', 3200)).toThrow(/Already bid this round/);
  });

  it('archives opening public clues, skill feed, bids and settlement details for admin replay', () => {
    const match = makeMatch();
    match.roundIndex = 4;
    match.totalRounds = 5;
    match.currentRound!.index = 4;
    match.currentRound!.isFinalAuction = true;
    setRoundPhase(match, 'auction', 30000, 3200);

    submitBid(match, 'p1', 42000, 3300);
    submitBid(match, 'p2', 44000, 3400);
    settleCurrentRound(match, 4000);
    finishRound(match, 5000);

    const history = match.roundHistory[0]!;
    expect(history.publicClues.length).toBeGreaterThan(0);
    expect(history.publicClues[0]?.source).toBe('public');
    expect(history.skillFeed?.some((entry) => entry.visibility === 'public')).toBe(true);
    expect(history.skillFeed?.some((entry) => entry.playerId === 'p1' && entry.visibility === 'private')).toBe(true);
    expect(history.privateCluesByPlayerId.p1?.some((clue) => clue.source === 'skill')).toBe(true);
    expect(history.bids.map((bid) => bid.amount)).toEqual([42000, 44000]);
    expect(history.settlement.participants).toHaveLength(4);
  });

  it('rejects manual hero skills because BidKing hero skills are automatic', () => {
    const match = makeMatch();
    setRoundPhase(match, 'intel', 15000, 3000);
    const before = match.players[0]!.privateClues.length;

    expect(() => useSkill(match, 'p1', undefined, 3500)).toThrow(/automatic/);

    expect(match.players[0]!.privateClues.length).toBe(before);
    expect(match.players[0]!.skillCooldown).toBe(0);
    expect(match.players[0]!.skillUsesRemaining).toBe(
      gameConfig.roles.find((role) => role.id === match.players[0]!.roleId)?.usesPerMatch
    );
    expect(match.players[0]!.skillUsedThisRound).toBe(false);
  });

  it('uses automatic round-start skill clues to mark private warehouse knowledge', () => {
    const match = makeMatch();

    const intelRound = buildSnapshot(match, 'p1').public.currentRound;
    expect(intelRound?.skillFeed?.some((entry) => entry.playerId === 'p1' && entry.visibility === 'private')).toBe(true);
    expect(intelRound?.warehouseSlots?.some((slot) => slot.markedBySkill)).toBe(false);

    setRoundPhase(match, 'auction', 30000, 3000);
    expect(buildSnapshot(match, 'p1').public.currentRound?.warehouseSlots?.some((slot) => slot.markedBySkill)).toBe(true);
  });

  it('lets bots decide from visible and private clue estimates', () => {
    const match = makeMatch();
    setRoundPhase(match, 'auction', 30000, 3000);
    const action = chooseBotAction(match, 'b1', 'clue_reader');

    expect(['bid', 'pass', 'battle_item', 'emote']).toContain(action.type);
    expect(action.audit).toEqual(expect.objectContaining({
      profileId: 'clue_reader',
      phase: 'auction',
      auctionMode: match.currentRound!.auctionMode,
      behaviorTree: expect.arrayContaining(['BidKingBotRoot']),
      riskAppetite: expect.any(Number),
      bluffChance: expect.any(Number),
      estimate: expect.any(Number),
      maxBid: expect.any(Number),
      confidence: expect.any(Number),
      targetBid: expect.any(Number),
      trueValue: expect.any(Number),
      targetBidRatio: expect.any(Number),
      maxBidRatio: expect.any(Number),
      nextOpenBid: expect.any(Number)
    }));
    if (action.type === 'bid') {
      expect(action.amount).toBeGreaterThan(0);
      expect(action.amount).toBeLessThanOrEqual(match.players.find((player) => player.id === 'b1')!.cash);
    }
  });

  it('does not let open-auction bots submit twice', () => {
    const match = makeMatch();
    match.currentRound!.auctionMode = 'open';
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'b1', 24000, 3100);
    const action = chooseBotAction(match, 'b1', 'aggressive');

    expect(action.type).not.toBe('bid');
    expect(action.audit?.behaviorTree).toContain('BidKingBotRoot');
    expect(action.reason).toMatch(/submitted|idle/i);
  });

  it('keeps sealed bot decisions independent from hidden opponent bid amounts', () => {
    const baseline = makeCoreMatch();
    setRoundPhase(baseline, 'auction', 30000, 3000);
    const baselineBot = baseline.players.find((player) => player.id === 'b1')!;
    baselineBot.skillCooldown = 1;
    baselineBot.skillUsesRemaining = 0;
    const baselineAction = chooseBotAction(baseline, 'b1', 'clue_reader');
    expect(baselineAction.audit).toEqual(expect.objectContaining({
      publicEstimateHidden: true,
      publicEstimateSource: 'protocol_inferred_hidden_range',
      protocolInferredEstimate: true
    }));

    const withHiddenBids = makeCoreMatch();
    setRoundPhase(withHiddenBids, 'auction', 30000, 3000);
    const hiddenBot = withHiddenBids.players.find((player) => player.id === 'b1')!;
    hiddenBot.skillCooldown = 1;
    hiddenBot.skillUsesRemaining = 0;
    withHiddenBids.currentRound!.bids.push(
      { playerId: 'p1', amount: 999_000, createdAt: 3100, visible: false },
      { playerId: 'p2', amount: 1_000, createdAt: 3200, visible: false }
    );

    const hiddenAction = chooseBotAction(withHiddenBids, 'b1', 'clue_reader');

    expect({
      type: hiddenAction.type,
      amount: hiddenAction.amount,
      targetBid: hiddenAction.audit?.targetBid,
      maxBid: hiddenAction.audit?.maxBid
    }).toEqual({
      type: baselineAction.type,
      amount: baselineAction.amount,
      targetBid: baselineAction.audit?.targetBid,
      maxBid: baselineAction.audit?.maxBid
    });
  });

  it('keeps core sealed bots competitive enough to resist cheap second-round closes', () => {
    const match = makeCoreMatch();
    const round = match.currentRound!;
    match.roundIndex = 1;
    round.index = 1;
    round.container.publicInfo.estimateMin = 650_000;
    round.container.publicInfo.estimateMax = 720_000;
    round.container.publicInfo.risk = 'low';
    round.container.minimumBid = 60_000;
    round.warehouseSlots = [];
    setRoundPhase(match, 'auction', 30000, 3000);

    const bot = match.players.find((player) => player.id === 'b1')!;
    bot.skillCooldown = 1;
    bot.skillUsesRemaining = 0;

    const action = chooseBotAction(match, 'b1', 'mentor');

    expect(action.type).toBe('bid');
    expect(action.amount ?? 0).toBeGreaterThanOrEqual(380_000);
    expect(action.audit).toEqual(expect.objectContaining({
      rankAiRoundCount: 2,
      trueValue: expect.any(Number),
      actionBidRatio: expect.any(Number),
      projectedProfitAtAction: expect.any(Number)
    }));
  });

  it('keeps visible slot estimates from multiplying one high-value slot across the warehouse', () => {
    const match = makeCoreMatch();
    const round = match.currentRound!;
    round.auctionMode = 'open';
    round.container.publicInfo.estimateMin = 580_000;
    round.container.publicInfo.estimateMax = 640_000;
    round.container.publicInfo.risk = 'low';
    round.container.minimumBid = 200_000;
    round.container.publicClues = [];
    round.container.privateCluesByPlayerId = {};
    round.warehouseSlots = [
      {
        slotId: 'slot_1',
        itemId: 'item_1',
        x: 0,
        y: 0,
        w: 2,
        h: 2,
        visibleShape: true,
        visibleRarity: 'legendary',
        visibleValueRange: { min: 600_000, max: 650_000 }
      },
      { slotId: 'slot_2', x: 2, y: 0, w: 1, h: 1, visibleShape: true },
      { slotId: 'slot_3', x: 3, y: 0, w: 1, h: 1, visibleShape: false },
      { slotId: 'slot_4', x: 4, y: 0, w: 1, h: 1, visibleShape: false }
    ];
    setRoundPhase(match, 'auction', 30000, 3000);

    const bot = match.players.find((player) => player.id === 'b1')!;
    bot.privateClues = [];
    bot.skillCooldown = 99;
    bot.skillUsesRemaining = 0;
    bot.battleItemCooldowns = {};
    for (const item of BattleItem) {
      bot.battleItemCooldowns[String(item.id)] = 99;
    }

    const action = chooseBotAction(match, 'b1', 'aggressive');

    expect(action.type).toBe('bid');
    expect(action.audit?.slotEstimate).toBeLessThanOrEqual(760_000);
    expect(action.audit?.estimate).toBeLessThanOrEqual(700_000);
    expect(action.amount ?? 0).toBeLessThanOrEqual(700_000);
  });

  it('uses RankAi min and pk pools to chase final-round core bids', () => {
    const match = createMatch({
      id: 'rank-ai-pk-pool',
      seed: 51515,
      players: [
        { id: 'p1', name: '甲', kind: 'human', roleId: gameConfig.roles[0]!.id, heroCid: 101 },
        { id: 'p2', name: '乙', kind: 'human', roleId: gameConfig.roles[1]!.id, heroCid: 102 },
        { id: 'b1', name: '丙', kind: 'bot', roleId: gameConfig.roles[2]!.id, heroCid: 103 },
        { id: 'b2', name: '丁', kind: 'bot', roleId: gameConfig.roles[3]!.id, heroCid: 104 }
      ],
      totalRounds: 5,
      coreMode: true,
      coreAuctionMode: 'sealed',
      coreBidMapId: 2401,
      config: gameConfig,
      now: 1000
    });
    startNextRound(match, 2000);
    const round = match.currentRound!;
    match.roundIndex = 4;
    round.index = 4;
    round.container.publicInfo.estimateMin = 900_000;
    round.container.publicInfo.estimateMax = 1_100_000;
    round.container.publicInfo.risk = 'medium';
    round.container.minimumBid = 100_000;
    round.container.publicClues = [];
    round.warehouseSlots = [];
    for (const player of match.players) {
      player.cash = 2_000_000;
      player.privateClues = [];
      player.skillCooldown = 99;
      player.skillUsesRemaining = 0;
      for (const item of BattleItem) {
        player.battleItemCooldowns[String(item.id)] = 99;
      }
    }
    setRoundPhase(match, 'auction', 30000, 3000);

    const action = chooseBotAction(match, 'b1', 'risk_taker');

    expect(action.type).toBe('bid');
    expect(action.amount ?? 0).toBeGreaterThanOrEqual(1_050_000);
    expect(action.amount ?? 0).toBeLessThanOrEqual(2_000_000);
    expect(action.audit).toEqual(expect.objectContaining({
      profileId: 'risk_taker',
      rankAiRoleId: 103,
      rankAiRoundCount: 5,
      rankAiMinBidRatio: expect.any(Number),
      rankAiPkRatio: expect.any(Number),
      rankAiBidTimeSeconds: expect.any(Number),
      rankAiTargetRatio: expect.any(Number)
    }));
    expect(action.audit?.rankAiPkRatio ?? 0).toBeGreaterThan(action.audit?.rankAiMinBidRatio ?? 0);
    expect(action.audit?.rankAiTargetRatio ?? 0).toBeGreaterThan((action.audit?.rankAiMinBidRatio ?? 0) / 1000);
  });

  it('lets core open bots submit target-sized bids instead of minimum increments', () => {
    const match = createMatch({
      id: 'core_open_match',
      seed: 24680,
      players: [
        { id: 'p1', name: '甲', kind: 'human', roleId: gameConfig.roles[0]!.id },
        { id: 'p2', name: '乙', kind: 'human', roleId: gameConfig.roles[1]!.id },
        { id: 'b1', name: '丙', kind: 'bot', roleId: gameConfig.roles[2]!.id },
        { id: 'b2', name: '丁', kind: 'bot', roleId: gameConfig.roles[3]!.id }
      ],
      totalRounds: 5,
      coreMode: true,
      coreAuctionMode: 'open',
      coreBidMapId: 2601,
      config: gameConfig,
      now: 1000
    });
    match.players.forEach((player) => {
      player.cash = 10_000_000;
    });
    startNextRound(match, 2000);
    const round = match.currentRound!;
    round.auctionMode = 'open';
    round.container.publicInfo.estimateMin = 900_000;
    round.container.publicInfo.estimateMax = 1_000_000;
    round.container.publicInfo.risk = 'high';
    round.container.minimumBid = 267_000;
    round.warehouseSlots = [];
    round.container.publicClues = [];
    setRoundPhase(match, 'auction', 30000, 3000);

    const bot = match.players.find((player) => player.id === 'b1')!;
    bot.skillCooldown = 1;
    bot.skillUsesRemaining = 0;
    for (const item of BattleItem) {
      bot.battleItemCooldowns[String(item.id)] = 1;
    }
    const action = chooseBotAction(match, 'b1', 'aggressive');

    expect(action.type).toBe('bid');
    expect(action.audit?.nextOpenBid).toBe(267_000);
    expect(action.audit?.targetBid).toBeGreaterThan(390_000);
    expect(action.amount ?? 0).toBeGreaterThanOrEqual(action.audit?.targetBid ?? 0);
    expect(action.amount ?? 0).toBeGreaterThan(action.audit?.nextOpenBid ?? 0);
  });

  it('does not make core open bots rebid after their one-shot quote', () => {
    const match = makeCoreMatch();
    const round = match.currentRound!;
    round.auctionMode = 'open';
    round.container.minimumBid = 100_000;
    setRoundPhase(match, 'auction', 30000, 3000);
    submitBid(match, 'b1', 220_000, 3100);
    submitBid(match, 'b2', 260_000, 3200);

    const action = chooseBotAction(match, 'b1', 'aggressive');

    expect(action.type).toBe('emote');
    expect(action.reason).toMatch(/already submitted open-auction bid/i);
  });

  it('reveals items only during reveal phase', () => {
    const match = makeMatch();
    setRoundPhase(match, 'auction', 30000, 3000);
    submitBid(match, 'p1', 40000, 3100);
    settleCurrentRound(match, 4000);
    revealNextItem(match, 4500);

    expect(match.currentRound!.revealedItems).toHaveLength(1);
    expect(buildSnapshot(match, 'p1').public.currentRound?.revealedItems).toHaveLength(1);
  });

  it('starts final settlement with footprints only and reveals by warehouse position', () => {
    const match = makeCoreMatch();
    const round = match.currentRound!;
    const highItem = {
      ...round.container.hiddenItems[0]!,
      id: 'test_high_item',
      name: '高品测试件',
      rarity: 'legendary' as const,
      value: 100_000,
      displayValue: 100_000
    };
    const lowItem = {
      ...round.container.hiddenItems[1]!,
      id: 'test_low_item',
      name: '低品测试件',
      rarity: 'junk' as const,
      value: 1000,
      displayValue: 1000
    };
    round.container.hiddenItems = [highItem, lowItem];
    round.container.warehouseSlots = [
      { slotId: 'slot_high', item: highItem, x: 0, y: 0, w: 2, h: 2 },
      { slotId: 'slot_low', item: lowItem, x: 3, y: 0, w: 1, h: 1 }
    ];
    round.warehouseSlots = [
      { slotId: 'slot_high', x: 0, y: 0, w: 1, h: 1, visibleShape: false },
      { slotId: 'slot_low', x: 3, y: 0, w: 1, h: 1, visibleShape: false }
    ];
    match.roundIndex = 4;
    match.totalRounds = 5;
    round.index = 4;
    round.isFinalAuction = true;
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'p1', 40000, 3100);
    settleCurrentRound(match, 4000);

    const silhouetteRound = buildSnapshot(match, 'p1').public.currentRound!;
    expect(silhouetteRound.warehouseSlots).toEqual([
      expect.objectContaining({
        slotId: 'slot_high',
        x: 0,
        y: 0,
        w: 2,
        h: 2,
        visibleShape: true,
        visibleRarity: undefined,
        itemName: undefined,
        iconKey: undefined
      }),
      expect.objectContaining({
        slotId: 'slot_low',
        x: 3,
        y: 0,
        w: 1,
        h: 1,
        visibleShape: true,
        visibleRarity: undefined,
        itemName: undefined,
        iconKey: undefined
      })
    ]);

    revealNextItem(match, 4500);

    expect(match.currentRound!.revealedItems[0]?.id).toBe(highItem.id);
  });

  it('builds a final summary with curve, rewards and revealed codex items', () => {
    const match = makeMatch();
    match.totalRounds = 1;
    setRoundPhase(match, 'auction', 30000, 3000);
    submitBid(match, 'p1', 40000, 3100);
    settleCurrentRound(match, 4000);
    finishRound(match, 5000);
    startNextRound(match, 6000);

    const summary = buildSnapshot(match, 'p1').public.finalSummary;
    expect(match.status).toBe('ended');
    expect(summary?.rankings).toHaveLength(4);
    expect(summary?.netWorthCurve.length).toBe(2);
    expect(summary?.revealedItems.length).toBeGreaterThan(0);
    expect(summary?.awardedItemsByPlayerId?.p1?.length).toBe(summary?.revealedItems.length);
    expect(summary?.rewards.find((reward) => reward.playerId === 'p1')?.xp).toBeGreaterThan(0);
    expect(summary?.rewards.find((reward) => reward.playerId === 'p1')?.coins).toBe(
      summary?.auctionStats?.find((stats) => stats.playerId === 'p1')?.netProfit
    );
  });
});
