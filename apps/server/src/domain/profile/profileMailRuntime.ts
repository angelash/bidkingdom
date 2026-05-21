import { Mail } from '@bitkingdom/bidking-compat';
import { bidKingMailMaxCount, parseBidKingNumberRows } from '@bitkingdom/match-core';
import type { MailInboxItem, PlayerProfile } from '@bitkingdom/shared';

type RewardRowSource = {
  id?: string;
  columns: readonly string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const rawMailTextPattern = /(?:mail|text|ui)_[a-z0-9_]+|配置行\s+\d+，保留结构、数值和资源键，显示文本使用本项目包装。/i;

export function mailAttachmentRewards(row?: RewardRowSource): number[][] {
  return parseBidKingNumberRows(row?.columns[7]);
}

export function mailAttachmentSummary(row: RewardRowSource): string {
  const rewards = mailAttachmentRewards(row);
  if (rewards.length === 0) {
    return '无附件';
  }
  return rewards
    .map(([type = 0, refId = 0, quantity = 1]) => `类型${type}:${refId} x${quantity}`)
    .join(' / ');
}

export function ensureStarterMail(profile: PlayerProfile): void {
  profile.deletedMailTemplateIds ??= [];
  for (const mail of profile.mail) {
    if (mail.expiresAt === undefined) {
      mail.expiresAt = mailExpiresAt(Mail.find((row) => row.id === mail.templateId), mail.createdAt);
    }
  }
}

export function addMailFromTemplate(profile: PlayerProfile, templateId: string, sourceKey = templateId): MailInboxItem | undefined {
  const row = Mail.find((candidate) => candidate.id === templateId);
  if (!row) {
    return undefined;
  }
  const mailId = `mail_${row.id}_${profile.playerId}_${sourceKey}`;
  if (profile.mail.some((mail) => mail.id === mailId)) {
    return undefined;
  }
  if (profile.mail.length >= bidKingMailMaxCount()) {
    return undefined;
  }
  const createdAt = Date.now();
  const mail: MailInboxItem = {
    id: mailId,
    templateId: row.id,
    title: mailTitle(row),
    body: mailBody(row),
    read: false,
    claimed: false,
    attachmentSummary: mailAttachmentSummary(row),
    createdAt,
    expiresAt: mailExpiresAt(row, createdAt)
  };
  profile.mail.unshift(mail);
  profile.updatedAt = createdAt;
  return mail;
}

export function mailExpiresAt(row: RewardRowSource | undefined, createdAt: number): number | undefined {
  const days = Number(row?.columns[8] ?? 0);
  return Number.isFinite(days) && days > 0 ? createdAt + days * DAY_MS : undefined;
}

export function isMailExpired(mail: MailInboxItem, now = Date.now()): boolean {
  return mail.expiresAt !== undefined && mail.expiresAt <= now;
}

function mailTitle(row: RewardRowSource): string {
  return safeMailText((row as { packaged_name?: string }).packaged_name ?? '') || `系统邮件 ${row.id ?? ''}`.trim();
}

function mailBody(row: RewardRowSource): string {
  return safeMailText((row as { packaged_desc?: string }).packaged_desc ?? '')
    || safeMailText(row.columns[6] ?? '')
    || '系统邮件内容已同步到本地信箱。';
}

function safeMailText(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || rawMailTextPattern.test(normalized)) {
    return '';
  }
  return normalized;
}
