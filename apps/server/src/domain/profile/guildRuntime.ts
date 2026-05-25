import { GuildArea, GuildPermissions, GuildPoints, GuildResources } from '@bitkingdom/bidking-compat';
import type { GuildMemberState, PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { sanitizeText } from '../system/textGuard';
import { parseNumberArray } from './profileNumber';

export type GuildTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export type GuildNumberChangeApplier = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: Extract<ProfileTransaction['resource'], 'coins' | 'rankPoints' | 'xp'>,
  amountChange: number
) => void;

export function guildPermissionFlags(roleId: string): Record<string, boolean> {
  const row = GuildPermissions.find((candidate) => candidate.id === roleId) ?? GuildPermissions[0];
  return {
    approveMember: row?.columns[3] === '1',
    kickMember: row?.columns[4] === '1',
    editNotice: row?.columns[5] === '1',
    manageResource: row?.columns[6] === '1',
    donate: row?.columns[7] === '1',
    invite: row?.columns[8] === '1',
    changeRole: row?.columns[9] === '1',
    disband: row?.columns[10] === '1'
  };
}

export function guildPointsForDonation(amount: number): number {
  const tableBonus = GuildPoints.find((row) => {
    const [min = 0, max = 0] = parseNumberArray(row.columns[3]);
    return amount >= min && (max <= 0 || amount <= max);
  });
  const configured = Number(tableBonus?.columns[4] ?? 0);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }
  return Math.max(1, Math.floor(amount / 100));
}

export function removeFriendFromProfile(
  profile: PlayerProfile,
  friendId: string,
  recordTransaction: GuildTransactionRecorder
): boolean {
  const index = profile.friends.findIndex((friend) => friend.id === friendId);
  if (index < 0) {
    throw new Error('好友不存在');
  }
  const before = profile.friends.length;
  profile.friends.splice(index, 1);
  recordTransaction(profile, `friend_remove:${profile.playerId}:${friendId}:${Date.now()}`, 'friend_remove', 'task', before, -1);
  profile.updatedAt = Date.now();
  return true;
}

export function setFriendRemarkForProfile(
  profile: PlayerProfile,
  friendId: string,
  remark: string,
  recordTransaction: GuildTransactionRecorder
): boolean {
  const friend = profile.friends.find((candidate) => candidate.id === friendId);
  if (!friend) {
    throw new Error('好友不存在');
  }
  const nextRemark = sanitizeText(remark).trim().slice(0, 40);
  if ((friend.remark ?? '') === nextRemark) {
    return false;
  }
  const before = (friend.remark ?? '').length;
  friend.remark = nextRemark || undefined;
  profile.updatedAt = Date.now();
  recordTransaction(
    profile,
    `friend_remark:${profile.playerId}:${friendId}:${profile.updatedAt}`,
    'friend_remark_update',
    'task',
    before,
    nextRemark.length - before
  );
  return true;
}

export function joinGuildForProfile(
  profile: PlayerProfile,
  areaId?: string,
  recordTransaction?: GuildTransactionRecorder
): boolean {
  const area = GuildArea.find((row) => row.id === areaId) ?? GuildArea[0];
  const previous = profile.guildMembership;
  const nextAreaId = area?.id ?? '0';
  const beforeAreaId = previous?.areaId;
  const changed = !previous || beforeAreaId !== nextAreaId;
  profile.guildMembership = {
    guildId: `guild_${area?.id ?? 'local'}`,
    name: area?.packaged_name ?? '本地收藏协会',
    areaId: nextAreaId,
    roleId: previous?.roleId ?? '1',
    notice: previous?.notice,
    points: previous?.points ?? Math.max(10, profile.completedMatches.length * 10 + profile.codex.length),
    permissions: guildPermissionFlags(previous?.roleId ?? '1'),
    resources: previous?.resources ?? {},
    members: ensureGuildMembers(profile, nextAreaId, previous?.members),
    pendingApplications: previous?.pendingApplications ?? [],
    joinedAt: previous?.joinedAt ?? Date.now()
  };
  if (changed && recordTransaction) {
    const before = Number(beforeAreaId ?? 0) || 0;
    const after = Number(nextAreaId) || before;
    recordTransaction(
      profile,
      `guild_area:${profile.playerId}:${beforeAreaId ?? 'new'}:${nextAreaId}:${Date.now()}`,
      previous ? 'guild_area_change' : 'guild_join_area',
      'task',
      before,
      after - before
    );
  }
  profile.updatedAt = Date.now();
  return changed;
}

export function approveGuildMemberForProfile(
  profile: PlayerProfile,
  applicantId: string,
  recordTransaction: GuildTransactionRecorder
): boolean {
  if (!profile.guildMembership) {
    joinGuildForProfile(profile);
  }
  const membership = profile.guildMembership!;
  membership.permissions = guildPermissionFlags(membership.roleId);
  if (!membership.permissions.approveMember) {
    throw new Error('协会权限不足');
  }
  membership.pendingApplications ??= [];
  const index = membership.pendingApplications.findIndex((member) => member.playerId === applicantId);
  if (index < 0) {
    throw new Error('协会申请不存在');
  }
  const [application] = membership.pendingApplications.splice(index, 1);
  if (!application) {
    return false;
  }
  membership.members = ensureGuildMembers(profile, membership.areaId, membership.members);
  if (membership.members.some((member) => member.playerId === application.playerId)) {
    return false;
  }
  const member: GuildMemberState = {
    ...application,
    roleId: application.roleId || '3',
    areaId: membership.areaId,
    status: 'member',
    joinedAt: Date.now()
  };
  membership.members.push(member);
  recordTransaction(profile, `guild_member_approve:${profile.playerId}:${member.playerId}:${member.joinedAt}`, 'guild_member_approve', 'task', membership.members.length - 1, 1);
  profile.updatedAt = Date.now();
  return true;
}

export function kickGuildMemberForProfile(
  profile: PlayerProfile,
  memberId: string,
  recordTransaction: GuildTransactionRecorder
): boolean {
  if (!profile.guildMembership) {
    joinGuildForProfile(profile);
  }
  const membership = profile.guildMembership!;
  membership.permissions = guildPermissionFlags(membership.roleId);
  if (!membership.permissions.kickMember) {
    throw new Error('协会权限不足');
  }
  if (memberId === profile.playerId) {
    throw new Error('不能移除自己');
  }
  membership.members = ensureGuildMembers(profile, membership.areaId, membership.members);
  const index = membership.members.findIndex((member) => member.playerId === memberId);
  if (index < 0) {
    throw new Error('协会成员不存在');
  }
  const before = membership.members.length;
  membership.members.splice(index, 1);
  recordTransaction(profile, `guild_member_kick:${profile.playerId}:${memberId}:${Date.now()}`, 'guild_member_kick', 'task', before, -1);
  profile.updatedAt = Date.now();
  return true;
}

export function updateGuildNoticeForProfile(
  profile: PlayerProfile,
  notice: string,
  recordTransaction: GuildTransactionRecorder
): boolean {
  if (!profile.guildMembership) {
    joinGuildForProfile(profile);
  }
  const membership = profile.guildMembership!;
  membership.permissions = guildPermissionFlags(membership.roleId);
  if (!membership.permissions.editNotice) {
    throw new Error('协会权限不足');
  }
  const nextNotice = sanitizeText(notice).trim().slice(0, 80);
  if ((membership.notice ?? '') === nextNotice) {
    return false;
  }
  const before = (membership.notice ?? '').length;
  membership.notice = nextNotice || undefined;
  profile.updatedAt = Date.now();
  recordTransaction(
    profile,
    `guild_notice:${profile.playerId}:${membership.guildId}:${profile.updatedAt}`,
    'guild_notice_update',
    'task',
    before,
    nextNotice.length - before
  );
  return true;
}

export function setGuildRoleForProfile(
  profile: PlayerProfile,
  roleId: string,
  recordTransaction: GuildTransactionRecorder
): boolean {
  if (!profile.guildMembership) {
    joinGuildForProfile(profile);
  }
  const role = GuildPermissions.find((row) => row.id === roleId);
  if (!role) {
    throw new Error('协会职位配置不存在');
  }
  const membership = profile.guildMembership!;
  membership.permissions = guildPermissionFlags(membership.roleId);
  if (!membership.permissions.changeRole) {
    throw new Error('协会权限不足');
  }
  if (membership.roleId === role.id) {
    return false;
  }
  const before = Number(membership.roleId) || 0;
  membership.roleId = role.id;
  membership.permissions = guildPermissionFlags(role.id);
  membership.members = ensureGuildMembers(profile, membership.areaId, membership.members);
  profile.updatedAt = Date.now();
  recordTransaction(profile, `guild_role:${profile.playerId}:${role.id}:${Date.now()}`, 'guild_role_change', 'task', before, (Number(role.id) || before) - before);
  return true;
}

export function donateGuildCoinsForProfile(
  profile: PlayerProfile,
  amount: number,
  applyNumberChange: GuildNumberChangeApplier
): void {
  const safeAmount = Math.max(100, Math.floor(amount));
  if (!profile.guildMembership) {
    joinGuildForProfile(profile);
  }
  if (profile.coins < safeAmount) {
    throw new Error('铜钱不足，无法捐献');
  }
  profile.guildMembership!.permissions = guildPermissionFlags(profile.guildMembership!.roleId);
  if (!profile.guildMembership!.permissions.donate) {
    throw new Error('协会权限不足');
  }
  applyNumberChange(profile, `guild:${profile.playerId}:${Date.now()}:coins`, 'guild_donate_spend', 'coins', -safeAmount);
  profile.guildMembership!.points += guildPointsForDonation(safeAmount);
  profile.guildMembership!.members = ensureGuildMembers(profile, profile.guildMembership!.areaId, profile.guildMembership!.members);
  profile.updatedAt = Date.now();
}

export function claimGuildResourceForProfile(
  profile: PlayerProfile,
  resourceId: string,
  recordTransaction: GuildTransactionRecorder
): void {
  if (!profile.guildMembership) {
    joinGuildForProfile(profile);
  }
  const resource = GuildResources.find((row) => row.id === resourceId);
  if (!resource) {
    throw new Error('协会资源配置不存在');
  }
  const membership = profile.guildMembership!;
  membership.permissions = guildPermissionFlags(membership.roleId);
  if (!membership.permissions.manageResource) {
    throw new Error('协会权限不足');
  }
  membership.resources ??= {};
  const before = membership.resources[resource.id] ?? 0;
  membership.resources[resource.id] = before + 1;
  recordTransaction(profile, `guild_resource:${profile.playerId}:${resource.id}:${membership.resources[resource.id]}`, 'guild_resource_claim', 'task', before, 1);
  profile.updatedAt = Date.now();
}

export function claimAreaResourceForProfile(
  profile: PlayerProfile,
  areaId: string | undefined,
  recordTransaction: GuildTransactionRecorder
): void {
  if (!profile.guildMembership) {
    joinGuildForProfile(profile, areaId);
  }
  const membership = profile.guildMembership!;
  const targetAreaId = areaId ?? membership.areaId;
  const guildArea = GuildArea.find((row) => row.id === targetAreaId);
  if (!guildArea) {
    throw new Error('协会地区配置不存在');
  }
  if (membership.areaId !== guildArea.id) {
    throw new Error('不在该协会地区');
  }
  const resourceId = guildArea.columns[3];
  const resource = GuildResources.find((row) => row.id === resourceId);
  if (!resource) {
    throw new Error('协会地区资源配置不存在');
  }
  membership.permissions = guildPermissionFlags(membership.roleId);
  if (!membership.permissions.manageResource) {
    throw new Error('协会权限不足');
  }
  membership.resources ??= {};
  const before = membership.resources[resource.id] ?? 0;
  membership.resources[resource.id] = before + 1;
  recordTransaction(
    profile,
    `guild_area_resource:${profile.playerId}:${guildArea.id}:${resource.id}:${membership.resources[resource.id]}`,
    'guild_area_resource_claim',
    'task',
    before,
    1
  );
  profile.updatedAt = Date.now();
}

export function useGuildResourceForProfile(
  profile: PlayerProfile,
  resourceId: string,
  quantity: number,
  recordTransaction: GuildTransactionRecorder
): void {
  if (!profile.guildMembership) {
    joinGuildForProfile(profile);
  }
  const resource = GuildResources.find((row) => row.id === resourceId);
  if (!resource) {
    throw new Error('协会资源配置不存在');
  }
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const membership = profile.guildMembership!;
  membership.permissions = guildPermissionFlags(membership.roleId);
  if (!membership.permissions.manageResource) {
    throw new Error('协会权限不足');
  }
  membership.resources ??= {};
  const before = membership.resources[resource.id] ?? 0;
  if (before < safeQuantity) {
    throw new Error('协会资源不足');
  }
  membership.resources[resource.id] = before - safeQuantity;
  recordTransaction(profile, `guild_resource_use:${profile.playerId}:${resource.id}:${Date.now()}`, 'guild_resource_use', 'task', before, -safeQuantity);
  profile.updatedAt = Date.now();
}

function ensureGuildMembers(
  profile: PlayerProfile,
  areaId: string,
  members: GuildMemberState[] | undefined
): GuildMemberState[] {
  const nextMembers = members ? [...members] : [];
  const selfIndex = nextMembers.findIndex((member) => member.playerId === profile.playerId);
  const self: GuildMemberState = {
    playerId: profile.playerId,
    name: profile.name,
    roleId: profile.guildMembership?.roleId ?? '1',
    areaId,
    points: profile.guildMembership?.points ?? Math.max(10, profile.completedMatches.length * 10 + profile.codex.length),
    status: 'member',
    joinedAt: profile.guildMembership?.joinedAt ?? Date.now()
  };
  if (selfIndex >= 0) {
    nextMembers[selfIndex] = { ...nextMembers[selfIndex], ...self };
  } else {
    nextMembers.unshift(self);
  }
  return nextMembers;
}
