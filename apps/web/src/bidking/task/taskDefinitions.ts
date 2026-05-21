import {
  Mission as bidKingMissions,
  bidKingMissionDisplayDesc,
  bidKingMissionDisplayName
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile } from '@bitkingdom/shared';
import { safeBidKingDisplayText } from '../system/bidKingSystemRuntime';

type MissionSource = (typeof bidKingMissions)[number];

export interface TaskDefinition {
  id: string;
  label: string;
  source: MissionSource;
  group: number;
  type: number;
  refreshType: number;
  order: number;
}

export const taskDefinitions: TaskDefinition[] = bidKingMissions
  .filter((mission) => mission.display > 0 || mission.reward.length > 0 || mission.conditions.length > 0 || mission.refreshtype > 0)
  .map((mission, index) => ({
    id: String(mission.Id),
    label: safeBidKingDisplayText(bidKingMissionDisplayName(mission), `委托 ${mission.Id}`) || `委托 ${mission.Id}`,
    source: mission,
    group: mission.group,
    type: mission.type,
    refreshType: mission.refreshtype,
    order: index
  }))
  .sort((left, right) => taskGroupRank(left) - taskGroupRank(right) || left.group - right.group || left.source.Id - right.source.Id);

export function taskBoardDefinitions(profile: PlayerProfile, limit = 6): TaskDefinition[] {
  return [...taskDefinitions]
    .sort((left, right) => taskProgressRank(profile, left) - taskProgressRank(profile, right) || left.order - right.order)
    .slice(0, limit);
}

export function taskRewardText(taskId: string): string {
  const task = taskDefinitions.find((entry) => entry.id === taskId);
  return safeBidKingDisplayText(task?.source ? bidKingMissionDisplayDesc(task.source) : '', '完成后推进掌柜成长。') || '完成后推进掌柜成长。';
}

function taskProgressRank(profile: PlayerProfile, task: TaskDefinition): number {
  const progress = profile.missionProgress?.[task.id];
  if (progress?.claimable) {
    return 0;
  }
  if (progress?.completed && !progress.claimed) {
    return 1;
  }
  if (task.refreshType > 0 && !progress?.claimed) {
    return 2;
  }
  if (progress && !progress.completed) {
    return 3;
  }
  return 4 + taskGroupRank(task);
}

function taskGroupRank(task: TaskDefinition): number {
  if (task.refreshType === 1) {
    return 0;
  }
  if (task.refreshType === 2) {
    return 1;
  }
  if (task.source.steamachievement > 0 || task.group > 0) {
    return 2;
  }
  return 3;
}
