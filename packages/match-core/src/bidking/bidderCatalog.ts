export interface BidKingBidderRoleBinding {
  readonly order: number;
  readonly sourceHeroId: number;
  readonly roleId: string;
}

export const BID_KING_BIDDER_ROLE_BINDINGS: readonly BidKingBidderRoleBinding[] = [
  { order: 1, sourceHeroId: 104, roleId: 'mentor_teacher' },
  { order: 2, sourceHeroId: 107, roleId: 'trend_hunter' },
  { order: 3, sourceHeroId: 108, roleId: 'market_vendor' },
  { order: 4, sourceHeroId: 101, roleId: 'historian' },
  { order: 5, sourceHeroId: 105, roleId: 'fashion_tailor' },
  { order: 6, sourceHeroId: 110, roleId: 'old_noble' },
  { order: 7, sourceHeroId: 208, roleId: 'layout_artist' },
  { order: 8, sourceHeroId: 209, roleId: 'veteran_broker' },
  { order: 9, sourceHeroId: 102, roleId: 'appraiser' },
  { order: 10, sourceHeroId: 103, roleId: 'insurer' },
  { order: 11, sourceHeroId: 106, roleId: 'caravan_master' },
  { order: 12, sourceHeroId: 109, roleId: 'field_medic' },
  { order: 13, sourceHeroId: 201, roleId: 'arms_dealer' },
  { order: 14, sourceHeroId: 202, roleId: 'restorer' },
  { order: 15, sourceHeroId: 203, roleId: 'academy_professor' },
  { order: 16, sourceHeroId: 204, roleId: 'intel_analyst' },
  { order: 17, sourceHeroId: 205, roleId: 'treasure_hunter' },
  { order: 18, sourceHeroId: 206, roleId: 'eastern_appraiser' },
  { order: 19, sourceHeroId: 207, roleId: 'young_savant' },
  { order: 20, sourceHeroId: 301, roleId: 'secret_broker' }
] as const;

export const BID_KING_BIDDER_SOURCE_HERO_IDS = BID_KING_BIDDER_ROLE_BINDINGS.map((binding) => binding.sourceHeroId);

const bindingByRoleId = new Map(BID_KING_BIDDER_ROLE_BINDINGS.map((binding) => [binding.roleId, binding]));
const bindingBySourceHeroId = new Map(BID_KING_BIDDER_ROLE_BINDINGS.map((binding) => [binding.sourceHeroId, binding]));

export function bidKingBidderBindingForRoleId(roleId: string | undefined): BidKingBidderRoleBinding | undefined {
  return roleId ? bindingByRoleId.get(roleId) : undefined;
}

export function bidKingBidderBindingForSourceHeroId(sourceHeroId: number | undefined): BidKingBidderRoleBinding | undefined {
  return typeof sourceHeroId === 'number' ? bindingBySourceHeroId.get(sourceHeroId) : undefined;
}

export function bidKingSourceHeroIdForRoleId(roleId: string | undefined): number | undefined {
  return bidKingBidderBindingForRoleId(roleId)?.sourceHeroId;
}

export function bidKingRoleIdForSourceHeroId(sourceHeroId: number | undefined): string | undefined {
  return bidKingBidderBindingForSourceHeroId(sourceHeroId)?.roleId;
}
