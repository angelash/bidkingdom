import type { PostProfileAction } from './profileActionClient';

export interface ProgressProfileActions {
  claimAchievementReward: (achievementId: string) => void;
  claimActivityReward: (activityId: string) => void;
  claimLevelReward: (level: number) => void;
  claimMail: (mailId: string) => void;
  deleteMail: (mailId: string) => void;
  claimMissionReward: (taskId: string) => void;
  claimRankReward: (rank: number) => void;
  equipBattleItems: (itemIds: number[]) => void;
  markMailRead: (mailId: string) => void;
}

export function createProgressProfileActions(postProfileAction: PostProfileAction): ProgressProfileActions {
  return {
    claimAchievementReward: (achievementId) => {
      postProfileAction('/api/achievement/claim', { achievementId });
    },
    claimActivityReward: (activityId) => {
      postProfileAction('/api/activity/claim', { activityId });
    },
    claimLevelReward: (level) => {
      postProfileAction('/api/level/reward/claim', { level });
    },
    claimMail: (mailId) => {
      postProfileAction('/api/mail/claim', { mailId });
    },
    deleteMail: (mailId) => {
      postProfileAction('/api/mail/delete', { mailId });
    },
    claimMissionReward: (taskId) => {
      postProfileAction('/api/mission/claim', { taskId });
    },
    claimRankReward: (rank) => {
      postProfileAction('/api/rank/claim', { rank });
    },
    equipBattleItems: (itemIds) => {
      postProfileAction('/api/battle/items/equip', { itemIds });
    },
    markMailRead: (mailId) => {
      postProfileAction('/api/mail/read', { mailId });
    }
  };
}
