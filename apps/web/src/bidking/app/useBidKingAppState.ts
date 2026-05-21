import { useEffect, useState } from 'react';
import { gameConfig } from '@bitkingdom/config';
import type { CoreAuctionMode, PlayerProfile, ProfileSnapshot } from '@bitkingdom/shared';
import { fetchProfileSnapshot } from '../api/bidkingApiClient';
import {
  buildBidKingBattleMapGroups,
  loadSelectedBidMapId
} from '../battlePrev/bidMapRuntime';
import {
  loadCoreAuctionMode,
  loadProfile,
  loadProfileId,
  normalizeProfileForReview,
  saveProfile
} from '../profile/profileSession';

export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://127.0.0.1:8787';

export type AppView = 'play' | 'admin';

export const bidKingBattleMapGroups = buildBidKingBattleMapGroups();
export const defaultBidMapId = bidKingBattleMapGroups[0]?.children[0]?.id;

export function useBidKingAppState() {
  const [profileId] = useState(() => loadProfileId());
  const [playerName, setPlayerName] = useState(localStorage.getItem('bk_player_name') ?? '试拍掌柜');
  const [selectedRoleId, setSelectedRoleId] = useState(gameConfig.roles[0]!.id);
  const [view, setView] = useState<AppView>(() => (window.location.pathname === '/admin' ? 'admin' : 'play'));
  const [skillTargetId, setSkillTargetId] = useState<string>();
  const [botCount, setBotCount] = useState(3);
  const [coreAuctionMode, setCoreAuctionMode] = useState<CoreAuctionMode>(() => loadCoreAuctionMode());
  const [selectedBidMapId, setSelectedBidMapId] = useState<number | undefined>(() => loadSelectedBidMapId(defaultBidMapId));
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [tutorialDismissed, setTutorialDismissed] = useState(localStorage.getItem('bk_tutorial_dismissed') === '1');

  function applyProfileSnapshot(nextProfile?: ProfileSnapshot): void {
    if (!nextProfile) {
      return;
    }
    const normalized = normalizeProfileForReview(nextProfile.profile);
    setProfile((current) => {
      if ((normalized.updatedAt ?? 0) < (current.updatedAt ?? 0)) {
        return current;
      }
      saveProfile(normalized);
      return normalized;
    });
  }

  function switchView(nextView: AppView): void {
    setView(nextView);
    window.history.replaceState(null, '', nextView === 'admin' ? '/admin' : '/');
  }

  function dismissTutorial(): void {
    localStorage.setItem('bk_tutorial_dismissed', '1');
    setTutorialDismissed(true);
  }

  useEffect(() => {
    void fetchProfileSnapshot(SERVER_URL, profileId, playerName).then(applyProfileSnapshot).catch(() => undefined);
  }, [playerName, profileId]);

  return {
    applyProfileSnapshot,
    botCount,
    coreAuctionMode,
    dismissTutorial,
    playerName,
    profile,
    profileId,
    selectedBidMapId,
    selectedRoleId,
    setBotCount,
    setCoreAuctionMode,
    setPlayerName,
    setSelectedBidMapId,
    setSelectedRoleId,
    setSkillTargetId,
    setView,
    skillTargetId,
    switchView,
    tutorialDismissed,
    view
  };
}
