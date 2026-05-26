import { z } from 'zod';

export const roleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  animal: z.string().min(1),
  archetype: z.string().min(1),
  skillId: z.enum([
    'appraise_value',
    'single_treasure',
    'read_intent'
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
  rarity: z.enum(['junk', 'common', 'fine', 'rare', 'legendary', 'mythic']),
  value: z.number().int().min(0),
  displayValue: z.number().int().min(0),
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
  itemPool: z.array(z.string()),
  itemCountRange: z.tuple([z.number().int().min(3), z.number().int().min(3)]),
  publicEstimateBias: z.tuple([z.number().min(0.3), z.number().max(2)]),
  auctionModeWeights: z.object({
    open: z.number().min(0),
    sealed: z.number().min(0)
  }),
  artKey: z.string().min(1)
});

export const setSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  itemIds: z.array(z.string()),
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
  auctionMode: z.enum(['open', 'sealed']),
  estimateMin: z.number().int().min(0),
  estimateMax: z.number().int().min(0),
  itemIds: z.array(z.string()),
  publicClues: z.array(z.string()),
  privateCluesBySeat: z.array(z.array(z.string())).length(4),
  auctionDurationMs: z.number().int().positive().optional(),
  artKey: z.string().min(1)
});

export const gameConfigSchema = z.object({
  roles: z.array(roleSchema).min(18),
  items: z.array(itemSchema),
  containers: z.array(containerSchema),
  sets: z.array(setSchema),
  scriptedRounds: z.array(scriptedRoundSchema),
  botProfiles: z.array(botProfileSchema).min(4),
  rules: z.object({
    initialCash: z.number().int().positive(),
    totalRounds: z.number().int().min(3),
    minIncrement: z.number().int().positive()
  })
});

export type GameConfig = z.infer<typeof gameConfigSchema>;
