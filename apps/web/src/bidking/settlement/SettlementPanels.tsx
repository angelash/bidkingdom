import { Award, BookOpen, ClipboardList, Crown, Home, RefreshCw, Sparkles, Trophy } from 'lucide-react';
import type {
  FinalMatchSummary,
  MatchEventLog,
  PlayerSnapshot,
  PublicPlayer,
  PlayerProfile,
  TransactionLog
} from '@bitkingdom/shared';

export interface ReplayBundle {
  events: MatchEventLog[];
  transactions: TransactionLog[];
}

export function LootRevealSummary({ round }: { round: NonNullable<PlayerSnapshot['public']['currentRound']> }): JSX.Element {
  const settlement = round.settlement;
  const revealedValue = round.revealedItems.reduce((sum, item) => sum + item.value, 0);
  const revealedRepair = round.revealedItems.reduce((sum, item) => sum + item.repairCost, 0);
  const totalSlots = round.warehouseSlots?.length ?? round.revealedItems.length;
  const allRevealed = Boolean(settlement?.isFinal && totalSlots > 0 && round.revealedItems.length >= totalSlots);
  const payment = settlement?.payment ?? 0;
  const progressiveProfit = settlement?.isFinal
    ? allRevealed
      ? settlement.profit
      : revealedValue - payment - (settlement.depositCost ?? 0) - revealedRepair
    : 0;
  const isFinalReveal = Boolean(settlement?.isFinal);
  const profitClass = progressiveProfit >= 0 ? 'profit' : 'loss';

  return (
    <section className={`loot-reveal-summary ${isFinalReveal ? 'active' : ''}`}>
      <div>
        <span>最终竞拍价格</span>
        <strong>{payment > 0 ? payment.toLocaleString() : '-'}</strong>
      </div>
      <div>
        <span>已开珍物估值</span>
        <strong>{revealedValue.toLocaleString()}</strong>
      </div>
      <div>
        <span>当前盈余</span>
        <strong className={profitClass}>{progressiveProfit >= 0 ? '+' : ''}{progressiveProfit.toLocaleString()}</strong>
      </div>
      <em>{isFinalReveal ? `${round.revealedItems.length}/${Math.max(totalSlots, round.revealedItems.length)} 独立揭露` : '最终成交后启匣'}</em>
    </section>
  );
}

export function RareRevealBanner({ round }: { round: NonNullable<PlayerSnapshot['public']['currentRound']> }): JSX.Element {
  if (round.phase !== 'reveal') {
    return <></>;
  }
  const latest = round.revealedItems.at(-1);
  if (!latest || !['rare', 'legendary', 'fake'].includes(latest.rarity)) {
    return <></>;
  }
  const label = latest.rarity === 'legendary'
    ? '传世出货'
    : latest.rarity === 'rare'
      ? '稀有现世'
      : '风险暴露';
  return (
    <section className={`rare-reveal-banner rarity-${latest.rarity}`}>
      <Sparkles size={18} />
      <div>
        <span>{label}</span>
        <strong>{latest.name}</strong>
      </div>
      <em>{latest.value.toLocaleString()}</em>
    </section>
  );
}

export function RoundFeedbackPanel({ players, snapshot }: { players: PublicPlayer[]; snapshot: PlayerSnapshot }): JSX.Element {
  const feedback = snapshot.public.currentRound?.bidFeedback ?? snapshot.public.currentRound?.settlement?.bidFeedback;
  if (!feedback) {
    return <></>;
  }
  return (
    <section className="feedback-block">
      <div className="section-title small">
        <ClipboardList size={16} />
        <h3>本轮反馈</h3>
      </div>
      <p>{feedback.message}</p>
      {feedback.leaderPlayerId && <span>最高排名：{playerNameById(players, feedback.leaderPlayerId)}</span>}
      {feedback.publicPrice && <span>公开价：{feedback.publicPrice.toLocaleString()}</span>}
      {feedback.secondPrice !== undefined && <span>第二名：{feedback.secondPrice.toLocaleString()}</span>}
      {feedback.closeThreshold !== undefined && (
        <span>
          成交线：{feedback.closeThreshold > 0
            ? `最高价超过第二名 ${Math.round((1 + feedback.closeThreshold) * 100)}%`
            : '最高价高于第二名'}
        </span>
      )}
      <div className="feedback-ranking">
        {feedback.publicRanking.slice(0, 4).map((entry) => {
          const amount = entry.visibleAmount && entry.amount !== undefined ? ` · ${entry.amount.toLocaleString()}` : '';
          return (
            <em key={`${entry.playerId}_${entry.rank}`}>#{entry.rank} {playerNameById(players, entry.playerId)}{amount}</em>
          );
        })}
      </div>
    </section>
  );
}

export function SettlementPanel({
  round,
  settlement,
  players,
  selfPlayerId
}: {
  round?: NonNullable<PlayerSnapshot['public']['currentRound']>;
  settlement: NonNullable<PlayerSnapshot['public']['currentRound']>['settlement'];
  players: PublicPlayer[];
  selfPlayerId?: string;
}): JSX.Element {
  if (!settlement) {
    return <></>;
  }
  if (settlement.isFinal === false) {
    return (
      <section className="settlement-stack interim">
        <SettlementRoundMatrix players={players} activeRound={round?.index} />
        <div className="settlement">
          <strong>{settlement.title}</strong>
          {settlement.bidFeedback?.publicPrice && <span>公开价 {settlement.bidFeedback.publicPrice.toLocaleString()}</span>}
          {settlement.bidFeedback?.extraRound
            ? <span>同价，加赛一轮</span>
            : <span>未达到成交线，下一轮继续揭示同一仓库</span>}
        </div>
      </section>
    );
  }
  const winnerName = settlement.winnerId ? playerNameById(players, settlement.winnerId) : '流拍';
  const profitClass = settlement.profit >= 0 ? 'profit' : 'loss';
  return (
    <section className="settlement-stack">
      <div className="settlement-deal">
        <Crown size={22} />
        <div>
          <span>{round?.phase === 'reveal' ? '拍成后启匣中' : '最终结算'}</span>
          <strong>{winnerName}</strong>
        </div>
        <em>成交 {settlement.payment.toLocaleString()}</em>
        <b className={profitClass}>{settlement.profit >= 0 ? '+' : ''}{settlement.profit.toLocaleString()}</b>
      </div>
      <SettlementRoundMatrix players={players} activeRound={round?.index} />
      <div className="settlement">
        <strong>{settlement.title}</strong>
        <span>成交 {settlement.payment.toLocaleString()}</span>
        {settlement.depositCost > 0 && <span>押金 {settlement.depositCost.toLocaleString()}</span>}
        <span>真值 {settlement.trueValue.toLocaleString()}</span>
        {settlement.repairCost > 0 && <span>修复 {settlement.repairCost.toLocaleString()}</span>}
        {settlement.insuranceRefund > 0 && <span>保险返还 {settlement.insuranceRefund.toLocaleString()}</span>}
        {(settlement.lossRebateRefund ?? 0) > 0 && <span>亏损返利 {settlement.lossRebateRefund!.toLocaleString()}</span>}
        <span className={settlement.profit >= 0 ? 'profit' : 'loss'}>{settlement.profit.toLocaleString()}</span>
      </div>
      <div className="settlement-ledger">
        {settlement.participants.map((entry) => {
          const isWinner = entry.playerId === settlement.winnerId;
          return (
            <div
              className={`ledger-row ${entry.playerId === selfPlayerId ? 'self' : ''} ${isWinner ? 'winner' : ''}`}
              key={entry.playerId}
            >
              <strong>{playerNameById(players, entry.playerId)}</strong>
              <span>{entry.title}</span>
              <span>成交 {entry.payment.toLocaleString()}</span>
              <span>押金 {formatDeposit(entry.depositPaid, entry.depositRefund)}</span>
              <span>修复 {entry.repairCost.toLocaleString()}</span>
              {(entry.lossRebateRefund ?? 0) > 0 && <span>返利 {entry.lossRebateRefund!.toLocaleString()}</span>}
              <em className={entry.profit >= 0 ? 'profit' : 'loss'}>
                {entry.profit >= 0 ? '+' : ''}{entry.profit.toLocaleString()}
              </em>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ClueReviewPanel({ settlement }: { settlement: NonNullable<PlayerSnapshot['public']['currentRound']>['settlement'] }): JSX.Element {
  if (!settlement || settlement.clueReview.length === 0) {
    return <></>;
  }
  return (
    <section className="review-panel">
      <div className="section-title small">
        <ClipboardList size={16} />
        <h3>线索复盘</h3>
      </div>
      {settlement.clueReview.slice(0, 6).map((review) => (
        <div className={`review-row verdict-${review.verdict}`} key={review.clueId}>
          <p>{review.text}</p>
          <span>{review.result}</span>
        </div>
      ))}
    </section>
  );
}

export function ProgressPanel({ snapshot }: { snapshot: PlayerSnapshot }): JSX.Element {
  const round = snapshot.public.currentRound;
  const rareRevealed = round?.revealedItems.some((item) => ['rare', 'legendary'].includes(item.rarity)) ?? false;
  const usedSkill = snapshot.private?.skillUsedThisRound ?? false;
  const hasBid = snapshot.public.players.find((player) => player.id === snapshot.private?.playerId)?.hasSubmittedBid ?? false;
  return (
    <section className="progress-block">
      <div className="section-title small">
        <BookOpen size={16} />
        <h3>临场委托</h3>
      </div>
      <TaskRow done={Boolean(round)} label="进入一轮拍场" />
      <TaskRow done={hasBid || Boolean(round?.bids.some((bid) => bid.playerId === snapshot.private?.playerId))} label="完成一次出价或暗拍" />
      <TaskRow done={usedSkill} label="使用一次掌眼" />
      <TaskRow done={rareRevealed} label="见到稀有或传世藏品" />
    </section>
  );
}

export function TutorialPanel({
  snapshot,
  recommendedBid,
  onDismiss
}: {
  snapshot: PlayerSnapshot;
  recommendedBid?: { safePrice: number; reason: string };
  onDismiss: () => void;
}): JSX.Element {
  const round = snapshot.public.currentRound;
  if (!round) {
    return <></>;
  }
  return (
    <section className="tutorial-panel">
      <div>
        <strong>{tutorialTitle(round)}</strong>
        <p>{tutorialText(round)}</p>
        {recommendedBid && <span>推荐安全价：{recommendedBid.safePrice.toLocaleString()}，{recommendedBid.reason}</span>}
      </div>
      <button onClick={onDismiss}>收起</button>
    </section>
  );
}

export function FinalSummaryPanel({
  snapshot,
  profile,
  replay,
  showReplay,
  onLoadReplay,
  onToggleReplay,
  onReturnHome
}: {
  snapshot: PlayerSnapshot;
  profile: PlayerProfile;
  replay?: ReplayBundle;
  showReplay: boolean;
  onLoadReplay: () => Promise<void>;
  onToggleReplay: () => void;
  onReturnHome: () => void;
}): JSX.Element {
  const summary = snapshot.public.finalSummary;
  const selfId = snapshot.private?.playerId;
  const selfReward = profile.lastRewards?.matchId === snapshot.public.id ? profile.lastRewards : undefined;
  if (!summary) {
    return <></>;
  }
  return (
    <section className="final-dashboard">
      <section className="final-panel">
        <div className="section-title">
          <Trophy size={20} />
          <h2>名士榜结算</h2>
        </div>
        {summary.rankings.map((player) => (
          <div className={`rank-row ${player.playerId === selfId ? 'self' : ''}`} key={player.playerId}>
            <strong>#{player.rank}</strong>
            <span>{player.name}</span>
            <span>{player.netWorth.toLocaleString()}</span>
          </div>
        ))}
        {selfReward && (
          <div className="reward-strip">
            <Award size={18} />
            <span>收藏经验 +{selfReward.xp}</span>
            <span>铜钱 +{selfReward.coins}</span>
            {(selfReward.lossRecovery ?? 0) > 0 && <span>本场返利 +{selfReward.lossRecovery}</span>}
            <span>名望 {selfReward.rankPoints >= 0 ? '+' : ''}{selfReward.rankPoints}</span>
            <span>新珍宝谱 {selfReward.newCodex.length}</span>
            {selfReward.collectionLevelAfter !== undefined && selfReward.collectionLevelBefore !== undefined && (
              <span>掌柜 Lv.{selfReward.collectionLevelBefore} -&gt; Lv.{selfReward.collectionLevelAfter}</span>
            )}
          </div>
        )}
        <div className="final-actions">
          <button className="primary" type="button" onClick={onReturnHome}>
            <Home size={18} />
            返回珍宝局
          </button>
        </div>
      </section>

      <section className="final-panel texture-panel">
        <div className="section-title">
          <BookOpen size={20} />
          <h2>钱库曲线</h2>
        </div>
        <NetWorthChart summary={summary} />
      </section>

      <section className="final-panel texture-panel">
        <div className="section-title">
          <ClipboardList size={20} />
          <h2>掌眼复盘</h2>
        </div>
        <InsightCard insight={summary.bestMove} tone="good" />
        <InsightCard insight={summary.biggestMistake} tone="bad" />
        <div className="replay-actions">
          <button onClick={replay ? onToggleReplay : onLoadReplay}>
            <RefreshCw size={16} />
            {replay ? (showReplay ? '收起回放' : '查看回放') : '加载珍宝局回放'}
          </button>
          <span>事件 {summary.eventCount} · 流水 {summary.transactionCount}</span>
        </div>
        {showReplay && replay && <ReplayPanel replay={replay} />}
      </section>
    </section>
  );
}

function SettlementRoundMatrix({
  players,
  activeRound
}: {
  players: PublicPlayer[];
  activeRound?: number;
}): JSX.Element {
  return (
    <div className="settlement-round-matrix">
      {players.map((player) => (
        <div className="settlement-round-player" key={`${player.id}_settlement_rounds`}>
          <strong>{player.name}</strong>
          <div>
            {Array.from({ length: 5 }, (_, index) => {
              const roundNumber = index + 1;
              const entry = player.bidRanks?.find((candidate) => candidate.round === roundNumber);
              const amountText = entry?.visibleAmount && entry.amount !== undefined ? formatCompactCurrency(entry.amount) : undefined;
              return (
                <span
                  className={`${entry?.rank ? 'ranked' : entry?.submitted ? 'submitted' : ''} ${entry?.usedSkillName ? 'skilled' : ''} ${activeRound === index ? 'current' : ''}`}
                  key={`${player.id}_settlement_round_${roundNumber}`}
                  title={roundActionTitle(entry)}
                >
                  <i>{entry?.rank ? `#${entry.rank}` : roundNumber}</i>
                  {amountText && <small>{amountText}</small>}
                  {entry?.usedSkillName && <b>{skillBadgeText(entry.usedSkillName)}</b>}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function NetWorthChart({ summary }: { summary: FinalMatchSummary }): JSX.Element {
  const maxValue = Math.max(
    1,
    ...summary.netWorthCurve.flatMap((point) => Object.values(point.values))
  );
  return (
    <div className="curve-board">
      {summary.rankings.map((player) => (
        <div className="curve-row" key={player.playerId}>
          <span>{player.name}</span>
          <div className="curve-bars">
            {summary.netWorthCurve.map((point) => (
              <i
                key={`${player.playerId}_${point.label}`}
                style={{ height: `${Math.max(8, Math.round(((point.values[player.playerId] ?? 0) / maxValue) * 100))}%` }}
                title={`${point.label}: ${(point.values[player.playerId] ?? 0).toLocaleString()}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightCard({ insight, tone }: { insight: FinalMatchSummary['bestMove']; tone: 'good' | 'bad' }): JSX.Element {
  return (
    <div className={`insight-card ${tone}`}>
      <strong>{insight.title}</strong>
      <p>{insight.detail}</p>
    </div>
  );
}

function ReplayPanel({ replay }: { replay: ReplayBundle }): JSX.Element {
  return (
    <section className="replay-panel">
      <div>
        <h3>拍场纪事</h3>
        {replay.events.slice(-8).map((event) => (
          <p key={event.id}>{event.type} · {new Date(event.createdAt).toLocaleTimeString()}</p>
        ))}
      </div>
      <div>
        <h3>钱库流水</h3>
        {replay.transactions.slice(-8).map((tx) => (
          <p key={tx.id}>{tx.reason} {tx.amountChange >= 0 ? '+' : ''}{tx.amountChange.toLocaleString()}</p>
        ))}
      </div>
    </section>
  );
}

function TaskRow({ done, label }: { done: boolean; label: string }): JSX.Element {
  return (
    <div className={`task-row ${done ? 'done' : ''}`}>
      <span>{done ? '✓' : '·'}</span>
      <p>{label}</p>
    </div>
  );
}

function playerNameById(players: PublicPlayer[], playerId: string): string {
  return players.find((player) => player.id === playerId)?.name ?? '未知玩家';
}

function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(abs >= 1_000_000_000 ? 1 : 2).replace(/\.0+$/, '')}亿`;
  }
  if (abs >= 10_000) {
    return `${(value / 10_000).toFixed(abs >= 100_000 ? 0 : 1).replace(/\.0$/, '')}万`;
  }
  return value.toLocaleString();
}

function skillBadgeText(skillName: string): string {
  return Array.from(skillName.replace(/[·\s]/g, '')).slice(0, 2).join('');
}

function roundActionTitle(entry?: NonNullable<PublicPlayer['bidRanks']>[number]): string {
  if (!entry) {
    return '未出价';
  }
  const parts = [`第${entry.round}轮`];
  if (entry.rank) {
    parts.push(`排名 #${entry.rank}`);
  }
  if (entry.visibleAmount && entry.amount !== undefined) {
    parts.push(`出价 ${entry.amount.toLocaleString()}`);
  } else if (entry.submitted) {
    parts.push('已提交');
  }
  if (entry.usedSkillName) {
    parts.push(`掌眼 ${entry.usedSkillName}`);
  }
  return parts.join(' · ');
}

function formatDeposit(paid: number, refund: number): string {
  if (paid <= 0) {
    return '0';
  }
  if (refund <= 0) {
    return `-${paid.toLocaleString()}`;
  }
  return `-${paid.toLocaleString()} / +${refund.toLocaleString()}`;
}

function tutorialTitle(round: NonNullable<PlayerSnapshot['public']['currentRound']>): string {
  if (round.settlement?.isFinal === false) {
    return `第${round.index + 1}轮反馈`;
  }
  if (round.phase === 'auction') {
    return `第${round.index + 1}轮出价提示`;
  }
  if ((round.phase === 'settlement' || round.phase === 'reveal') && round.isFinalAuction) {
    return '最终开匣复盘';
  }
  return `第${round.index + 1}轮教学`;
}

function tutorialText(round: NonNullable<PlayerSnapshot['public']['currentRound']>): string {
  const { index: roundIndex, auctionMode: mode, phase } = round;
  if (round.settlement?.isFinal === false) {
    return '本轮只公布出价走势，不揭晓仓内真值。把领先者、价格区间和新增线索合在一起，下一轮继续推断。';
  }
  if (!round.isFinalAuction && (phase === 'settlement' || phase === 'reveal')) {
    return '同一仓库还没有成交，观察这轮反馈后再决定下一轮是压价、跟价还是停手。';
  }
  if (phase === 'auction') {
    if (!round.isFinalAuction) {
      return mode === 'sealed'
        ? '暗拍阶段不会公开具体报价，重点是用自己的线索估出可承受上限。'
        : '明拍阶段会暴露临时领先价，可以用它校准大家对同一仓库的判断。';
    }
    return mode === 'sealed'
      ? '最终暗拍会决定整仓归属，只按自己推断出的净值上限出价，不要被前几轮领先者带偏。'
      : '最终明拍会直接成交，确认真值、占格效率和现金余量后再加价。';
  }
  if (roundIndex === 0) {
    return '先看公共估值和私人线索，目标是理解真实价值与成交价的差距。';
  }
  if (roundIndex === 1) {
    return '这轮信息会逐步收窄。线索里出现低品质、低密度或估值偏低时，超过安全价后就要准备停手。';
  }
  if (mode === 'second_price') {
    return '次高价拍卖不一定支付最高出价，但出高价会暴露意图，也可能被第二名抬高成交价。';
  }
  if (mode === 'deposit_open') {
    return '押金明拍每次入场都有成本，抬价可以诱导对手，但自己也会付出押金代价。';
  }
  if (mode === 'flash') {
    return '闪拍提交后不能修改。最后一轮可以翻盘，但最好先锁定一个自己能承受的价格。';
  }
  return '不是每轮都要赢，放弃并让别人高价接盘也是有效策略。';
}
