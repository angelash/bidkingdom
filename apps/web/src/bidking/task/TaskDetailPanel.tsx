import {
  Achievement as bidKingAchievements,
  Item as bidKingCompatItems,
  LevelUp as bidKingLevelUps,
  bidKingItemDisplayName,
  bidKingLevelUpDisplayName,
  bidKingRawTableDisplayDesc,
  bidKingRawTableDisplayName
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile } from '@bitkingdom/shared';
import { taskDefinitions, taskRewardText } from './taskDefinitions';

interface TaskDetailPanelProps {
  profile: PlayerProfile;
  onClaimMissionReward: (taskId: string) => void;
  onClaimAchievementReward: (achievementId: string) => void;
  onClaimLevelReward: (level: number) => void;
}

export function TaskDetailPanel({
  profile,
  onClaimMissionReward,
  onClaimAchievementReward,
  onClaimLevelReward
}: TaskDetailPanelProps): JSX.Element {
  return (
    <div className="task-detail-panel">
      <section className="config-table-panel mission-table-panel">
        <header>
          <strong>珍宝局委托</strong>
          <span>{taskDefinitions.length} 道委托</span>
        </header>
        {taskDefinitions.map((task) => {
          const progress = profile.missionProgress?.[task.id];
          const done = progress?.completed ?? profile.completedTasks.includes(task.id);
          const claimed = progress?.claimed ?? profile.claimedMissionRewards.includes(task.id);
          const claimable = progress?.claimable ?? (done && !claimed);
          return (
            <div
              className={`task-detail-row ${done ? 'done' : ''} ${claimed ? 'claimed' : ''} ${claimable ? 'claimable' : ''}`}
              key={task.id}
            >
              <span>{claimable ? '!' : done ? '✓' : '·'}</span>
              <div>
                <strong>{task.label}</strong>
                <p>{taskRewardText(task.id)}</p>
                <em>
                  {progress ? missionProgressText(progress) : '尚无进度快照'}
                  {' · '}
                  委托号 {task.source.Id}
                  {task.refreshType ? ` · ${task.refreshType === 2 ? '周课' : '日课'}` : ''}
                  {task.group ? ` · 谱系 ${task.group}` : ''}
                </em>
              </div>
              <button disabled={!claimable} onClick={() => onClaimMissionReward(task.id)} type="button">
                {claimed ? '已领' : claimable ? '领取' : done ? '完成' : '进行中'}
              </button>
            </div>
          );
        })}
      </section>
      <section className="config-table-panel">
        <header>
          <strong>名望成就</strong>
          <span>{bidKingAchievements.length} 道成就</span>
        </header>
        {bidKingAchievements.map((achievement) => {
          const missionIds = achievementMissionIds(achievement);
          const progress = profile.achievementProgress?.[achievement.id];
          const claimedCount = progress?.claimed ?? missionIds.filter((missionId) => profile.claimedAchievements?.includes(String(missionId))).length;
          const completedCount = progress?.completed ?? claimedCount;
          const total = progress?.total ?? (missionIds.length || 1);
          const complete = missionIds.length > 0 && claimedCount >= missionIds.length;
          const claimable = progress?.claimable ?? !complete;
          return (
            <article className={`${complete ? 'claimed' : ''} ${claimable ? 'claimable' : ''}`} key={achievement.id}>
              <strong>{bidKingRawTableDisplayName(achievement)}</strong>
              <p>{bidKingRawTableDisplayDesc(achievement)}</p>
              <em>完成 {completedCount}/{total} · 已领 {claimedCount}</em>
              <button disabled={!claimable} onClick={() => onClaimAchievementReward(achievement.id)} type="button">
                {complete ? '已领完' : claimable ? '领取' : '进行中'}
              </button>
            </article>
          );
        })}
      </section>
      <section className="config-table-panel">
        <header>
          <strong>掌柜等级赏</strong>
          <span>当前 Lv.{profile.level}</span>
        </header>
        {bidKingLevelUps.map((row) => {
          const claimed = profile.claimedLevelRewards?.includes(row.id) ?? false;
          const canClaim = profile.level >= row.id;
          return (
            <article className={claimed ? 'claimed' : ''} key={row.id}>
              <strong>{bidKingLevelUpDisplayName(row)}</strong>
              <p>{levelRewardLabel(row)}</p>
              <em>升阶门槛 {row.collection_value}</em>
              <button disabled={!canClaim || claimed} onClick={() => onClaimLevelReward(row.id)} type="button">
                {claimed ? '已领取' : canClaim ? '领取' : '未达成'}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function achievementMissionIds(row: { columns: readonly string[] }): number[] {
  const raw = rawColumn(row, 5);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'number')) {
      return parsed;
    }
  } catch {
    return [];
  }
  return [];
}

function levelRewardLabel(row: (typeof bidKingLevelUps)[number]): string {
  return [...row.level_reward, ...row.bass_reward, ...row.big_bass_reward]
    .filter(([refId = 0, quantity = 0]) => refId > 0 && quantity > 0)
    .map(([refId = 0, quantity = 1]) => {
      if (refId === 1) {
        return `铜钱 x${quantity.toLocaleString()}`;
      }
      const item = bidKingCompatItems.find((candidate) => candidate.id === refId);
      return `${item ? bidKingItemDisplayName(item) : `珍物${refId}`} x${quantity}`;
    })
    .join('、') || '无奖励';
}

function missionProgressText(progress: { current: number; required: number; refreshType?: number; resetAt?: number; reason?: string }): string {
  const current = Math.min(progress.current, progress.required);
  const value = `进度 ${current}/${progress.required}`;
  const reset = progress.resetAt ? ` · ${progress.refreshType === 2 ? '周课' : '日课'}重置 ${new Date(progress.resetAt).toLocaleDateString()}` : '';
  return progress.reason ? `${value}${reset} · ${progress.reason}` : `${value}${reset}`;
}

function rawColumn(row: { columns: readonly string[] }, index: number): string {
  return row.columns[index] ?? '';
}
