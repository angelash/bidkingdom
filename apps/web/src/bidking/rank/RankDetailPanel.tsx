import { useEffect, useState } from 'react';
import { Star, Trophy } from 'lucide-react';
import {
  LevelUp as bidKingLevelUps,
  Rank as bidKingRanks,
  RankReward as bidKingRankRewards,
  bidKingRawTableDisplayDesc,
  bidKingRawTableDisplayName,
  type BidKingRawTableRow
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile, RankSnapshot } from '@bitkingdom/shared';
import { safeBidKingDisplayText } from '../system/bidKingSystemRuntime';
import { bidKingRewardRowsLabel, parseBidKingRewardRows } from '../system/rewardText';

interface RankDetailPanelProps {
  profile: PlayerProfile;
  serverUrl: string;
  onClaimRankReward: (rank: number) => void;
}

const rankTiers = [
  { name: '初入局', points: 0 },
  { name: '见习掌柜', points: 10 },
  { name: '行家', points: 40 },
  { name: '鉴宝师', points: 90 },
  { name: '大掌柜', points: 150 },
  { name: '一方名士', points: 220 },
  { name: '传世藏家', points: 300 }
];

export function RankDetailPanel({
  profile,
  serverUrl,
  onClaimRankReward
}: RankDetailPanelProps): JSX.Element {
  const currentTier = currentRankTier(profile.rankPoints);
  const nextTier = nextRankTier(profile.rankPoints);
  const currentLevelXp = previousXpForLevel(profile.level);
  const nextLevelXp = xpForLevel(profile.level);
  const rankProgress = nextTier ? Math.round(((profile.rankPoints - currentTier.points) / (nextTier.points - currentTier.points)) * 100) : 100;
  const [rankSnapshot, setRankSnapshot] = useState<RankSnapshot>();
  const [selectedRankId, setSelectedRankId] = useState(bidKingRanks[0]?.id ?? '101');
  const [rankPage, setRankPage] = useState(1);
  const rankPageSize = 8;
  const selectedRank = bidKingRanks.find((rank) => rank.id === selectedRankId);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ rankId: selectedRankId, page: String(rankPage), pageSize: String(rankPageSize) });
    fetch(`${serverUrl}/api/rank/snapshot?${params.toString()}`)
      .then((response) => response.json() as Promise<RankSnapshot>)
      .then((payload) => {
        if (!cancelled) {
          setRankSnapshot(payload);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profile.rankPoints, profile.completedMatches.length, rankPage, selectedRankId, serverUrl]);

  return (
    <div className="rank-detail-panel">
      <section className="rank-hero">
        <Trophy size={30} />
        <div>
          <span>当前名望</span>
          <h3>{currentTier.name}</h3>
          <p>{profile.rankPoints} 名士积分 · 掌柜 Lv.{profile.level}</p>
        </div>
      </section>
      <div className="codex-meter">
        <span style={{ width: `${Math.min(100, Math.max(0, rankProgress))}%` }} />
      </div>
      <p className="rank-next">{nextTier ? `距离 ${nextTier.name} 还需要 ${Math.max(0, nextTier.points - profile.rankPoints)} 名望` : '已达到当前名士榜最高称号'}</p>
      <div className="detail-stat-grid">
        <RankDetailStat
          label="经验"
          value={`${Math.max(0, profile.xp - currentLevelXp)}/${Math.max(1, nextLevelXp - currentLevelXp)}`}
        />
        <RankDetailStat label="铜钱" value={profile.coins.toLocaleString()} />
        <RankDetailStat label="完成对局" value={`${profile.completedMatches.length}`} />
        <RankDetailStat label="珍宝谱加成" value={`${profile.codex.length * 20} 铜钱`} />
      </div>
      <div className="rank-tier-list">
        {rankTiers.map((tier) => (
          <div className={`rank-tier-row ${profile.rankPoints >= tier.points ? 'unlocked' : ''}`} key={tier.name}>
            <Star size={15} />
            <span>{tier.name}</span>
            <strong>{tier.points}</strong>
          </div>
        ))}
      </div>
      <div className="inline-action-row">
        {bidKingRanks.map((rank) => (
          <button
            className={rank.id === selectedRankId ? 'active' : ''}
            key={`rank_tab_${rank.id}`}
            onClick={() => {
              setSelectedRankId(rank.id);
              setRankPage(1);
            }}
          type="button"
        >
            {bidKingRawTableDisplayName(rank)}
          </button>
        ))}
      </div>
      <section className="rank-reward-panel config-table-panel config-grid-panel">
        <header>
          <strong>{selectedRank ? bidKingRawTableDisplayName(selectedRank) : safeBidKingDisplayText(rankSnapshot?.title ?? '', '名士榜快照') || '名士榜快照'}</strong>
          <span>
            {rankSnapshot ? `第 ${rankSnapshot.page}/${rankSnapshot.totalPages} 页 · ${rankSnapshot.totalEntries} 位玩家` : '加载中'}
          </span>
        </header>
        {rankSnapshot && <p>{rankSnapshotMeta(rankSnapshot, selectedRank)}</p>}
        {(rankSnapshot?.entries ?? []).map((entry) => (
          <article className={entry.playerId === profile.playerId ? 'claimed' : ''} key={entry.playerId}>
            <strong>#{entry.rank} {entry.name}</strong>
            <p>{entry.rankPoints} 名望 · Lv.{entry.level} · {entry.completedMatches} 局</p>
            <em>{entry.coins.toLocaleString()} 铜钱</em>
          </article>
        ))}
        <div className="inline-action-row">
          <button disabled={(rankSnapshot?.page ?? 1) <= 1} onClick={() => setRankPage((page) => Math.max(1, page - 1))} type="button">
            上一页
          </button>
          <button
            disabled={(rankSnapshot?.page ?? 1) >= (rankSnapshot?.totalPages ?? 1)}
            onClick={() => setRankPage((page) => Math.min(rankSnapshot?.totalPages ?? page, page + 1))}
            type="button"
          >
            下一页
          </button>
        </div>
      </section>
      <section className="rank-reward-panel config-table-panel config-grid-panel">
        <header>
          <strong>名士榜赏</strong>
          <span>{bidKingRankRewards.length} 道赏格</span>
        </header>
        {bidKingRankRewards.map((reward) => {
          const [minRank, maxRank] = rankRewardRange(reward);
          const claimed = profile.claimedRankRewards.includes(reward.id);
          return (
            <article className={claimed ? 'claimed' : ''} key={reward.id}>
              <strong>{bidKingRawTableDisplayName(reward)}</strong>
              <p>{bidKingRawTableDisplayDesc(reward)} · 排名 {minRank === maxRank ? minRank : `${minRank}-${maxRank}`}</p>
              <em>{rankRewardSummary(reward)}</em>
              <button disabled={claimed} onClick={() => onClaimRankReward(minRank)} type="button">
                {claimed ? '已领取' : '领取'}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function RankDetailStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function currentRankTier(points: number): (typeof rankTiers)[number] {
  let current = rankTiers[0]!;
  for (const tier of rankTiers) {
    if (points >= tier.points) {
      current = tier;
    }
  }
  return current;
}

function nextRankTier(points: number): (typeof rankTiers)[number] | undefined {
  return rankTiers.find((tier) => tier.points > points);
}

function xpForLevel(level: number): number {
  return bidKingLevelUps.find((entry) => entry.id === level)?.collection_value ?? Math.max(120, level * level * 120);
}

function previousXpForLevel(level: number): number {
  if (level <= 1) {
    return 0;
  }
  return xpForLevel(level - 1);
}

function rankRewardRange(row: BidKingRawTableRow): [number, number] {
  const values = rawColumn(row, 4).match(/\d+/g)?.map(Number) ?? [];
  const first = values[0] ?? 1;
  return [first, values[1] ?? first];
}

function rankRewardSummary(row: BidKingRawTableRow): string {
  const rewards = [...parseBidKingRewardRows(rawColumn(row, 5)), ...parseBidKingRewardRows(rawColumn(row, 7))];
  const rewardText = bidKingRewardRowsLabel(rewards, '无配置奖励');
  const mailId = rawColumn(row, 8);
  return mailId ? `${rewardText} · 信札 ${mailId}` : rewardText;
}

function rankSnapshotMeta(snapshot: RankSnapshot, selectedRank?: BidKingRawTableRow): string {
  const tags = [
    snapshot.isRegional ? '地区榜' : '全服榜',
    snapshot.isDated ? '赛季榜' : '永久榜',
    snapshot.isRoleBased ? '角色榜' : '综合榜',
    snapshot.sortDirection === 'asc' ? '升序' : '降序',
    `榜类 ${snapshot.rankType}`
  ];
  const description = selectedRank
    ? bidKingRawTableDisplayDesc(selectedRank)
    : safeBidKingDisplayText(snapshot.description, '按当前榜单规则排序。') || '按当前榜单规则排序。';
  return `${tags.join(' · ')} · ${description}`;
}

function rawColumn(row: BidKingRawTableRow, index: number): string {
  return row.columns[index] ?? '';
}
