import { useEffect } from 'react';
import type { CoreAuctionMode, RoomSnapshot } from '@bitkingdom/shared';

interface UseBidKingRoomSyncArgs {
  room?: RoomSnapshot;
  onSetCoreAuctionMode: (mode: CoreAuctionMode) => void;
  onSetSelectedBidMapId: (bidMapId: number) => void;
}

export function useBidKingRoomSync({
  room,
  onSetCoreAuctionMode,
  onSetSelectedBidMapId
}: UseBidKingRoomSyncArgs): void {
  useEffect(() => {
    if (!room?.coreAuctionMode) {
      return;
    }
    onSetCoreAuctionMode(room.coreAuctionMode);
  }, [onSetCoreAuctionMode, room?.coreAuctionMode]);

  useEffect(() => {
    if (!room?.selectedBidMapId) {
      return;
    }
    onSetSelectedBidMapId(room.selectedBidMapId);
  }, [onSetSelectedBidMapId, room?.selectedBidMapId]);
}
