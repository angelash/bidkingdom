import type { CSSProperties, ReactNode } from 'react';
import { Archive, ChevronRight, Gavel, Play, Shield, Sparkles, Users, X } from 'lucide-react';
import {
  bidKingBidGameCountChoices,
  bidKingBidRateChoices,
  bidKingDefaultRoundTimeSeconds,
  bidKingBidMapAccess,
  bidKingHeroIdForRoleId,
  bidKingHeroStateFromProfile,
  bidKingInitialCashChoices,
  bidKingInitialCashForBidMap,
  bidKingItemBudgetChoices,
  bidKingReliefFundRuntime,
  bidKingRoomPlayerCountChoices
} from '@bitkingdom/match-core';
import {
  BattleItem as bidKingBattleItems,
  RankMap as bidKingRankMaps,
  bidKingBidMapDisplayDesc,
  bidKingBidMapDisplayName,
  bidKingBattleItemDisplayDesc,
  bidKingBattleItemDisplayName,
  bidKingMapDisplayName,
  type BidKingBidMapRow,
  type BidKingMapRow
} from '@bitkingdom/bidking-compat';
import { gameConfig } from '@bitkingdom/config';
import type { CoreAuctionMode, PlayerProfile } from '@bitkingdom/shared';
import { containerArtForKey, roleAvatarForRoleId, rolePortraitForRoleId } from '../../artAssets';
import { roleSkillDetails } from '../bidder/roleSkillDetails';

export type BattlePrevTab = 'map' | 'hero' | 'items' | 'settings';

export interface BidKingBattleMapGroup {
  parent: BidKingMapRow;
  children: BidKingBidMapRow[];
  x: number;
  y: number;
}

type RoleDefinition = (typeof gameConfig.roles)[number];

interface BattlePrevPanelViewProps {
  botCount: number;
  coreAuctionMode: CoreAuctionMode;
  mapGroups: BidKingBattleMapGroup[];
  selectedBidMapId?: number;
  profile: PlayerProfile;
  selectedRole: RoleDefinition;
  selectedRoleId: string;
  tab: BattlePrevTab;
  onCancel: () => void;
  onConfirm: () => void;
  onSelectCoreAuctionMode: (mode: CoreAuctionMode) => void;
  onSelectBidMap: (bidMapId: number) => void;
  onSelectRole: (roleId: string) => void;
  onEquipBattleItems: (itemIds: number[]) => void;
  onSetBotCount: (value: number) => void;
  onSetTab: (tab: BattlePrevTab) => void;
}

export function BattlePrevPanelView({
  botCount,
  coreAuctionMode,
  mapGroups,
  selectedBidMapId,
  profile,
  selectedRole,
  selectedRoleId,
  tab,
  onCancel,
  onConfirm,
  onSelectCoreAuctionMode,
  onSelectBidMap,
  onSelectRole,
  onEquipBattleItems,
  onSetBotCount,
  onSetTab
}: BattlePrevPanelViewProps): JSX.Element {
  const selectedGroup = mapGroups.find((group) => group.children.some((map) => map.id === selectedBidMapId)) ?? mapGroups[0]!;
  const selectedBidMap = selectedGroup.children.find((map) => map.id === selectedBidMapId) ?? selectedGroup.children[0]!;
  const selectedParentMap = selectedGroup.parent;
  const selectedRankMap = bidKingRankMaps.find((rankMap) => rankMap.id === selectedBidMap.id);
  const selectedAccess = bidKingBidMapAccess(profile, selectedBidMap.id);
  const selectedInitialCash = bidKingInitialCashForBidMap(selectedBidMap.id, gameConfig.rules.initialCash);
  const sceneMode = modeForBidKingMap(selectedParentMap);
  const selectedRoleSkill = roleSkillDetails[selectedRole.skillId];
  const selectedMaxBotCount = Math.max(0, selectedBidMap.bidder_number - 1);
  const selectedBotCount = Math.min(botCount, selectedMaxBotCount);
  const tabs = [
    { id: 'map', label: '场地', icon: <Gavel size={16} /> },
    { id: 'hero', label: '竞买人', icon: <Users size={16} /> },
    { id: 'items', label: '试宝令', icon: <Archive size={16} /> },
    { id: 'settings', label: '局规', icon: <Shield size={16} /> }
  ] satisfies Array<{ id: BattlePrevTab; label: string; icon: ReactNode }>;

  return (
    <div className="battle-prev-backdrop" onMouseDown={onCancel}>
      <section className="battle-prev-shell" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="battle-prev-header">
          <div>
            <span>珍宝局 · 入场前</span>
            <h2>开拍前整备</h2>
          </div>
          <div className="battle-prev-flow">
            <span className="active">珍宝局</span>
            <ChevronRight size={15} />
            <span className="active">选仓</span>
            <ChevronRight size={15} />
            <span>召集</span>
            <ChevronRight size={15} />
            <span>开拍</span>
          </div>
          <button className="modal-close" type="button" onClick={onCancel} title="关闭">
            <X size={18} />
          </button>
        </header>

        <main className="battle-prev-body">
          <section className="battle-prev-map">
            <div className="battle-prev-map-bg" />
            <div className="battle-prev-route" />
            {mapGroups.map((group) => {
              const sample = group.children[0]!;
              const selected = group.parent.id === selectedParentMap.id;
              const mode = modeForBidKingMap(group.parent);
              const firstAvailable = group.children.find((bidMap) => bidKingBidMapAccess(profile, bidMap.id).canEnter);
              const access = firstAvailable ? bidKingBidMapAccess(profile, firstAvailable.id) : bidKingBidMapAccess(profile, sample.id);
              return (
                <button
                  className={`battle-prev-node risk-${sample.risk} mode-${mode} ${selected ? 'selected' : ''} ${access.canEnter ? '' : 'locked'}`}
                  disabled={!access.canEnter}
                  key={group.parent.id}
                  onClick={() => onSelectBidMap((firstAvailable ?? sample).id)}
                  style={{
                    '--node-x': `${group.x}%`,
                    '--node-y': `${group.y}%`,
                    '--node-art': `url(${containerArtForKey(group.parent.art_key || sample.art_key)})`
                  } as CSSProperties}
                  title={access.canEnter ? undefined : access.reasons.join('、')}
                  type="button"
                >
                  <span />
                  <strong>{bidKingParentMapName(group.parent)}</strong>
                  <small>{access.canEnter ? `${bidKingMapModeName(group.parent.type)} · ${group.children.length} 仓型` : access.reasons[0]}</small>
                </button>
              );
            })}
          </section>

          <aside className="battle-prev-detail">
            <div className="battle-prev-tabs">
              {tabs.map((entry) => (
                <button className={tab === entry.id ? 'active' : ''} key={entry.id} onClick={() => onSetTab(entry.id)} type="button">
                  {entry.icon}
                  <span>{entry.label}</span>
                </button>
              ))}
            </div>

            <section className="battle-prev-card">
              <img src={containerArtForKey(selectedBidMap.art_key)} alt="" loading="lazy" />
              <div>
                <span>拍场仓单</span>
                <h3>{bidKingDisplayBidMapName(selectedBidMap)}</h3>
                <p>{bidKingParentMapName(selectedParentMap)} · {selectedBidMap.packaged_tags.join(' / ')}</p>
              </div>
            </section>

            {tab === 'map' && (
              <div className="battle-prev-map-rules">
                <div className="battle-prev-stack">
                  <DetailStat label="模式" value={bidKingMapModeName(selectedParentMap.type)} />
                  <DetailStat label="风险" value={riskName(selectedBidMap.risk)} />
                  <DetailStat label="人数" value={`${selectedBidMap.bidder_number} 人同局`} />
                  <DetailStat label="格数" value={`${selectedBidMap.map_cell} 格`} />
                  <DetailStat label="时间" value={bidKingRoundTimes(selectedBidMap)} />
                  <DetailStat label="起始资金" value={formatCompactCurrency(selectedInitialCash)} />
                  <DetailStat label="最低出价" value={bidKingMinBidLabel(selectedRankMap)} />
                </div>
                <BidKingBidMapSelector
                  bidMaps={selectedGroup.children}
                  selectedBidMapId={selectedBidMap.id}
                  onSelect={onSelectBidMap}
                  profile={profile}
                />
                <BidKingRuleSummary bidMap={selectedBidMap} profile={profile} rankMap={selectedRankMap} />
              </div>
            )}

            {tab === 'hero' && (
              <div className="battle-prev-hero">
                <RoleDetailView role={selectedRole} selected onSelect={() => onSelectRole(selectedRoleId)} />
                <div className="battle-prev-role-grid">
                  {gameConfig.roles.slice(0, 12).map((role) => (
                    <RoleChoiceButton
                      key={role.id}
                      role={role}
                      selected={role.id === selectedRoleId}
                      state={bidKingHeroStateFromProfile(profile, bidKingHeroIdForRoleId(role.id, gameConfig.roles)).state}
                      onSelect={() => onSelectRole(role.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {tab === 'items' && (
              <BattlePrevItemChoose profile={profile} onEquipBattleItems={onEquipBattleItems} />
            )}

            {tab === 'settings' && (
              <div className="battle-prev-settings">
                <ModeSelector mode={sceneMode} onSelect={onSelectCoreAuctionMode} disabled />
                <button className="scene-mode-apply" type="button" onClick={() => onSelectCoreAuctionMode(sceneMode)}>
                  <Gavel size={16} />
                  <span>场地默认</span>
                  <strong>{auctionModeName(sceneMode)}</strong>
                </button>
                <label>
                  随从
                  <input type="range" min="0" max={selectedMaxBotCount} value={selectedBotCount} onChange={(event) => onSetBotCount(Number(event.target.value))} />
                  <span>{selectedBotCount}/{selectedMaxBotCount}</span>
                </label>
                <p>
                  {selectedRole.name} · {selectedRoleSkill.short} · 场地写入 {auctionModeName(sceneMode)}
                  {coreAuctionMode !== sceneMode ? `（覆盖${auctionModeName(coreAuctionMode)}）` : ''}
                </p>
              </div>
            )}

            <footer className="battle-prev-actions">
              <button type="button" onClick={onCancel}>返回珍宝局</button>
              <button className="primary" type="button" onClick={onConfirm} disabled={!selectedAccess.canEnter}>
                <Play size={18} />
                {selectedAccess.canEnter ? '确认开拍' : selectedAccess.reasons[0]}
              </button>
            </footer>
          </aside>
        </main>
      </section>
    </div>
  );
}

function BattlePrevItemChoose({
  profile,
  onEquipBattleItems
}: {
  profile: PlayerProfile;
  onEquipBattleItems: (itemIds: number[]) => void;
}): JSX.Element {
  const equippedIds = profile.equippedBattleItems.map((entry) => entry.itemId);
  const ownedBattleItems = bidKingBattleItems
    .filter((item) => inventoryQuantity(profile, item.id) > 0)
    .slice(0, 18);
  const itemRows = ownedBattleItems.length > 0 ? ownedBattleItems : bidKingBattleItems.slice(0, 12);

  function toggleItem(itemId: number): void {
    const nextIds = equippedIds.includes(itemId)
      ? equippedIds.filter((id) => id !== itemId)
      : [...equippedIds, itemId].slice(0, 3);
    onEquipBattleItems(nextIds);
  }

  return (
    <div className="battle-prev-items-panel">
      <header>
        <div>
          <span>试宝令 / 战前携带</span>
          <strong>试宝令</strong>
        </div>
        <em>{equippedIds.length}/3 已携带</em>
      </header>
      <div className="battle-prev-item-grid">
        {itemRows.map((item) => {
          const quantity = inventoryQuantity(profile, item.id);
          const equipped = equippedIds.includes(item.id);
          const disabled = quantity <= 0 && !equipped;
          return (
            <article className={`battle-prev-item-card quality-${item.item_quality} ${equipped ? 'equipped' : ''}`} key={item.id}>
              <span>品阶 {item.item_quality} · {battleItemKindLabel(item.battle_item_type)}</span>
              <strong>{bidKingBattleItemDisplayName(item)}</strong>
              <p>{bidKingBattleItemDisplayDesc(item)}</p>
              <em>库存 {quantity}</em>
              <button disabled={disabled} onClick={() => toggleItem(item.id)} type="button">
                {equipped ? '卸下' : quantity > 0 ? '携带' : '未拥有'}
              </button>
            </article>
          );
        })}
      </div>
      {ownedBattleItems.length === 0 && <p className="muted">可先在宝铺购入试宝令；未拥有项仅作预览。</p>}
    </div>
  );
}

function BidKingBidMapSelector({
  bidMaps,
  selectedBidMapId,
  onSelect,
  profile
}: {
  bidMaps: BidKingBidMapRow[];
  selectedBidMapId: number;
  onSelect: (bidMapId: number) => void;
  profile: PlayerProfile;
}): JSX.Element {
  return (
    <div className="bidmap-toggle-grid" aria-label="仓型选择">
      {bidMaps.map((bidMap) => {
        const access = bidKingBidMapAccess(profile, bidMap.id);
        return (
          <button
            className={`${bidMap.id === selectedBidMapId ? 'selected' : ''} ${access.canEnter ? '' : 'locked'}`}
            disabled={!access.canEnter}
            key={bidMap.id}
            onClick={() => onSelect(bidMap.id)}
            title={access.canEnter ? undefined : access.reasons.join('、')}
            type="button"
          >
            <strong>{bidKingDisplayBidMapName(bidMap)}</strong>
            <span>{access.canEnter ? `${bidMap.map_cell}格 · ${riskName(bidMap.risk)} · ${bidKingRoundTimes(bidMap)}` : access.reasons[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

function BidKingRuleSummary({
  bidMap,
  profile,
  rankMap
}: {
  bidMap: BidKingBidMapRow;
  profile: PlayerProfile;
  rankMap?: (typeof bidKingRankMaps)[number];
}): JSX.Element {
  const roundRules = bidMap.auction_rounds_rate.map((rate, index) => {
    const label = rate > 0 ? `${Math.round(rate / 10)}%` : '最终';
    return { id: `${bidMap.id}_${index}`, label: `第${index + 1}轮`, value: label };
  });
  const minBidRanges = rankMap?.min_bid_range
    .filter((range) => range.length >= 2)
    .map((range) => `${formatCompactCurrency(range[0] ?? 0)}-${formatCompactCurrency(range[1] ?? range[0] ?? 0)}`)
    .slice(0, 3);
  const skillGroups = bidMap.map_random_skill.filter((groupId) => groupId > 0);
  const reliefFund = bidKingReliefFundRuntime();
  const access = bidKingBidMapAccess(profile, bidMap.id);
  const initialCash = bidKingInitialCashForBidMap(bidMap.id, gameConfig.rules.initialCash);
  return (
    <section className="bidking-rule-summary">
      <div className="bidking-round-rate">
        {roundRules.map((rule) => (
          <span key={rule.id}>
            <small>{rule.label}</small>
            <strong>{rule.value}</strong>
          </span>
        ))}
      </div>
      <div className="bidking-rule-list">
        <p><strong>入场</strong>{bidKingCostText(bidMap)}</p>
        <p><strong>状态</strong>{access.canEnter ? '可入场' : access.reasons.join(' / ')}</p>
        <p><strong>起始资金</strong>{formatCompactCurrency(initialCash)} · 档位 {bidKingInitialCashChoices().map(formatCompactCurrency).join(' / ')}</p>
        <p><strong>产出</strong>{bidMap.item_count_min}-{bidMap.item_count_max} 件 · {bidKingBidMapDesc(bidMap)}</p>
        <p><strong>最低价池</strong>{minBidRanges?.join(' / ') || '-'}</p>
        <p><strong>估值预算</strong>{bidKingItemBudgetChoices().map(formatCompactCurrency).join(' / ')}</p>
        <p><strong>房间参数</strong>{bidKingBidGameCountChoices().join('/')} 局 · {bidKingRoomPlayerCountChoices().join('/')} 人 · {bidKingDefaultRoundTimeSeconds()} 秒/轮</p>
        <p><strong>出价倍率</strong>{bidKingBidRateChoices().map((rate) => (rate > 0 ? `${(rate / 1000).toFixed(1)}x` : '停手')).join(' / ')}</p>
        <p><strong>救济金</strong>{reliefFund.times} 次 · 低于 {formatCompactCurrency(reliefFund.limit)} 可补 {formatCompactCurrency(reliefFund.rewardRows[0]?.[2] ?? 0)}</p>
        <p><strong>场地机缘</strong>{skillGroups.length > 0 ? skillGroups.map((groupId) => `机缘 ${groupId}`).join(' / ') : '无'}</p>
      </div>
    </section>
  );
}

function RoleDetailView({
  role,
  selected,
  onSelect
}: {
  role: RoleDefinition;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const skill = roleSkillDetails[role.skillId];
  return (
    <div className="role-detail-view" style={{ '--role-color': role.color } as CSSProperties}>
      <div className="role-detail-hero">
        <img src={rolePortraitForRoleId(role.id)} alt="" loading="lazy" />
        <div>
          <span>{role.animal}</span>
          <h3>{role.name}</h3>
          <p>{skill.positioning}</p>
        </div>
      </div>
      <div className="detail-stat-grid">
        <span>
          <small>定位</small>
          <strong>{role.archetype}</strong>
        </span>
        <span>
          <small>冷却</small>
          <strong>{role.cooldownRounds} 轮</strong>
        </span>
        <span>
          <small>次数</small>
          <strong>{role.usesPerMatch} 次/局</strong>
        </span>
        <span>
          <small>上手</small>
          <strong>{skill.difficulty}</strong>
        </span>
      </div>
      <section className="detail-block">
        <strong>主动掌眼 · {skill.skillName}</strong>
        <p>{skill.active}</p>
      </section>
      <section className="detail-block">
        <strong>被动特性</strong>
        <p>{role.passive}</p>
      </section>
      <section className="detail-block">
        <strong>使用建议</strong>
        <ul>
          {skill.tips.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      </section>
      <button className="primary" type="button" onClick={onSelect} disabled={selected}>
        <Sparkles size={18} />
        {selected ? '当前已选用' : '选用角色'}
      </button>
    </div>
  );
}

function RoleChoiceButton({
  role,
  selected,
  state,
  onSelect
}: {
  role: RoleDefinition;
  selected: boolean;
  state: string;
  onSelect: () => void;
}): JSX.Element {
  const selectable = state !== 'locked';
  return (
    <button
      className={`${selected ? 'selected' : ''} ${selectable ? `state-${state}` : 'locked'}`}
      disabled={!selectable}
      onClick={onSelect}
      style={{ '--role-color': role.color } as CSSProperties}
      title={selectable ? heroStateLabel(state) : '竞买人尚未解锁'}
      type="button"
    >
      <img src={roleAvatarForRoleId(role.id)} alt="" loading="lazy" />
      <span>{role.name}</span>
    </button>
  );
}

function heroStateLabel(state: string): string {
  if (state === 'owned') {
    return '已拥有';
  }
  if (state === 'free') {
    return '限免';
  }
  if (state === 'trial') {
    return '体验';
  }
  return '未拥有';
}

function DetailStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
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
    <div className="mode-selector" aria-label="拍卖模式">
      {([
        { mode: 'sealed', label: '暗拍', detail: '只公开排名' },
        { mode: 'open', label: '明拍', detail: '记录金额' }
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

function inventoryQuantity(profile: PlayerProfile, refId: number | string): number {
  return profile.inventory
    .filter((entry) => entry.refId === String(refId))
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

function modeForBidKingMap(parent: BidKingMapRow): CoreAuctionMode {
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

function bidKingParentMapName(parent: BidKingMapRow): string {
  return bidKingMapDisplayName(parent) || `场地 ${parent.id}`;
}

function bidKingDisplayBidMapName(bidMap: BidKingBidMapRow): string {
  return bidKingBidMapDisplayName(bidMap);
}

function bidKingBidMapDesc(bidMap: BidKingBidMapRow): string {
  return bidKingBidMapDisplayDesc(bidMap);
}

function bidKingRoundTimes(bidMap: BidKingBidMapRow): string {
  const times = [...new Set(bidMap.map_time.filter((seconds) => seconds > 0))];
  if (times.length === 0) {
    return '-';
  }
  if (times.length === 1) {
    return `${times[0]}s x${bidMap.map_time.length}`;
  }
  return times.map((seconds) => `${seconds}s`).join('/');
}

function bidKingMinBidLabel(rankMap?: (typeof bidKingRankMaps)[number]): string {
  const values = rankMap?.min_bid_range
    .filter((range) => range.length >= 2)
    .flatMap((range) => [range[0] ?? 0, range[1] ?? range[0] ?? 0])
    .filter((value) => value > 0);
  if (!values || values.length === 0) {
    return '-';
  }
  return `${formatCompactCurrency(Math.min(...values))}-${formatCompactCurrency(Math.max(...values))}`;
}

function bidKingCostText(bidMap: BidKingBidMapRow): string {
  const currencyCost = bidMap.currency_cost[2] ?? 0;
  const required = bidMap.required_items[0]?.[2] ?? 0;
  const parts = [
    currencyCost > 0 ? `${formatCompactCurrency(currencyCost)} 铜钱` : undefined,
    required > 0 ? `门槛 ${formatCompactCurrency(required)}` : undefined
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : '免费';
}

function riskName(risk: BidKingBidMapRow['risk']): string {
  const names: Record<BidKingBidMapRow['risk'], string> = {
    low: '低',
    medium: '中',
    high: '高'
  };
  return names[risk];
}

function battleItemKindLabel(type: number): string {
  if (type === 2) {
    return '估值';
  }
  if (type === 3) {
    return '验伪';
  }
  if (type === 4) {
    return '封箱';
  }
  return '掌眼';
}

function auctionModeName(mode: string): string {
  const names: Record<string, string> = {
    open: '明拍',
    sealed: '暗拍',
    second_price: '次高价',
    deposit_open: '押金明拍',
    flash: '闪拍'
  };
  return names[mode] ?? mode;
}

function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(abs >= 1_000_000_000 ? 1 : 2).replace(/\.0+$/, '')}亿`;
  }
  if (abs >= 10_000) {
    return `${(value / 10_000).toFixed(abs >= 100_000 ? 0 : 1).replace(/\.0$/, '')}万`;
  }
  return value.toLocaleString();
}
