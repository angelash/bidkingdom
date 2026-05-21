import { describe, expect, it } from 'vitest';
import { Activity, GiftPackage, Mail, Mission, RankReward } from '@bitkingdom/bidking-compat';
import {
  activityRewardRowsFromRaw,
  createRewardPlans,
  parseBidKingNumberRows,
  parseRankRewardRange,
  rankRewardForRank,
  rankRewardPlans
} from './rewardEngine';

describe('rewardEngine', () => {
  it('parses single and bounded rank ranges', () => {
    expect(parseRankRewardRange('[1]')).toEqual([1, 1]);
    expect(parseRankRewardRange('[2,5]')).toEqual([2, 5]);
    expect(parseRankRewardRange()).toEqual([1, 1]);
  });

  it('builds one reward plan per RankReward row', () => {
    expect(rankRewardPlans()).toHaveLength(RankReward.length);
    expect(rankRewardPlans()[0]).toEqual(expect.objectContaining({
      activityId: RankReward[0]!.columns[2],
      rankId: RankReward[0]!.columns[3],
      rankRange: [1, 1],
      rewardRows: []
    }));
  });

  it('finds a reward plan for a concrete rank', () => {
    expect(rankRewardForRank(1)).toBeDefined();
  });

  it('parses BidKing numeric reward rows safely', () => {
    expect(parseBidKingNumberRows('[[1,1,20],[0,100100,2]]')).toEqual([[1, 1, 20], [0, 100100, 2]]);
    expect(parseBidKingNumberRows('[[]]')).toEqual([]);
    expect(parseBidKingNumberRows('not-json')).toEqual([]);
  });

  it('normalizes flat activity rewards into item reward rows', () => {
    expect(activityRewardRowsFromRaw('[100100,2]')).toEqual([[0, 100100, 2]]);
  });

  it('creates resource plans without mutating the raw table shape', () => {
    expect(createRewardPlans([[1, 1, 20], [0, 100100, 2]])).toEqual([
      {
        resource: 'coins',
        rewardType: 1,
        refId: 1,
        quantity: 20,
        inventoryType: 'coins'
      },
      {
        resource: 'item',
        rewardType: 0,
        refId: 100100,
        quantity: 2,
        inventoryType: 'item'
      }
    ]);
  });

  it('normalizes reward rows from every synced reward-bearing table', () => {
    const missionPlans = Mission.flatMap((row) => createRewardPlans(row.reward));
    const mailPlans = Mail.flatMap((row) => createRewardPlans(parseBidKingNumberRows(row.columns[7])));
    const activityPlans = Activity.flatMap((row) => createRewardPlans(activityRewardRowsFromRaw(row.columns[12])));
    const giftPackagePlans = GiftPackage.flatMap((row) => createRewardPlans(parseBidKingNumberRows(row.columns[7])));
    const rankPlans = rankRewardPlans();

    expect(missionPlans.length).toBeGreaterThan(0);
    expect(activityPlans.length).toBeGreaterThan(0);
    expect(giftPackagePlans.length).toBeGreaterThan(0);
    expect(rankPlans).toHaveLength(RankReward.length);
    expect([...missionPlans, ...mailPlans, ...activityPlans, ...giftPackagePlans]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          quantity: expect.any(Number),
          refId: expect.any(Number)
        })
      ])
    );
    expect([...missionPlans, ...mailPlans, ...activityPlans, ...giftPackagePlans].every((plan) => plan.quantity > 0 && plan.refId > 0)).toBe(true);
  });
});
