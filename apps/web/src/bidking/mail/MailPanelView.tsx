import {
  Mail as bidKingMails,
  bidKingRawTableDisplayDesc,
  bidKingRawTableDisplayName,
  type BidKingRawTableRow
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile } from '@bitkingdom/shared';
import { safeBidKingDisplayText } from '../system/bidKingSystemRuntime';
import { bidKingRewardRowsLabel, parseBidKingRewardRows } from '../system/rewardText';

interface MailPanelViewProps {
  profile: PlayerProfile;
  onClaimMail: (mailId: string) => void;
  onDeleteMail: (mailId: string) => void;
  onMarkMailRead: (mailId: string) => void;
}

export function MailPanelView({ profile, onClaimMail, onDeleteMail, onMarkMailRead }: MailPanelViewProps): JSX.Element {
  return (
    <div className="config-table-panel config-grid-panel">
      <header>
        <strong>信札</strong>
        <span>{profile.mail.length} 封 · 信札模板 {bidKingMails.length} 道</span>
      </header>
      {profile.mail.map((mail) => {
        const expired = mail.expiresAt !== undefined && mail.expiresAt <= Date.now();
        const template = bidKingMails.find((row) => row.id === mail.templateId);
        return (
          <article className={`${mail.read ? 'claimed' : 'claimable'} ${expired ? 'expired' : ''}`} key={mail.id}>
            <strong>{template ? bidKingRawTableDisplayName(template) : safeBidKingDisplayText(mail.title, '珍宝局信札') || '珍宝局信札'}</strong>
            <p>{template ? bidKingRawTableDisplayDesc(template) : safeBidKingDisplayText(mail.body, '珍宝局信札内容已同步到本地信箱。') || '珍宝局信札内容已同步到本地信箱。'}</p>
            <em>
              {mail.read ? '已读' : '未读'} · {mail.attachmentSummary}
              {mail.expiresAt ? ` · ${expired ? '已过期' : `有效至 ${new Date(mail.expiresAt).toLocaleDateString()}`}` : ''}
            </em>
            <div className="purchase-action-row">
              <button disabled={mail.read} onClick={() => onMarkMailRead(mail.id)} type="button">
                {mail.read ? '已读' : '阅毕'}
              </button>
              <button disabled={mail.claimed || expired} onClick={() => onClaimMail(mail.id)} type="button">
                {mail.claimed ? '已领取' : expired ? '已过期' : '领取'}
              </button>
              <button onClick={() => onDeleteMail(mail.id)} type="button">归档</button>
            </div>
          </article>
        );
      })}
      {profile.mail.length === 0 && bidKingMails.slice(0, 6).map((mail) => (
        <article key={mail.id}>
          <strong>{bidKingRawTableDisplayName(mail)}</strong>
          <p>{bidKingRawTableDisplayDesc(mail)}</p>
          <em>附件：{mailAttachmentLabel(mail)}</em>
        </article>
      ))}
    </div>
  );
}

function mailAttachmentLabel(row: BidKingRawTableRow): string {
  return bidKingRewardRowsLabel(parseBidKingRewardRows(rawColumn(row, 7)), '无附件');
}

function rawColumn(row: BidKingRawTableRow, index: number): string {
  return row.columns[index] ?? '';
}
