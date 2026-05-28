import type { PlayerSnapshot, SkillFeedEntry } from '@bitkingdom/shared';

export const MARKET_INTEL_TIP_HOLD_MS = 1450;
export const MARKET_INTEL_TIP_MOVE_MS = 600;
export const MARKET_INTEL_TIP_SETTLE_MS = 300;
export const MARKET_INTEL_STEP_MS = MARKET_INTEL_TIP_HOLD_MS + MARKET_INTEL_TIP_MOVE_MS + MARKET_INTEL_TIP_SETTLE_MS;
export const MARKET_INTEL_ROW_VISIBLE_MS = MARKET_INTEL_TIP_HOLD_MS + MARKET_INTEL_TIP_MOVE_MS;

export interface MarketIntelSequenceState {
  cumulative: SkillFeedEntry[];
  currentRound: SkillFeedEntry[];
  visible: SkillFeedEntry[];
  activeTip?: {
    entry: SkillFeedEntry;
    moving: boolean;
  };
  isSequencing: boolean;
}

export interface MarketIntelSequenceTiming {
  sequenceStartedAt?: number;
  openingDelayMs?: number;
  entryFirstSeenAt?: ReadonlyMap<string, number>;
}

type PublicRound = NonNullable<PlayerSnapshot['public']['currentRound']>;

interface MarketIntelScheduledEntry {
  entry: SkillFeedEntry;
  startsAt: number;
  visibleAt: number;
}

interface StoredMarketIntelClock {
  sequenceStartedAt: number;
  openingDelayMs: number;
  entryFirstSeenAt: Map<string, number>;
}

const marketIntelClocks = new Map<string, StoredMarketIntelClock>();

export function marketIntelSequenceState(
  round: PublicRound,
  now: number,
  timing: MarketIntelSequenceTiming = {}
): MarketIntelSequenceState {
  const roundNumber = round.index + 1;
  const cumulative = marketIntelEntriesForDisplay(round.skillFeed ?? [], roundNumber);
  const currentRound = currentRoundMarketIntelEntries(cumulative, roundNumber);
  const scheduled = marketIntelScheduledEntries(round, currentRound, timing);
  const isSequencing = scheduled.some((entry) => now < entry.visibleAt);
  const visibleCurrent = scheduled
    .filter((entry) => now >= entry.visibleAt)
    .map((entry) => entry.entry);
  const visibleCurrentIds = new Set(visibleCurrent.map((entry) => entry.id));
  return {
    cumulative,
    currentRound,
    visible: cumulative.filter((entry) => (
      entry.round < roundNumber || visibleCurrentIds.has(entry.id)
    )),
    activeTip: isSequencing ? marketIntelActiveTip(scheduled, now) : undefined,
    isSequencing
  };
}

export function marketIntelSequenceTimingForRound(round: PublicRound, now: number): MarketIntelSequenceTiming {
  const roundNumber = round.index + 1;
  const key = `${round.id}:${roundNumber}`;
  let clock = marketIntelClocks.get(key);
  if (!clock) {
    clock = {
      sequenceStartedAt: now,
      openingDelayMs: round.phase === 'intel' ? openingPresentationDelayMs(round) : 0,
      entryFirstSeenAt: new Map()
    };
    marketIntelClocks.set(key, clock);
    pruneMarketIntelClocks(key);
  }

  const currentRound = currentRoundMarketIntelEntries(
    marketIntelEntriesForDisplay(round.skillFeed ?? [], roundNumber),
    roundNumber
  );
  for (const entry of currentRound) {
    if (!clock.entryFirstSeenAt.has(entry.id)) {
      clock.entryFirstSeenAt.set(entry.id, now);
    }
  }

  return {
    sequenceStartedAt: clock.sequenceStartedAt,
    openingDelayMs: clock.openingDelayMs,
    entryFirstSeenAt: new Map(clock.entryFirstSeenAt)
  };
}

export function marketIntelEntriesForDisplay(
  skillFeed: readonly SkillFeedEntry[],
  roundNumber: number
): SkillFeedEntry[] {
  const seen = new Set<string>();
  let acceptedMapEntryId = '';
  return skillFeed
    .filter((entry) => entry.round <= roundNumber)
    .sort((left, right) => (
      left.round - right.round
      || marketIntelSourceOrder(left.source) - marketIntelSourceOrder(right.source)
      || left.createdAt - right.createdAt
      || left.id.localeCompare(right.id)
    ))
    .filter((entry) => {
      if (seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      if (entry.source !== 'map') {
        return true;
      }
      if (entry.round !== 1) {
        return false;
      }
      if (!acceptedMapEntryId) {
        acceptedMapEntryId = entry.id;
      }
      return entry.id === acceptedMapEntryId;
    });
}

export function currentRoundMarketIntelEntries(
  skillFeed: readonly SkillFeedEntry[],
  roundNumber: number
): SkillFeedEntry[] {
  return skillFeed.filter((entry) => entry.round === roundNumber);
}

export function openingPresentationDelayMs(round: PublicRound): number {
  if (round.index !== 0) {
    return 0;
  }
  const mapIntroMs = (round.openingCandidates?.length ?? 0) > 1 ? 1600 : 0;
  const intelligencePanelMs = round.intelligenceClue ? 4600 : 0;
  return mapIntroMs + intelligencePanelMs;
}

export function marketIntelRowVisibleAt(index: number): number {
  return index * MARKET_INTEL_STEP_MS + MARKET_INTEL_ROW_VISIBLE_MS;
}

export function marketIntelActiveTip(
  entries: readonly MarketIntelScheduledEntry[],
  now: number
): { entry: SkillFeedEntry; moving: boolean } | undefined {
  for (const entry of entries) {
    if (now >= entry.startsAt && now < entry.visibleAt) {
      return {
        entry: entry.entry,
        moving: now >= entry.startsAt + MARKET_INTEL_TIP_HOLD_MS
      };
    }
  }
  return undefined;
}

function marketIntelScheduledEntries(
  round: PublicRound,
  entries: readonly SkillFeedEntry[],
  timing: MarketIntelSequenceTiming
): MarketIntelScheduledEntry[] {
  if (entries.length === 0) {
    return [];
  }
  const presentationDelayMs = timing.openingDelayMs ?? openingPresentationDelayMs(round);
  const sourceStartAt = Math.min(...entries.map((entry) => entry.createdAt)) + presentationDelayMs;
  const localStartAt = timing.sequenceStartedAt === undefined
    ? sourceStartAt
    : timing.sequenceStartedAt + presentationDelayMs;
  const sequenceStartAt = timing.sequenceStartedAt === undefined
    ? sourceStartAt
    : Math.max(sourceStartAt, localStartAt);
  let cursor = sequenceStartAt;
  return entries.map((entry) => {
    const firstSeenAt = timing.entryFirstSeenAt?.get(entry.id);
    const availableAt = firstSeenAt === undefined ? entry.createdAt : Math.max(entry.createdAt, firstSeenAt);
    const startsAt = Math.max(cursor, availableAt);
    cursor = startsAt + MARKET_INTEL_STEP_MS;
    return {
      entry,
      startsAt,
      visibleAt: startsAt + MARKET_INTEL_ROW_VISIBLE_MS
    };
  });
}

function pruneMarketIntelClocks(activeKey: string): void {
  if (marketIntelClocks.size <= 8) {
    return;
  }
  for (const key of marketIntelClocks.keys()) {
    if (key !== activeKey) {
      marketIntelClocks.delete(key);
    }
    if (marketIntelClocks.size <= 8) {
      return;
    }
  }
}

function marketIntelSourceOrder(source: SkillFeedEntry['source']): number {
  const orders: Record<SkillFeedEntry['source'], number> = {
    map: 0,
    hero: 1,
    item: 2,
    manual: 3,
    auto: 4
  };
  return orders[source];
}
