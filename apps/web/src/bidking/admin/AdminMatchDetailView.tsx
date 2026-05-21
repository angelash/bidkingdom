import type { ReactElement } from 'react';
import { History, Users } from 'lucide-react';
import { gameConfig } from '@bitkingdom/config';
import type {
  AdminMatchDetail,
  AdminRoundReplay
} from '@bitkingdom/shared';
import {
  auctionModeName,
  clueSourceName,
  eventName,
  eventPayloadText,
  matchStatusName,
  playerNameFromAdmin,
  transactionName
} from './adminFormatters';

export function AdminMatchDetailView({ detail }: { detail: AdminMatchDetail }): ReactElement {
  const summary = detail.summary;
  return (
    <>
      <section className="admin-summary-band">
        <div>
          <span>房间 {summary.roomCode}</span>
          <h2>{summary.winnerName ? `赢家：${summary.winnerName}` : matchStatusName(summary.status)}</h2>
        </div>
        <div className="admin-metric">
          <span>轮次</span>
          <strong>{Math.min(summary.totalRounds, Math.max(0, summary.roundIndex + 1))}/{summary.totalRounds}</strong>
        </div>
        <div className="admin-metric">
          <span>事件</span>
          <strong>{summary.eventCount}</strong>
        </div>
        <div className="admin-metric">
          <span>流水</span>
          <strong>{summary.transactionCount}</strong>
        </div>
      </section>

      <section className="admin-panel-block">
        <div className="section-title small">
          <Users size={16} />
          <h3>玩家结果</h3>
        </div>
        <div className="admin-player-table">
          {summary.players
            .slice()
            .sort((left, right) => right.netWorth - left.netWorth)
            .map((player, index) => {
              const role = gameConfig.roles.find((candidate) => candidate.id === player.roleId);
              return (
                <div className={`admin-player-row ${player.id === summary.winnerId ? 'winner' : ''}`} key={player.id}>
                  <strong>#{index + 1}</strong>
                  <span>{player.name}</span>
                  <span>{role?.name ?? player.roleId}</span>
                  <span>{player.kind === 'bot' ? '随从' : '掌柜'}</span>
                  <em>{player.netWorth.toLocaleString()}</em>
                </div>
              );
            })}
        </div>
      </section>

      <section className="admin-panel-block">
        <div className="section-title small">
          <History size={16} />
          <h3>逐轮过程</h3>
        </div>
        <div className="admin-round-list">
          {detail.rounds.map((round) => (
            <AdminRoundCard detail={detail} round={round} key={round.roundId} />
          ))}
        </div>
      </section>
    </>
  );
}

function AdminRoundCard({ detail, round }: { detail: AdminMatchDetail; round: AdminRoundReplay }): ReactElement {
  const publicClues = round.publicClues ?? [];
  const privateCluesByPlayerId = round.privateCluesByPlayerId ?? {};
  const bids = round.bids ?? [];
  const revealedItems = round.revealedItems ?? [];
  const settlementParticipants = round.settlement?.participants ?? [];
  const events = round.events ?? [];
  const transactions = round.transactions ?? [];

  return (
    <article className="admin-round-card">
      <header>
        <div>
          <span>{round.label} · {round.auctionMode ? auctionModeName(round.auctionMode) : '准备中'}</span>
          <strong>{round.containerName ?? '未生成货柜'}</strong>
        </div>
        <em className={(round.profit ?? 0) >= 0 ? 'profit' : 'loss'}>
          {round.title ?? '进行中'}{round.profit !== undefined ? ` ${round.profit >= 0 ? '+' : ''}${round.profit.toLocaleString()}` : ''}
        </em>
      </header>
      <div className="admin-round-metrics">
        <span>赢家 {round.winnerId ? playerNameFromAdmin(detail, round.winnerId) : '-'}</span>
        <span>成交 {round.payment?.toLocaleString() ?? '-'}</span>
        <span>真值 {round.trueValue?.toLocaleString() ?? '-'}</span>
        <span>出价 {bids.length}</span>
        <span>线索 {publicClues.length + Object.values(privateCluesByPlayerId).reduce((sum, clues) => sum + clues.length, 0)}</span>
        <span>开出 {revealedItems.length}</span>
      </div>
      <div className="admin-clue-grid">
        <div className="admin-clue-group">
          <strong>公共线索</strong>
          {publicClues.map((clue) => (
            <p key={clue.id}>{clue.text}</p>
          ))}
          {publicClues.length === 0 && <p className="muted">暂无公共线索。</p>}
        </div>
        {detail.summary.players.map((player) => {
          const clues = privateCluesByPlayerId[player.id] ?? [];
          return (
            <div className="admin-clue-group" key={player.id}>
              <strong>{player.name} 私有线索</strong>
              {clues.map((clue) => (
                <p key={clue.id}>{clueSourceName(clue.source)} · {clue.text}</p>
              ))}
              {clues.length === 0 && <p className="muted">暂无私有线索。</p>}
            </div>
          );
        })}
      </div>
      {bids.length > 0 && (
        <div className="admin-bid-strip">
          {bids.map((bid, index) => (
            <span key={`${bid.playerId}_${bid.createdAt}_${index}`}>
              {playerNameFromAdmin(detail, bid.playerId)} · {bid.visible ? '明拍' : '暗拍'} · {bid.amount > 0 ? bid.amount.toLocaleString() : '停手'}
            </span>
          ))}
        </div>
      )}
      {settlementParticipants.length > 0 && (
        <div className="admin-settlement-list">
          {settlementParticipants.map((entry) => (
            <span className={entry.profit >= 0 ? 'profit' : 'loss'} key={entry.playerId}>
              {playerNameFromAdmin(detail, entry.playerId)} {entry.title} {entry.profit >= 0 ? '+' : ''}{entry.profit.toLocaleString()}
            </span>
          ))}
        </div>
      )}
      <div className="admin-timeline">
        {events.map((event) => (
          <div className="admin-event-row" key={event.id}>
            <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
            <strong>{eventName(event.type)}</strong>
            <p>{event.actorId ? playerNameFromAdmin(detail, event.actorId) : '系统'} · {eventPayloadText(event.payload, detail)}</p>
          </div>
        ))}
        {events.length === 0 && <p className="muted">本轮暂无事件。</p>}
      </div>
      {transactions.length > 0 && (
        <div className="admin-transaction-list">
          {transactions.map((tx) => (
            <span className={tx.amountChange >= 0 ? 'profit' : 'loss'} key={tx.id}>
              {playerNameFromAdmin(detail, tx.playerId)} {transactionName(tx.reason)} {tx.amountChange >= 0 ? '+' : ''}{tx.amountChange.toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
