import type { CoreAuctionMode, PlayerProfile, RoomSnapshot } from '@bitkingdom/shared';
import { bidKingDisplayBidMapName } from '../battlePrev/bidMapRuntime';
import type { BidKingBattleMapGroup } from '../battlePrev/BattlePrevPanelView';
import { RoomLobbyView } from './RoomLobbyView';
import type { RoomActions } from './useRoomActions';

interface RoomLobbyRouteProps {
  coreAuctionMode: CoreAuctionMode;
  isHost: boolean;
  mapGroups: BidKingBattleMapGroup[];
  profile: PlayerProfile;
  room: RoomSnapshot;
  roomActions: RoomActions;
  selectedBidMapId?: number;
  selectedRoleId: string;
  selfPlayerId?: string;
  onReady: () => void;
  onReturnHome: () => void;
}

export function RoomLobbyRoute({
  coreAuctionMode,
  isHost,
  mapGroups,
  profile,
  room,
  roomActions,
  selectedBidMapId,
  selectedRoleId,
  selfPlayerId,
  onReady,
  onReturnHome
}: RoomLobbyRouteProps): JSX.Element {
  return (
    <RoomLobbyView
      coreAuctionMode={coreAuctionMode}
      displayBidMapName={bidKingDisplayBidMapName}
      isHost={isHost}
      mapGroups={mapGroups}
      profile={profile}
      room={room}
      selectedBidMapId={selectedBidMapId}
      selectedRoleId={selectedRoleId}
      selfPlayerId={selfPlayerId}
      onReady={onReady}
      onReturnHome={onReturnHome}
      onSelectCoreAuctionMode={roomActions.selectCoreAuctionMode}
      onSelectBidMap={roomActions.selectBidMap}
      onSelectRole={roomActions.selectRole}
      onStartMatch={roomActions.startMatch}
    />
  );
}
