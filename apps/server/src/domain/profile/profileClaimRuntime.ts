import { Activity, GiftPackage, Mail, Pay, activityClaimState } from '@bitkingdom/bidking-compat';
import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { activityRewardRows as profileActivityRewardRows, giftPackageRewards } from './profileRewardCatalog';
import { isMailExpired, mailAttachmentRewards } from './profileMailRuntime';

export type ClaimRewardRowsApplier = (
  profile: PlayerProfile,
  sourcePrefix: string,
  rewards: readonly (readonly number[])[],
  reason: string
) => void;

export type ClaimTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export type ClaimSourceChecker = (sourceId: string) => boolean;

export function claimMailForProfile(
  profile: PlayerProfile,
  mailId: string,
  applyRewardRows: ClaimRewardRowsApplier,
  recordTransaction: ClaimTransactionRecorder
): void {
  const mail = profile.mail.find((candidate) => candidate.id === mailId);
  if (!mail) {
    throw new Error('邮件不存在');
  }
  if (isMailExpired(mail)) {
    throw new Error('邮件已过期');
  }
  mail.read = true;
  if (!mail.claimed) {
    mail.claimed = true;
    const template = Mail.find((row) => row.id === mail.templateId);
    applyRewardRows(profile, `mail:${profile.playerId}:${mail.id}`, mailAttachmentRewards(template), 'mail_reward');
    recordTransaction(profile, `mail:${profile.playerId}:${mail.id}:claim`, 'mail_claim', 'mail', 0, 1);
  }
  profile.updatedAt = Date.now();
}

export function markMailReadForProfile(
  profile: PlayerProfile,
  mailId: string,
  recordTransaction: ClaimTransactionRecorder
): boolean {
  const mail = profile.mail.find((candidate) => candidate.id === mailId);
  if (!mail) {
    throw new Error('邮件不存在');
  }
  if (mail.read) {
    return false;
  }
  mail.read = true;
  profile.updatedAt = Date.now();
  recordTransaction(profile, `mail:${profile.playerId}:${mail.id}:read`, 'mail_read', 'mail', 0, 1);
  return true;
}

export function deleteMailForProfile(
  profile: PlayerProfile,
  mailId: string,
  recordTransaction: ClaimTransactionRecorder
): boolean {
  const mailIndex = profile.mail.findIndex((candidate) => candidate.id === mailId);
  const mail = profile.mail[mailIndex];
  if (!mail) {
    throw new Error('邮件不存在');
  }
  const template = Mail.find((row) => row.id === mail.templateId);
  if (!mail.claimed && !isMailExpired(mail) && mailAttachmentRewards(template).length > 0) {
    throw new Error('邮件附件未领取');
  }
  profile.deletedMailTemplateIds ??= [];
  if (!profile.deletedMailTemplateIds.includes(mail.templateId)) {
    profile.deletedMailTemplateIds.push(mail.templateId);
  }
  profile.mail.splice(mailIndex, 1);
  profile.updatedAt = Date.now();
  recordTransaction(profile, `mail:${profile.playerId}:${mail.id}:delete`, 'mail_delete', 'mail', 1, -1);
  return true;
}

export function claimActivityRewardForProfile(
  profile: PlayerProfile,
  activityId: string,
  applyRewardRows: ClaimRewardRowsApplier
): boolean {
  const activity = Activity.find((row) => row.id === activityId);
  if (!activity) {
    throw new Error('活动配置不存在');
  }
  const state = activityClaimState(activity, {
    claimed: profile.claimedActivityRewards.includes(activityId),
    profileCreatedAt: profile.createdAt
  });
  if (state.claimed) {
    return false;
  }
  if (!state.active) {
    throw new Error('活动已过期');
  }
  if (!state.hasReward) {
    throw new Error('活动无可领取奖励');
  }
  applyRewardRows(profile, `activity:${profile.playerId}:${activityId}`, profileActivityRewardRows(activity), 'activity_reward');
  profile.claimedActivityRewards.push(activityId);
  profile.updatedAt = Date.now();
  return true;
}

export function claimGiftPackageForProfile(
  profile: PlayerProfile,
  packageId: string,
  applyRewardRows: ClaimRewardRowsApplier,
  recordTransaction: ClaimTransactionRecorder,
  hasTransactionSource: ClaimSourceChecker
): boolean {
  const giftPackage = GiftPackage.find((row) => row.id === packageId);
  if (!giftPackage) {
    throw new Error('礼包配置不存在');
  }
  const sourceId = `gift_package:${profile.playerId}:${giftPackage.id}:claim`;
  profile.claimedGiftPackages ??= [];
  if (profile.claimedGiftPackages.includes(packageId)) {
    return false;
  }
  const payId = giftPackagePayId(giftPackage);
  if (payId) {
    const pay = Pay.find((row) => row.id === payId);
    if (!pay) {
      throw new Error('礼包充值档位不存在');
    }
    const paid = profile.purchaseOrders?.some(
      (order) => order.source === 'pay' && order.refId === pay.id && order.status === 'completed'
    );
    if (!paid) {
      throw new Error('礼包对应充值未到账');
    }
  }
  if (hasTransactionSource(sourceId)) {
    profile.claimedGiftPackages.push(packageId);
    profile.updatedAt = Date.now();
    return true;
  }
  applyRewardRows(profile, `gift_package:${profile.playerId}:${giftPackage.id}`, giftPackageRewards(giftPackage), 'gift_package_reward');
  recordTransaction(profile, sourceId, 'gift_package_claim', 'task', 0, 1);
  profile.claimedGiftPackages.push(packageId);
  profile.updatedAt = Date.now();
  return true;
}

function giftPackagePayId(row: (typeof GiftPackage)[number]): string | undefined {
  const payId = String(row.columns[6] ?? '').trim();
  return payId || undefined;
}
