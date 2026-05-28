import { useEffect, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  Archive,
  Check,
  Coins,
  Filter,
  Lock,
  Package,
  Play,
  Ticket,
  X
} from 'lucide-react';
import {
  bidKingBidMapAccess,
  bidKingBidMapEntryCosts,
  bidKingHeroIdForRoleId,
  bidKingHeroStateFromProfile,
  bidKingInitialCashForBidMap,
  bidKingIsDefaultUnknownBidMap,
  bidKingSourceRoles
} from '@bitkingdom/match-core';
import {
  BattleItem as bidKingBattleItems,
  bidKingBattleItemDisplayDesc,
  bidKingBattleItemDisplayName,
  bidKingBidMapDisplayDesc,
  bidKingBidMapDisplayName,
  bidKingItemDisplayName,
  bidKingMapDisplayName,
  itemById,
  type BidKingBattleItemRow,
  type BidKingBidMapRow,
  type BidKingMapRow
} from '@bitkingdom/bidking-compat';
import { gameConfig } from '@bitkingdom/config';
import type { PlayerProfile } from '@bitkingdom/shared';
import { containerArtForKey, roleAvatarForRoleId, rolePortraitForRoleId } from '../../artAssets';
import { roleSkillDetailForRole } from '../bidder/roleSkillDetails';
import { formatChineseCompactCurrency } from '../currencyFormat';
import type { GameExceptionInput } from '../system/gameExceptionRuntime';

export type BattlePrevTab = 'map' | 'hero' | 'items' | 'settings';

export interface BidKingBattleMapGroup {
  parent: BidKingMapRow;
  children: BidKingBidMapRow[];
  x: number;
  y: number;
}

type RoleDefinition = (typeof gameConfig.roles)[number];
type ScenePopover = 'role' | 'items';

interface BattlePrevPanelViewProps {
  matchmaking?: BattlePrevMatchmakingState;
  mapGroups: BidKingBattleMapGroup[];
  selectedBidMapId?: number;
  profile: PlayerProfile;
  selectedRole: RoleDefinition;
  selectedRoleId: string;
  onCancel: () => void;
  onConfirm: (config?: { roleId?: string; itemIds?: number[] }) => void;
  onSelectBidMap: (bidMapId: number) => void;
  onSelectRole: (roleId: string) => void;
  onReportException: (exception: GameExceptionInput) => void;
  onEquipBattleItems: (itemIds: number[]) => void;
  onCancelMatchmaking?: () => void;
}

const SCENE_CONFIG_STORAGE_KEY = 'bk_scene_prepare_config_v1';
const MAX_SCENE_ITEM_COUNT = 5;

export interface BattlePrevMatchmakingState {
  elapsedSeconds: number;
  estimatedSeconds: number;
}

interface ScenePrepareConfig {
  roleId?: string;
  itemIds: number[];
  updatedAt: number;
}

type ScenePrepareConfigStore = Record<string, ScenePrepareConfig>;

export function BattlePrevPanelView({
  matchmaking,
  mapGroups,
  selectedBidMapId,
  profile,
  selectedRole,
  selectedRoleId,
  onCancel,
  onConfirm,
  onSelectBidMap,
  onSelectRole,
  onReportException,
  onEquipBattleItems,
  onCancelMatchmaking
}: BattlePrevPanelViewProps): JSX.Element {
  const selectedGroup = mapGroups.find((group) => group.children.some((map) => map.id === selectedBidMapId)) ?? mapGroups[0]!;
  const selectedBidMap = selectedGroup.children.find((map) => map.id === selectedBidMapId) ?? sceneDefaultBidMap(selectedGroup) ?? selectedGroup.children[0]!;
  const selectedParentMap = selectedGroup.parent;
  const selectedAccess = bidKingBidMapAccess(profile, selectedBidMap.id);
  const selectedInitialCash = bidKingInitialCashForBidMap(selectedBidMap.id);
  const selectedIsDefault = bidKingIsDefaultUnknownBidMap(selectedBidMap.id);
  const closeScene = matchmaking ? onCancelMatchmaking ?? onCancel : onCancel;
  const sourceRoles = bidKingSourceRoles(gameConfig.roles);
  const [sceneEntered, setSceneEntered] = useState(false);
  const [activePopover, setActivePopover] = useState<ScenePopover>();
  const [configuredRoleId, setConfiguredRoleId] = useState<string>();
  const [configuredItemIds, setConfiguredItemIds] = useState<number[]>([]);
  const selectedSourceRole = sourceRoles.find((role) => role.id === selectedRoleId)
    ?? sourceRoles.find((role) => role.id === selectedRole.id);
  if (!selectedSourceRole) {
    throw new Error(`Selected role ${selectedRoleId} is not backed by BidKing Hero`);
  }
  const resolvedConfiguredRole = configuredRoleId
    ? sourceRoles.find((role) => role.id === configuredRoleId)
    : selectedSourceRole;
  if (!resolvedConfiguredRole) {
    throw new Error(`Configured role ${configuredRoleId} is not backed by BidKing Hero`);
  }
  const configuredRole: RoleDefinition = resolvedConfiguredRole;
  const configuredRoleSkill = roleSkillDetailForRole(configuredRole, sourceRoles);
  const configuredItemRows = configuredItemIds
    .map((itemId) => bidKingBattleItems.find((item) => item.id === itemId))
    .filter((item): item is BidKingBattleItemRow => Boolean(item));
  useEffect(() => {
    const saved = loadScenePrepareConfig(selectedParentMap.id);
    setConfiguredRoleId(saved?.roleId);
    setConfiguredItemIds(sanitizeItemIds(saved?.itemIds ?? []));
    setActivePopover(undefined);
  }, [selectedParentMap.id]);
  useEffect(() => {
    if (matchmaking) {
      setSceneEntered(false);
      setActivePopover(undefined);
    }
  }, [matchmaking]);

  function reportBlockedBidMap(bidMap: BidKingBidMapRow, reasons: string[]): void {
    onReportException({
      action: 'dismiss',
      code: `BID_MAP_LOCKED_${bidMap.id}`,
      context: {
        bidMapId: bidMap.id,
        reasons
      },
      key: `battle-prev-bid-map-locked:${bidMap.id}:${reasons.join('|')}`,
      kind: 'system',
      message: `${displayBidMapVersionName(selectedParentMap, bidMap)}暂不能开拍：${reasons.join('、')}。`,
      modal: true,
      source: '入场校验',
      title: '暂未满足开拍条件',
      tone: 'warning'
    });
  }

  function reportLockedRole(role: RoleDefinition): void {
    onReportException({
      action: 'dismiss',
      code: `HERO_LOCKED_${role.id}`,
      context: { roleId: role.id },
      key: `battle-prev-role-locked:${role.id}`,
      kind: 'system',
      message: `${role.name}尚未解锁，暂不能作为本局竞买人出场。`,
      modal: true,
      source: '竞买人校验',
      title: '竞买人未解锁',
      tone: 'warning'
    });
  }

  function selectScene(group: BidKingBattleMapGroup): void {
    const nextBidMap = sceneDefaultBidMap(group) ?? group.children[0];
    if (nextBidMap) {
      const access = bidKingBidMapAccess(profile, nextBidMap.id);
      if (!access.canEnter) {
        reportBlockedBidMap(nextBidMap, access.reasons);
        return;
      }
      onSelectBidMap(nextBidMap.id);
      setSceneEntered(true);
    }
  }

  function selectRoleForScene(role: RoleDefinition): void {
    const state = bidKingHeroStateFromProfile(profile, bidKingHeroIdForRoleId(role.id, sourceRoles)).state;
    if (state === 'locked') {
      reportLockedRole(role);
      return;
    }
    const next = { roleId: role.id, itemIds: configuredItemIds, updatedAt: Date.now() };
    saveScenePrepareConfig(selectedParentMap.id, next);
    setConfiguredRoleId(role.id);
    setActivePopover(undefined);
    onSelectRole(role.id);
  }

  function toggleSceneItem(itemId: number): void {
    if (inventoryQuantity(profile, itemId) <= 0) {
      return;
    }
    setConfiguredItemIds((current) => {
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId].slice(0, MAX_SCENE_ITEM_COUNT);
      saveScenePrepareConfig(selectedParentMap.id, {
        roleId: configuredRoleId,
        itemIds: next,
        updatedAt: Date.now()
      });
      onEquipBattleItems(next);
      return next;
    });
  }

  function startAction(): void {
    if (!selectedAccess.canEnter) {
      reportBlockedBidMap(selectedBidMap, selectedAccess.reasons);
      return;
    }
    const ownedItemIds = configuredItemIds
      .filter((itemId) => inventoryQuantity(profile, itemId) > 0)
      .slice(0, MAX_SCENE_ITEM_COUNT);
    onConfirm({
      roleId: configuredRole.id,
      itemIds: ownedItemIds
    });
  }

  return (
    <div className="battle-scene-backdrop">
      <section
        className={`battle-scene-shell ${sceneEntered && !matchmaking ? 'scene-entered' : 'map-overview'} ${matchmaking ? 'is-matching' : ''} has-role`}
        role="dialog"
        aria-modal="true"
        style={{
          '--scene-bg': `url(${containerArtForKey(selectedBidMap.art_key || selectedParentMap.art_key)})`,
          '--role-color': configuredRole.color
        } as CSSProperties}
      >
        <header className="battle-scene-header">
          <div className="battle-scene-brand">
            <span className="battle-scene-logo">珍宝局</span>
            <h2>竞拍大厅</h2>
          </div>
          <div className="battle-scene-wallet">
            <span className="gold">
              <Ticket size={28} />
              <strong>{profile.tickets.current}</strong>
              <button type="button" title="补充竞拍票">+</button>
            </span>
            <span className="silver">
              <Coins size={28} />
              <strong>{formatChineseCompactCurrency(profile.coins)}</strong>
            </span>
            <button className="battle-scene-close" type="button" onClick={closeScene} title={matchmaking ? '取消匹配' : '关闭'}>
              <X size={42} />
            </button>
          </div>
        </header>

        {sceneEntered && !matchmaking ? (
          <>
            <main className="battle-scene-main">
              {configuredRole ? (
                <section className="battle-scene-role-intro">
                  <span>{configuredRole.animal}</span>
                  <h1>{configuredRole.name}</h1>
                  <p>{configuredRoleSkill?.positioning}。{configuredRoleSkill?.active}</p>
                  <div className="battle-scene-role-thumbs" aria-hidden="true">
                    <img src={rolePortraitForRoleId(configuredRole.id)} alt="" loading="lazy" />
                    <img src={roleAvatarForRoleId(configuredRole.id)} alt="" loading="lazy" />
                  </div>
                </section>
              ) : (
                <section className="battle-scene-empty-copy" aria-label="未配置竞买人" />
              )}

              <aside className="battle-scene-detail-panel">
                <header>
                  <h3>{displayBidMapVersionName(selectedParentMap, selectedBidMap)}</h3>
                  <img src={containerArtForKey(selectedBidMap.art_key || selectedParentMap.art_key)} alt="" loading="lazy" />
                  <p>{selectedIsDefault ? unknownSceneDescription(selectedParentMap) : bidKingBidMapDesc(selectedBidMap)}</p>
                </header>

                <div className="battle-scene-stat-list">
                  <DetailStat label="拍卖价值" value={riskName(selectedBidMap.risk)} />
                  <EntryCostStat bidMap={selectedBidMap} profile={profile} />
                  <DetailStat label="资产要求" value={formatChineseCompactCurrency(selectedAccess.requiredCoins)} icon={<Coins size={25} />} />
                  <DetailStat label="拍卖轮数" value={String(selectedBidMap.auction_rounds_rate.length)} />
                  <DetailStat label="竞拍人数" value={`${selectedBidMap.bidder_number}人`} />
                </div>

                <section className="battle-scene-config-box skill">
                  <div className={`battle-scene-skill-slot ${configuredRole ? 'filled' : ''}`}>
                    {configuredRole && <img src={roleAvatarForRoleId(configuredRole.id)} alt="" loading="lazy" />}
                  </div>
                  <div className="battle-scene-config-copy">
                    {configuredRole ? (
                      <>
                        <strong>{configuredRole.name}</strong>
                        <span>{configuredRoleSkill?.short}</span>
                      </>
                    ) : (
                      <span />
                    )}
                  </div>
                  <button type="button" onClick={() => setActivePopover(activePopover === 'role' ? undefined : 'role')}>
                    配置技能
                  </button>
                </section>

                <section className="battle-scene-config-box items">
                  <header>
                    <strong>口袋：{configuredItemRows.length}/{MAX_SCENE_ITEM_COUNT}</strong>
                  </header>
                  <div className="battle-scene-pocket-row">
                    {Array.from({ length: MAX_SCENE_ITEM_COUNT }, (_, index) => {
                      const item = configuredItemRows[index];
                      return (
                        <span className={item ? `filled quality-${item.item_quality}` : ''} key={index}>
                          {item ? battleItemShortName(item) : ''}
                        </span>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => setActivePopover(activePopover === 'items' ? undefined : 'items')}>
                    配置藏品
                  </button>
                </section>
              </aside>

              {activePopover === 'role' && (
                <RoleSelectPopover
                  configuredRoleId={configuredRoleId}
                  profile={profile}
                  roles={sourceRoles}
                  onReportLocked={reportLockedRole}
                  onSelect={selectRoleForScene}
                />
              )}

              {activePopover === 'items' && (
                <ItemSelectPopover
                  configuredItemIds={configuredItemIds}
                  profile={profile}
                  onToggle={toggleSceneItem}
                />
              )}
            </main>

            <footer className="battle-scene-footer">
              <button className="battle-scene-back" type="button" onClick={() => {
                setActivePopover(undefined);
                setSceneEntered(false);
              }} title="返回场景地图">
                <ArrowLeft size={54} />
              </button>

              <div className="battle-scene-version-strip" aria-label="版本选择">
                {selectedGroup.children.map((bidMap) => {
                  const access = bidKingBidMapAccess(profile, bidMap.id);
                  const isSelected = bidMap.id === selectedBidMap.id;
                  const isDefault = bidKingIsDefaultUnknownBidMap(bidMap.id);
                  return (
                    <button
                      className={`${isSelected ? 'selected' : ''} ${isDefault ? 'unknown' : 'specified'} ${access.canEnter ? '' : 'locked'}`}
                      key={bidMap.id}
                      onClick={() => onSelectBidMap(bidMap.id)}
                      type="button"
                      title={access.canEnter ? undefined : access.reasons.join('、')}
                    >
                      {isDefault ? <Archive size={30} /> : (isSelected || access.canEnter) ? <Package size={28} /> : <Lock size={26} />}
                      <span>{displayBidMapVersionName(selectedParentMap, bidMap)}</span>
                    </button>
                  );
                })}
              </div>

              <div className="battle-scene-start-wrap">
                <small>{selectedAccess.canEnter ? `${formatChineseCompactCurrency(selectedInitialCash)} 起始资金` : selectedAccess.reasons[0]}</small>
                <button
                  className={`battle-scene-start ${selectedAccess.canEnter ? '' : 'locked'}`}
                  type="button"
                  onClick={startAction}
                >
                  <Play size={28} />
                  开始行动
                </button>
              </div>
            </footer>
          </>
        ) : (
          <main className="battle-scene-overview">
            <section className="battle-prev-map battle-scene-world-map" aria-label="场景选择">
              <div className="battle-prev-map-bg" />
              <div className="battle-prev-route" />
            {mapGroups.map((group) => {
              const defaultMap = sceneDefaultBidMap(group) ?? group.children[0]!;
              const active = group.parent.id === selectedParentMap.id;
              const access = bidKingBidMapAccess(profile, defaultMap.id);
              return (
                <button
                  className={`battle-prev-node risk-${defaultMap.risk} mode-${mapModeClass(group.parent)} ${active ? 'selected' : ''} ${access.canEnter ? '' : 'locked'}`}
                  key={group.parent.id}
                  onClick={() => selectScene(group)}
                  disabled={Boolean(matchmaking)}
                  style={{
                    '--node-x': `${group.x}%`,
                    '--node-y': `${group.y}%`,
                    '--node-art': `url(${containerArtForKey(group.parent.art_key || defaultMap.art_key)})`
                  } as CSSProperties}
                  type="button"
                  title={access.canEnter ? bidKingParentMapName(group.parent) : access.reasons.join('、')}
                >
                  <span />
                  <strong>{bidKingParentMapName(group.parent)}</strong>
                  <small>{access.canEnter ? `${bidKingMapModeName(group.parent.type)} · ${group.children.length} 仓型` : access.reasons[0]}</small>
                </button>
              );
            })}
            </section>
            <button className="battle-scene-overview-back" type="button" onClick={closeScene} title={matchmaking ? '取消匹配' : '返回'}>
              <ArrowLeft size={54} />
            </button>
            {matchmaking && (
              <aside className="battle-scene-matchmaking-card" aria-label="匹配状态">
                <span className="battle-scene-matchmaking-spinner" aria-hidden="true" />
                <div>
                  <small>经典大厅匹配中</small>
                  <strong>{formatMatchmakingTimer(matchmaking.elapsedSeconds)}</strong>
                  <em>预计匹配时间：{matchmaking.estimatedSeconds}秒</em>
                </div>
                <button type="button" onClick={onCancelMatchmaking}>取消</button>
              </aside>
            )}
          </main>
        )}
      </section>
    </div>
  );
}

function formatMatchmakingTimer(totalSeconds: number): string {
  const minute = Math.floor(totalSeconds / 60);
  const second = totalSeconds % 60;
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

function RoleSelectPopover({
  configuredRoleId,
  profile,
  roles,
  onReportLocked,
  onSelect
}: {
  configuredRoleId?: string;
  profile: PlayerProfile;
  roles: RoleDefinition[];
  onReportLocked: (role: RoleDefinition) => void;
  onSelect: (role: RoleDefinition) => void;
}): JSX.Element {
  return (
    <section className="battle-scene-popover role-popover" aria-label="配置技能">
      {roles.map((role) => {
        const detail = roleSkillDetailForRole(role, roles);
        const state = bidKingHeroStateFromProfile(profile, bidKingHeroIdForRoleId(role.id, roles)).state;
        const locked = state === 'locked';
        const selected = configuredRoleId === role.id;
        return (
          <button
            className={`${selected ? 'selected' : ''} ${locked ? 'locked' : ''}`}
            key={role.id}
            onClick={() => locked ? onReportLocked(role) : onSelect(role)}
            type="button"
          >
            <img src={roleAvatarForRoleId(role.id)} alt="" loading="lazy" />
            <span>
              <strong>{role.name}</strong>
              <em>{detail.active}</em>
            </span>
            {selected && <Check size={22} />}
            {locked && <Lock size={20} />}
          </button>
        );
      })}
    </section>
  );
}

function ItemSelectPopover({
  configuredItemIds,
  profile,
  onToggle
}: {
  configuredItemIds: number[];
  profile: PlayerProfile;
  onToggle: (itemId: number) => void;
}): JSX.Element {
  return (
    <section className="battle-scene-popover item-popover" aria-label="配置藏品">
      <header>
        <span>
          <Filter size={22} />
          全部
        </span>
      </header>
      <div className="battle-scene-item-list">
        {bidKingBattleItems.slice(0, 36).map((item) => {
          const quantity = inventoryQuantity(profile, item.id);
          const selected = configuredItemIds.includes(item.id);
          return (
            <button
              className={`${selected ? 'selected' : ''} ${quantity > 0 ? '' : 'missing'}`}
              key={item.id}
              onClick={() => onToggle(item.id)}
              type="button"
              disabled={quantity <= 0 && !selected}
            >
              <BattleItemIcon item={item} />
              <span>
                <strong>{bidKingBattleItemDisplayName(item)}</strong>
                <em>{bidKingBattleItemDisplayDesc(item)}</em>
              </span>
              <small>数量：<b>{quantity}</b></small>
            </button>
          );
        })}
      </div>
      <footer>
        <Archive size={22} />
        默认配置{configuredItemIds.length}
      </footer>
    </section>
  );
}

function BattleItemIcon({ item }: { item: BidKingBattleItemRow }): JSX.Element {
  return (
    <span className={`battle-item-token quality-${item.item_quality}`}>
      {battleItemKindSymbol(item.battle_item_type)}
    </span>
  );
}

function EntryCostStat({
  bidMap,
  profile
}: {
  bidMap: BidKingBidMapRow;
  profile: PlayerProfile;
}): JSX.Element {
  const costs = bidKingBidMapEntryCosts(bidMap.id);
  const coinCost = costs.find((cost) => cost.refId === 1)?.quantity ?? 0;
  const itemCosts = costs.filter((cost) => cost.refId !== 1);
  return (
    <div className="battle-scene-stat cost">
      <span>消耗藏品</span>
      <strong>
        {coinCost > 0 && (
          <em className="coin-cost">
            <Coins size={25} />
            {formatChineseCompactCurrency(coinCost)}
          </em>
        )}
        {itemCosts.map((cost) => {
          const quantity = inventoryQuantity(profile, cost.refId);
          const missing = quantity < cost.quantity;
          return (
            <em className={missing ? 'missing' : ''} key={cost.refId}>
              <Ticket size={24} />
              {costItemName(cost.refId)} {quantity}/{cost.quantity}
            </em>
          );
        })}
        {coinCost <= 0 && itemCosts.length === 0 && <em>免费</em>}
      </strong>
    </div>
  );
}

function DetailStat({ label, value, icon }: { label: string; value: string; icon?: JSX.Element }): JSX.Element {
  return (
    <div className="battle-scene-stat">
      <span>{label}</span>
      <strong>{icon}{value}</strong>
    </div>
  );
}

function loadScenePrepareConfigStore(): ScenePrepareConfigStore {
  try {
    const raw = localStorage.getItem(SCENE_CONFIG_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as ScenePrepareConfigStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadScenePrepareConfig(parentMapId: number): ScenePrepareConfig | undefined {
  return loadScenePrepareConfigStore()[String(parentMapId)];
}

function saveScenePrepareConfig(parentMapId: number, config: ScenePrepareConfig): void {
  const store = loadScenePrepareConfigStore();
  store[String(parentMapId)] = {
    roleId: config.roleId,
    itemIds: sanitizeItemIds(config.itemIds),
    updatedAt: config.updatedAt
  };
  localStorage.setItem(SCENE_CONFIG_STORAGE_KEY, JSON.stringify(store));
}

function sanitizeItemIds(itemIds: readonly number[]): number[] {
  return [...new Set(itemIds.filter((id) => Number.isFinite(id)))].slice(0, MAX_SCENE_ITEM_COUNT);
}

function sceneDefaultBidMap(group: BidKingBattleMapGroup): BidKingBidMapRow | undefined {
  return group.children.find((bidMap) => bidKingIsDefaultUnknownBidMap(bidMap.id)) ?? group.children[0];
}

function displayBidMapVersionName(parent: BidKingMapRow, bidMap: BidKingBidMapRow): string {
  if (bidKingIsDefaultUnknownBidMap(bidMap.id)) {
    return `未知${unknownSceneNoun(parent, bidMap)}`;
  }
  return bidKingBidMapDisplayName(bidMap);
}

function unknownSceneNoun(parent: BidKingMapRow, bidMap: BidKingBidMapRow): string {
  const artKey = parent.art_key || bidMap.art_key;
  if (artKey.includes('ship')) {
    return '残舱';
  }
  if (artKey.includes('armory')) {
    return '军库';
  }
  if (artKey.includes('academy')) {
    return '书斋';
  }
  if (artKey.includes('black_market')) {
    return '残骸';
  }
  if (artKey.includes('battlefield')) {
    return '遗址';
  }
  return '旧藏';
}

function unknownSceneDescription(parent: BidKingMapRow): string {
  return `${bidKingParentMapName(parent)}内仍有来历不明的旧藏，内容混杂，需要在拍卖中逐轮辨认。`;
}

function bidKingParentMapName(parent: BidKingMapRow): string {
  return bidKingMapDisplayName(parent) || `场景 ${parent.id}`;
}

function mapModeClass(parent: BidKingMapRow): string {
  return parent.type === 1 ? 'sealed' : 'open';
}

function bidKingMapModeName(type?: number): string {
  if (type === 1) {
    return '暗拍模式';
  }
  if (type === 2) {
    return '明拍场';
  }
  return '标准明拍';
}

function bidKingBidMapDesc(bidMap: BidKingBidMapRow): string {
  return bidKingBidMapDisplayDesc(bidMap);
}

function costItemName(refId: number): string {
  const item = itemById(refId);
  return item ? bidKingItemDisplayName(item) : `凭证 ${refId}`;
}

function inventoryQuantity(profile: PlayerProfile, refId: number | string): number {
  const raw = String(refId);
  return profile.inventory
    .filter((entry) => entry.refId === raw || entry.refId === `compat_${raw}`)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

function riskName(risk: BidKingBidMapRow['risk']): string {
  const names: Record<BidKingBidMapRow['risk'], string> = {
    low: '较低',
    medium: '中',
    high: '高'
  };
  return names[risk];
}

function battleItemKindSymbol(type: number): string {
  if (type === 2) {
    return '◇';
  }
  if (type === 3) {
    return '□';
  }
  if (type === 4) {
    return '▣';
  }
  return '◎';
}

function battleItemShortName(item: BidKingBattleItemRow): string {
  return bidKingBattleItemDisplayName(item).split('·').at(-1)?.slice(0, 2) ?? String(item.id).slice(-2);
}
