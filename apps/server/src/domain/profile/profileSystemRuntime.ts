import { Guide, Notice } from '@bitkingdom/bidking-compat';
import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { sanitizeDisplayName } from '../system/textGuard';
import { languageNameFromSeed } from './languageNameRuntime';

export type ProfileTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export function markNoticeReadForProfile(
  profile: PlayerProfile,
  noticeId: string,
  recordTransaction: ProfileTransactionRecorder
): boolean {
  const notice = Notice.find((row) => row.id === noticeId);
  if (!notice) {
    throw new Error('公告配置不存在');
  }
  profile.readNotices ??= [];
  if (profile.readNotices.includes(notice.id)) {
    return false;
  }
  profile.readNotices.push(notice.id);
  recordTransaction(profile, `notice:${profile.playerId}:${notice.id}:read`, 'notice_read', 'task', 0, 1);
  profile.updatedAt = Date.now();
  return true;
}

export function completeGuideForProfile(
  profile: PlayerProfile,
  guideId: string,
  recordTransaction: ProfileTransactionRecorder
): boolean {
  const guide = Guide.find((row) => row.id === guideId);
  if (!guide) {
    throw new Error('引导配置不存在');
  }
  profile.completedGuides ??= [];
  if (profile.completedGuides.includes(guide.id)) {
    return false;
  }
  profile.completedGuides.push(guide.id);
  recordTransaction(profile, `guide:${profile.playerId}:${guide.id}:complete`, 'guide_complete', 'task', 0, 1);
  profile.updatedAt = Date.now();
  return true;
}

export function applyLanguageNameToProfile(
  profile: PlayerProfile,
  seed: number,
  recordTransaction: ProfileTransactionRecorder
): void {
  const nextName = languageNameFromSeed(seed);
  profile.name = sanitizeDisplayName(nextName, profile.name);
  profile.updatedAt = Date.now();
  recordTransaction(profile, `language_name:${profile.playerId}:${seed}`, 'language_name_apply', 'task', 0, 1);
}
