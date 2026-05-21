import type { CoreAuctionMode, PlayerProfile, PublicPlayerAccount } from '@bitkingdom/shared';
import { modeForBidMapId } from '../battlePrev/bidMapRuntime';
import type { BidKingBattleMapGroup } from '../battlePrev/BattlePrevPanelView';
import { codexCatalogItems } from '../catalog/codexRuntime';
import type { ProfileActions } from '../profile/useProfileActions';
import type { RoomActions } from '../room/useRoomActions';
import { MainHallView } from './MainHallView';

interface MainHallRouteProps {
  botCount: number;
  coreAuctionMode: CoreAuctionMode;
  defaultBidMapId?: number;
  mapGroups: BidKingBattleMapGroup[];
  playerName: string;
  profile: PlayerProfile;
  account?: PublicPlayerAccount;
  profileActions: ProfileActions;
  roomActions: RoomActions;
  selectedBidMapId?: number;
  selectedRoleId: string;
  serverUrl: string;
  authError?: string;
  onChangeAccountPassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  onSetBotCount: (value: number) => void;
  onLogoutAllAccounts: () => void;
  onLogoutAccount: () => void;
  onSetPlayerName: (value: string) => void;
  onUpgradeGuestAccount: (accountName: string, password: string, playerName: string) => Promise<void>;
}

export function MainHallRoute({
  botCount,
  coreAuctionMode,
  defaultBidMapId,
  mapGroups,
  playerName,
  profile,
  account,
  profileActions,
  roomActions,
  selectedBidMapId,
  selectedRoleId,
  serverUrl,
  authError,
  onChangeAccountPassword,
  onSetBotCount,
  onLogoutAllAccounts,
  onLogoutAccount,
  onSetPlayerName,
  onUpgradeGuestAccount
}: MainHallRouteProps): JSX.Element {
  return (
    <MainHallView
      botCount={botCount}
      catalogItems={codexCatalogItems}
      coreAuctionMode={coreAuctionMode}
      defaultBidMapId={defaultBidMapId}
      mapGroups={mapGroups}
      playerName={playerName}
      profile={profile}
      account={account}
      selectedBidMapId={selectedBidMapId}
      selectedRoleId={selectedRoleId}
      serverUrl={serverUrl}
      authError={authError}
      resolveModeForBidMapId={modeForBidMapId}
      onCreateRoom={roomActions.createRoom}
      onSelectBidMap={roomActions.selectBidMap}
      onSelectCoreAuctionMode={roomActions.selectCoreAuctionMode}
      onSelectRole={roomActions.selectRole}
      onSelectHead={profileActions.selectHead}
      onSellAllCabinetItems={profileActions.sellAllCabinetItems}
      onClaimCollectionIncome={profileActions.claimCollectionIncome}
      onClaimReliefFund={profileActions.claimReliefFund}
      onSelectHeroSkin={profileActions.selectHeroSkin}
      onBuyItem={profileActions.buyShopItem}
      onRefreshShop={profileActions.refreshShop}
      onSetShopItemCollection={profileActions.setShopItemCollection}
      onClaimMail={profileActions.claimMail}
      onDeleteMail={profileActions.deleteMail}
      onMarkMailRead={profileActions.markMailRead}
      onClaimMissionReward={profileActions.claimMissionReward}
      onClaimAchievementReward={profileActions.claimAchievementReward}
      onClaimLevelReward={profileActions.claimLevelReward}
      onClaimRankReward={profileActions.claimRankReward}
      onCreateMarketOrder={profileActions.createMarketOrder}
      onActOnMarketOrder={profileActions.actOnMarketOrder}
      onEquipBattleItems={profileActions.equipBattleItems}
      onClaimActivityReward={profileActions.claimActivityReward}
      onClaimGiftPackage={profileActions.claimGiftPackage}
      onCreateDemoPayOrder={profileActions.createDemoPayOrder}
      onCompleteDemoPayOrder={profileActions.completeDemoPayOrder}
      onCancelDemoPayOrder={profileActions.cancelDemoPayOrder}
      onCompletePurchaseListOrder={profileActions.completePurchaseListOrder}
      onUnlockDemoDlc={profileActions.unlockDemoDlc}
      onAddDemoFriend={profileActions.addDemoFriend}
      onRemoveFriend={profileActions.removeFriend}
      onSetFriendRemark={profileActions.setFriendRemark}
      onJoinGuild={profileActions.joinGuild}
      onSetGuildRole={profileActions.setGuildRole}
      onAddDemoGuildApplication={profileActions.addDemoGuildApplication}
      onApproveGuildMember={profileActions.approveGuildMember}
      onKickGuildMember={profileActions.kickGuildMember}
      onUpdateGuildNotice={profileActions.updateGuildNotice}
      onDonateGuildCoins={profileActions.donateGuildCoins}
      onClaimAreaResource={profileActions.claimAreaResource}
      onClaimGuildResource={profileActions.claimGuildResource}
      onUseGuildResource={profileActions.useGuildResource}
      onMarkNoticeRead={profileActions.markNoticeRead}
      onCompleteGuide={profileActions.completeGuide}
      onUpdateSettings={profileActions.updateProfileSettings}
      onApplyLanguageName={profileActions.applyLanguageName}
      onChangeAccountPassword={onChangeAccountPassword}
      onSetBotCount={onSetBotCount}
      onLogoutAllAccounts={onLogoutAllAccounts}
      onLogoutAccount={onLogoutAccount}
      onSetPlayerName={onSetPlayerName}
      onUpgradeGuestAccount={onUpgradeGuestAccount}
    />
  );
}
