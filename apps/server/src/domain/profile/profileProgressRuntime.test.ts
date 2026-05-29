import { describe, expect, it } from 'vitest';
import type { FinalMatchSummary, PlayerProfile, ProfileTransaction } from '@bitkingdom/shared';
import { createDefaultProfile } from './profileLifecycle';
import { applyMatchSummaryForProfile } from './profileProgressRuntime';

function makeSummary(playerId: string, coins: number, lossRecovery = 0): FinalMatchSummary {
  return {
    matchId: `match_${coins}_${lossRecovery}`,
    seed: 1,
    rankings: [
      {
        playerId,
        name: '试拍掌柜',
        rank: 1,
        cash: 0,
        holdingsValue: 0,
        setBonus: 0,
        netWorth: coins
      }
    ],
    netWorthCurve: [],
    bestMove: { title: '测试', detail: '测试' },
    biggestMistake: { title: '测试', detail: '测试' },
    revealedItems: [],
    awardedItemsByPlayerId: { [playerId]: [] },
    lossRecoveryByPlayerId: { [playerId]: lossRecovery },
    auctionStats: [
      {
        playerId,
        totalProfit: Math.max(0, coins),
        netProfit: coins,
        successfulAuctionCount: coins > 0 ? 1 : 0,
        failedAuctionCount: coins < 0 ? 1 : 0,
        highestItemValue: 0,
        highestWinningItemTotalValue: 0
      }
    ],
    rewards: [
      {
        playerId,
        xp: 0,
        coins,
        rankPoints: 0
      }
    ],
    eventCount: 0,
    transactionCount: 0
  };
}

describe('profile match settlement', () => {
  it('applies signed match coin results and loss recovery as separate ledgers', () => {
    const profile = createDefaultProfile('p1', '试拍掌柜', 1000);
    const transactions: ProfileTransaction[] = [];
    const sourceIds = new Set<string>();
    const applyNumberChange = (
      currentProfile: PlayerProfile,
      sourceId: string,
      reason: ProfileTransaction['reason'],
      resource: Extract<ProfileTransaction['resource'], 'coins' | 'rankPoints' | 'xp'>,
      amountChange: number
    ) => {
      if (sourceIds.has(sourceId) || amountChange === 0) {
        return;
      }
      sourceIds.add(sourceId);
      const before = currentProfile[resource] ?? 0;
      currentProfile[resource] = Math.max(0, before + amountChange);
      transactions.push({
        id: `txn_${transactions.length + 1}`,
        playerId: currentProfile.playerId,
        sourceId,
        reason,
        resource,
        amountBefore: before,
        amountChange: currentProfile[resource] - before,
        amountAfter: currentProfile[resource],
        createdAt: Date.now()
      });
    };

    expect(applyMatchSummaryForProfile(profile, makeSummary('p1', 1200), applyNumberChange)).toBe(true);
    expect(profile.coins).toBe(2_001_200);
    expect(transactions.find((transaction) => transaction.reason === 'match_reward_coins')?.amountChange).toBe(1200);
    expect(profile.lastRewards?.coins).toBe(1200);

    expect(applyMatchSummaryForProfile(profile, makeSummary('p1', -500, 50), applyNumberChange)).toBe(true);
    expect(profile.coins).toBe(2_000_750);
    expect(transactions.filter((transaction) => transaction.reason === 'match_reward_coins').at(-1)?.amountChange).toBe(-500);
    expect(transactions.find((transaction) => transaction.reason === 'match_loss_recovery')?.amountChange).toBe(50);
    expect(profile.lastRewards?.coins).toBe(-500);
    expect(profile.lastRewards?.lossRecovery).toBe(50);
  });
});
