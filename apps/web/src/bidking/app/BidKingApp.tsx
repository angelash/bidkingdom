import { useEffect } from 'react';
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
import { bidKingToastErrorStyle } from '../system/errorCodeStyleRuntime';

export function BidKingApp(): JSX.Element {
  const {
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
    setPlayerName,
    setSelectedBidMapId,
    setSelectedRoleId,
    setSkillTargetId,
    setView,
    skillTargetId,
    switchView,
    tutorialDismissed,
    view
  } = useBidKingAppState();
  const now = useNow();
  const liveIntel = useLiveIntelActions();

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
  } = useBidKingSocket({ serverUrl: SERVER_URL, onProfileUpdated: applyProfileSnapshot, profileId, sessionToken });
  const profileActions = useProfileActions({
    onError: setToast,
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
    currentRound: matchState.currentRound,
    previousBid: matchState.previousSelfBid,
    recommendedBid: matchState.recommendedBid,
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
  const replay = useReplayActions({ matchId: snapshot?.public.id, serverUrl: SERVER_URL });
  const roomActions = useRoomActions({
    activeRoomCodeRef,
    botCount,
    coreAuctionMode,
    defaultBidMapId,
    isHost: matchState.isHost,
    playerName,
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
    selectedSkillTargetId: matchState.selectedSkillTargetId,
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
          botCount={botCount}
          coreAuctionMode={coreAuctionMode}
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
          onSetBotCount={setBotCount}
          onLogoutAccount={logoutAccount}
          onSetPlayerName={setPlayerName}
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
          tutorialDismissed={tutorialDismissed}
          onDismissTutorial={dismissTutorial}
          onPassAuction={() => socket?.emit('passAuction')}
          onReturnHome={navigation.returnHome}
          onSelectSkillTarget={setSkillTargetId}
          onSendEmote={(emote) => socket?.emit('sendEmote', { emote })}
          onUseBattleItem={navigation.useBattleItemClick}
          onUseSkill={navigation.useSkillClick}
        />
      )}

      <footer className={`toast-line ${bidKingToastErrorStyle(toast).className}`}>{toast}</footer>
    </main>
  );
}
