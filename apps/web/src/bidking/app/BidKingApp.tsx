import { useCallback, useEffect, useRef } from 'react';
import { AdminDashboard } from '../admin/AdminDashboard';
import { AccountGate } from './AccountGate';
import { AppTopBar } from './AppTopBar';
import { useGameKeyboardLayer } from './useGameKeyboardLayer';
import { useBidKingAppNavigation } from './useBidKingAppNavigation';
import { useBidKingRoomSync } from './useBidKingRoomSync';
import {
  bidKingBattleMapGroups,
  defaultBidMapId,
  SERVER_URL,
  useBidKingAppState
} from './useBidKingAppState';
import {
  useNow
} from '../battle/BattlePanels';
import { MatchRoute } from '../battle/MatchRoute';
import { useBidComposerActions } from '../battle/useBidComposerActions';
import { useMatchDerivedState } from '../battle/useMatchDerivedState';
import { MainHallRoute } from '../home/MainHallRoute';
import { useLiveIntelActions } from '../intel/useLiveIntelActions';
import { useProfileActions } from '../profile/useProfileActions';
import { RoomLobbyRoute } from '../room/RoomLobbyRoute';
import { useRoomActions } from '../room/useRoomActions';
import { useReplayActions } from '../settlement/useReplayActions';
import { useBidKingSocket } from '../socket/useBidKingSocket';
import { GameExceptionCenter } from '../system/GameExceptionCenter';
import { bidKingToastErrorStyle } from '../system/errorCodeStyleRuntime';
import { useGameExceptionCenter } from '../system/useGameExceptionCenter';

export function BidKingApp(): JSX.Element {
  const exceptions = useGameExceptionCenter();
  const { reportException } = exceptions;
  const phaseExceptionKeyRef = useRef('');
  const {
    account,
    applyProfileSnapshot,
    authError,
    authStatus,
    botCount,
    changeAccountPassword,
    coreAuctionMode,
    continueAsGuest,
    loginAccount,
    logoutAccount,
    logoutAllAccounts,
    playerName,
    profile,
    profileId,
    registerAccount,
    selectedBidMapId,
    selectedRoleId,
    sessionToken,
    setBotCount,
    setCoreAuctionMode,
    setPlayerName,
    setSelectedBidMapId,
    setSelectedRoleId,
    setSkillTargetId,
    setView,
    skillTargetId,
    switchView,
    upgradeGuestAccount,
    view
  } = useBidKingAppState();
  const now = useNow();
  const liveIntel = useLiveIntelActions();
  const reportProfileException = useCallback((message: string): void => {
    reportException({
      action: 'dismiss',
      kind: 'profile',
      message,
      source: '档案操作',
      title: '操作未完成'
    });
  }, [reportException]);

  const {
    activeRoomCodeRef,
    connected,
    room,
    selfPlayerId,
    setRoom,
    setSelfPlayerId,
    setSnapshot,
    setToast,
    snapshot,
    socket,
    toast
  } = useBidKingSocket({
    serverUrl: SERVER_URL,
    onException: reportException,
    onProfileUpdated: applyProfileSnapshot,
    profileId,
    sessionToken
  });
  const profileActions = useProfileActions({
    onError: (message) => {
      setToast(message);
      reportProfileException(message);
    },
    onProfileSnapshot: applyProfileSnapshot,
    playerId: profileId,
    sessionToken,
    serverUrl: SERVER_URL
  });

  useBidKingRoomSync({
    room,
    onSetCoreAuctionMode: setCoreAuctionMode,
    onSetSelectedBidMapId: setSelectedBidMapId
  });

  const matchState = useMatchDerivedState({
    now,
    profile,
    room,
    selfPlayerId,
    skillTargetId,
    snapshot
  });
  const bidComposer = useBidComposerActions({
    previousBid: matchState.previousSelfBid,
    selfCash: matchState.selfPlayer?.cash,
    socket
  });
  useEffect(() => {
    const round = snapshot?.public.currentRound;
    if (!socket || snapshot?.public.status !== 'playing' || !round || matchState.phaseRemaining > 0) {
      return;
    }
    socket.emit('requestSnapshot');
    const timer = window.setInterval(() => socket.emit('requestSnapshot'), 2500);
    return () => window.clearInterval(timer);
  }, [
    matchState.phaseRemaining,
    snapshot?.public.currentRound?.id,
    snapshot?.public.currentRound?.phase,
    snapshot?.public.status,
    socket
  ]);
  useEffect(() => {
    const round = snapshot?.public.currentRound;
    if (!socket || snapshot?.public.status !== 'playing' || !round) {
      phaseExceptionKeyRef.current = '';
      return;
    }
    const phaseOverrunMs = now - round.phaseEndsAt;
    const watchedPhase = ['intel', 'auction'].includes(round.phase);
    if (!watchedPhase || phaseOverrunMs < 8000) {
      phaseExceptionKeyRef.current = '';
      return;
    }
    const key = `match-phase-overrun:${round.id}:${round.phase}`;
    socket.emit('requestSnapshot');
    if (phaseExceptionKeyRef.current === key) {
      return;
    }
    phaseExceptionKeyRef.current = key;
    reportException({
      action: 'request_snapshot',
      context: {
        phase: round.phase,
        phaseEndsAt: round.phaseEndsAt,
        roundId: round.id
      },
      key,
      kind: 'match',
      message: `${roundPhaseLabel(round.phase)}已超时 ${Math.ceil(phaseOverrunMs / 1000)} 秒，已请求服务端重新同步。`,
      modal: true,
      source: '对局阶段',
      title: '对局阶段未推进',
      tone: 'warning'
    });
  }, [
    now,
    reportException,
    snapshot?.public.currentRound,
    snapshot?.public.status,
    socket
  ]);
  const replay = useReplayActions({ matchId: snapshot?.public.id, serverUrl: SERVER_URL });
  const roomActions = useRoomActions({
    activeRoomCodeRef,
    botCount,
    coreAuctionMode,
    defaultBidMapId,
    isHost: matchState.isHost,
    playerName,
    profile,
    profileId,
    room,
    selectedBidMapId,
    selectedRoleId,
    setCoreAuctionMode,
    setRoom,
    setSelectedBidMapId,
    setSelectedRoleId,
    setSelfPlayerId,
    setToast,
    snapshot,
    socket
  });
  const navigation = useBidKingAppNavigation({
    activeRoomCodeRef,
    bidComposer,
    liveIntel,
    replay,
    setRoom,
    setSelfPlayerId,
    setSkillTargetId,
    setSnapshot,
    setToast,
    setView,
    socket
  });

  useGameKeyboardLayer({
    bidComposerOpen: bidComposer.bidComposerOpen,
    confirmBidOpen: bidComposer.confirmBidAmount !== undefined,
    enabled: view === 'play' && Boolean(room),
    liveIntelOpen: liveIntel.liveIntelOpen,
    onCloseBidComposer: bidComposer.closeBidComposer,
    onCloseConfirmBid: bidComposer.closeConfirmBid,
    onCloseLiveIntel: liveIntel.closeLiveIntel,
    onReturnHome: navigation.returnHome
  });

  if (view === 'play' && authStatus !== 'ready') {
    return (
      <main className="app-shell home-screen">
        <div className="backdrop" />
        <AccountGate
          defaultPlayerName={playerName}
          error={authError}
          status={authStatus}
          onContinueAsGuest={continueAsGuest}
          onLogin={loginAccount}
          onRegister={registerAccount}
        />
      </main>
    );
  }

  const isActiveMatchView = view === 'play' && Boolean(snapshot && matchState.currentRound && snapshot.public.status !== 'ended');
  const isHomeView = view === 'play' && !room;

  return (
    <main className={`app-shell ${isActiveMatchView ? 'in-match' : ''} ${isHomeView ? 'home-screen' : ''}`}>
      <div className="backdrop" />
      <AppTopBar
        connected={connected}
        hasRoom={Boolean(room)}
        hidden={isHomeView}
        view={view}
        onReturnHome={navigation.returnHome}
        onSwitchView={switchView}
      />

      {view === 'admin' && <AdminDashboard serverUrl={SERVER_URL} />}

      {view === 'play' && !room && (
        <MainHallRoute
          defaultBidMapId={defaultBidMapId}
          mapGroups={bidKingBattleMapGroups}
          playerName={playerName}
          profile={profile}
          account={account}
          profileActions={profileActions}
          roomActions={roomActions}
          selectedBidMapId={selectedBidMapId}
          selectedRoleId={selectedRoleId}
          serverUrl={SERVER_URL}
          authError={authError}
          onChangeAccountPassword={changeAccountPassword}
          onReportException={reportException}
          onSetBotCount={setBotCount}
          onLogoutAllAccounts={logoutAllAccounts}
          onLogoutAccount={logoutAccount}
          onSetPlayerName={setPlayerName}
          onUpgradeGuestAccount={upgradeGuestAccount}
        />
      )}

      {view === 'play' && room && !snapshot && (
        <RoomLobbyRoute
          coreAuctionMode={coreAuctionMode}
          isHost={matchState.isHost}
          mapGroups={bidKingBattleMapGroups}
          profile={profile}
          room={room}
          roomActions={roomActions}
          selectedBidMapId={selectedBidMapId}
          selectedRoleId={selectedRoleId}
          selfPlayerId={selfPlayerId}
          onReady={() => socket?.emit('setReady', { ready: true })}
          onReturnHome={navigation.returnHome}
        />
      )}

      {view === 'play' && (
        <MatchRoute
          bidComposer={bidComposer}
          liveIntel={liveIntel}
          matchState={matchState}
          profile={profile}
          replay={replay}
          snapshot={snapshot}
          onPassAuction={() => socket?.emit('passAuction')}
          onReturnHome={navigation.returnHome}
          onSelectSkillTarget={setSkillTargetId}
          onSendEmote={(emote) => socket?.emit('sendEmote', { emote })}
          onUseBattleItem={navigation.useBattleItemClick}
        />
      )}

      <footer className={`toast-line ${bidKingToastErrorStyle(toast).className}`}>{toast}</footer>
      <GameExceptionCenter
        activeExceptions={exceptions.activeExceptions}
        exceptionCenterOpen={exceptions.exceptionCenterOpen}
        openException={exceptions.openException}
        recentExceptions={exceptions.recentExceptions}
        onDismiss={exceptions.dismissException}
        onDismissAll={exceptions.dismissAllExceptions}
        onOpen={exceptions.openExceptionCenter}
        onReload={() => window.location.reload()}
        onRequestSnapshot={() => {
          socket?.emit('requestSnapshot');
          setToast('已请求重新同步对局状态');
        }}
        onResolve={exceptions.resolveException}
        onReturnHome={navigation.returnHome}
        onSetOpen={exceptions.setExceptionCenterOpen}
      />
    </main>
  );
}

function roundPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    auction: '竞价阶段',
    intel: '情报阶段'
  };
  return labels[phase] ?? '对局阶段';
}
