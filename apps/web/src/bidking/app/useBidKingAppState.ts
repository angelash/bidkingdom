import { useEffect, useState } from 'react';
import { gameConfig } from '@bitkingdom/config';
import type { AccountSessionSnapshot, CoreAuctionMode, PlayerProfile, ProfileSnapshot, PublicPlayerAccount } from '@bitkingdom/shared';
import {
  createGuestAccountSession,
  fetchAccountSession,
  fetchProfileSnapshot,
  loginAccountSession,
  logoutAccountSession,
  registerAccountSession
} from '../api/bidkingApiClient';
import {
  buildBidKingBattleMapGroups,
  loadSelectedBidMapId
} from '../battlePrev/bidMapRuntime';
import {
  loadCoreAuctionMode,
  loadDeviceId,
  loadProfile,
  loadProfileId,
  loadStoredAccountSession,
  normalizeProfileForReview,
  saveAccountSession,
  saveProfile
} from '../profile/profileSession';

export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://127.0.0.1:8787';

export type AppView = 'play' | 'admin';
export type AccountAuthStatus = 'checking' | 'signedOut' | 'submitting' | 'ready';

export const bidKingBattleMapGroups = buildBidKingBattleMapGroups();
export const defaultBidMapId = bidKingBattleMapGroups[0]?.children[0]?.id;

export function useBidKingAppState() {
  const [account, setAccount] = useState<PublicPlayerAccount | undefined>(() => loadStoredAccountSession()?.account);
  const [sessionToken, setSessionToken] = useState<string | undefined>(() => loadStoredAccountSession()?.sessionToken);
  const [authStatus, setAuthStatus] = useState<AccountAuthStatus>(() => loadStoredAccountSession() ? 'checking' : 'signedOut');
  const [authError, setAuthError] = useState<string>();
  const [profileId, setProfileId] = useState(() => loadStoredAccountSession()?.profileId ?? loadProfileId());
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
      if (current.playerId === normalized.playerId && (normalized.updatedAt ?? 0) < (current.updatedAt ?? 0)) {
        return current;
      }
      saveProfile(normalized);
      return normalized;
    });
  }

  function applyAccountSessionSnapshot(nextSession: AccountSessionSnapshot): void {
    saveAccountSession(nextSession);
    setAccount(nextSession.account);
    setSessionToken(nextSession.sessionToken);
    setProfileId(nextSession.account.profileId);
    setPlayerName(nextSession.profile.profile.name);
    setAuthError(undefined);
    setAuthStatus('ready');
    applyProfileSnapshot(nextSession.profile);
  }

  function switchView(nextView: AppView): void {
    setView(nextView);
    window.history.replaceState(null, '', nextView === 'admin' ? '/admin' : '/');
  }

  function dismissTutorial(): void {
    localStorage.setItem('bk_tutorial_dismissed', '1');
    setTutorialDismissed(true);
  }

  function updatePlayerName(value: string): void {
    localStorage.setItem('bk_player_name', value);
    setPlayerName(value);
  }

  async function continueAsGuest(nextPlayerName = playerName): Promise<void> {
    setAuthStatus('submitting');
    setAuthError(undefined);
    try {
      applyAccountSessionSnapshot(await createGuestAccountSession(SERVER_URL, {
        deviceId: loadDeviceId(),
        playerName: nextPlayerName,
        legacyProfileId: loadProfileId()
      }));
    } catch (error) {
      setAuthStatus('signedOut');
      setAuthError(error instanceof Error ? error.message : '游客进入失败');
    }
  }

  async function registerAccount(accountName: string, password: string, nextPlayerName = playerName): Promise<void> {
    setAuthStatus('submitting');
    setAuthError(undefined);
    try {
      applyAccountSessionSnapshot(await registerAccountSession(SERVER_URL, { accountName, password, playerName: nextPlayerName }));
    } catch (error) {
      setAuthStatus('signedOut');
      setAuthError(error instanceof Error ? error.message : '注册失败');
    }
  }

  async function loginAccount(accountName: string, password: string): Promise<void> {
    setAuthStatus('submitting');
    setAuthError(undefined);
    try {
      applyAccountSessionSnapshot(await loginAccountSession(SERVER_URL, { accountName, password }));
    } catch (error) {
      setAuthStatus('signedOut');
      setAuthError(error instanceof Error ? error.message : '登录失败');
    }
  }

  function logoutAccount(): void {
    const token = sessionToken;
    if (token) {
      void logoutAccountSession(SERVER_URL, token).catch(() => undefined);
    }
    localStorage.removeItem('bk_account_session_v1');
    setAccount(undefined);
    setSessionToken(undefined);
    setAuthStatus('signedOut');
    setAuthError(undefined);
  }

  useEffect(() => {
    const stored = loadStoredAccountSession();
    if (!stored) {
      setAuthStatus('signedOut');
      return;
    }
    let cancelled = false;
    void fetchAccountSession(SERVER_URL, stored.sessionToken)
      .then((session) => {
        if (!cancelled) {
          applyAccountSessionSnapshot(session);
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem('bk_account_session_v1');
          setAuthStatus('signedOut');
          setAuthError('登录已过期，请重新进入');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authStatus !== 'ready') {
      return;
    }
    void fetchProfileSnapshot(SERVER_URL, profileId, playerName, sessionToken).then(applyProfileSnapshot).catch(() => undefined);
  }, [authStatus, playerName, profileId, sessionToken]);

  return {
    account,
    applyProfileSnapshot,
    authError,
    authStatus,
    botCount,
    coreAuctionMode,
    continueAsGuest,
    dismissTutorial,
    loginAccount,
    logoutAccount,
    playerName,
    profile,
    profileId,
    registerAccount,
    selectedBidMapId,
    selectedRoleId,
    sessionToken,
    setBotCount,
    setCoreAuctionMode,
    setPlayerName: updatePlayerName,
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
