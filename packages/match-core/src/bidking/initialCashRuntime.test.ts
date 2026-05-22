import { describe, expect, it } from 'vitest';
import { createMatch } from '../match';
import {
  bidKingBestAvailableBidMapId,
  bidKingBidMapAccess,
  bidKingBidMapEntryCostCoins,
  bidKingBidMapEntryCosts,
  bidKingBidMapRequiredCoins,
  bidKingDailyMapEntryKey,
  bidKingDefaultInitialCash,
  bidKingHighestConfiguredMinimumBidForBidMap,
  bidKingInitialCashChoices,
  bidKingInitialCashForBidMap,
  bidKingInitialCashForProfileCoins,
  bidKingItemBudgetChoices
} from './initialCashRuntime';
import {
  bidKingStarterCoins,
  bidKingStarterHeadId,
  bidKingStarterInventoryRewards,
  bidKingStarterRewardRows
} from './profileInitialRuntime';
import {
  bidKingBidGameCountChoices,
  bidKingBidRateChoices,
  bidKingDefaultAuctionDurationMs,
  bidKingDefaultBidGameCount,
  bidKingDefaultRoomPlayerCount,
  bidKingInitialWarehouseCapacity,
  bidKingReliefFundRuntime,
  bidKingRoomPlayerCountChoices,
  bidKingRoundTimeChoicesSeconds
} from './roomRuleRuntime';

describe('BidKing initial cash runtime', () => {
  it('reads original initial point and item budget choices', () => {
    expect(bidKingInitialCashChoices()).toEqual([100_000, 500_000, 1_000_000, 2_000_000, 3_000_000]);
    expect(bidKingItemBudgetChoices()).toEqual([10_000, 50_000, 100_000, 200_000, 500_000, 1_000_000]);
    expect(bidKingDefaultInitialCash()).toBe(1_000_000);
  });

  it('uses original parent Map stakes to set room initial cash', () => {
    expect(bidKingHighestConfiguredMinimumBidForBidMap(2201)).toBe(20_000);
    expect(bidKingInitialCashForBidMap(2101)).toBe(100_000);
    expect(bidKingInitialCashForBidMap(2201)).toBe(500_000);
    expect(bidKingInitialCashForBidMap(2301)).toBe(1_000_000);
    expect(bidKingInitialCashForBidMap(2401)).toBe(2_000_000);
    expect(bidKingInitialCashForBidMap(2501)).toBe(3_000_000);
    expect(bidKingHighestConfiguredMinimumBidForBidMap(2601)).toBe(3_000_000);
    expect(bidKingInitialCashForBidMap(2601)).toBe(3_000_000);
  });

  it('uses account balance to gate maps while keeping cash fixed by the selected room', () => {
    expect(bidKingBidMapRequiredCoins(2401)).toBe(2_000_000);
    expect(bidKingBidMapEntryCostCoins(2401)).toBe(10_000);
    expect(bidKingBidMapEntryCosts(2101)).toEqual([{ refId: 101, quantity: 1 }]);
    expect(bidKingBidMapAccess({ coins: 2_090_000 }, 2401).canEnter).toBe(true);
    expect(bidKingBidMapAccess({ coins: 20_000, inventory: [{ refId: 101, quantity: 1 }] }, 2101).canEnter).toBe(true);
    expect(bidKingBidMapAccess({ coins: 20_000, inventory: [] }, 2101).canEnter).toBe(false);
    expect(bidKingBidMapAccess({ coins: 1_999_999 }, 2401).canEnter).toBe(false);
    expect(bidKingBidMapAccess({ coins: 2_090_000 }, 2501).canEnter).toBe(false);
    const now = new Date(2026, 4, 22, 12, 0, 0).getTime();
    expect(bidKingBidMapAccess({
      coins: 20_000,
      inventory: [{ refId: 101, quantity: 1 }],
      dailyMapEntries: { [bidKingDailyMapEntryKey(101, now)]: 100 }
    }, 2101, now).reasons).toContain('今日次数 100/100');
    expect(bidKingBestAvailableBidMapId({ coins: 2_090_000 }, 2201)).toBe(2201);
    expect(bidKingBestAvailableBidMapId({ coins: 2_090_000 })).toBe(2401);
    expect(bidKingBestAvailableBidMapId({ coins: 20_000, inventory: [{ refId: 101, quantity: 1 }] })).toBe(2101);
    expect(bidKingInitialCashForProfileCoins(2_090_000, 2201)).toBe(500_000);
    expect(bidKingInitialCashForProfileCoins(2_090_000, 2601)).toBe(3_000_000);
  });

  it('applies the resolved cash tier to every runtime player in core matches', () => {
    const match = createMatch({
      id: 'cash_restore',
      players: [
        { id: 'p1', name: '甲', kind: 'human', roleId: 'appraiser' },
        { id: 'p2', name: '乙', kind: 'bot', roleId: 'smuggler' },
        { id: 'p3', name: '丙', kind: 'bot', roleId: 'psychologist' },
        { id: 'p4', name: '丁', kind: 'bot', roleId: 'rumormonger' }
      ],
      coreMode: true,
      coreBidMapId: 2601
    });

    expect(match.config.rules.initialCash).toBe(3_000_000);
    expect(match.players.map((player) => player.cash)).toEqual([3_000_000, 3_000_000, 3_000_000, 3_000_000]);
  });

  it('reads starter profile coins from original init_items rewards', () => {
    expect(bidKingStarterRewardRows().some((row) => row[0] === 1 && row[1] === 1 && row[2] === 2_000_000)).toBe(true);
    expect(bidKingStarterCoins()).toBe(2_000_000);
    expect(bidKingStarterHeadId()).toBe('120000');
    expect(bidKingStarterInventoryRewards()).toEqual(expect.arrayContaining([
      { type: '5', refId: '7101', quantity: 1 },
      { type: '101', refId: '1091001', quantity: 1 },
      { type: '19', refId: '8101', quantity: 5 }
    ]));
  });

  it('reads original room and auction choice constants', () => {
    expect(bidKingBidGameCountChoices()).toEqual([5, 10, 15, 20]);
    expect(bidKingDefaultBidGameCount()).toBe(5);
    expect(bidKingRoomPlayerCountChoices()).toEqual([2, 3, 4]);
    expect(bidKingDefaultRoomPlayerCount()).toBe(4);
    expect(bidKingRoundTimeChoicesSeconds()).toEqual([40, 60, 120]);
    expect(bidKingDefaultAuctionDurationMs()).toBe(60_000);
    expect(bidKingBidRateChoices()).toEqual([2000, 1800, 1600, 1400, 1200, 1100, 0]);
    expect(bidKingInitialWarehouseCapacity()).toBe(50);
    expect(bidKingReliefFundRuntime()).toEqual({
      times: 3,
      limit: 100_000,
      rewardRows: [[1, 1, 100_000]]
    });
  });
});
