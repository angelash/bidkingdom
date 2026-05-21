import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ClipboardList, History, ListChecks, Trophy, Users } from 'lucide-react';
import type {
  AdminAuditSnapshot,
  AdminConfigParitySnapshot,
  AdminMatchDetail,
  AdminMatchListItem,
  PlayerProfile,
  ProfileTransaction
} from '@bitkingdom/shared';
import {
  AdminAuditOverview,
  AdminAuditOverviewPending,
  AdminActivityAuditPanel,
  AdminConfigParityPanel,
  AdminConfigParityPending,
  AdminLedgerPanel,
  AdminMetricTile,
  AdminReviewChecklistPanel,
  AdminReviewChecklistPending,
  AdminReviewSummaryPanel,
  AdminReviewSummaryPending
} from './AdminAuditPanels';
import { AdminMatchDetailView } from './AdminMatchDetailView';
import { matchStatusName } from './adminFormatters';

interface AdminDashboardProps {
  serverUrl: string;
}

type MatchStatusFilter = AdminMatchListItem['status'] | 'all';
type LedgerResourceFilter = ProfileTransaction['resource'] | 'all';
type LedgerSourceFilter = 'all' | 'activity' | 'guild' | 'market' | 'match' | 'order' | 'shop' | 'social' | 'system';

const ledgerResourceOptions: { value: LedgerResourceFilter; label: string }[] = [
  { value: 'all', label: '全部资源' },
  { value: 'coins', label: '铜钱' },
  { value: 'rankPoints', label: '名望' },
  { value: 'xp', label: '经验' },
  { value: 'ticket', label: '票券' },
  { value: 'item', label: '珍物' },
  { value: 'mail', label: '信札' },
  { value: 'task', label: '委托' }
];

const ledgerSourceOptions: { value: LedgerSourceFilter; label: string }[] = [
  { value: 'all', label: '全部来源' },
  { value: 'activity', label: '活动' },
  { value: 'guild', label: '鉴宝会' },
  { value: 'market', label: '市集' },
  { value: 'match', label: '拍局' },
  { value: 'order', label: '订单' },
  { value: 'shop', label: '宝铺' },
  { value: 'social', label: '社交' },
  { value: 'system', label: '系统' }
];

export function AdminDashboard({ serverUrl }: AdminDashboardProps): ReactElement {
  const [matches, setMatches] = useState<AdminMatchListItem[]>([]);
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [audit, setAudit] = useState<AdminAuditSnapshot>();
  const [configParity, setConfigParity] = useState<AdminConfigParitySnapshot>();
  const [ledger, setLedger] = useState<ProfileTransaction[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [matchStatusFilter, setMatchStatusFilter] = useState<MatchStatusFilter>('all');
  const [profileQuery, setProfileQuery] = useState('');
  const [ledgerPlayerId, setLedgerPlayerId] = useState('');
  const [ledgerResourceFilter, setLedgerResourceFilter] = useState<LedgerResourceFilter>('all');
  const [ledgerSourceFilter, setLedgerSourceFilter] = useState<LedgerSourceFilter>('all');
  const [ledgerQuery, setLedgerQuery] = useState('');
  const [detail, setDetail] = useState<AdminMatchDetail>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadMatches(): Promise<void> {
      try {
        const response = await fetch(`${serverUrl}/api/admin/matches`);
        const payload = await response.json() as { matches: AdminMatchListItem[] };
        if (cancelled) {
          return;
        }
        const nextMatches = payload.matches ?? [];
        setMatches(nextMatches);
        setSelectedMatchId((current) => current ?? nextMatches[0]?.matchId);
        setError('');
      } catch {
        if (!cancelled) {
          setError('后台列表加载失败');
        }
      }
    }
    void loadMatches();
    const timer = window.setInterval(loadMatches, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [serverUrl]);

  useEffect(() => {
    let cancelled = false;
    async function loadAudit(): Promise<void> {
      try {
        const ledgerParams = new URLSearchParams({ limit: '120' });
        if (ledgerPlayerId.trim()) {
          ledgerParams.set('playerId', ledgerPlayerId.trim());
        }
        if (ledgerResourceFilter !== 'all') {
          ledgerParams.set('resource', ledgerResourceFilter);
        }
        if (ledgerSourceFilter !== 'all') {
          ledgerParams.set('source', ledgerSourceFilter);
        }
        if (ledgerQuery.trim()) {
          ledgerParams.set('query', ledgerQuery.trim());
        }
        const [auditResponse, parityResponse, ledgerResponse] = await Promise.all([
          fetch(`${serverUrl}/api/admin/audit`),
          fetch(`${serverUrl}/api/admin/config-parity`),
          fetch(`${serverUrl}/api/admin/ledger?${ledgerParams.toString()}`)
        ]);
        const auditPayload = await auditResponse.json() as AdminAuditSnapshot;
        const parityPayload = await parityResponse.json() as AdminConfigParitySnapshot;
        const ledgerPayload = await ledgerResponse.json() as { transactions: ProfileTransaction[] };
        if (!cancelled) {
          setAudit(auditPayload);
          setConfigParity(parityPayload);
          setLedger(ledgerPayload.transactions ?? []);
        }
      } catch {
        if (!cancelled) {
          setAudit(undefined);
          setConfigParity(undefined);
          setLedger([]);
        }
      }
    }
    void loadAudit();
    const timer = window.setInterval(loadAudit, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ledgerPlayerId, ledgerQuery, ledgerResourceFilter, ledgerSourceFilter, serverUrl]);

  useEffect(() => {
    let cancelled = false;
    async function loadProfiles(): Promise<void> {
      try {
        const response = await fetch(`${serverUrl}/api/admin/profiles?limit=80`);
        const payload = await response.json() as { profiles: PlayerProfile[] };
        if (!cancelled) {
          setProfiles(payload.profiles ?? []);
        }
      } catch {
        if (!cancelled) {
          setProfiles([]);
        }
      }
    }
    void loadProfiles();
    const timer = window.setInterval(loadProfiles, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [serverUrl]);

  useEffect(() => {
    if (!selectedMatchId) {
      setDetail(undefined);
      return;
    }
    let cancelled = false;
    async function loadDetail(): Promise<void> {
      setLoading(true);
      try {
        const response = await fetch(`${serverUrl}/api/admin/matches/${selectedMatchId}`);
        if (!response.ok) {
          throw new Error('match not found');
        }
        const payload = await response.json() as AdminMatchDetail;
        if (!cancelled) {
          setDetail(payload);
          setError('');
        }
      } catch {
        if (!cancelled) {
          setError('对局详情加载失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadDetail();
    const timer = window.setInterval(loadDetail, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedMatchId, serverUrl]);

  const filteredMatches = useMemo(() => (
    matches.filter((match) => matchStatusFilter === 'all' || match.status === matchStatusFilter)
  ), [matchStatusFilter, matches]);
  const filteredProfiles = useMemo(() => {
    const query = profileQuery.trim().toLowerCase();
    if (!query) {
      return profiles;
    }
    return profiles.filter((profile) => (
      profile.playerId.toLowerCase().includes(query) ||
      profile.name.toLowerCase().includes(query)
    ));
  }, [profileQuery, profiles]);
  const filteredLedger = useMemo(() => (
    ledger.filter((transaction) => ledgerResourceFilter === 'all' || transaction.resource === ledgerResourceFilter)
  ), [ledger, ledgerResourceFilter]);

  return (
    <section className="admin-layout">
      <aside className="admin-list-panel">
        <div className="section-title">
          <ClipboardList size={20} />
          <h2>对局后台</h2>
        </div>
        <div className="admin-stats">
          <AdminMetricTile icon={<History size={18} />} label="场次" value={`${matches.length}`} />
          <AdminMetricTile icon={<Trophy size={18} />} label="已结束" value={`${matches.filter((match) => match.status === 'ended').length}`} />
          <AdminMetricTile icon={<Users size={18} />} label="档案" value={`${profiles.length}`} />
          <AdminMetricTile icon={<ListChecks size={18} />} label="账本" value={`${audit?.transactionCount ?? ledger.length}`} />
        </div>
        {error && <p className="admin-error">{error}</p>}
        {audit ? <AdminAuditOverview audit={audit} /> : <AdminAuditOverviewPending />}
        {audit && <AdminActivityAuditPanel audit={audit} />}
        {configParity ? <AdminConfigParityPanel snapshot={configParity} /> : <AdminConfigParityPending />}
        {configParity ? <AdminReviewSummaryPanel snapshot={configParity} /> : <AdminReviewSummaryPending />}
        {configParity ? <AdminReviewChecklistPanel snapshot={configParity} /> : <AdminReviewChecklistPending />}
        <a
          className="admin-export-link"
          href={`${serverUrl}/api/admin/review-snapshot`}
          rel="noreferrer"
          target="_blank"
        >
          导出审查快照
        </a>
        <div className="admin-filter-row single">
          <select
            aria-label="账本掌柜"
            value={ledgerPlayerId}
            onChange={(event) => setLedgerPlayerId(event.currentTarget.value)}
          >
            <option value="">全部掌柜</option>
            {profiles.map((profile) => (
              <option key={profile.playerId} value={profile.playerId}>{profile.name} · {profile.playerId}</option>
            ))}
          </select>
          <select
            aria-label="账本资源"
            value={ledgerResourceFilter}
            onChange={(event) => setLedgerResourceFilter(event.currentTarget.value as LedgerResourceFilter)}
          >
            {ledgerResourceOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            aria-label="账本来源"
            value={ledgerSourceFilter}
            onChange={(event) => setLedgerSourceFilter(event.currentTarget.value as LedgerSourceFilter)}
          >
            {ledgerSourceOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            aria-label="账本查询"
            value={ledgerQuery}
            onChange={(event) => setLedgerQuery(event.currentTarget.value)}
            placeholder="搜索来源、事由或掌柜"
          />
        </div>
        <AdminLedgerPanel transactions={filteredLedger} />
        <div className="admin-filter-row single">
          <select
            aria-label="对局状态"
            value={matchStatusFilter}
            onChange={(event) => setMatchStatusFilter(event.currentTarget.value as MatchStatusFilter)}
          >
            <option value="all">全部对局</option>
            <option value="lobby">大厅</option>
            <option value="playing">进行中</option>
            <option value="ended">已结束</option>
          </select>
        </div>
        <div className="admin-match-list">
          {filteredMatches.map((match) => (
            <button
              className={`admin-match-card ${selectedMatchId === match.matchId ? 'selected' : ''}`}
              key={match.matchId}
              onClick={() => setSelectedMatchId(match.matchId)}
              type="button"
            >
              <span>{matchStatusName(match.status)} · 房间 {match.roomCode}</span>
              <strong>{match.winnerName ? `赢家 ${match.winnerName}` : `第 ${Math.max(0, match.roundIndex + 1)}/${match.totalRounds} 轮`}</strong>
              <small>{match.players.map((player) => player.name).join(' / ')}</small>
              <em>{new Date(match.updatedAt).toLocaleTimeString()}</em>
            </button>
          ))}
          {filteredMatches.length === 0 && <p className="muted">暂无符合条件的对局。</p>}
        </div>
        <div className="admin-filter-row">
          <input
            aria-label="档案搜索"
            value={profileQuery}
            onChange={(event) => setProfileQuery(event.currentTarget.value)}
            placeholder="搜索掌柜或档案 ID"
          />
        </div>
        <div className="admin-match-list">
          {filteredProfiles.slice(0, 8).map((profile) => (
            <article className="admin-match-card" key={profile.playerId}>
              <span>Lv.{profile.level} · {profile.tickets.current}/{profile.tickets.max} 票</span>
              <strong>{profile.name}</strong>
              <small>{profile.coins.toLocaleString()} 铜钱 · {profile.completedMatches.length} 局 · {profile.completedTasks.length} 委托</small>
              <em>{new Date(profile.updatedAt).toLocaleTimeString()}</em>
            </article>
          ))}
          {filteredProfiles.length === 0 && <p className="muted">暂无符合条件的掌柜档案。</p>}
        </div>
      </aside>

      <section className="admin-detail-panel">
        {loading && !detail && <p className="muted">正在加载对局详情...</p>}
        {!detail && !loading && <p className="muted">选择一场对局查看结果和过程。</p>}
        {detail && <AdminMatchDetailView detail={detail} />}
      </section>
    </section>
  );
}
