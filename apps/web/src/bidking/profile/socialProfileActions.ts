import type { PostProfileAction } from './profileActionClient';

export interface SocialProfileActions {
  approveGuildMember: (applicantId: string) => void;
  claimAreaResource: (areaId?: string) => void;
  claimGuildResource: (resourceId: string) => void;
  donateGuildCoins: (amount: number) => void;
  joinGuild: (areaId?: string) => void;
  kickGuildMember: (memberId: string) => void;
  removeFriend: (friendId: string) => void;
  setFriendRemark: (friendId: string, remark: string) => void;
  setGuildRole: (roleId: string) => void;
  updateGuildNotice: (notice: string) => void;
  useGuildResource: (resourceId: string, quantity?: number) => void;
}

export function createSocialProfileActions(postProfileAction: PostProfileAction): SocialProfileActions {
  return {
    approveGuildMember: (applicantId) => {
      postProfileAction('/api/guild/member/approve', { applicantId });
    },
    claimAreaResource: (areaId) => {
      postProfileAction('/api/guild/area/resource/claim', { areaId });
    },
    claimGuildResource: (resourceId) => {
      postProfileAction('/api/guild/resource/claim', { resourceId });
    },
    donateGuildCoins: (amount) => {
      postProfileAction('/api/guild/donate', { amount });
    },
    joinGuild: (areaId) => {
      postProfileAction('/api/guild/join', { areaId });
    },
    kickGuildMember: (memberId) => {
      postProfileAction('/api/guild/member/kick', { memberId });
    },
    removeFriend: (friendId) => {
      postProfileAction('/api/social/friend/remove', { friendId });
    },
    setFriendRemark: (friendId, remark) => {
      postProfileAction('/api/social/friend/remark', { friendId, remark });
    },
    setGuildRole: (roleId) => {
      postProfileAction('/api/guild/role', { roleId });
    },
    updateGuildNotice: (notice) => {
      postProfileAction('/api/guild/notice', { notice });
    },
    useGuildResource: (resourceId, quantity = 1) => {
      postProfileAction('/api/guild/resource/use', { resourceId, quantity });
    }
  };
}
