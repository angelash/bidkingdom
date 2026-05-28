import type { PlayerProfile, PublicPlayerAccount } from '@bitkingdom/shared';
import { bidKingHeroIdForRoleId } from '@bitkingdom/match-core';
import { gameConfig } from '@bitkingdom/config';
import { modeForBidMapId } from '../battlePrev/bidMapRuntime';
import type { BattlePrevMatchmakingState, BidKingBattleMapGroup } from '../battlePrev/BattlePrevPanelView';
import { codexCatalogItems } from '../catalog/codexRuntime';
import type { ProfileActions } from '../profile/useProfileActions';
import type { RoomActions } from '../room/useRoomActions';
import { MainHallView } from './MainHallView';
import type { GameExceptionInput } from '../system/gameExceptionRuntime';

interface MainHallRouteProps {
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
  sessionToken?: string;
  authError?: string;
  matchmaking?: BattlePrevMatchmakingState;
  onCancelMatchmaking: () => void;
  onChangeAccountPassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  onReportException: (exception: GameExceptionInput) => void;
  onSetBotCount: (value: number) => void;
  onLogoutAllAccounts: () => void;
  onLogoutAccount: () => void;
  onSetPlayerName: (value: string) => void;
  onUpgradeGuestAccount: (accountName: string, password: string, playerName: string) => Promise<void>;
}

export function MainHallRoute({
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
  sessionToken,
  authError,
  matchmaking,
  onCancelMatchmaking,
  onChangeAccountPassword,
  onReportException,
  onSetBotCount,
  onLogoutAllAccounts,
  onLogoutAccount,
  onSetPlayerName,
  onUpgradeGuestAccount
}: MainHallRouteProps): JSX.Element {
  return (
    <MainHallView
      catalogItems={codexCatalogItems}
      defaultBidMapId={defaultBidMapId}
      mapGroups={mapGroups}
      playerName={playerName}
      profile={profile}
      account={account}
      selectedBidMapId={selectedBidMapId}
      selectedRoleId={selectedRoleId}
      serverUrl={serverUrl}
      sessionToken={sessionToken}
      authError={authError}
      matchmaking={matchmaking}
      resolveModeForBidMapId={modeForBidMapId}
      onStartMatchmaking={roomActions.matchGame}
      onCancelMatchmaking={onCancelMatchmaking}
      onSelectBidMap={roomActions.selectBidMap}
      onSelectCoreAuctionMode={roomActions.selectCoreAuctionMode}
      onSelectRole={(roleId) => {
        roomActions.selectRole(roleId);
        profileActions.selectHero(bidKingHeroIdForRoleId(roleId, gameConfig.roles));
      }}
      onSelectHead={profileActions.selectHead}
      onSellAllCabinetItems={profileActions.sellAllCabinetItems}
      onClaimCollectionIncome={profileActions.claimCollectionIncome}
      onClaimReliefFund={profileActions.claimReliefFund}
      onUnlockHero={profileActions.unlockHero}
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
      onRemoveFriend={profileActions.removeFriend}
      onSetFriendRemark={profileActions.setFriendRemark}
      onJoinGuild={profileActions.joinGuild}
      onSetGuildRole={profileActions.setGuildRole}
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
      onReportException={onReportException}
      onSetBotCount={onSetBotCount}
      onLogoutAllAccounts={onLogoutAllAccounts}
      onLogoutAccount={onLogoutAccount}
      onSetPlayerName={onSetPlayerName}
      onUpgradeGuestAccount={onUpgradeGuestAccount}
    />
  );
}
