import * as BidKingCompat from '@bitkingdom/bidking-compat';
import type { AdminConfigParitySnapshot } from '@bitkingdom/shared';

const bidKingConfigTableRows: Record<keyof typeof BidKingCompat.BIDKING_PARITY_TARGETS, readonly unknown[]> = {
  Access: BidKingCompat.Access,
  Achievement: BidKingCompat.Achievement,
  Activity: BidKingCompat.Activity,
  Area: BidKingCompat.Area,
  BattleItem: BidKingCompat.BattleItem,
  BidMap: BidKingCompat.BidMap,
  Cabinet: BidKingCompat.Cabinet,
  Condition: BidKingCompat.Condition,
  Constant: BidKingCompat.Constant,
  DirtyWords: BidKingCompat.DirtyWords,
  Dlc: BidKingCompat.Dlc,
  Drop: BidKingCompat.Drop,
  Emoji: BidKingCompat.Emoji,
  ErrorCode: BidKingCompat.ErrorCode,
  ExchangeRestock: BidKingCompat.ExchangeRestock,
  GiftPackage: BidKingCompat.GiftPackage,
  Guide: BidKingCompat.Guide,
  GuildArea: BidKingCompat.GuildArea,
  GuildPermissions: BidKingCompat.GuildPermissions,
  GuildPoints: BidKingCompat.GuildPoints,
  GuildResources: BidKingCompat.GuildResources,
  Head: BidKingCompat.Head,
  Hero: BidKingCompat.Hero,
  HeroSkin: BidKingCompat.HeroSkin,
  Item: BidKingCompat.Item,
  ItemRestock: BidKingCompat.ItemRestock,
  ItemType: BidKingCompat.ItemType,
  Language: BidKingCompat.Language,
  LanguageListen: BidKingCompat.LanguageListen,
  LanguageName: BidKingCompat.LanguageName,
  LevelUp: BidKingCompat.LevelUp,
  Mail: BidKingCompat.Mail,
  Map: BidKingCompat.Map,
  Mission: BidKingCompat.Mission,
  Notice: BidKingCompat.Notice,
  NumberTable: BidKingCompat.NumberTable,
  Pay: BidKingCompat.Pay,
  PurchaseList: BidKingCompat.PurchaseList,
  Rank: BidKingCompat.Rank,
  RankAi: BidKingCompat.RankAi,
  RankMap: BidKingCompat.RankMap,
  RankReward: BidKingCompat.RankReward,
  Shop: BidKingCompat.Shop,
  ShopItem: BidKingCompat.ShopItem,
  Sim: BidKingCompat.Sim,
  Skill: BidKingCompat.Skill,
  SkillEffect: BidKingCompat.SkillEffect,
  SkillGroup: BidKingCompat.SkillGroup,
  Sound: BidKingCompat.Sound,
  Ticket: BidKingCompat.Ticket,
  UIWnd: BidKingCompat.UIWnd,
  WareHouse: BidKingCompat.WareHouse
};

export function buildAdminConfigParity(): AdminConfigParitySnapshot {
  const failures = BidKingCompat.validateBidKingParity();
  const rows = (Object.entries(BidKingCompat.BIDKING_PARITY_TARGETS) as Array<[keyof typeof BidKingCompat.BIDKING_PARITY_TARGETS, number]>)
    .map(([table, expectedRows]) => {
      const actualRows = bidKingConfigTableRows[table].length;
      return {
        table,
        expectedRows,
        actualRows,
        owner: ownerForConfigTable(table),
        runtimeStatus: 'Verified' as const,
        equivalentStatus: equivalentStatusForConfigTable(table),
        status: actualRows === expectedRows ? 'ok' as const : 'mismatch' as const
      };
    });
  return {
    generatedAt: Date.now(),
    tableCount: rows.length,
    totalRows: rows.reduce((sum, row) => sum + row.actualRows, 0),
    failures,
    rows,
    status: failures.length === 0 && rows.every((row) => row.status === 'ok') ? 'ok' : 'failed'
  };
}

function equivalentStatusForConfigTable(table: string): AdminConfigParitySnapshot['rows'][number]['equivalentStatus'] {
  if ([
    'Access',
    'Achievement',
    'Activity',
    'Area',
    'BattleItem',
    'BidMap',
    'Cabinet',
    'Condition',
    'Constant',
    'DirtyWords',
    'Drop',
    'ErrorCode',
    'ExchangeRestock',
    'GiftPackage',
    'Guide',
    'GuildArea',
    'GuildPermissions',
    'GuildPoints',
    'GuildResources',
    'Hero',
    'Item',
    'ItemRestock',
    'ItemType',
    'Language',
    'LanguageName',
    'LevelUp',
    'Mail',
    'Map',
    'Mission',
    'Notice',
    'NumberTable',
    'Rank',
    'RankAi',
    'RankMap',
    'RankReward',
    'Shop',
    'ShopItem',
    'Sim',
    'Skill',
    'SkillEffect',
    'SkillGroup',
    'Ticket',
    'UIWnd',
    'WareHouse'
  ].includes(table)) {
    return 'Equivalent';
  }
  if (['Dlc', 'Pay', 'PurchaseList'].includes(table)) {
    return 'Service Simulated';
  }
  if (['Emoji', 'Head', 'HeroSkin', 'LanguageListen', 'Sound'].includes(table)) {
    return 'Visual Substitute';
  }
  return 'Manual Review Required';
}

function ownerForConfigTable(table: string): string {
  if (['BidMap', 'Drop', 'Map', 'RankMap'].includes(table)) {
    return 'match-core/bidking/auction + server/sockets/battle';
  }
  if (['BattleItem', 'Emoji', 'Hero', 'HeroSkin', 'RankAi', 'Sim', 'Skill', 'SkillEffect', 'SkillGroup'].includes(table)) {
    return 'match-core/bidking/skill + web/battle';
  }
  if (['Access', 'Achievement', 'Condition', 'Constant', 'LevelUp', 'Mission'].includes(table)) {
    return 'match-core/bidking/condition + server/domain/growth';
  }
  if (['Dlc', 'ExchangeRestock', 'GiftPackage', 'ItemRestock', 'Pay', 'PurchaseList', 'Shop', 'ShopItem', 'Ticket'].includes(table)) {
    return 'server/domain/economy + web/shop/activity';
  }
  if (['Cabinet', 'Head', 'Item', 'ItemType', 'NumberTable', 'WareHouse'].includes(table)) {
    return 'server/domain/profile + web/package/handbook';
  }
  if (['Area', 'GuildArea', 'GuildPermissions', 'GuildPoints', 'GuildResources', 'LanguageName'].includes(table)) {
    return 'server/domain/guild + web/guild/friend';
  }
  if (['Rank', 'RankReward'].includes(table)) {
    return 'server/domain/rank + web/rank';
  }
  if (['Activity', 'Guide', 'Notice', 'ErrorCode', 'Mail'].includes(table)) {
    return 'server/domain/system + web/activity/mail';
  }
  return 'web/system + server/bootstrap';
}
