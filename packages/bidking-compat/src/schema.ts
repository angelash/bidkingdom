export const BIDKING_PARITY_TARGETS = {
  BidMap: 125,
  Item: 1136,
  Drop: 629,
  Hero: 20,
  Skill: 256,
  SkillGroup: 5,
  SkillEffect: 36,
  RankMap: 83,
  RankAi: 120,
  Map: 9,
  BattleItem: 64,
  ItemType: 29,
  Cabinet: 12,
  LevelUp: 256,
  Mission: 314,
  HeroSkin: 22,
  Shop: 13,
  ShopItem: 256,
  Ticket: 1,
  NumberTable: 7,
  UIWnd: 80,
  Sound: 320,
  Constant: 85,
  Condition: 206,
  Access: 9,
  Achievement: 25,
  Activity: 3,
  Area: 105,
  DirtyWords: 8763,
  Dlc: 1,
  Emoji: 16,
  ErrorCode: 84,
  ExchangeRestock: 4,
  GiftPackage: 6,
  Guide: 37,
  GuildArea: 97,
  GuildPermissions: 3,
  GuildPoints: 6,
  GuildResources: 17,
  Head: 102,
  ItemRestock: 487,
  Language: 5214,
  LanguageListen: 273,
  LanguageName: 100,
  Mail: 13,
  Notice: 107,
  Pay: 6,
  PurchaseList: 6,
  Rank: 10,
  RankReward: 7,
  Sim: 101,
  WareHouse: 1
} as const;

export const BIDKING_AUCTION_ROUNDS_RATE = [2000, 1600, 1300, 1100, 0] as const;

export type BidKingRisk = 'low' | 'medium' | 'high';

export interface BidKingRawTableRow {
  id: string;
  table: string;
  columns: readonly string[];
  packaged_name: string;
  packaged_desc: string;
}

export interface BidKingBidMapRow {
  id: number;
  s_map_name: string;
  s_map_logo: string;
  s_map_togname: string;
  s_map_desc: string;
  parent_map_id: number;
  is_visiable: number;
  map_group: readonly (readonly number[])[];
  map_income: string;
  map_cell: number;
  currency_cost: readonly number[];
  item_cost: readonly (readonly number[])[];
  map_time: readonly number[];
  required_items: readonly (readonly number[])[];
  special_output_items: readonly (readonly number[])[];
  drop_group_id: readonly number[];
  bidder_number: number;
  auction_rounds_rate: readonly number[];
  map_random_skill: readonly number[];
  map_resource: string;
  tap_up: number;
  item_count_min: number;
  item_count_max: number;
  public_estimate_min_rate: number;
  public_estimate_max_rate: number;
  packaged_name: string;
  packaged_desc: string;
  packaged_tags: readonly string[];
  risk: BidKingRisk;
  art_key: string;
}

export interface BidKingItemRow {
  id: number;
  item_name: string;
  item_nm: string;
  item_desc: string;
  item_type_id: number;
  item_type_ids: readonly number[];
  slot_type: number;
  item_quality: number;
  base_value: number;
  in_case: number;
  is_tradable: number;
  binds_on_purchase: number;
  is_auction: number;
  auction_baseprice: readonly number[];
  grid_count: number;
  transaction_tax_rate: readonly (readonly number[])[];
  max_stack_size: number;
  max_per_listing: number;
  collectible_item_type_id: readonly number[];
  skills: readonly number[];
  specified_obtain: readonly (readonly number[])[];
  drop_group_id: number;
  show_item: readonly number[];
  icon_path: string;
  icon_atlas: string;
  collection: number;
  rank7count: number;
  item_access: readonly number[];
  collection_coin: number;
  number: readonly number[];
  number_weight: readonly number[];
  cost: readonly number[];
  model_3D: string;
  is_show: number;
  exchangeId: readonly number[];
  is_sale: number;
  room_price: number | '';
  packaged_name: string;
  packaged_category: string;
  packaged_icon_key: string;
}

export interface BidKingDropRow {
  group_id: number;
  weight_type: number;
  items_list: readonly BidKingDropItemRow[];
}

export interface BidKingDropItemRow {
  item_type: number;
  item_id: number;
  min_count: number;
  max_count: number;
  drop_weight: number;
}

export interface BidKingHeroRow {
  id: number;
  name: string;
  gender: number;
  hero_class: string;
  background: string;
  hero_skill_name: string;
  hero_skill_description: string;
  hero_effect_description: string;
  cast_type: readonly number[];
  icon_path: string;
  icon_path2: string;
  icon_path3: string;
  illustration_path: string;
  bg_path: string;
  access: readonly number[];
  voices: readonly number[];
  battleBgm: readonly number[];
  hero_tag: number;
  hero_task_group: readonly number[];
  packaged_name: string;
  packaged_title: string;
  packaged_role_id: string;
}

export interface BidKingSkillRow {
  id: number;
  skill_group: string;
  skill_name: string;
  skilldesc: string;
  skill_textshow: string;
  skill_type: number;
  skilltarget: number;
  skilltargetvalue: readonly number[];
  skilltarget2: number;
  skilltargetvalue2: readonly number[];
  skilltarget3: number;
  skilltargetvalue3: readonly number[];
  skill_count_type: number;
  skill_count: number;
  skilleffect_position: readonly number[];
  skill_icon: string;
  skill_value: readonly number[];
  skill_active_type: number;
  skill_opt: number;
  skill_opt_param1: readonly (readonly number[])[];
  skill_opt_param2: readonly (readonly number[])[];
  skill_cast: readonly (readonly number[])[];
  skill_round: number;
  skill_CD: number;
  show_type: number;
  packaged_name: string;
  packaged_desc: string;
}

export interface BidKingSkillGroupRow {
  groupid: number;
  skill_group: readonly (readonly [number, number])[];
}

export interface BidKingSkillEffectRow {
  EffectId: number;
  Category: number;
  Param: readonly number[];
  effect_key: string;
  effect_desc: string;
}

export interface BidKingRankMapRow {
  id: number;
  match_time: readonly (readonly number[])[];
  role_spawn: readonly (readonly number[])[];
  min_bid_range: readonly (readonly number[])[];
  bid_type: readonly number[];
}

export interface BidKingRankAiRow {
  id: number;
  role_id: number;
  round_count: number;
  min_bid_ratio: readonly (readonly number[])[];
  item_use_probability: number;
  item_usage_group: readonly (readonly number[])[];
  bid_time: readonly (readonly number[])[];
  bid_pk: readonly (readonly number[])[];
  risk_appetite: number;
  bluff_chance: number;
  overpay_tolerance: number;
  bid_aggression: number;
}

export interface BidKingMapRow {
  id: number;
  map_name: string;
  map_desc: string;
  map_position: readonly number[];
  map_icon: string;
  auction_limit_notify: number;
  entrust_value: number;
  entrust_bidmap: number;
  entrust_cost: readonly number[];
  entrust_prob: number;
  type: number;
  entrust_num: readonly number[];
  is_open: number;
  mapgroup: number;
  world_process: number;
  daily_counts: number;
  open_time: readonly (readonly number[])[];
  packaged_name: string;
  packaged_desc: string;
  art_key: string;
}

export interface BidKingBattleItemRow {
  id: number;
  item_type_id: readonly number[];
  item_quality: number;
  battle_item_type: number;
  item_name: string;
  item_desc: string;
  skill_group: number;
  packaged_name: string;
  packaged_desc: string;
}

export interface BidKingItemTypeRow {
  id: number;
  configFileName: string;
  type_name: string;
  showin_tradingbuy: number;
  showin_auction: number;
  store_type: number;
  icon: string;
  packaged_name: string;
  packaged_source_name: string;
}

export interface BidKingCabinetRow {
  id: number;
  resource_name: string;
  location_type: readonly number[];
  max_slot_limit: number;
  quality_requirement: readonly number[];
  slot_count: readonly number[];
  place_max: number;
  coinbonus: number;
  timemax: number;
  bg_offset: readonly number[];
  resource: string;
  resource2: string;
  packaged_name: string;
  packaged_desc: string;
}

export interface BidKingLevelUpRow {
  id: number;
  collection_value: number;
  level_reward: readonly (readonly number[])[];
  bass_value: number;
  bass_reward: readonly (readonly number[])[];
  big_bass_reward: readonly (readonly number[])[];
  packaged_name: string;
  reward_summary: string;
}

export interface BidKingMissionRow {
  Id: number;
  missionname: string;
  missiondec: string;
  type: number;
  display: number;
  refreshtype: number;
  operationtype: number;
  conditions: readonly (readonly number[])[];
  reward: readonly (readonly number[])[];
  choosereward: readonly (readonly number[])[];
  chooserewardnum: number;
  premissionids: readonly number[];
  group: number;
  steamachievement: number;
  finish_show: number;
  packaged_name: string;
  packaged_desc: string;
  packaged_group: string;
}

export interface BidKingHeroSkinRow {
  id: number;
  skinhero: number;
  name: string;
  skin_class: string;
  skinground: string;
  icon_path: string;
  icon_path2: string;
  icon_path3: string;
  illustration_path: string;
  bg_path: string;
  access: readonly number[];
  voices: readonly number[];
  battleBgm: readonly number[];
  hero_tag: number;
  packaged_name: string;
  packaged_desc: string;
}

export interface BidKingShopRow {
  id: number;
  type: number;
  typeicon: string;
  name: string;
  shopicon: string;
  tabname: string;
  tap: number;
  buyuitype: number;
  currencydisplay: readonly number[];
  randcounts: number;
  autofresh: number;
  ticket: number;
  setting: number;
  random: number;
  packaged_name: string;
  packaged_desc: string;
}

export interface BidKingShopItemRow {
  id: number;
  shopid: number;
  order: number;
  name: string;
  type: number;
  front: readonly number[];
  itemid: readonly (readonly number[])[];
  buytype: number;
  price: readonly (readonly number[])[];
  buycounts: number;
  randvalue: number;
  rate: readonly number[];
  ratevalue: readonly number[];
  pic: string;
  desc: string;
  packaged_name: string;
  packaged_desc: string;
}

export interface BidKingTicketRow {
  id: number;
  name: string;
  type: number;
  recovertime: number;
  max: number;
  maxlimit: number;
  buyrefresh: number;
  buycounts: number;
  buyquantity: number;
  buycurrency: number;
  price: readonly number[];
  reserveticket: number;
  reservetime: number;
  reservelimit: number;
  packaged_name: string;
  packaged_desc: string;
}

export interface BidKingNumberRow {
  Id: number;
  name: string;
  quality: number;
  counts: number;
  numberbonus: number;
  bg: string;
  bid: number;
  packaged_name: string;
  packaged_desc: string;
}

export interface BidKingUIWndRow {
  id: number;
  Name: string;
  Beizhu: string;
  Path: string;
  IsMainWnd: number;
  Layer: number;
  CommonSet: number;
  ResSet: readonly number[];
  BGM: readonly number[];
  IsBlur: number;
  packaged_name: string;
  packaged_desc: string;
}

export interface BidKingSoundRow {
  Id: number;
  Desc: string;
  Name: string;
  FullPathName: string;
  Type: number;
  PanLevel: number;
  Volume: number;
  MinDistance: number;
  Spread: number;
  IsLoop: number;
  Delay: number;
  FadeInTime: number;
  FadeOutTime: number;
  CurMaxPlayingCount: number;
  Priority: number;
  i18nEnabled: number;
  i18nPathKey: string;
  packaged_name: string;
  packaged_desc: string;
}

export interface BidKingConstantRow {
  Id: string;
  Name: string;
  Type: string;
  Value: string;
  packaged_desc: string;
}

export interface BidKingConditionRow {
  id: number;
  type: number;
  preorconditions: readonly number[];
  preorconditionsparam: readonly (readonly number[])[];
  preconditions: readonly number[];
  preconditionsparam: readonly (readonly number[])[];
  condition: number;
  conditionparams: readonly number[];
  divided: number;
  maxvalue: number;
  desc: string;
  packaged_desc: string;
}
