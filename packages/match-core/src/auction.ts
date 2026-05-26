import type { BidRecord, RevealedItem, RoundBidDecision, RoundBidFeedback, RoundSettlement } from '@bitkingdom/shared';
import { getBidKingCloseThreshold } from '@bitkingdom/bidking-compat';
import { reviewClues } from './clues';
import { recordRoundHistory, setRoundPhase, pushEvent, requirePlayer, requireRound } from './match';
import { calculateSetBonus, sumItemValue } from './scoring';
import type { MatchRuntimeState, RuntimePlayer } from './types';

export function submitBid(
  state: MatchRuntimeState,
  playerId: string,
  amount: number,
  now = Date.now()
): MatchRuntimeState {
  const round = requireRound(state);
  const player = requirePlayer(state, playerId);

  if (round.phase !== 'auction') {
    throw new Error('Bids are only allowed during auction phase');
  }
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Bid amount must be a non-negative number');
  }

  if (round.bids.some((bid) => bid.playerId === playerId)) {
    throw new Error('Already bid this round');
  }

  const requestedAmount = Math.round(amount);
  const availableCash = availableCashForBid(state, player);
  if (requestedAmount > availableCash) {
    throw new Error('出价超过当前可用现金');
  }
  const normalizedAmount = requestedAmount;
  if (normalizedAmount === 0) {
    return passAuction(state, playerId, now);
  }
  if (state.coreMode && round.index > 4 && normalizedAmount > 0) {
    const previousAmount = previousCoreBidAmount(state, playerId);
    if (previousAmount > 0 && normalizedAmount <= previousAmount) {
      throw new Error('BidKing extra-round bids must exceed the previous round bid');
    }
  }

  const isOpenRound = round.auctionMode === 'open';

  if (isOpenRound) {
    player.passed = false;
    player.hasSubmittedBid = true;
    round.bids.push({
      playerId,
      amount: normalizedAmount,
      createdAt: now,
      visible: false
    });
  } else {
    upsertHiddenBid(round.bids, playerId, normalizedAmount, now);
    player.hasSubmittedBid = true;
  }

  state.updatedAt = now;
  pushEvent(state, 'bid_submitted', playerId, {
    roundId: round.id,
    amount: undefined,
    mode: round.auctionMode
  });
  return state;
}

export function passAuction(state: MatchRuntimeState, playerId: string, now = Date.now()): MatchRuntimeState {
  const round = requireRound(state);
  const player = requirePlayer(state, playerId);
  if (round.phase !== 'auction') {
    throw new Error('Pass is only allowed during auction phase');
  }
  if (round.bids.some((bid) => bid.playerId === playerId)) {
    throw new Error('Already bid this round');
  }
  player.passed = true;
  player.hasSubmittedBid = true;
  upsertHiddenBid(round.bids, playerId, 0, now);
  state.updatedAt = now;
  pushEvent(state, 'auction_passed', playerId, { roundId: round.id });
  return state;
}

export function settleCurrentRound(state: MatchRuntimeState, now = Date.now()): MatchRuntimeState {
  const round = requireRound(state);
  if (round.phase !== 'auction') {
    throw new Error('Can only settle during auction phase');
  }

  const sortedBids = [...round.bids]
    .filter((bid) => bid.amount > 0)
    .sort((left, right) => right.amount - left.amount || left.createdAt - right.createdAt);
  const winningBid = sortedBids[0];
  const coreDecision = state.coreMode ? evaluateCoreCloseRule(round.index, sortedBids) : undefined;
  const bidFeedback = buildBidFeedback(round.auctionMode, round.index, sortedBids, coreDecision);
  round.bidFeedback = bidFeedback;
  round.currentLeaderId = bidFeedback.leaderPlayerId;

  if (coreDecision?.extraRound) {
    state.totalRounds = Math.max(state.totalRounds, round.index + 2);
  }

  const isCoreLastScheduledRound = state.coreMode && round.index >= state.totalRounds - 1;
  const shouldSettleFinal = state.coreMode
    ? Boolean(coreDecision?.shouldClose || (isCoreLastScheduledRound && !coreDecision?.extraRound))
    : Boolean(round.isFinalAuction);

  if (!shouldSettleFinal) {
    round.settlement = buildInterimSettlement(round.id, bidFeedback, state.players);
    setRoundPhase(state, 'settlement', 6000, now);
    pushEvent(state, 'round_feedback', bidFeedback.leaderPlayerId, {
      roundId: round.id,
      feedback: bidFeedback,
      decision: bidFeedback.decision
    }, now);
    return state;
  }

  if (state.coreMode) {
    state.totalRounds = round.index + 1;
  }

  const winner = winningBid ? requirePlayer(state, winningBid.playerId) : undefined;
  const payment = winningBid ? calculatePayment(sortedBids) : 0;
  const trueValue = sumItemValue(round.container.hiddenItems);
  const ownedWithWonItems = winner ? [...winner.holdings, ...round.container.hiddenItems] : [];
  const setBonus = winner ? calculateSetBonus(ownedWithWonItems, state.config) - calculateSetBonus(winner.holdings, state.config) : 0;
  const profit = winner ? trueValue + setBonus - payment : 0;

  const participantRows = state.players.map((player) => {
    const isWinner = player.id === winner?.id;
    return {
      player,
      isWinner,
      profit: isWinner ? profit : 0
    };
  });

  if (winner) {
    transact(state, winner, -payment, 'auction_payment', now);
    winner.holdings.push(...round.container.hiddenItems);
  }
  const clueReview = reviewClues(
    [
      ...round.container.publicClues,
      ...(winner ? round.container.privateCluesByPlayerId[winner.id] ?? [] : [])
    ],
    round.container.hiddenItems,
    trueValue
  );

  const settlement: RoundSettlement = {
    roundId: round.id,
    isFinal: true,
    winnerId: winner?.id,
    payment,
    trueValue,
    setBonus,
    profit,
    title: buildSettlementTitle(profit, payment, trueValue),
    participants: participantRows.map((row) => ({
      playerId: row.player.id,
      payment: row.isWinner ? payment : 0,
      trueValue: row.isWinner ? trueValue : 0,
      setBonus: row.isWinner ? setBonus : 0,
      profit: row.profit,
      title: buildParticipantTitle(row.isWinner, row.profit)
    })),
    clueReview,
    bidFeedback
  };

  round.settlement = settlement;
  round.revealedItems = [];
  setRoundPhase(state, 'reveal', 12000, now);
  pushEvent(state, 'round_settled', winner?.id, settlement, now);
  return state;
}

export function revealNextItem(state: MatchRuntimeState, now = Date.now()): MatchRuntimeState {
  const round = requireRound(state);
  if (round.phase !== 'reveal') {
    throw new Error('Items can only be revealed during reveal phase');
  }
  if (round.settlement?.isFinal === false) {
    setRoundPhase(state, 'settlement', 6000, now);
    return state;
  }
  const nextItem = nextFinalRevealItem(round);
  if (!nextItem) {
    setRoundPhase(state, 'settlement', 8000, now);
    return state;
  }
  round.revealedItems.push(nextItem);
  state.updatedAt = now;
  pushEvent(state, 'item_revealed', undefined, { roundId: round.id, item: nextItem }, now);
  return state;
}

const FINAL_REVEAL_RARITY_ORDER: Record<RevealedItem['rarity'], number> = {
  junk: 1,
  common: 2,
  fine: 3,
  rare: 4,
  legendary: 5,
  mythic: 6
};

function nextFinalRevealItem(round: ReturnType<typeof requireRound>): RevealedItem | undefined {
  const revealedIds = new Set(round.revealedItems.map((item) => item.id));
  const slotByItemId = new Map(round.container.warehouseSlots.map((slot) => [slot.item.id, slot]));
  return [...round.container.hiddenItems]
    .sort((left, right) => {
      const leftSlot = slotByItemId.get(left.id);
      const rightSlot = slotByItemId.get(right.id);
      return FINAL_REVEAL_RARITY_ORDER[left.rarity] - FINAL_REVEAL_RARITY_ORDER[right.rarity]
        || (leftSlot?.y ?? 99) - (rightSlot?.y ?? 99)
        || (leftSlot?.x ?? 99) - (rightSlot?.x ?? 99)
        || left.value - right.value
        || left.id.localeCompare(right.id);
    })
    .find((item) => !revealedIds.has(item.id));
}

export function finishRound(state: MatchRuntimeState, now = Date.now()): MatchRuntimeState {
  const round = requireRound(state);
  recordRoundHistory(state);
  round.phase = 'ended';
  round.phaseEndsAt = now;
  state.updatedAt = now;
  pushEvent(state, 'round_finished', undefined, { roundId: round.id }, now);
  return state;
}

function calculatePayment(sortedBids: BidRecord[]): number {
  const winningBid = sortedBids[0];
  if (!winningBid) {
    return 0;
  }
  return winningBid.amount;
}

interface CoreCloseDecision {
  threshold: number;
  leaderAmount: number;
  secondAmount: number;
  marginRatio: number;
  shouldClose: boolean;
  isTie: boolean;
  extraRound: boolean;
}

function evaluateCoreCloseRule(roundIndex: number, sortedBids: BidRecord[]): CoreCloseDecision {
  const leaderAmount = sortedBids[0]?.amount ?? 0;
  const secondAmount = sortedBids[1]?.amount ?? 0;
  const threshold = coreCloseThreshold(roundIndex);
  const isTie = leaderAmount > 0 && leaderAmount === secondAmount;
  const marginRatio = secondAmount > 0
    ? (leaderAmount - secondAmount) / secondAmount
    : leaderAmount > 0
      ? Number.POSITIVE_INFINITY
      : 0;
  return {
    threshold,
    leaderAmount,
    secondAmount,
    marginRatio,
    shouldClose: leaderAmount > 0 && !isTie && marginRatio > threshold,
    isTie,
    extraRound: roundIndex >= 4 && isTie
  };
}

function coreCloseThreshold(roundIndex: number): number {
  return getBidKingCloseThreshold(roundIndex);
}

function previousCoreBidAmount(state: MatchRuntimeState, playerId: string): number {
  for (let index = state.roundHistory.length - 1; index >= 0; index -= 1) {
    const bid = state.roundHistory[index]?.bids.find((entry) => entry.playerId === playerId);
    if (bid) {
      return bid.amount;
    }
  }
  return 0;
}

function buildBidFeedback(
  mode: string,
  roundIndex: number,
  sortedBids: BidRecord[],
  coreDecision?: CoreCloseDecision
): RoundBidFeedback {
  const leader = sortedBids[0];
  const publicRanking = buildRanking(sortedBids);
  const isOpen = mode === 'open';
  if (!leader) {
    return {
      round: roundIndex + 1,
      mode: mode as RoundBidFeedback['mode'],
      closeThreshold: coreDecision?.threshold,
      shouldClose: false,
      decision: coreDecision ? buildBidDecision(roundIndex, coreDecision) : undefined,
      publicRanking,
      message: `第${roundIndex + 1}轮无人给出有效报价，仓库仍处于观望状态。`
    };
  }

  const secondBid = sortedBids[1];
  return {
    round: roundIndex + 1,
    mode: mode as RoundBidFeedback['mode'],
    leaderPlayerId: leader.playerId,
    secondPlayerId: secondBid?.playerId,
    publicPrice: isOpen ? leader.amount : undefined,
    secondPrice: isOpen ? secondBid?.amount ?? 0 : undefined,
    closeThreshold: coreDecision?.threshold,
    leaderMarginRatio: coreDecision?.marginRatio,
    shouldClose: coreDecision?.shouldClose,
    isTie: coreDecision?.isTie,
    extraRound: coreDecision?.extraRound,
    decision: coreDecision ? buildBidDecision(roundIndex, coreDecision) : undefined,
    publicRanking,
    message: buildFeedbackMessage(mode, roundIndex, leader.amount, secondBid?.amount ?? 0, coreDecision)
  };
}

function buildBidDecision(roundIndex: number, coreDecision: CoreCloseDecision): RoundBidDecision {
  const decision = coreDecision.extraRound
    ? 'extra_round'
    : coreDecision.leaderAmount <= 0
      ? 'no_valid_bid'
      : coreDecision.shouldClose
        ? 'close'
        : 'continue';
  const marginPercent = Number.isFinite(coreDecision.marginRatio)
    ? Math.round(coreDecision.marginRatio * 100)
    : undefined;
  return {
    round: roundIndex + 1,
    source: 'BidMap.auction_rounds_rate',
    threshold: coreDecision.threshold,
    thresholdPercent: Math.round(coreDecision.threshold * 100),
    leaderAmount: coreDecision.leaderAmount,
    secondAmount: coreDecision.secondAmount,
    marginRatio: coreDecision.marginRatio,
    marginPercent,
    isTie: coreDecision.isTie,
    decision,
    reason: buildBidDecisionReason(roundIndex, coreDecision, decision, marginPercent)
  };
}

function buildBidDecisionReason(
  roundIndex: number,
  coreDecision: CoreCloseDecision,
  decision: RoundBidDecision['decision'],
  marginPercent: number | undefined
): string {
  if (decision === 'extra_round') {
    return `第${roundIndex + 1}轮最高出价并列，按 BidMap.auction_rounds_rate 进入追加竞拍。`;
  }
  if (decision === 'no_valid_bid') {
    return `第${roundIndex + 1}轮无人有效出价，按 BidMap.auction_rounds_rate 继续流拍观察。`;
  }
  const margin = marginPercent === undefined ? '无限' : `${marginPercent}%`;
  const threshold = `${Math.round(coreDecision.threshold * 100)}%`;
  return decision === 'close'
    ? `第${roundIndex + 1}轮领先差距 ${margin} 超过成交线 ${threshold}，本轮成交。`
    : `第${roundIndex + 1}轮领先差距 ${margin} 未超过成交线 ${threshold}，继续下一轮。`;
}

function buildRanking(sortedBids: BidRecord[]): RoundBidFeedback['publicRanking'] {
  let lastAmount: number | undefined;
  let currentRank = 0;
  return sortedBids.map((bid, index) => {
    if (lastAmount === undefined || bid.amount < lastAmount) {
      currentRank = index + 1;
      lastAmount = bid.amount;
    }
    return {
      playerId: bid.playerId,
      rank: currentRank,
      amount: bid.amount,
      visibleAmount: false
    };
  });
}

function buildFeedbackMessage(
  mode: string,
  roundIndex: number,
  leaderAmount: number,
  secondAmount: number,
  coreDecision?: CoreCloseDecision
): string {
  if (coreDecision?.extraRound) {
    return `第${roundIndex + 1}轮最高出价并列，追加竞拍回合。`;
  }
  const margin = coreDecision?.marginRatio === Number.POSITIVE_INFINITY
    ? '无限'
    : `${Math.round((coreDecision?.marginRatio ?? 0) * 100)}%`;
  const thresholdRatio = Math.round((1 + (coreDecision?.threshold ?? 0)) * 100);
  const thresholdMargin = Math.round((coreDecision?.threshold ?? 0) * 100);
  const threshold = thresholdMargin > 0
    ? `最高价超过第二名 ${thresholdRatio}%，即高出 ${thresholdMargin}%`
    : '最高价高于第二名';
  if (mode === 'open') {
    const secondText = secondAmount > 0 ? `第二名 ${secondAmount.toLocaleString()}，` : '暂无第二名有效出价，';
    return coreDecision?.shouldClose
      ? `第${roundIndex + 1}轮最高价 ${leaderAmount.toLocaleString()}，${secondText}领先 ${margin}，超过成交线：${threshold}。`
      : `第${roundIndex + 1}轮最高价 ${leaderAmount.toLocaleString()}，${secondText}领先 ${margin}，未超过成交线：${threshold}。`;
  }
  return coreDecision?.shouldClose
    ? `第${roundIndex + 1}轮暗拍排名已公布，最高价领先第二名 ${margin}，超过成交线：${threshold}。`
    : `第${roundIndex + 1}轮暗拍排名已公布，最高价领先第二名 ${margin}，未超过成交线：${threshold}。`;
}

function buildInterimSettlement(
  roundId: string,
  bidFeedback: RoundBidFeedback,
  players: RuntimePlayer[]
): RoundSettlement {
  return {
    roundId,
    isFinal: false,
    payment: bidFeedback.publicPrice ?? 0,
    trueValue: 0,
    setBonus: 0,
    profit: 0,
    title: `第${bidFeedback.round}轮出价反馈`,
    participants: players.map((player) => ({
      playerId: player.id,
      payment: 0,
      trueValue: 0,
      setBonus: 0,
      profit: 0,
      title: bidFeedback.leaderPlayerId === player.id ? '本轮暂时领先' : '继续观察'
    })),
    clueReview: [],
    bidFeedback
  };
}

function availableCashForBid(state: MatchRuntimeState, player: RuntimePlayer): number {
  void state;
  return player.cash;
}

function transact(
  state: MatchRuntimeState,
  player: RuntimePlayer,
  amountChange: number,
  reason: string,
  now: number
): void {
  const amountBefore = player.cash;
  player.cash += amountChange;
  state.transactions.push({
    id: `${state.id}_tx_${state.transactions.length + 1}`,
    matchId: state.id,
    roundId: state.currentRound?.id,
    playerId: player.id,
    reason,
    amountBefore,
    amountChange,
    amountAfter: player.cash,
    createdAt: now
  });
}

function upsertHiddenBid(bids: BidRecord[], playerId: string, amount: number, now: number): void {
  const existing = bids.find((bid) => bid.playerId === playerId);
  if (existing) {
    existing.amount = amount;
    existing.createdAt = now;
    return;
  }
  bids.push({
    playerId,
    amount,
    createdAt: now,
    visible: false
  });
}

function buildSettlementTitle(profit: number, payment: number, trueValue: number): string {
  if (payment === 0) {
    return '全员观望';
  }
  if (profit >= trueValue * 0.35) {
    return '极限捡漏';
  }
  if (profit > 0) {
    return '稳健盈利';
  }
  if (profit < -trueValue * 0.35) {
    return '高价接盘';
  }
  return '判断失准';
}

function buildParticipantTitle(isWinner: boolean, profit: number): string {
  if (!isWinner) {
    return '保守观望';
  }
  if (profit > 0) {
    return '成交盈利';
  }
  if (profit < 0) {
    return '成交亏损';
  }
  return '收支持平';
}
