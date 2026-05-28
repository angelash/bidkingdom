import { ListChecks } from 'lucide-react';
import type { PlayerProfile } from '@bitkingdom/shared';
import { TaskDetailPanel } from './TaskDetailPanel';
import { taskBoardDefinitions } from './taskDefinitions';

export default function TaskHubPanel({
  profile,
  onClaimMissionReward,
  onClaimAchievementReward,
  onClaimLevelReward
}: {
  profile: PlayerProfile;
  onClaimMissionReward: (taskId: string) => void;
  onClaimAchievementReward: (achievementId: string) => void;
  onClaimLevelReward: (level: number) => void;
}): JSX.Element {
  return (
    <div className="task-modal-combo">
      <TaskDetailPanel
        profile={profile}
        onClaimMissionReward={onClaimMissionReward}
        onClaimAchievementReward={onClaimAchievementReward}
        onClaimLevelReward={onClaimLevelReward}
      />
      <TaskBoard profile={profile} />
    </div>
  );
}

function TaskBoard({ profile }: { profile: PlayerProfile }): JSX.Element {
  return (
    <section className="task-board">
      <div className="section-title small">
        <ListChecks size={16} />
        <h3>每日/名望委托</h3>
      </div>
      {taskBoardDefinitions(profile).map((task) => {
        const progress = profile.missionProgress?.[task.id];
        const done = progress?.completed ?? profile.completedTasks.includes(task.id);
        const claimable = progress?.claimable ?? false;
        return (
          <div className={`task-row ${done ? 'done' : ''} ${claimable ? 'claimable' : ''}`} key={task.id}>
            <span>{claimable ? '!' : done ? '✓' : '·'}</span>
            <p>{task.label}</p>
          </div>
        );
      })}
    </section>
  );
}
