import React from 'react';
import { Gavel, Home, Info, ListChecks, Play, Shield, Users } from 'lucide-react';
import { gameConfig } from '@bitkingdom/config';
import { bidKingSourceRoles } from '@bitkingdom/match-core';
import type { BidKingBidMapRow } from '@bitkingdom/bidking-compat';
import type { CoreAuctionMode, PlayerProfile, RoomSnapshot } from '@bitkingdom/shared';
import { roleAvatarForRoleId, rolePortraitForRoleId } from '../../artAssets';
import { auctionModeName, PlayerGrid } from '../battle/BattlePanels';
import type { BidKingBattleMapGroup } from '../battlePrev/BattlePrevPanelView';
import { roleSkillDetailForRole } from '../bidder/roleSkillDetails';
import { formatChineseCoinAmount, formatChineseCompactCurrency } from '../currencyFormat';
import { taskBoardDefinitions } from '../task/taskDefinitions';

type RoleDefinition = (typeof gameConfig.roles)[number];

export function RoomLobbyView({
  displayBidMapName,
  isHost,
  mapGroups,
  profile,
  room,
  selectedRoleId,
  selfPlayerId,
  onReady,
  onReturnHome,
  onSelectCoreAuctionMode,
  onSelectBidMap,
  onSelectRole,
  onStartMatch
}: {
  displayBidMapName: (bidMap: BidKingBidMapRow) => string;
  isHost: boolean;
  mapGroups: BidKingBattleMapGroup[];
  profile: PlayerProfile;
  room: RoomSnapshot;
  selectedRoleId: string;
  selfPlayerId?: string;
  onReady: () => void;
  onReturnHome: () => void;
  onSelectCoreAuctionMode: (mode: CoreAuctionMode) => void;
  onSelectBidMap: (bidMapId: number) => void;
  onSelectRole: (roleId: string) => void;
  onStartMatch: () => void;
}): JSX.Element {
  const sourceRoles = bidKingSourceRoles(gameConfig.roles);
  const selectedRole = sourceRoles.find((role) => role.id === selectedRoleId);
  if (!selectedRole) {
    throw new Error(`Selected role ${selectedRoleId} is not backed by BidKing Hero`);
  }
  const lobbyBidMapChoices = mapGroups.flatMap((group) => group.children);
  const lobbyBidMap = lobbyBidMapChoices.find((map) => map.id === room.selectedBidMapId);
  if (!lobbyBidMap) {
    throw new Error(`Room BidMap ${room.selectedBidMapId} is missing from battle map groups`);
  }
  const roomPlayerCount = room.maxPlayers;
  const currentBidMapIndex = lobbyBidMapChoices.findIndex((map) => map.id === lobbyBidMap.id);
  const nextBidMap = lobbyBidMapChoices[(currentBidMapIndex + 1) % lobbyBidMapChoices.length];
  if (!nextBidMap) {
    throw new Error('Room has no BidMap switch target');
  }
  return (
    <section className="room-ready-hall">
      <aside className="hall-mode-rail">
        <button className="active" type="button">
          <Users size={18} />
          <span>包厢</span>
        </button>
        <button type="button">
          <Gavel size={18} />
          <span>拍场</span>
        </button>
      </aside>
      <section className="room-ready-board">
        <header className="hall-map-header">
          <div>
            <span>房间 {room.code}</span>
            <h2>等待开拍</h2>
          </div>
          <div className="hall-resource-strip">
            <span>席位 <strong>{room.players.length}/{roomPlayerCount}</strong></span>
            <span>局规 <strong>{auctionModeName(room.coreAuctionMode)}</strong></span>
            <span>起始 <strong>{formatChineseCompactCurrency(room.initialCash)}</strong></span>
            <span>房主 <strong>{isHost ? '你' : '队友'}</strong></span>
            <button disabled={!isHost} onClick={() => onSelectBidMap(nextBidMap.id)} type="button">
              场地 <strong>{displayBidMapName(lobbyBidMap)}</strong>
            </button>
          </div>
          <button className="hall-return-home" onClick={onReturnHome} type="button">
            <Home size={16} />
            返回
          </button>
        </header>
        <PlayerGrid players={room.players} selfPlayerId={selfPlayerId} />
        <section className="room-rule-dock">
          <ModeSelector mode={room.coreAuctionMode} onSelect={onSelectCoreAuctionMode} disabled={!isHost} />
          <div className="hall-dock-actions">
            <button onClick={onReady} type="button">
              <Shield size={18} />
              准备
            </button>
            <button className="primary" onClick={onStartMatch} disabled={!isHost} type="button">
              <Play size={18} />
              开始
            </button>
          </div>
        </section>
      </section>
      <aside className="hall-side-panel">
        <HallRoleCard initialCash={room.initialCash} profile={profile} role={selectedRole} />
        <div className="hall-role-roster">
          {sourceRoles.map((role) => (
            <button
              className={selectedRoleId === role.id ? 'selected' : ''}
              key={role.id}
              onClick={() => onSelectRole(role.id)}
              style={{ '--role-color': role.color } as React.CSSProperties}
              title={`${role.animal} · ${role.name}`}
              type="button"
            >
              <img src={roleAvatarForRoleId(role.id)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
        <TaskBoard profile={profile} />
      </aside>
    </section>
  );
}

function HallRoleCard({
  initialCash,
  profile,
  role,
  onInspect
}: {
  initialCash: number;
  profile: PlayerProfile;
  role: RoleDefinition;
  onInspect?: () => void;
}): JSX.Element {
  const skill = roleSkillDetailForRole(role);
  const portrait = rolePortraitForRoleId(role.id);
  return (
    <section className="hall-role-card" style={{ '--role-color': role.color } as React.CSSProperties}>
      {portrait && <img src={portrait} alt="" loading="lazy" />}
      <div className="hall-role-copy">
        <span>{role.animal}</span>
        <h3>{role.name}</h3>
        <strong>{skill.skillName}</strong>
        <p>{skill.short}</p>
      </div>
      <div className="hall-role-stats">
        <span>Lv.{profile.level}</span>
        <span>开局 {formatChineseCoinAmount(initialCash)}</span>
        <span>{profile.rankPoints} 名望</span>
      </div>
      {onInspect && (
        <button type="button" onClick={onInspect}>
          <Info size={16} />
          详情
        </button>
      )}
    </section>
  );
}

function TaskBoard({ profile }: { profile: PlayerProfile }): JSX.Element {
  return (
    <section className="task-board">
      <div className="section-title small">
        <ListChecks size={16} />
        <h3>每日/名望委托</h3>
      </div>
      {taskBoardDefinitions(profile).map((task) => {
        const progress = profile.missionProgress?.[task.id];
        const done = progress?.completed ?? profile.completedTasks.includes(task.id);
        const claimable = progress?.claimable ?? false;
        return (
          <div className={`task-row ${done ? 'done' : ''} ${claimable ? 'claimable' : ''}`} key={task.id}>
            <span>{claimable ? '!' : done ? '✓' : '·'}</span>
            <p>{task.label}</p>
          </div>
        );
      })}
    </section>
  );
}

function ModeSelector({
  mode,
  onSelect,
  disabled = false
}: {
  mode: CoreAuctionMode;
  onSelect: (mode: CoreAuctionMode) => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <div className="mode-selector" aria-label="拍场局规">
      {([
        { mode: 'sealed', label: '暗拍', detail: '只公开排名' },
        { mode: 'open', label: '明拍', detail: '轮后公开' }
      ] satisfies Array<{ mode: CoreAuctionMode; label: string; detail: string }>).map((option) => (
        <button
          className={mode === option.mode ? 'active' : ''}
          disabled={disabled}
          key={option.mode}
          onClick={() => onSelect(option.mode)}
          type="button"
        >
          <strong>{option.label}</strong>
          <span>{option.detail}</span>
        </button>
      ))}
    </div>
  );
}
