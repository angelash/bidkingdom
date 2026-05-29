export type BidKingSkillEffectRuntimeKind = 'warehouse' | 'aggregate' | 'text' | 'system';

export interface BidKingSkillEffectFieldMask {
  itemCid: boolean;
  itemSlotType: boolean;
  itemType: boolean;
  itemQuility: boolean;
  itemPrice: boolean;
  itemBoxIndex: boolean;
}

export interface BidKingSkillEffectKnowledgeMask {
  shape: boolean;
  rank: boolean;
  all: boolean;
  value: boolean;
  sizeCount: boolean;
}

export interface BidKingSkillEffectRuntimeProfile {
  category: number;
  runtimeKind: BidKingSkillEffectRuntimeKind;
  affectsWarehouseKnowledge: boolean;
  publicFields: BidKingSkillEffectFieldMask;
  knowledge: BidKingSkillEffectKnowledgeMask;
}

const EMPTY_FIELDS: BidKingSkillEffectFieldMask = {
  itemCid: false,
  itemSlotType: false,
  itemType: false,
  itemQuility: false,
  itemPrice: false,
  itemBoxIndex: false
};

const EMPTY_KNOWLEDGE: BidKingSkillEffectKnowledgeMask = {
  shape: false,
  rank: false,
  all: false,
  value: false,
  sizeCount: false
};

export function bidKingSkillEffectRuntimeProfile(category: number): BidKingSkillEffectRuntimeProfile {
  const normalizedCategory = Math.max(0, Math.floor(category));
  if (normalizedCategory === 1 || normalizedCategory === 22) {
    return profile(normalizedCategory, 'warehouse', {
      publicFields: { itemSlotType: true },
      knowledge: { shape: true }
    });
  }
  if (normalizedCategory === 5) {
    return profile(normalizedCategory, 'warehouse', {
      publicFields: { itemPrice: true },
      knowledge: { value: true }
    });
  }
  if (normalizedCategory === 6) {
    return profile(normalizedCategory, 'warehouse', {
      publicFields: { itemCid: true, itemSlotType: true, itemQuility: true },
      knowledge: { all: true, shape: true, rank: true, value: true }
    });
  }
  if (normalizedCategory === 7) {
    return profile(normalizedCategory, 'warehouse', {
      publicFields: { itemQuility: true },
      knowledge: { rank: true }
    });
  }
  if (normalizedCategory === 11) {
    return profile(normalizedCategory, 'warehouse', {
      publicFields: { itemBoxIndex: true },
      knowledge: { sizeCount: true }
    });
  }
  if ([2, 3, 4, 8, 9, 10].includes(normalizedCategory)) {
    return profile(normalizedCategory, 'aggregate');
  }
  if ([12, 13, 14, 15].includes(normalizedCategory)) {
    return profile(normalizedCategory, 'text');
  }
  if ([16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 28].includes(normalizedCategory)) {
    return profile(normalizedCategory, 'system');
  }
  throw new Error(`BidKing SkillEffect Category ${normalizedCategory} is not mapped`);
}

export function bidKingSkillEffectAffectsWarehouseKnowledge(category: number): boolean {
  return bidKingSkillEffectRuntimeProfile(category).affectsWarehouseKnowledge;
}

export function bidKingSkillEffectPublicFields(categories: Iterable<number>): BidKingSkillEffectFieldMask {
  const fields = { ...EMPTY_FIELDS };
  for (const category of categories) {
    const profile = bidKingSkillEffectRuntimeProfile(category);
    mergeMask(fields, profile.publicFields);
  }
  return fields;
}

export function bidKingSkillEffectKnowledge(categories: Iterable<number>): BidKingSkillEffectKnowledgeMask {
  const knowledge = { ...EMPTY_KNOWLEDGE };
  for (const category of categories) {
    const profile = bidKingSkillEffectRuntimeProfile(category);
    mergeMask(knowledge, profile.knowledge);
  }
  return knowledge;
}

function profile(
  category: number,
  runtimeKind: BidKingSkillEffectRuntimeKind,
  overrides: {
    publicFields?: Partial<BidKingSkillEffectFieldMask>;
    knowledge?: Partial<BidKingSkillEffectKnowledgeMask>;
  } = {}
): BidKingSkillEffectRuntimeProfile {
  const publicFields = { ...EMPTY_FIELDS, ...overrides.publicFields };
  const knowledge = { ...EMPTY_KNOWLEDGE, ...overrides.knowledge };
  return {
    category,
    runtimeKind,
    affectsWarehouseKnowledge: runtimeKind === 'warehouse',
    publicFields,
    knowledge
  };
}

function mergeMask<T extends object>(target: T, source: T): void {
  for (const key of Object.keys(target) as Array<keyof T>) {
    target[key] = Boolean(target[key] || source[key]) as T[keyof T];
  }
}
