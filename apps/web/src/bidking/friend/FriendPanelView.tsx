import { useEffect, useState } from 'react';
import { MessageCircle, Save, UserPlus, X } from 'lucide-react';
import {
  GuildArea as bidKingGuildAreas,
  Head as bidKingHeads,
  bidKingRawTableDisplayName,
  type BidKingRawTableRow
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile } from '@bitkingdom/shared';
import { socialEmojiActionsForProfile, type SocialEmojiAction } from './emojiSocialRuntime';

interface FriendPanelViewProps {
  profile: PlayerProfile;
  onAddDemoFriend: () => void;
  onRemoveFriend: (friendId: string) => void;
  onSetFriendRemark: (friendId: string, remark: string) => void;
  onSelectHead: (headId: string) => void;
}

export function FriendPanelView({
  profile,
  onAddDemoFriend,
  onRemoveFriend,
  onSetFriendRemark,
  onSelectHead
}: FriendPanelViewProps): JSX.Element {
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const emojiActions = socialEmojiActionsForProfile(profile);
  const [selectedEmojiId, setSelectedEmojiId] = useState(emojiActions[0]?.id ?? '');
  const [socialPreview, setSocialPreview] = useState<{ friendId: string; action: SocialEmojiAction; sentAt: number }>();
  const selectedEmoji = emojiActions.find((action) => action.id === selectedEmojiId) ?? emojiActions[0];

  useEffect(() => {
    setRemarks(Object.fromEntries(profile.friends.map((friend) => [friend.id, friend.remark ?? ''])));
  }, [profile.friends]);

  return (
    <div className="config-table-panel config-grid-panel">
      <header>
        <strong>同游名册</strong>
        <span>{profile.friends.length} 位同游 · {bidKingHeads.length} 枚头像</span>
      </header>
      <article>
        <strong>同游列表</strong>
        <p>{profile.friends.length > 0 ? `${profile.friends.length} 位同游已入名册` : '暂无同游'}</p>
        <em>头像 {bidKingHeads.length} 枚 · 地区 {bidKingGuildAreas.length} 处</em>
        <button onClick={onAddDemoFriend} type="button">
          <UserPlus size={16} />
          添加同游
        </button>
      </article>
      <article className="social-emoji-panel">
        <strong>同游表情</strong>
        <p>{emojiActions.length} 个表情 · {emojiActions.filter((action) => action.visualClass === 'projectile').length} 个动效</p>
        <div className="social-emoji-palette">
          {emojiActions.map((action) => (
            <button
              className={`${selectedEmoji?.id === action.id ? 'active' : ''} emote-${action.visualClass}`}
              disabled={action.disabled}
              key={action.id}
              onClick={() => setSelectedEmojiId(action.id)}
              title={action.title}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      </article>
      {profile.friends.map((friend) => {
        const head = bidKingHeads.find((row) => row.id === friend.headId);
        const area = bidKingGuildAreas.find((row) => row.id === friend.areaId);
        const preview = socialPreview?.friendId === friend.id ? socialPreview : undefined;
        return (
          <article key={friend.id}>
            <strong>{friend.name}</strong>
            <p>{area ? bidKingRawTableDisplayName(area) : `会馆地区${friend.areaId}`} · {head ? bidKingRawTableDisplayName(head) : `头像${friend.headId}`}</p>
            {friend.remark && <p>备注：{friend.remark}</p>}
            <em>{new Date(friend.createdAt).toLocaleString()}</em>
            {preview && (
              <div
                className={`social-emoji-burst emote-${preview.action.visualClass}`}
                key={`${preview.friendId}_${preview.action.id}_${preview.sentAt}`}
                title={preview.action.title}
              >
                <MessageCircle size={16} />
                <strong>{preview.action.label}</strong>
              </div>
            )}
            <label>
              同游备注
              <input
                aria-label={`同游备注 ${friend.name}`}
                maxLength={40}
                value={remarks[friend.id] ?? ''}
                onChange={(event) => {
                  const nextRemark = event.currentTarget.value;
                  setRemarks((current) => ({ ...current, [friend.id]: nextRemark }));
                }}
              />
            </label>
            <button onClick={() => onSetFriendRemark(friend.id, remarks[friend.id] ?? '')} type="button">
              <Save size={16} />
              保存备注
            </button>
            <button
              disabled={!selectedEmoji || selectedEmoji.disabled}
              onClick={() => selectedEmoji && setSocialPreview({ friendId: friend.id, action: selectedEmoji, sentAt: Date.now() })}
              title={selectedEmoji?.title}
              type="button"
            >
              <MessageCircle size={16} />
              发送表情
            </button>
            <button onClick={() => onRemoveFriend(friend.id)} type="button">
              <X size={16} />
              移出名册
            </button>
          </article>
        );
      })}
      {bidKingHeads.slice(0, 24).map((head) => (
        <article className={profile.headId === head.id ? 'claimed' : ''} key={head.id}>
          <strong>{bidKingRawTableDisplayName(head)}</strong>
          <p>{headVisualLabel(head)}</p>
          <button disabled={profile.headId === head.id} onClick={() => onSelectHead(head.id)} type="button">
            {profile.headId === head.id ? '已佩戴' : '佩戴头像'}
          </button>
        </article>
      ))}
    </div>
  );
}

function headVisualLabel(row: BidKingRawTableRow): string {
  const typeLabel = rawColumn(row, 3) === '2' ? '名牌' : '头像';
  const stateLabel = rawColumn(row, 9) === '1' ? '可佩戴' : '未开放';
  return `${typeLabel}外观 · ${stateLabel} · 自有头像替代`;
}

function rawColumn(row: BidKingRawTableRow, index: number): string {
  return row.columns[index] ?? '';
}
