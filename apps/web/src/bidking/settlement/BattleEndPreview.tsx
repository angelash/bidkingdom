import { useEffect, useMemo } from 'react';
import { Crown, Gavel } from 'lucide-react';
import { gameConfig } from '@bitkingdom/config';
import {
  SOURCE_BID_SUCCESS_PREVIEW_MS,
  type PlayerSnapshot,
  type PublicPlayer
} from '@bitkingdom/shared';
import { itemIconForKey, roleAvatarForRoleId, rolePortraitForRoleId } from '../../artAssets';

type CurrentRound = NonNullable<PlayerSnapshot['public']['currentRound']>;

interface BattleEndPreviewProps {
  round: CurrentRound;
  selfPlayerId?: string;
  snapshot: PlayerSnapshot;
  onComplete: () => void;
}

interface PreviewBidRow {
  amount: number;
  player: PublicPlayer;
  rank?: number;
}

export function BattleEndPreview({
  onComplete,
  round,
  selfPlayerId,
  snapshot
}: BattleEndPreviewProps): JSX.Element {
  const settlement = round.settlement;

  useEffect(() => {
    const timer = window.setTimeout(onComplete, SOURCE_BID_SUCCESS_PREVIEW_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete, round.id]);

  const players = snapshot.public.players;
  const winner = players.find((player) => player.id === settlement?.winnerId);
  const winnerRole = gameConfig.roles.find((role) => role.id === winner?.roleId);
  const winnerPortrait = rolePortraitForRoleId(winnerRole?.id);
  const winnerAvatar = roleAvatarForRoleId(winnerRole?.id);
  const selfWon = Boolean(selfPlayerId && selfPlayerId === settlement?.winnerId);
  const bidRows = useMemo(() => previewBidRows(round, players), [players, round]);
  const winnerBid = bidRows.find((entry) => entry.player.id === settlement?.winnerId)?.amount ?? settlement?.payment ?? 0;
  const skillSlots = winner?.bidRanks?.slice(0, Math.max(5, Math.min(6, winner.bidRanks.length))) ?? [];

  if (!settlement?.isFinal || !settlement.winnerId || !winner) {
    return <></>;
  }

  return (
    <section className={`battle-end-preview-overlay ${selfWon ? 'self-win' : 'self-lose'}`} aria-live="polite">
      <div className="battle-end-preview-panel">
        <div className="battle-end-preview-title">
          <span>{selfWon ? '竞拍成功' : '竞拍落定'}</span>
          <h2>最高出价！</h2>
          <p>{round.container.source} · 第 {round.index + 1} 轮成交</p>
        </div>

        <div className="battle-end-preview-body">
          <div className="battle-end-preview-portrait">
            {winnerPortrait
              ? <img src={winnerPortrait} alt="" />
              : winnerAvatar
                ? <img src={winnerAvatar} alt="" />
                : <Crown size={76} />}
          </div>
          <div className="battle-end-preview-winner">
            <span>拍得者：</span>
            <strong>{winner.name}</strong>
            <em>{winnerRole?.name ?? winner.roleId} · 成交 {formatCurrency(winnerBid)}</em>
          </div>
          <div className="battle-end-preview-items">
            {skillSlots.map((entry) => {
              const icon = entry.usedSkillIconKey ? itemIconForKey(entry.usedSkillIconKey) : undefined;
              return (
                <span className={icon ? '' : 'pending'} key={`${winner.id}_preview_skill_${entry.round}`}>
                  {icon ? <img src={icon} alt="" /> : <Gavel size={20} />}
                </span>
              );
            })}
          </div>
        </div>

        <div className="battle-end-preview-bids">
          {bidRows.map((entry) => (
            <span className={entry.player.id === settlement.winnerId ? 'winner' : ''} key={`${entry.player.id}_preview_bid`}>
              <strong>{entry.rank ? `${entry.rank}. ` : ''}{entry.player.name}</strong>
              <em>{entry.amount > 0 ? formatCurrency(entry.amount) : '停手'}</em>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function previewBidRows(round: CurrentRound, players: PublicPlayer[]): PreviewBidRow[] {
  const amountByPlayerId = new Map(round.bids.map((bid) => [bid.playerId, bid.amount]));
  const rankByPlayerId = new Map(
    (round.settlement?.bidFeedback?.publicRanking ?? round.bidFeedback?.publicRanking ?? [])
      .map((entry) => [entry.playerId, entry.rank])
  );
  return players
    .map((player) => ({
      amount: amountByPlayerId.get(player.id) ?? 0,
      player,
      rank: rankByPlayerId.get(player.id)
    }))
    .sort((left, right) => {
      const leftRank = left.rank ?? 99 + left.player.seat;
      const rightRank = right.rank ?? 99 + right.player.seat;
      return leftRank - rightRank || right.amount - left.amount || left.player.seat - right.player.seat;
    });
}

function formatCurrency(value: number): string {
  return value.toLocaleString();
}
