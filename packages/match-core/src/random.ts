export interface RandomSource {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly { item: T; weight: number }[]): T;
}

export function createRandom(seed: number): RandomSource {
  let value = seed >>> 0;

  const next = (): number => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('Cannot pick from an empty list');
      }
      return items[Math.floor(next() * items.length)]!;
    },
    weighted<T>(items: readonly { item: T; weight: number }[]): T {
      const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
      if (total <= 0) {
        throw new Error('Cannot pick from weights with no positive total');
      }
      let cursor = next() * total;
      for (const entry of items) {
        cursor -= Math.max(0, entry.weight);
        if (cursor <= 0) {
          return entry.item;
        }
      }
      return items[items.length - 1]!.item;
    }
  };
}

export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
