import type { PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { refreshMissionProgress } from './profileProgressRuntime';

export type MissionEventDomain = 'battle' | 'economy' | 'social' | 'collection' | 'system' | 'growth';

export interface MissionEventDescriptor {
  domain: MissionEventDomain;
  eventKey: string;
}

export interface MissionEventInput {
  sourceId: string;
  reason: string;
  resource: ProfileTransaction['resource'];
  amountChange: number;
}

const DOMAIN_REASON_PREFIXES: Array<[MissionEventDomain, readonly string[]]> = [
  ['battle', ['battle_item_', 'match_', 'ticket_']],
  ['economy', [
    'shop_',
    'market_',
    'trade_',
    'pay_',
    'purchase_',
    'purchase_list_',
    'purchase_order_',
    'dlc_',
    'gift_package_',
    'rank_reward_'
  ]],
  ['social', ['friend_', 'guild_']],
  ['collection', ['cabinet_', 'collection_income_']],
  ['system', ['mail_', 'notice_', 'guide_', 'language_name_', 'head_', 'hero_skin_', 'profile_settings_']],
  ['growth', ['task_', 'mission_', 'achievement_', 'level_reward_', 'activity_reward_']]
];

export function recordMissionEventFromTransaction(
  profile: PlayerProfile,
  event: MissionEventInput,
  now = Date.now()
): MissionEventDescriptor | undefined {
  const descriptor = missionEventDescriptorForTransaction(event);
  if (!descriptor) {
    return undefined;
  }
  ensureMissionEventStats(profile, now);
  const stats = profile.conditionStats!;
  stats.missionEventCounts![descriptor.eventKey] = (stats.missionEventCounts![descriptor.eventKey] ?? 0) + 1;
  stats.missionEventDomainCounts![descriptor.domain] = (stats.missionEventDomainCounts![descriptor.domain] ?? 0) + 1;
  stats.updatedAt = now;
  refreshMissionProgress(profile, now);
  return descriptor;
}

export function missionEventDescriptorForTransaction(event: MissionEventInput): MissionEventDescriptor | undefined {
  const reason = event.reason.trim();
  if (!reason) {
    return undefined;
  }
  const domain = DOMAIN_REASON_PREFIXES.find(([, prefixes]) => prefixes.some((prefix) => reason.startsWith(prefix)))?.[0];
  if (!domain) {
    return undefined;
  }
  return {
    domain,
    eventKey: `${domain}.${reason}`
  };
}

export function ensureMissionEventStats(profile: PlayerProfile, now = Date.now()): void {
  profile.conditionStats ??= {
    usedItemCount: 0,
    dailyUsedItemCount: {},
    usedItemCountsById: {},
    tradeBoughtCount: 0,
    tradeSoldCount: 0,
    auctionAcquiredItemIds: [],
    shopAcquiredItemIds: [],
    missionEventCounts: {},
    missionEventDomainCounts: {},
    updatedAt: now
  };
  profile.conditionStats.usedItemCount ??= 0;
  profile.conditionStats.dailyUsedItemCount ??= {};
  profile.conditionStats.usedItemCountsById ??= {};
  profile.conditionStats.tradeBoughtCount ??= 0;
  profile.conditionStats.tradeSoldCount ??= 0;
  profile.conditionStats.auctionAcquiredItemIds ??= [];
  profile.conditionStats.shopAcquiredItemIds ??= [];
  profile.conditionStats.missionEventCounts ??= {};
  profile.conditionStats.missionEventDomainCounts ??= {};
  profile.conditionStats.updatedAt ??= now;
}
