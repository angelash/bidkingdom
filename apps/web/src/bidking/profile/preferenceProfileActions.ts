import type { PostProfileAction } from './profileActionClient';

export interface PreferenceProfileActions {
  applyLanguageName: () => void;
  claimCollectionIncome: () => void;
  claimReliefFund: () => void;
  completeGuide: (guideId: string) => void;
  markNoticeRead: (noticeId: string) => void;
  selectHead: (headId: string) => void;
  selectHeroSkin: (skinId: number) => void;
  clearCabinetItem: (itemId: string) => void;
  setCabinetItem: (itemId: string) => void;
  sellCabinetItem: (refId: string, quantity: number) => void;
  sellAllCabinetItems: () => void;
  updateProfileSettings: (settings: Record<string, string | number | boolean>) => void;
}

export function createPreferenceProfileActions(postProfileAction: PostProfileAction): PreferenceProfileActions {
  return {
    applyLanguageName: () => {
      postProfileAction('/api/profile/language-name', { seed: Date.now() });
    },
    claimCollectionIncome: () => {
      postProfileAction('/api/profile/collection-income/claim', {});
    },
    claimReliefFund: () => {
      postProfileAction('/api/profile/relief-fund/claim', {});
    },
    completeGuide: (guideId) => {
      postProfileAction('/api/guide/complete', { guideId });
    },
    markNoticeRead: (noticeId) => {
      postProfileAction('/api/notice/read', { noticeId });
    },
    selectHead: (headId) => {
      postProfileAction('/api/profile/head/select', { headId });
    },
    selectHeroSkin: (skinId) => {
      postProfileAction('/api/hero-skin/select', { skinId });
    },
    clearCabinetItem: (itemId) => {
      postProfileAction('/api/cabinet/clear', { itemId });
    },
    setCabinetItem: (itemId) => {
      postProfileAction('/api/cabinet/set', { itemId });
    },
    sellCabinetItem: (refId, quantity) => {
      postProfileAction('/api/cabinet/sell', { refId, quantity });
    },
    sellAllCabinetItems: () => {
      postProfileAction('/api/cabinet/sell-all', {});
    },
    updateProfileSettings: (settings) => {
      postProfileAction('/api/profile/settings', { settings });
    }
  };
}
