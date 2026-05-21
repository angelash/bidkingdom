import { z } from 'zod';

export const roleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  animal: z.string().min(1),
  archetype: z.string().min(1),
  skillId: z.enum([
    'appraise_value',
    'single_treasure',
    'read_intent',
    'spread_rumor',
    'repair_audit',
    'loss_insurance'
  ]),
  passive: z.string().min(1),
  cooldownRounds: z.number().int().min(0).max(5),
  usesPerMatch: z.number().int().min(1).max(5),
  color: z.string().min(3)
});

export const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  rarity: z.enum(['junk', 'common', 'fine', 'rare', 'legendary', 'fake']),
  value: z.number().int().min(0),
  displayValue: z.number().int().min(0),
  isFake: z.boolean(),
  repairCost: z.number().int().min(0),
  setId: z.string().optional(),
  iconKey: z.string().min(1),
  footprint: z.object({
    w: z.number().int().min(1).max(3),
    h: z.number().int().min(1).max(3)
  })
});

export const containerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.string().min(1),
  tags: z.array(z.string()).min(1),
  risk: z.enum(['low', 'medium', 'high']),
  itemPool: z.array(z.string()).min(5),
  itemCountRange: z.tuple([z.number().int().min(3), z.number().int().min(3)]),
  publicEstimateBias: z.tuple([z.number().min(0.3), z.number().max(2)]),
  auctionModeWeights: z.object({
    open: z.number().min(0),
    sealed: z.number().min(0),
    second_price: z.number().min(0),
    deposit_open: z.number().min(0),
    flash: z.number().min(0)
  }),
  artKey: z.string().min(1)
});

export const setSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  itemIds: z.array(z.string()).min(2),
  bonusRate: z.number().min(0).max(1)
});

export const botProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  riskAppetite: z.number().min(0).max(1),
  bluffChance: z.number().min(0).max(1),
  overpayTolerance: z.number().min(0).max(1)
});

export const scriptedRoundSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.string().min(1),
  tags: z.array(z.string()).min(1),
  risk: z.enum(['low', 'medium', 'high']),
  auctionMode: z.enum(['open', 'sealed', 'second_price', 'deposit_open', 'flash']),
  estimateMin: z.number().int().min(0),
  estimateMax: z.number().int().min(0),
  itemIds: z.array(z.string()).min(3),
  publicClues: z.array(z.string()).min(1),
  privateCluesBySeat: z.array(z.array(z.string()).min(1)).length(4),
  depositValue: z.number().int().min(0).optional(),
  auctionDurationMs: z.number().int().positive().optional(),
  artKey: z.string().min(1)
});

export const gameConfigSchema = z.object({
  roles: z.array(roleSchema).min(18),
  items: z.array(itemSchema).min(1000),
  containers: z.array(containerSchema).min(30),
  sets: z.array(setSchema).min(5),
  scriptedRounds: z.array(scriptedRoundSchema).min(5),
  botProfiles: z.array(botProfileSchema).min(4),
  rules: z.object({
    initialCash: z.number().int().positive(),
    totalRounds: z.number().int().min(3),
    minIncrement: z.number().int().positive(),
    depositValue: z.number().int().positive(),
    depositRefund: z.number().int().min(0),
    insuranceLossThreshold: z.number().int().positive(),
    insuranceRefundRate: z.number().min(0).max(1)
  })
});

export type GameConfig = z.infer<typeof gameConfigSchema>;
