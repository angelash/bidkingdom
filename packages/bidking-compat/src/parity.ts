import { BIDKING_AUCTION_ROUNDS_RATE, BIDKING_PARITY_TARGETS } from './schema';
export { getBidKingCloseRate, getBidKingCloseThreshold } from './closeRate';
import { Access } from './tables/Access';
import { Achievement } from './tables/Achievement';
import { Activity } from './tables/Activity';
import { Area } from './tables/Area';
import { BattleItem } from './tables/BattleItem';
import { BidMap } from './tables/BidMap';
import { Cabinet } from './tables/Cabinet';
import { Condition } from './tables/Condition';
import { Constant } from './tables/Constant';
import { DirtyWords } from './tables/DirtyWords';
import { Dlc } from './tables/Dlc';
import { Drop } from './tables/Drop';
import { Emoji } from './tables/Emoji';
import { ErrorCode } from './tables/ErrorCode';
import { ExchangeRestock } from './tables/ExchangeRestock';
import { GiftPackage } from './tables/GiftPackage';
import { Guide } from './tables/Guide';
import { GuildArea } from './tables/GuildArea';
import { GuildPermissions } from './tables/GuildPermissions';
import { GuildPoints } from './tables/GuildPoints';
import { GuildResources } from './tables/GuildResources';
import { Head } from './tables/Head';
import { Hero } from './tables/Hero';
import { HeroSkin } from './tables/HeroSkin';
import { Item } from './tables/Item';
import { ItemRestock } from './tables/ItemRestock';
import { ItemType } from './tables/ItemType';
import { Language } from './tables/Language';
import { LanguageListen } from './tables/LanguageListen';
import { LanguageName } from './tables/LanguageName';
import { LevelUp } from './tables/LevelUp';
import { Mail } from './tables/Mail';
import { Map } from './tables/Map';
import { Mission } from './tables/Mission';
import { Notice } from './tables/Notice';
import { NumberTable } from './tables/Number';
import { Pay } from './tables/Pay';
import { PurchaseList } from './tables/PurchaseList';
import { Rank } from './tables/Rank';
import { RankAi } from './tables/RankAi';
import { RankMap } from './tables/RankMap';
import { RankReward } from './tables/RankReward';
import { Sim } from './tables/Sim';
import { Shop } from './tables/Shop';
import { ShopItem } from './tables/ShopItem';
import { Skill } from './tables/Skill';
import { SkillEffect } from './tables/SkillEffect';
import { SkillGroup } from './tables/SkillGroup';
import { Sound } from './tables/Sound';
import { Ticket } from './tables/Ticket';
import { UIWnd } from './tables/UIWnd';
import { WareHouse } from './tables/WareHouse';

export function validateBidKingParity(): string[] {
  const failures: string[] = [];
  const counts = {
    BidMap: BidMap.length,
    Item: Item.length,
    Drop: Drop.length,
    Hero: Hero.length,
    Skill: Skill.length,
    SkillGroup: SkillGroup.length,
    SkillEffect: SkillEffect.length,
    RankMap: RankMap.length,
    RankAi: RankAi.length,
    Map: Map.length,
    BattleItem: BattleItem.length,
    ItemType: ItemType.length,
    Cabinet: Cabinet.length,
    LevelUp: LevelUp.length,
    Mission: Mission.length,
    HeroSkin: HeroSkin.length,
    Shop: Shop.length,
    ShopItem: ShopItem.length,
    Ticket: Ticket.length,
    NumberTable: NumberTable.length,
    UIWnd: UIWnd.length,
    Sound: Sound.length,
    Constant: Constant.length,
    Condition: Condition.length,
    Access: Access.length,
    Achievement: Achievement.length,
    Activity: Activity.length,
    Area: Area.length,
    DirtyWords: DirtyWords.length,
    Dlc: Dlc.length,
    Emoji: Emoji.length,
    ErrorCode: ErrorCode.length,
    ExchangeRestock: ExchangeRestock.length,
    GiftPackage: GiftPackage.length,
    Guide: Guide.length,
    GuildArea: GuildArea.length,
    GuildPermissions: GuildPermissions.length,
    GuildPoints: GuildPoints.length,
    GuildResources: GuildResources.length,
    Head: Head.length,
    ItemRestock: ItemRestock.length,
    Language: Language.length,
    LanguageListen: LanguageListen.length,
    LanguageName: LanguageName.length,
    Mail: Mail.length,
    Notice: Notice.length,
    Pay: Pay.length,
    PurchaseList: PurchaseList.length,
    Rank: Rank.length,
    RankReward: RankReward.length,
    Sim: Sim.length,
    WareHouse: WareHouse.length
  };
  for (const [name, expected] of Object.entries(BIDKING_PARITY_TARGETS)) {
    const actual = counts[name as keyof typeof counts];
    if (actual !== expected) {
      failures.push(`${name}: expected ${expected}, got ${actual}`);
    }
  }
  const multiplayerMaps = BidMap.filter((row) => row.bidder_number > 1);
  const invalidRateMap = multiplayerMaps.find((row) => row.auction_rounds_rate.join(',') !== BIDKING_AUCTION_ROUNDS_RATE.join(','));
  if (invalidRateMap) {
    failures.push(`BidMap ${invalidRateMap.id} auction_rounds_rate mismatch`);
  }
  const fourPlayerMap = BidMap.find((row) => row.bidder_number === 4 && row.is_visiable === 1);
  if (!fourPlayerMap) {
    failures.push('BidMap: expected at least one visible 4-player auction map');
  }
  const dropGroupIds = new Set(Drop.map((row) => row.group_id));
  for (const bidMap of multiplayerMaps) {
    const [routeType, routeGroup] = bidMap.drop_group_id;
    if (routeType === 9999 && routeGroup !== undefined && !dropGroupIds.has(routeGroup)) {
      failures.push(`BidMap ${bidMap.id} missing Drop group ${routeGroup}`);
    }
  }
  const rankMapIds = new Set(RankMap.map((row) => row.id));
  for (const bidMap of multiplayerMaps) {
    if (!rankMapIds.has(bidMap.id)) {
      failures.push(`BidMap ${bidMap.id} missing RankMap row`);
    }
  }
  return failures;
}
