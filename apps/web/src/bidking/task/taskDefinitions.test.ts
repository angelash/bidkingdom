import { Mission as bidKingMissions } from '@bitkingdom/bidking-compat';
import type { PlayerProfile } from '@bitkingdom/shared';
import { describe, expect, it } from 'vitest';
import { taskBoardDefinitions, taskDefinitions } from './taskDefinitions';

describe('BidKing task definitions', () => {
  it('projects every actionable Mission row into the task UI model', () => {
    const actionableMissions = bidKingMissions.filter(
      (mission) => mission.display > 0 || mission.reward.length > 0 || mission.conditions.length > 0 || mission.refreshtype > 0
    );

    expect(taskDefinitions).toHaveLength(actionableMissions.length);
    expect(new Set(taskDefinitions.map((task) => task.id))).toEqual(
      new Set(actionableMissions.map((mission) => String(mission.Id)))
    );
    expect(taskDefinitions.every((task) => task.source.Id === Number(task.id))).toBe(true);
  });

  it('keeps red point missions visible on compact task boards', () => {
    const claimableTask = taskDefinitions.at(-1)!;
    const profile = {
      missionProgress: {
        [claimableTask.id]: {
          taskId: claimableTask.id,
          missionId: claimableTask.source.Id,
          current: 1,
          required: 1,
          completed: true,
          claimed: false,
          claimable: true,
          redPoint: true
        }
      }
    } as PlayerProfile;

    expect(taskBoardDefinitions(profile, 1)[0]?.id).toBe(claimableTask.id);
  });
});
