import React, { useEffect, useState } from 'react';
import {
  Archive,
  Award,
  BadgeDollarSign,
  BookOpen,
  ChevronRight,
  ClipboardList,
  Crown,
  Gavel,
  Info,
  KeyRound,
  ListChecks,
  LogOut,
  Shield,
  Trophy,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { gameConfig } from '@bitkingdom/config';
import { bidKingBestAvailableBidMapId, bidKingSourceRoles } from '@bitkingdom/match-core';
import type { CoreAuctionMode, PlayerProfile, PublicPlayerAccount } from '@bitkingdom/shared';
import { containerArtForKey } from '../../artAssets';
import { sourcePathForOutgameHub, titleForOutgameHub, type BidKingOutgameHubWindowKey } from '../app/windowRegistry';
import { RechargePanelView, PassPanelView, type ActivityTargetView, type SimPlanView } from '../activity/ActivityPanels';
import {
  BattlePrevPanelView,
  type BidKingBattleMapGroup
} from '../battlePrev/BattlePrevPanelView';
import { BidderPanelView } from '../bidder/BidderPanelView';
import { CabinetBrowser } from '../cabinet/CabinetBrowser';
import { HandBookPanel } from '../catalog/HandBookPanel';
import { FriendPanelView } from '../friend/FriendPanelView';
import { ClubPanelView } from '../guild/ClubPanelView';
import { MailPanelView } from '../mail/MailPanelView';
import { AuctionHousePanelView, TradePanelView } from '../market/MarketPanels';
import { PackagePanelView } from '../package/PackagePanelView';
import { RankDetailPanel } from '../rank/RankDetailPanel';
import { ShopPanelView } from '../shop/ShopPanelView';
import { FeedbackPanelView, SettingsPanelView } from '../system/SystemPanels';
import {
  bidKingStartupNoticeQueue,
  nextBidKingGuideStep,
  safeBidKingDisplayText,
  translateBidKingLanguage,
  type BidKingStartupNotice
} from '../system/bidKingSystemRuntime';
import type { GameExceptionInput } from '../system/gameExceptionRuntime';
import { TaskDetailPanel } from '../task/TaskDetailPanel';
import { taskBoardDefinitions } from '../task/taskDefinitions';

type HallCatalogItem = (typeof gameConfig.items)[number] & {
  bidKingQuality?: number;
  collectionCoinPerHour?: number;
};

type OutgameHub = BidKingOutgameHubWindowKey;

export function MainHallView({
  catalogItems,
  defaultBidMapId,
  mapGroups,
  playerName,
  profile,
  account,
  selectedBidMapId,
  selectedRoleId,
  serverUrl,
  authError,
  resolveModeForBidMapId,
  onCreateRoom,
  onSelectBidMap,
  onSelectCoreAuctionMode,
  onSelectRole,
  onSelectHead,
  onSellAllCabinetItems,
  onClaimCollectionIncome,
  onClaimReliefFund,
  onUnlockHero,
  onSelectHeroSkin,
  onBuyItem,
  onRefreshShop,
  onSetShopItemCollection,
  onClaimMail,
  onDeleteMail,
  onMarkMailRead,
  onClaimMissionReward,
  onClaimAchievementReward,
  onClaimLevelReward,
  onClaimRankReward,
  onCreateMarketOrder,
  onActOnMarketOrder,
  onEquipBattleItems,
  onClaimActivityReward,
  onClaimGiftPackage,
  onRemoveFriend,
  onSetFriendRemark,
  onJoinGuild,
  onSetGuildRole,
  onApproveGuildMember,
  onKickGuildMember,
  onUpdateGuildNotice,
  onDonateGuildCoins,
  onClaimAreaResource,
  onClaimGuildResource,
  onUseGuildResource,
  onMarkNoticeRead,
  onCompleteGuide,
  onUpdateSettings,
  onApplyLanguageName,
  onChangeAccountPassword,
  onReportException,
  onSetBotCount,
  onLogoutAllAccounts,
  onLogoutAccount,
  onSetPlayerName,
  onUpgradeGuestAccount
}: {
  catalogItems: HallCatalogItem[];
  defaultBidMapId?: number;
  mapGroups: BidKingBattleMapGroup[];
  playerName: string;
  profile: PlayerProfile;
  account?: PublicPlayerAccount;
  selectedBidMapId?: number;
  selectedRoleId: string;
  serverUrl: string;
  authError?: string;
  resolveModeForBidMapId: (bidMapId?: number) => CoreAuctionMode | undefined;
  onCreateRoom: (selectedBidMapId?: number, roleId?: string) => boolean;
  onSelectBidMap: (bidMapId: number) => void;
  onSelectCoreAuctionMode: (mode: CoreAuctionMode) => void;
  onSelectRole: (roleId: string) => void;
  onSelectHead: (headId: string) => void;
  onSellAllCabinetItems: () => void;
  onClaimCollectionIncome: () => void;
  onClaimReliefFund: () => void;
  onUnlockHero: (heroId: number) => void;
  onSelectHeroSkin: (skinId: number) => void;
  onBuyItem: (shopItemId: number) => void;
  onRefreshShop: (shopId?: number) => void;
  onSetShopItemCollection: (itemId: number, collected: boolean) => void;
  onClaimMail: (mailId: string) => void;
  onDeleteMail: (mailId: string) => void;
  onMarkMailRead: (mailId: string) => void;
  onClaimMissionReward: (taskId: string) => void;
  onClaimAchievementReward: (achievementId: string) => void;
  onClaimLevelReward: (level: number) => void;
  onClaimRankReward: (rank: number) => void;
  onCreateMarketOrder: (refId: string, quantity: number, price: number, orderType: 'trade' | 'auction', note?: string) => void;
  onActOnMarketOrder: (orderId: string, action: 'settle' | 'cancel') => void;
  onEquipBattleItems: (itemIds: number[]) => void;
  onClaimActivityReward: (activityId: string) => void;
  onClaimGiftPackage: (packageId: string) => void;
  onRemoveFriend: (friendId: string) => void;
  onSetFriendRemark: (friendId: string, remark: string) => void;
  onJoinGuild: (areaId?: string) => void;
  onSetGuildRole: (roleId: string) => void;
  onApproveGuildMember: (applicantId: string) => void;
  onKickGuildMember: (memberId: string) => void;
  onUpdateGuildNotice: (notice: string) => void;
  onDonateGuildCoins: (amount: number) => void;
  onClaimAreaResource: (areaId?: string) => void;
  onClaimGuildResource: (resourceId: string) => void;
  onUseGuildResource: (resourceId: string, quantity?: number) => void;
  onMarkNoticeRead: (noticeId: string) => void;
  onCompleteGuide: (guideId: string) => void;
  onUpdateSettings: (settings: Record<string, string | number | boolean>) => void;
  onApplyLanguageName: () => void;
  onChangeAccountPassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  onReportException: (exception: GameExceptionInput) => void;
  onSetBotCount: (value: number) => void;
  onLogoutAllAccounts: () => void;
  onLogoutAccount: () => void;
  onSetPlayerName: (value: string) => void;
  onUpgradeGuestAccount: (accountName: string, password: string, playerName: string) => Promise<void>;
}): JSX.Element {
  const [activeHub, setActiveHub] = useState<OutgameHub>();
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [battlePrevOpen, setBattlePrevOpen] = useState(false);
  const [selectedBattleBidMapId, setSelectedBattleBidMapId] = useState(
    bidKingBestAvailableBidMapId(profile, selectedBidMapId) ?? selectedBidMapId ?? defaultBidMapId
  );
  const [dismissedStartupNoticeIds, setDismissedStartupNoticeIds] = useState<string[]>([]);
  const sourceRoles = bidKingSourceRoles(gameConfig.roles);
  const selectedRole = sourceRoles.find((role) => role.id === selectedRoleId) ?? sourceRoles[0] ?? gameConfig.roles[0]!;
  const startupNotice = bidKingStartupNoticeQueue([...(profile.readNotices ?? []), ...dismissedStartupNoticeIds], 1)[0];
  const guideTargetWindow = !battlePrevOpen && activeHub ? sourcePathForOutgameHub(activeHub) : undefined;
  const guideStep = guideTargetWindow ? nextBidKingGuideStep(profile.completedGuides ?? [], guideTargetWindow) : undefined;
  useEffect(() => {
    if (selectedBidMapId) {
      setSelectedBattleBidMapId(selectedBidMapId);
    }
  }, [selectedBidMapId]);
  useEffect(() => {
    setDismissedStartupNoticeIds([]);
  }, [profile.playerId]);
  const topShortcuts = [
    { key: 'recharge', label: '钱庄', icon: <BadgeDollarSign size={23} />, onClick: () => openHub('recharge') },
    { key: 'bag', label: '行囊', icon: <Archive size={23} />, onClick: () => openHub('package') },
    { key: 'pass', label: '珍宝令', icon: <Shield size={23} />, onClick: () => openHub('pass') },
    { key: 'rank', label: '名士榜', icon: <Trophy size={23} />, onClick: () => openHub('rank') },
    { key: 'task', label: '委托', icon: <ClipboardList size={23} />, onClick: () => openHub('tasks') },
    { key: 'handbook', label: '珍宝谱', icon: <BookOpen size={23} />, onClick: () => openHub('codex') }
  ];
  const bottomTabs = [
    { key: 'storage', label: '珍阁', en: '仓库', icon: <Archive size={19} />, onClick: () => openHub('cabinet') },
    { key: 'trade', label: '市集', en: '互市', icon: <BadgeDollarSign size={19} />, onClick: () => openHub('trade') },
    { key: 'auction', label: '拍场', en: '开拍', icon: <Gavel size={19} />, onClick: () => openHub('auctionHouse') },
    { key: 'shop', label: '宝铺', en: '补给', icon: <Crown size={19} />, onClick: () => openHub('shop') },
    { key: 'bidder', label: '竞买人', en: '名士', icon: <Users size={19} />, onClick: () => openHub('bidder') },
    { key: 'club', label: '鉴宝会', en: '会馆', icon: <Award size={19} />, onClick: () => openHub('club') }
  ];

  function openHub(panel: OutgameHub): void {
    setActiveHub(panel);
  }

  function openBattlePrev(): void {
    setSelectedBattleBidMapId(
      bidKingBestAvailableBidMapId(profile, selectedBidMapId ?? selectedBattleBidMapId)
        ?? selectedBidMapId
        ?? selectedBattleBidMapId
        ?? defaultBidMapId
    );
    setBattlePrevOpen(true);
  }

  function confirmBattlePrev(config?: { roleId?: string; itemIds?: number[] }): void {
    if (config?.roleId) {
      onSelectRole(config.roleId);
    }
    if (config?.itemIds) {
      onEquipBattleItems(config.itemIds);
    }
    if (selectedBattleBidMapId) {
      onSelectBidMap(selectedBattleBidMapId);
      const sceneMode = resolveModeForBidMapId(selectedBattleBidMapId);
      if (sceneMode) {
        onSelectCoreAuctionMode(sceneMode);
      }
    }
    if (onCreateRoom(selectedBattleBidMapId, config?.roleId)) {
      setBattlePrevOpen(false);
    }
  }

  function selectBattleBidMap(bidMapId: number): void {
    setSelectedBattleBidMapId(bidMapId);
    const sceneMode = resolveModeForBidMapId(bidMapId);
    if (sceneMode) {
      onSelectCoreAuctionMode(sceneMode);
    }
  }

  function markStartupNoticeRead(noticeId: string): void {
    setDismissedStartupNoticeIds((ids) => [...ids, noticeId]);
    onMarkNoticeRead(noticeId);
  }

  function confirmStartupNotice(notice: BidKingStartupNotice): void {
    markStartupNoticeRead(notice.id);
    if (notice.actionTarget) {
      setActiveHub(notice.actionTarget);
    }
  }

  function applySimPlan(plan: SimPlanView): void {
    onSetBotCount(plan.roomBotCount);
    setSelectedBattleBidMapId(
      bidKingBestAvailableBidMapId(profile, selectedBidMapId ?? selectedBattleBidMapId)
        ?? selectedBidMapId
        ?? selectedBattleBidMapId
        ?? defaultBidMapId
    );
    setBattlePrevOpen(true);
  }

  function openActivityTarget(target: ActivityTargetView): void {
    setActiveHub(target);
  }

  return (
    <section className="bidking-home">
      <header className="bk-home-top">
        <div className="bk-profile-card">
          <span className="bk-logo-mark">珍</span>
          <div className="bk-profile-copy">
            <input
              aria-label="掌柜名"
              className="bk-player-name"
              value={playerName}
              onChange={(event) => onSetPlayerName(event.target.value)}
              maxLength={12}
            />
            <span>{account ? `${account.kind === 'guest' ? '游客' : '账号'}:${account.accountName}` : `UID:${profile.playerId}`}</span>
            <div className="bk-profile-mini-actions">
              <button className="bk-feedback" type="button" onClick={() => openHub('feedback')}>
                <Info size={17} />
                呈报
              </button>
              <button className="bk-feedback" type="button" onClick={() => setAccountPanelOpen(true)}>
                {account?.kind === 'guest' ? <UserPlus size={17} /> : <KeyRound size={17} />}
                {account?.kind === 'guest' ? '绑定' : '账号'}
              </button>
              <button className="bk-feedback" type="button" onClick={onLogoutAccount}>
                <LogOut size={17} />
                切换
              </button>
            </div>
          </div>
        </div>

        <div className="bk-top-actions">
          <span className="bk-resource gold">
            <BadgeDollarSign size={24} />
            <strong>{profile.tickets.current}/{profile.tickets.max}</strong>
            <button type="button" onClick={() => openHub('recharge')}>+</button>
          </span>
          <span className="bk-resource silver">
            <Award size={24} />
            <strong>{Math.max(1, Math.round(profile.coins / 1000)).toLocaleString()}K</strong>
          </span>
          <button type="button" title="同游" onClick={() => openHub('friend')}>
            <Users size={24} />
          </button>
          <button type="button" title="信札" onClick={() => openHub('mail')}>
            <ClipboardList size={24} />
          </button>
          <button type="button" title="行囊" onClick={() => openHub('package')}>
            <Archive size={24} />
          </button>
          <button type="button" title="章程" onClick={() => openHub('settings')}>
            <Shield size={24} />
          </button>
        </div>
      </header>

      <main className="bk-home-scene">
        <section className="bk-main-board">
          <div className="bk-board-paper" />
        </section>

        <aside className="bk-right-shelf">
          <div className="bk-shortcut-row">
            {topShortcuts.map((shortcut) => (
              <button key={shortcut.key} onClick={shortcut.onClick} type="button">
                {shortcut.icon}
                <span>{shortcut.label}</span>
              </button>
            ))}
          </div>

          <button className="bk-pass-banner" type="button" onClick={() => openHub('pass')}>
            <img src={containerArtForKey('container_palace')} alt="" loading="lazy" />
            <span>珍宝令</span>
            <strong>令</strong>
          </button>

          <div className="bk-shelf-display" aria-hidden="true" />

          <button className="bk-auction-cta" type="button" onClick={openBattlePrev}>
            <span>开拍</span>
            <ChevronRight size={40} />
            <ChevronRight size={40} />
          </button>
        </aside>
      </main>

      <nav className="bk-bottom-tabs" aria-label="主界面模块">
        {bottomTabs.map((tab) => (
          <button key={tab.key} onClick={tab.onClick} type="button">
            {tab.icon}
            <strong>{tab.label}</strong>
            <span>{tab.en}</span>
          </button>
        ))}
      </nav>

      {startupNotice && !activeHub && !battlePrevOpen && (
        <aside className="startup-notice-card" role="dialog" aria-label="启动公告">
          <span>{startupNotice.typeLabel}</span>
          <strong>{startupNotice.title}</strong>
          <p>{startupNotice.body}</p>
          {startupNotice.actionTarget && <em>{titleForOutgameHub(startupNotice.actionTarget)}</em>}
          {startupNotice.hasCancel && (
            <button type="button" onClick={() => markStartupNoticeRead(startupNotice.id)}>
              {translateBidKingLanguage(startupNotice.cancelLabelKey, profile.settings.languageColumn ?? 1, startupNotice.cancelLabelKey)}
            </button>
          )}
          <button type="button" onClick={() => confirmStartupNotice(startupNotice)}>
            {translateBidKingLanguage(startupNotice.okLabelKey, profile.settings.languageColumn ?? 1, startupNotice.okLabelKey)}
          </button>
        </aside>
      )}

      {guideStep && (
        <aside
          className="guide-overlay-card"
          data-delay-ms={guideStep.delayMs}
          data-dynamic={guideStep.isDynamic ? 'true' : 'false'}
          data-mask-alpha={guideStep.maskAlpha}
          role="note"
          aria-label="引导目标"
        >
          <strong>{safeBidKingDisplayText(guideStep.title, '引导目标') || '引导目标'}</strong>
          <p>{guideWindowDisplayLabel(guideStep.targetWindow)} · {guideStepDisplayText(guideStep.textKey, guideStep.targetNode, Number(profile.settings.languageColumn ?? 1))}</p>
          <em>{guideStep.anchor ? `(${guideStep.anchor.x}, ${guideStep.anchor.y})` : '等待触发'}</em>
          <button type="button" onClick={() => onCompleteGuide(guideStep.id)}>完成</button>
        </aside>
      )}
      {accountPanelOpen && (
        <DetailModal eyebrow="珍宝局" title={account?.kind === 'guest' ? '绑定账号' : '账号管理'} onClose={() => setAccountPanelOpen(false)}>
          <AccountManagePanel
            account={account}
            authError={authError}
            playerName={playerName}
            onChangePassword={onChangeAccountPassword}
            onClose={() => setAccountPanelOpen(false)}
            onLogoutAll={onLogoutAllAccounts}
            onUpgradeGuestAccount={onUpgradeGuestAccount}
          />
        </DetailModal>
      )}

      {activeHub === 'codex' && (
        <HandBookPanel
          items={catalogItems}
          onClose={() => setActiveHub(undefined)}
        />
      )}
      {activeHub === 'package' && (
        <PackagePanelView
          profile={profile}
          roles={gameConfig.roles}
          serverUrl={serverUrl}
          onClose={() => setActiveHub(undefined)}
          onClaimCollectionIncome={onClaimCollectionIncome}
          onClaimReliefFund={onClaimReliefFund}
        />
      )}
      {activeHub === 'bidder' && (
        <BidderPanelView
          profile={profile}
          roles={gameConfig.roles}
          selectedRoleId={selectedRoleId}
          onClose={() => setActiveHub(undefined)}
          onUnlockHero={onUnlockHero}
          onSelectHeroSkin={onSelectHeroSkin}
          onSelectRole={onSelectRole}
        />
      )}
      {activeHub && !['codex', 'package', 'bidder'].includes(activeHub) && (
        <DetailModal
          bodyClassName={activeHub === 'cabinet' ? 'cabinet-modal-body' : undefined}
          eyebrow="珍宝局"
          panelClassName={activeHub === 'cabinet' ? 'cabinet-modal' : undefined}
          title={titleForOutgameHub(activeHub)}
          onClose={() => setActiveHub(undefined)}
        >
          {activeHub === 'tasks' && (
            <div className="task-modal-combo">
              <TaskDetailPanel
                profile={profile}
                onClaimMissionReward={onClaimMissionReward}
                onClaimAchievementReward={onClaimAchievementReward}
                onClaimLevelReward={onClaimLevelReward}
              />
              <TaskBoard profile={profile} />
            </div>
          )}
          {activeHub === 'rank' && <RankDetailPanel profile={profile} serverUrl={serverUrl} onClaimRankReward={onClaimRankReward} />}
          {activeHub === 'mail' && (
            <MailPanelView
              profile={profile}
              onClaimMail={onClaimMail}
              onDeleteMail={onDeleteMail}
              onMarkMailRead={onMarkMailRead}
            />
          )}
          {activeHub === 'friend' && (
            <FriendPanelView
              profile={profile}
              onRemoveFriend={onRemoveFriend}
              onSetFriendRemark={onSetFriendRemark}
              onSelectHead={onSelectHead}
            />
          )}
          {activeHub === 'settings' && (
            <SettingsPanelView profile={profile} onApplyLanguageName={onApplyLanguageName} onUpdateSettings={onUpdateSettings} />
          )}
          {activeHub === 'feedback' && (
            <FeedbackPanelView profile={profile} onCompleteGuide={onCompleteGuide} onMarkNoticeRead={onMarkNoticeRead} />
          )}
          {activeHub === 'trade' && <TradePanelView profile={profile} serverUrl={serverUrl} onBuyItem={onBuyItem} onCreateMarketOrder={onCreateMarketOrder} onActOnMarketOrder={onActOnMarketOrder} />}
          {activeHub === 'auctionHouse' && <AuctionHousePanelView profile={profile} serverUrl={serverUrl} onBuyItem={onBuyItem} onCreateMarketOrder={onCreateMarketOrder} onActOnMarketOrder={onActOnMarketOrder} />}
          {activeHub === 'club' && (
            <ClubPanelView
              profile={profile}
              serverUrl={serverUrl}
              onJoinGuild={onJoinGuild}
              onSetGuildRole={onSetGuildRole}
              onApproveGuildMember={onApproveGuildMember}
              onKickGuildMember={onKickGuildMember}
              onUpdateGuildNotice={onUpdateGuildNotice}
              onDonateGuildCoins={onDonateGuildCoins}
              onClaimAreaResource={onClaimAreaResource}
              onClaimGuildResource={onClaimGuildResource}
              onUseGuildResource={onUseGuildResource}
            />
          )}
          {activeHub === 'recharge' && (
            <RechargePanelView
              profile={profile}
              onClaimGiftPackage={onClaimGiftPackage}
            />
          )}
          {activeHub === 'pass' && (
            <PassPanelView
              profile={profile}
              serverUrl={serverUrl}
              onApplySimPlan={applySimPlan}
              onClaimActivityReward={onClaimActivityReward}
              onOpenActivityTarget={openActivityTarget}
            />
          )}
          {activeHub === 'cabinet' && (
            <CabinetBrowser
              items={catalogItems}
              profile={profile}
              onSellAllCabinetItems={onSellAllCabinetItems}
            />
          )}
          {activeHub === 'shop' && (
            <ShopPanelView
              profile={profile}
              onBuyItem={onBuyItem}
              onRefreshShop={onRefreshShop}
              onSetShopItemCollection={onSetShopItemCollection}
            />
          )}
        </DetailModal>
      )}
      {battlePrevOpen && (
        <BattlePrevPanelView
          mapGroups={mapGroups}
          selectedBidMapId={selectedBattleBidMapId}
          profile={profile}
          selectedRole={selectedRole}
          selectedRoleId={selectedRoleId}
          onCancel={() => setBattlePrevOpen(false)}
          onConfirm={confirmBattlePrev}
          onSelectBidMap={selectBattleBidMap}
          onSelectRole={onSelectRole}
          onReportException={onReportException}
          onEquipBattleItems={onEquipBattleItems}
        />
      )}
    </section>
  );
}

function AccountManagePanel({
  account,
  authError,
  playerName,
  onChangePassword,
  onClose,
  onLogoutAll,
  onUpgradeGuestAccount
}: {
  account?: PublicPlayerAccount;
  authError?: string;
  playerName: string;
  onChangePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  onClose: () => void;
  onLogoutAll: () => void;
  onUpgradeGuestAccount: (accountName: string, password: string, playerName: string) => Promise<void>;
}): JSX.Element {
  const [accountName, setAccountName] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submitUpgrade(): Promise<void> {
    setBusy(true);
    setMessage(undefined);
    try {
      await onUpgradeGuestAccount(accountName, password, playerName);
      onClose();
    } catch {
      // The app state owns the user-facing auth error.
    } finally {
      setBusy(false);
    }
  }

  async function submitPasswordChange(): Promise<void> {
    setBusy(true);
    setMessage(undefined);
    try {
      await onChangePassword(currentPassword, nextPassword);
      setCurrentPassword('');
      setNextPassword('');
      setMessage('密码已更新');
    } catch {
      // The app state owns the user-facing auth error.
    } finally {
      setBusy(false);
    }
  }

  if (account?.kind === 'guest') {
    return (
      <section className="account-manage-panel">
        <div className="account-manage-summary">
          <span>当前档案</span>
          <strong>{account.displayName}</strong>
          <em>{account.profileId}</em>
        </div>
        <label>
          账号
          <input value={accountName} onChange={(event) => setAccountName(event.target.value)} maxLength={32} autoComplete="username" />
        </label>
        <label>
          密码
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" maxLength={72} autoComplete="new-password" />
        </label>
        {authError && <p className="account-gate-error">{authError}</p>}
        <button className="primary" type="button" disabled={busy} onClick={() => void submitUpgrade()}>
          <UserPlus size={18} />
          {busy ? '处理中' : '绑定当前档案'}
        </button>
      </section>
    );
  }

  return (
    <section className="account-manage-panel">
      <div className="account-manage-summary">
        <span>账号</span>
        <strong>{account?.accountName ?? '未登录'}</strong>
        <em>{account?.profileId ?? ''}</em>
      </div>
      <label>
        当前密码
        <input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" maxLength={72} autoComplete="current-password" />
      </label>
      <label>
        新密码
        <input value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} type="password" maxLength={72} autoComplete="new-password" />
      </label>
      {(authError || message) && <p className={authError ? 'account-gate-error' : 'account-manage-message'}>{authError ?? message}</p>}
      <div className="account-manage-actions">
        <button className="primary" type="button" disabled={busy} onClick={() => void submitPasswordChange()}>
          <KeyRound size={18} />
          {busy ? '处理中' : '修改密码'}
        </button>
        <button type="button" onClick={onLogoutAll}>
          <LogOut size={18} />
          退出全部设备
        </button>
      </div>
    </section>
  );
}

function guideWindowDisplayLabel(targetWindow: string): string {
  const labels: Record<string, string> = {
    Battle_Main: '竞拍局内',
    UIMain: '珍宝局主厅'
  };
  return labels[targetWindow] ?? '引导目标';
}

function guideStepDisplayText(textKey: string, targetNode: string, languageColumn: number): string {
  const translated = safeBidKingDisplayText(translateBidKingLanguage(textKey, languageColumn, ''), '');
  if (translated && translated !== '文书条目') {
    return translated;
  }
  return `前往${guideNodeDisplayLabel(targetNode)}`;
}

function guideNodeDisplayLabel(targetNode: string): string {
  const lastSegment = targetNode.split('/').filter(Boolean).at(-1) ?? targetNode;
  if (!lastSegment || /^[A-Za-z]+[_A-Za-z0-9]*$/.test(lastSegment)) {
    return '界面目标';
  }
  return safeBidKingDisplayText(lastSegment, '界面目标') || '界面目标';
}

function DetailModal({
  bodyClassName,
  eyebrow,
  panelClassName,
  title,
  children,
  onClose
}: {
  bodyClassName?: string;
  eyebrow: string;
  panelClassName?: string;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}): JSX.Element {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="detail-modal-backdrop" onMouseDown={onClose}>
      <section className={`detail-modal ${panelClassName ?? ''}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="detail-modal-header">
          <div>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </header>
        <div className={`detail-modal-body ${bodyClassName ?? ''}`}>{children}</div>
      </section>
    </div>
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
