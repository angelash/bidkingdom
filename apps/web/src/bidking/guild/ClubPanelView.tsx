import { useEffect, useState } from 'react';
import { PackageCheck, Save, UserCheck, UserX } from 'lucide-react';
import {
  GuildArea as bidKingGuildAreas,
  GuildPermissions as bidKingGuildPermissions,
  GuildPoints as bidKingGuildPoints,
  GuildResources as bidKingGuildResources,
  bidKingGuildResourceRuntime,
  bidKingRawTableDisplayDesc,
  bidKingRawTableDisplayName,
  type BidKingRawTableRow
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile } from '@bitkingdom/shared';
import { formatChineseCompactCurrency } from '../currencyFormat';
import { safeBidKingDisplayText } from '../system/bidKingSystemRuntime';

interface ClubPanelViewProps {
  profile: PlayerProfile;
  serverUrl: string;
  onJoinGuild: (areaId?: string) => void;
  onSetGuildRole: (roleId: string) => void;
  onApproveGuildMember: (applicantId: string) => void;
  onKickGuildMember: (memberId: string) => void;
  onUpdateGuildNotice: (notice: string) => void;
  onDonateGuildCoins: (amount: number) => void;
  onClaimAreaResource: (areaId?: string) => void;
  onClaimGuildResource: (resourceId: string) => void;
  onUseGuildResource: (resourceId: string, quantity?: number) => void;
}

interface AreaSnapshotView {
  areas: Array<{
    areaId: string;
    areaName: string;
    guildAreaId?: string;
    guildResourceId?: string;
    guildResourceName?: string;
    guildResourceType?: number;
    guildResourceUsage?: string;
    guildResourceKey?: string;
    guildCount: number;
    points: number;
    recommendedNames?: string[];
  }>;
}

export function ClubPanelView({
  profile,
  serverUrl,
  onJoinGuild,
  onSetGuildRole,
  onApproveGuildMember,
  onKickGuildMember,
  onUpdateGuildNotice,
  onDonateGuildCoins,
  onClaimAreaResource,
  onClaimGuildResource,
  onUseGuildResource
}: ClubPanelViewProps): JSX.Element {
  const area = bidKingGuildAreas[0];
  const membership = profile.guildMembership;
  const currentArea = bidKingGuildAreas.find((row) => row.id === membership?.areaId) ?? area;
  const canChangeRole = Boolean(membership?.permissions?.changeRole);
  const canApproveMember = Boolean(membership?.permissions?.approveMember);
  const canKickMember = Boolean(membership?.permissions?.kickMember);
  const canDonate = Boolean(membership?.permissions?.donate);
  const canEditNotice = Boolean(membership?.permissions?.editNotice);
  const [areaSnapshot, setAreaSnapshot] = useState<AreaSnapshotView>();
  const [noticeDraft, setNoticeDraft] = useState(membership?.notice ?? '');

  useEffect(() => {
    setNoticeDraft(membership?.notice ?? '');
  }, [membership?.notice]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${serverUrl}/api/area/snapshot`)
      .then((response) => response.json() as Promise<AreaSnapshotView>)
      .then((payload) => {
        if (!cancelled) {
          setAreaSnapshot(payload);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [membership?.areaId, membership?.points, serverUrl]);

  return (
    <div className="config-table-panel config-grid-panel">
      <header>
        <strong>鉴宝会</strong>
        <span>{bidKingGuildResources.length} 会馆资源 · {bidKingGuildPermissions.length} 个职位 · {bidKingGuildAreas.length} 处地区</span>
      </header>
      <article className={membership ? 'claimed' : ''}>
        <strong>{membership?.name ?? '未加入鉴宝会'}</strong>
        <p>{membership ? `职位 ${membership.roleId} · 声望 ${membership.points}` : '选择一处地区鉴宝会即可入会。'}</p>
        <em>{currentArea ? bidKingRawTableDisplayName(currentArea) : '默认会馆'}</em>
        {membership?.notice && <p>会馆告示：{membership.notice}</p>}
        <button onClick={() => onJoinGuild(currentArea?.id ?? area?.id)} type="button">
          {membership ? '刷新会馆状态' : '加入鉴宝会'}
        </button>
        <button disabled={!canDonate || profile.coins < 1000} onClick={() => onDonateGuildCoins(1000)} type="button">
          捐献1000
        </button>
        <div className="inline-action-row">
          {bidKingGuildPoints.slice(0, 3).map((row) => {
            const amount = guildPointDonationAmount(row);
            return (
              <button disabled={!canDonate || amount <= 0 || profile.coins < amount} key={`guild_donate_${row.id}`} onClick={() => onDonateGuildCoins(amount)} type="button">
                {compactAmount(amount)} / +{rawColumn(row, 4)}
              </button>
            );
          })}
        </div>
      </article>
      {membership && (
        <article>
          <strong>权限状态</strong>
          <p>{Object.entries(membership.permissions ?? {}).filter(([, enabled]) => enabled).map(([key]) => key).join('、') || '无权限'}</p>
          <em>资源 {Object.values(membership.resources ?? {}).reduce((sum, value) => sum + value, 0)} 个</em>
          <label>
            会馆告示
            <input
              aria-label="会馆告示"
              disabled={!canEditNotice}
              maxLength={80}
              value={noticeDraft}
              onChange={(event) => setNoticeDraft(event.currentTarget.value)}
            />
          </label>
          <button disabled={!canEditNotice} onClick={() => onUpdateGuildNotice(noticeDraft)} type="button">
            <Save size={16} />
            保存告示
          </button>
          <div className="inline-action-row">
            {bidKingGuildPermissions.map((row) => (
              <button disabled={!canChangeRole || row.id === membership.roleId} key={`guild_role_${row.id}`} onClick={() => onSetGuildRole(row.id)} type="button">
                {guildRoleName(row)}
              </button>
            ))}
          </div>
        </article>
      )}
      {membership && (
        <article>
          <strong>成员审批</strong>
          <p>成员 {membership.members?.length ?? 1} · 待审批 {membership.pendingApplications?.length ?? 0}</p>
          <em>{canApproveMember ? '可审批入会' : '无审批权限'} · {canKickMember ? '可移除成员' : '无踢人权限'}</em>
          <div className="inline-action-row">
            {(membership.pendingApplications ?? []).slice(0, 3).map((member) => (
              <button disabled={!canApproveMember} key={`guild_approve_${member.playerId}`} onClick={() => onApproveGuildMember(member.playerId)} type="button">
                <UserCheck size={16} />
                {member.name}
              </button>
            ))}
          </div>
          {(membership.members ?? []).filter((member) => member.playerId !== profile.playerId).slice(0, 4).map((member) => (
            <div className="inline-action-row" key={`guild_member_${member.playerId}`}>
              <span>{member.name} · 职位 {member.roleId} · 积分 {member.points}</span>
              <button disabled={!canKickMember} onClick={() => onKickGuildMember(member.playerId)} type="button">
                <UserX size={16} />
                移除
              </button>
            </div>
          ))}
        </article>
      )}
      {(areaSnapshot?.areas ?? []).slice(0, 6).map((row) => {
        const targetAreaId = row.guildAreaId ?? row.areaId;
        const active = membership?.areaId === targetAreaId || membership?.areaId === row.areaId;
        const recommendedNames = row.recommendedNames
          ?.map((name) => safeBidKingDisplayText(name))
          .filter((name) => name.length > 0) ?? [];
        return (
          <article className={active ? 'claimed' : ''} key={`area_snapshot_${row.areaId}`}>
            <strong>{guildAreaDisplayFromSnapshot(row)}</strong>
            <p>鉴宝会 {row.guildCount} 个 · 声望 {row.points}</p>
            <em>{guildAreaResourceName(row.guildResourceId, row.guildResourceName) ?? '无地区资源'} · {row.guildResourceUsage ?? '未配置用途'}</em>
            {row.guildResourceKey ? <p>地区资源已绑定，可在入会后领取。</p> : null}
            {recommendedNames.length ? <p>推荐名：{recommendedNames.join('、')}</p> : null}
            <button disabled={active} onClick={() => onJoinGuild(targetAreaId)} type="button">
              {active ? '当前地区' : membership ? '迁入地区' : '加入地区'}
            </button>
            <button
              disabled={!active || !membership?.permissions?.manageResource || !row.guildResourceId}
              onClick={() => onClaimAreaResource(targetAreaId)}
              type="button"
            >
              <PackageCheck size={16} />
              领取地区资源
            </button>
          </article>
        );
      })}
      {bidKingGuildResources.slice(0, 12).map((row) => {
        const runtime = bidKingGuildResourceRuntime(row);
        return (
          <article key={`guild_resource_${row.id}`}>
            <strong>{guildResourceName(row)}</strong>
            <p>{runtime.usageLabel} · {runtime.description}</p>
            <em>已领取 {membership?.resources?.[row.id] ?? 0} · 资源类 {runtime.typeCode} · {runtime.iconKey || runtime.displayKey || '无资源键'}</em>
            <div className="inline-action-row">
              <button disabled={!membership?.permissions?.manageResource} onClick={() => onClaimGuildResource(row.id)} type="button">
                领取资源
              </button>
              <button disabled={!membership?.permissions?.manageResource || (membership.resources?.[row.id] ?? 0) <= 0} onClick={() => onUseGuildResource(row.id, 1)} type="button">
                使用资源
              </button>
            </div>
          </article>
        );
      })}
      {[...bidKingGuildPermissions, ...bidKingGuildPoints.slice(0, 12), ...bidKingGuildAreas.slice(0, 12)].map((row) => (
        <article key={`${row.packaged_name}_${row.id}`}>
          <strong>{guildConfigDisplayName(row)}</strong>
          <p>{safeBidKingDisplayText(bidKingRawTableDisplayDesc(row), guildConfigSummary(row)) || guildConfigSummary(row)}</p>
          <em>{guildConfigValueLabel(row)}</em>
        </article>
      ))}
    </div>
  );
}

function rawColumn(row: BidKingRawTableRow, index: number): string {
  return row.columns[index] ?? '';
}

function guildRoleName(row: BidKingRawTableRow): string {
  const labels: Record<string, string> = {
    '1': '会首',
    '2': '执事',
    '3': '会众'
  };
  return labels[row.id] ?? safeBidKingDisplayText(rawColumn(row, 2), row.packaged_name) ?? `职位 ${row.id}`;
}

function guildConfigSummary(row: BidKingRawTableRow): string {
  if (row.table === 'GuildPermissions') {
    return '鉴宝会职位权限配置，控制改职、审批、捐献和资源操作。';
  }
  if (row.table === 'GuildPoints') {
    return '鉴宝会声望区间配置，用于捐献和对局收益换算。';
  }
  if (row.table === 'GuildArea') {
    return '鉴宝会地区配置，绑定地区入口和地区资源。';
  }
  return '鉴宝会配置已接入本地名册状态。';
}

function guildConfigValueLabel(row: BidKingRawTableRow): string {
  if (row.table === 'GuildPoints') {
    return `声望 +${rawColumn(row, 4) || '0'}`;
  }
  if (row.table === 'GuildArea') {
    return `地区 ${row.id}`;
  }
  return `条目 ${row.id}`;
}

function guildConfigDisplayName(row: BidKingRawTableRow): string {
  if (row.table === 'GuildPermissions') {
    return guildRoleName(row);
  }
  if (row.table === 'GuildPoints') {
    return `捐献声望·第${row.id}档`;
  }
  if (row.table === 'GuildArea') {
    return bidKingRawTableDisplayName(row);
  }
  return `会馆条目 ${row.id}`;
}

function guildResourceName(row: BidKingRawTableRow): string {
  return guildResourceNameById(row.id) ?? `会馆资源 ${row.id}`;
}

function guildAreaResourceName(resourceId?: string, defaultName?: string): string | undefined {
  if (!resourceId) {
    return defaultName;
  }
  return guildResourceNameById(resourceId) ?? defaultName;
}

function guildResourceNameById(id: string): string | undefined {
  const names: Record<string, string> = {
    1001: '洛阳木牌',
    1002: '江东水令',
    1003: '西凉马令',
    1004: '荆襄文牒',
    1005: '铜雀会符',
    1006: '武库虎符',
    1007: '青囊药符',
    1008: '书画雅券',
    2001: '会馆铜锭',
    2002: '会馆银锭',
    2003: '会馆金锭',
    2004: '鉴宝会木匣',
    2005: '鉴宝会铜匣',
    2006: '鉴宝会金匣',
    2007: '名士荐书',
    2008: '珍阁整备令',
    2009: '铜雀秘荐'
  };
  return names[id];
}

function guildAreaName(id: string): string {
  return bidKingRawTableDisplayName({
    id,
    table: 'GuildArea',
    packaged_name: `会馆地区 ${id}`
  });
}

function guildAreaDisplayFromSnapshot(row: AreaSnapshotView['areas'][number]): string {
  const areaId = row.guildAreaId ?? row.areaId;
  return guildAreaName(areaId);
}

function guildPointDonationAmount(row: BidKingRawTableRow): number {
  try {
    const parsed = JSON.parse(rawColumn(row, 3)) as unknown;
    if (!Array.isArray(parsed)) {
      return 0;
    }
    return Number(parsed[0] ?? 0) || 0;
  } catch {
    return 0;
  }
}

function compactAmount(value: number): string {
  return formatChineseCompactCurrency(value);
}
