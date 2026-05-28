import { describe, expect, it } from 'vitest';
import type { PlayerSnapshot } from '@bitkingdom/shared';
import { roundPresentationOverlay } from './useMatchDerivedState';

type CurrentRound = NonNullable<PlayerSnapshot['public']['currentRound']>;

function round(overrides: Partial<CurrentRound> = {}): CurrentRound {
  return {
    id: 'round_1',
    index: 0,
    phase: 'intel',
    auctionMode: 'sealed',
    isFinalAuction: false,
    container: {
      id: 'container_1',
      templateId: 'bidmap_2101',
      name: '测试拍场',
      source: '测试来源',
      risk: 'medium',
      artKey: 'container_palace',
      tags: [],
      estimateMin: 0,
      estimateMax: 0,
      estimateHidden: true
    },
    openingCandidates: [
      {
        id: 'candidate_1',
        templateId: 'bidmap_2101',
        name: '候选一',
        source: '测试来源',
        risk: 'medium',
        artKey: 'container_palace',
        tags: [],
        estimateMin: 0,
        estimateMax: 0,
        estimateHidden: true
      },
      {
        id: 'candidate_2',
        templateId: 'bidmap_2102',
        name: '候选二',
        source: '测试来源',
        risk: 'medium',
        artKey: 'container_palace',
        tags: [],
        estimateMin: 0,
        estimateMax: 0,
        estimateHidden: true
      }
    ],
    intelligenceClue: {
      id: 'clue_1',
      kind: 'category',
      text: '本轮公开情报。',
      accuracy: 1,
      source: 'public',
      isTruthful: true
    },
    intelligenceChoices: [],
    publicClues: [],
    warehouseSlots: [],
    bids: [],
    currentBid: 0,
    skillFeed: [],
    revealedItems: [],
    phaseEndsAt: 7200,
    minimumBid: 0,
    ...overrides
  };
}

describe('roundPresentationOverlay', () => {
  it('plays BattleRandom first and IntelligencePanel next during intel phase', () => {
    expect(roundPresentationOverlay(round(), 1000)).toBe('battle_random');
    expect(roundPresentationOverlay(round(), 2700)).toBe('intelligence_panel');
    expect(roundPresentationOverlay(round(), 5700)).toBe('intelligence_panel');
    expect(roundPresentationOverlay(round(), 7300)).toBeUndefined();
  });

  it('does not play presentation overlays outside the source round-start intel phase', () => {
    expect(roundPresentationOverlay(round({ phase: 'auction' }), 1000)).toBeUndefined();
    expect(roundPresentationOverlay(round({ phase: 'reveal' }), 1000)).toBeUndefined();
  });

  it('does not replay opening presentation overlays on later rounds', () => {
    expect(roundPresentationOverlay(round({ index: 1, openingCandidates: undefined }), 1000)).toBeUndefined();
  });
});
