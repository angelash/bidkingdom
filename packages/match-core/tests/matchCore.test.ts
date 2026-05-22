import { gameConfig } from '@bitkingdom/config';
import { BattleItem } from '@bitkingdom/bidking-compat';
import { describe, expect, it } from 'vitest';
import { finishRound, passAuction, revealNextItem, settleCurrentRound, submitBid } from '../src/auction';
import { chooseBotAction } from '../src/bots';
import { createMatch, buildSnapshot, setRoundPhase, startNextRound } from '../src/match';
import { useSkill } from '../src/skills';

function makeMatch() {
  const roles = gameConfig.roles;
  const match = createMatch({
    id: 'test_match',
    seed: 12345,
    players: [
      { id: 'p1', name: '甲', kind: 'human', roleId: roles[0]!.id },
      { id: 'p2', name: '乙', kind: 'human', roleId: roles[1]!.id },
      { id: 'b1', name: '丙', kind: 'bot', roleId: roles[2]!.id },
      { id: 'b2', name: '丁', kind: 'bot', roleId: roles[3]!.id }
    ],
    config: gameConfig,
    now: 1000
  });
  startNextRound(match, 2000);
  return match;
}

function makeCoreMatch() {
  const roles = gameConfig.roles;
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
    config: gameConfig,
    now: 1000
  });
  for (const player of match.players) {
    player.cash = 1_000_000;
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

  it('settles second price auction with second bid plus increment', () => {
    const match = makeMatch();
    match.currentRound!.auctionMode = 'second_price';
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'p1', 80000, 3100);
    submitBid(match, 'p2', 56000, 3200);
    passAuction(match, 'b1', 3300);
    submitBid(match, 'b2', 41000, 3400);
    settleCurrentRound(match, 4000);

    expect(match.currentRound!.settlement?.winnerId).toBe('p1');
    expect(match.currentRound!.settlement?.payment).toBe(57000);
    expect(match.transactions.some((tx) => tx.reason === 'auction_payment')).toBe(true);
  });

  it('runs core mode as one warehouse across five progressive bid rounds', () => {
    const match = makeCoreMatch();
    const warehouseId = match.currentRound!.container.id;
    const hiddenItemCount = match.currentRound!.container.hiddenItems.length;

    expect(match.currentRound!.phase).toBe('warehouse_roll');
    expect(match.currentRound!.openingCandidates?.length).toBeGreaterThan(3);
    expect(match.currentRound!.auctioneerClue?.text).toContain('掌眼人情报');
    expect(buildSnapshot(match, 'p1').public.currentRound?.publicClues.some((clue) => clue.id === match.currentRound!.auctioneerClue?.id)).toBe(false);
    setRoundPhase(match, 'auctioneer_reveal', 3000, 2500);
    expect(buildSnapshot(match, 'p1').public.currentRound?.publicClues.some((clue) => clue.id === match.currentRound!.auctioneerClue?.id)).toBe(true);

    for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
      expect(match.currentRound!.container.id).toBe(warehouseId);
      expect(match.currentRound!.auctionMode).toBe('sealed');
      expect(match.currentRound!.isFinalAuction).toBe(roundIndex === 4);
      expect(match.currentRound!.warehouseSlots.length).toBe(hiddenItemCount);

      setRoundPhase(match, 'auction', 30000, 3000 + roundIndex * 1000);
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

  it('charges and refunds deposits in deposit open auction', () => {
    const match = makeMatch();
    match.currentRound!.auctionMode = 'deposit_open';
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'p1', 30000, 3100);
    submitBid(match, 'p2', 36000, 3200);
    passAuction(match, 'p1', 3300);
    settleCurrentRound(match, 4000);

    expect(match.currentRound!.settlement?.winnerId).toBe('p2');
    expect(match.currentRound!.settlement?.depositCost).toBe(gameConfig.rules.depositValue);
    expect(match.currentRound!.settlement?.participants.find((entry) => entry.playerId === 'p1')?.profit).toBe(-1000);
    expect(match.currentRound!.settlement?.participants.find((entry) => entry.playerId === 'p2')?.depositPaid).toBe(gameConfig.rules.depositValue);
    expect(match.transactions.some((tx) => tx.playerId === 'p1' && tx.reason === 'auction_deposit_refund')).toBe(true);
  });

  it('rejects deposit open bids above cash available after deposit', () => {
    const match = makeMatch();
    const player = match.players.find((candidate) => candidate.id === 'p1')!;
    player.cash = 31000;
    match.currentRound!.auctionMode = 'deposit_open';
    setRoundPhase(match, 'auction', 30000, 3000);

    expect(() => submitBid(match, 'p1', 40000, 3100)).toThrow(/可用现金/);
    expect(match.currentRound!.bids).toHaveLength(0);
    expect(player.cash).toBe(31000);
  });

  it('accepts deposit open bids within cash available after deposit', () => {
    const match = makeMatch();
    const player = match.players.find((candidate) => candidate.id === 'p1')!;
    player.cash = 31000;
    match.currentRound!.auctionMode = 'deposit_open';
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'p1', 29000, 3100);
    expect(match.currentRound!.currentBid).toBe(29000);
    settleCurrentRound(match, 4000);
    expect(player.cash).toBe(0);
  });

  it('deducts repair costs from cash so settlement profit matches net worth movement', () => {
    const match = makeMatch();
    const repairItem = gameConfig.items.find((item) => item.id === 'sample_r4_cracked_jade')!;
    match.currentRound!.container.hiddenItems = [repairItem];
    match.currentRound!.auctionMode = 'open';
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'p1', 30000, 3100);
    settleCurrentRound(match, 4000);

    const player = match.players.find((candidate) => candidate.id === 'p1')!;
    expect(match.currentRound!.settlement?.repairCost).toBe(20000);
    expect(match.currentRound!.settlement?.profit).toBe(-5000);
    expect(player.cash).toBe(50000);
    expect(match.transactions.some((tx) => tx.playerId === 'p1' && tx.reason === 'repair_cost_paid')).toBe(true);
  });

  it('applies BidKing loss rebate when the final deal loses more than the configured threshold', () => {
    const match = makeMatch();
    const lowValueItem = gameConfig.items.find((item) => item.value <= 5000 && item.repairCost === 0)!;
    match.currentRound!.container.hiddenItems = [lowValueItem];
    match.currentRound!.auctionMode = 'open';
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'p1', 50000, 3100);
    settleCurrentRound(match, 4000);

    const rawProfit = lowValueItem.value - 50000;
    const expectedRebate = Math.floor(Math.abs(rawProfit) * 0.1);
    expect(match.currentRound!.settlement?.lossRebateRefund).toBe(expectedRebate);
    expect(match.currentRound!.settlement?.profit).toBe(rawProfit + expectedRebate);
    expect(match.transactions.some((tx) => tx.reason === 'bid_loss_rebate' && tx.amountChange === expectedRebate)).toBe(true);
  });

  it('prevents modifying flash bids', () => {
    const match = makeMatch();
    match.currentRound!.auctionMode = 'flash';
    setRoundPhase(match, 'auction', 10000, 3000);

    submitBid(match, 'p1', 30000, 3100);

    expect(() => submitBid(match, 'p1', 32000, 3200)).toThrow(/Flash/);
  });

  it('keeps hidden pass records idempotent', () => {
    const match = makeMatch();
    match.currentRound!.auctionMode = 'sealed';
    setRoundPhase(match, 'auction', 10000, 3000);

    passAuction(match, 'p1', 3100);
    passAuction(match, 'p1', 3200);

    expect(match.currentRound!.bids.filter((bid) => bid.playerId === 'p1')).toHaveLength(1);
    expect(match.currentRound!.bids.find((bid) => bid.playerId === 'p1')?.amount).toBe(0);
  });

  it('archives clues, bids and settlement details for admin replay', () => {
    const match = makeMatch();
    setRoundPhase(match, 'intel', 15000, 3000);
    useSkill(match, 'p1', undefined, 3100);
    setRoundPhase(match, 'auction', 30000, 3200);

    submitBid(match, 'p1', 42000, 3300);
    submitBid(match, 'p2', 44000, 3400);
    settleCurrentRound(match, 4000);
    finishRound(match, 5000);

    const history = match.roundHistory[0]!;
    expect(history.publicClues.length).toBeGreaterThan(0);
    expect(history.privateCluesByPlayerId.p1?.some((clue) => clue.source === 'skill')).toBe(true);
    expect(history.bids.map((bid) => bid.amount)).toEqual([42000, 44000]);
    expect(history.settlement.participants).toHaveLength(4);
  });

  it('adds skill clues and keeps cooldown state', () => {
    const match = makeMatch();
    setRoundPhase(match, 'intel', 15000, 3000);
    const before = match.players[0]!.privateClues.length;

    useSkill(match, 'p1', undefined, 3500);

    expect(match.players[0]!.privateClues.length).toBe(before + 1);
    expect(match.players[0]!.skillCooldown).toBe(gameConfig.roles[0]!.cooldownRounds);
    expect(match.players[0]!.skillUsesRemaining).toBe(gameConfig.roles[0]!.usesPerMatch - 1);
    expect(match.players[0]!.skillUsedThisRound).toBe(true);
  });

  it('uses manual skill clues to mark private warehouse knowledge', () => {
    const match = makeMatch();
    setRoundPhase(match, 'intel', 15000, 3000);

    useSkill(match, 'p2', undefined, 3500);

    expect(buildSnapshot(match, 'p2').public.currentRound?.warehouseSlots?.some((slot) => slot.markedBySkill)).toBe(true);
  });

  it('lets bots decide from visible and private clue estimates', () => {
    const match = makeMatch();
    setRoundPhase(match, 'auction', 30000, 3000);
    const action = chooseBotAction(match, 'b1', 'clue_reader');

    expect(['bid', 'pass', 'skill', 'emote']).toContain(action.type);
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

  it('does not let an open-auction leader bid against itself', () => {
    const match = makeMatch();
    match.currentRound!.auctionMode = 'open';
    setRoundPhase(match, 'auction', 30000, 3000);

    submitBid(match, 'b1', 24000, 3100);
    const action = chooseBotAction(match, 'b1', 'aggressive');

    expect(action.type).not.toBe('bid');
    expect(action.audit?.behaviorTree).toContain('BidKingBotRoot');
    expect(action.reason).toMatch(/lead|submitted|skill|idle/i);
  });

  it('keeps sealed bot decisions independent from hidden opponent bid amounts', () => {
    const baseline = makeCoreMatch();
    setRoundPhase(baseline, 'auction', 30000, 3000);
    const baselineBot = baseline.players.find((player) => player.id === 'b1')!;
    baselineBot.skillCooldown = 1;
    baselineBot.skillUsesRemaining = 0;
    const baselineAction = chooseBotAction(baseline, 'b1', 'clue_reader');

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
      config: gameConfig,
      now: 1000
    });
    match.players.forEach((player) => {
      player.cash = 1_000_000;
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
    submitBid(match, 'p1', 300_000, 3100);

    const bot = match.players.find((player) => player.id === 'b1')!;
    bot.skillCooldown = 1;
    bot.skillUsesRemaining = 0;
    for (const item of BattleItem) {
      bot.battleItemCooldowns[String(item.id)] = 1;
    }
    const action = chooseBotAction(match, 'b1', 'aggressive');

    expect(action.type).toBe('bid');
    expect(action.audit?.nextOpenBid).toBe(301_000);
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
    expect(action.reason).toMatch(/already submitted core open-auction bid/i);
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
    expect(summary?.rewards.find((reward) => reward.playerId === 'p1')?.coins).toBe(0);
  });
});
