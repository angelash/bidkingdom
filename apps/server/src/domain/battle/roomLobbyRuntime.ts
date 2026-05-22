import { gameConfig } from '@bitkingdom/config';
import {
  bidKingInitialCashForBidMap,
  bidKingHeroIdForRoleId,
  type CreateMatchPlayer,
  type MatchRuntimeState
} from '@bitkingdom/match-core';
import type {
  CoreAuctionMode,
  PublicPlayer,
  RoomSnapshot
} from '@bitkingdom/shared';
import { languageNameFromSeed } from '../profile/languageNameRuntime';
import { BOT_ROLE_SEQUENCE } from './roomRuntimeConfig';

export interface RoomPlayer extends CreateMatchPlayer {
  socketId?: string;
  ready: boolean;
  status: PublicPlayer['status'];
}

export interface RoomSnapshotSource {
  id: string;
  code: string;
  hostId: string;
  totalRounds: number;
  initialCash: number;
  coreAuctionMode: CoreAuctionMode;
  selectedBidMapId?: number;
  status: RoomSnapshot['status'];
  players: RoomPlayer[];
  match?: MatchRuntimeState;
}

export function createBotRoomPlayer(index: number, id: string): { player: RoomPlayer; profileId: string } {
  const roleId = BOT_ROLE_SEQUENCE[index - 1] ?? BOT_ROLE_SEQUENCE[index % BOT_ROLE_SEQUENCE.length]!;
  const role = gameConfig.roles.find((candidate) => candidate.id === roleId) ?? gameConfig.roles[index % gameConfig.roles.length]!;
  const profile = gameConfig.botProfiles[index % gameConfig.botProfiles.length]!;
  return {
    player: {
      id,
      name: languageNameFromSeed(10_000 + index),
      kind: 'bot',
      roleId: role.id,
      heroCid: bidKingHeroIdForRoleId(role.id, gameConfig.roles),
      ready: true,
      status: 'ready'
    },
    profileId: profile.id
  };
}

export function snapshotRoom(room: RoomSnapshotSource): RoomSnapshot {
  const matchPlayers = room.match?.players;
  const lobbyInitialCash = bidKingInitialCashForBidMap(room.selectedBidMapId, room.initialCash);
  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    botCount: room.players.filter((player) => player.kind === 'bot').length,
    totalRounds: room.totalRounds,
    initialCash: room.match?.config.rules.initialCash ?? lobbyInitialCash,
    coreAuctionMode: room.coreAuctionMode,
    selectedBidMapId: room.selectedBidMapId,
    status: room.status,
    players: room.players.map((player, seat) => {
      const runtime = matchPlayers?.find((candidate) => candidate.id === player.id);
      return {
        id: player.id,
        seat,
        name: player.name,
        kind: player.kind,
        roleId: runtime?.roleId ?? player.roleId,
        heroCid: runtime?.heroCid ?? player.heroCid,
        heroSkinCid: runtime?.heroSkinCid ?? player.heroSkinCid,
        cash: runtime?.cash ?? lobbyInitialCash,
        netWorth: runtime?.cash ?? lobbyInitialCash,
        status: runtime?.status ?? player.status,
        hasSubmittedBid: runtime?.hasSubmittedBid ?? false,
        passed: runtime?.passed ?? false,
        emote: runtime?.emote,
        emoteSoundId: runtime?.emoteSoundId,
        emoteAnimationKey: runtime?.emoteAnimationKey,
        emoteEffectKey: runtime?.emoteEffectKey,
        emoteEffectViewIds: runtime?.emoteEffectViewIds,
        emoteVisualClass: runtime?.emoteVisualClass
      };
    })
  };
}

export function validRole(roleId?: string): string {
  return gameConfig.roles.some((role) => role.id === roleId) ? roleId! : gameConfig.roles[0]!.id;
}

export function validCoreAuctionMode(mode?: CoreAuctionMode): CoreAuctionMode {
  return mode === 'open' || mode === 'sealed' ? mode : 'sealed';
}

export function validBidMapId(bidMapId?: number): number | undefined {
  return typeof bidMapId === 'number' && Number.isInteger(bidMapId) && bidMapId > 0 ? bidMapId : undefined;
}
