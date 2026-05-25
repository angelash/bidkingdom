import { describe, expect, it } from 'vitest';
import { Access, Condition } from '@bitkingdom/bidking-compat';
import { bidKingConditionTypeCoverage, checkBidKingAccess, evaluateBidKingCondition } from './conditionEngine';

describe('conditionEngine', () => {
  it('opens empty access ids', () => {
    expect(checkBidKingAccess({ completedMatches: 0, level: 1 }).ok).toBe(true);
    expect(checkBidKingAccess({ completedMatches: 0, level: 1 }, 0).ok).toBe(true);
  });

  it('keeps unsupported access lenient for the current local mode', () => {
    const result = checkBidKingAccess({ completedMatches: 0, level: 1 }, 'missing_access');
    expect(result.ok).toBe(true);
    expect(result.unsupported).toBe(true);
  });

  it('can block unsupported access in strict parity mode', () => {
    const result = checkBidKingAccess({ completedMatches: 0, level: 1 }, 'missing_access', { strictUnsupported: true });
    expect(result.ok).toBe(false);
    expect(result.unsupported).toBe(true);
    expect(result.reason).toContain('入口未登记');
  });

  it('evaluates the base always-on condition', () => {
    const result = evaluateBidKingCondition(1, { completedMatches: 0, level: 1 });
    expect(result.ok).toBe(true);
    expect(result.conditionType).toBe(1);
  });

  it('evaluates selected hero conditions', () => {
    const result = evaluateBidKingCondition(
      {
        id: 300001,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 3,
        conditionparams: [107],
        divided: 1,
        maxvalue: 1,
        desc: 'test',
        packaged_desc: '测试角色条件'
      },
      { completedMatches: 0, level: 1, selectedHeroId: 107 }
    );
    expect(result.ok).toBe(true);
    expect(result.currentValue).toBe(1);
  });

  it('evaluates restored cumulative match conditions', () => {
    const result = evaluateBidKingCondition(
      {
        id: 430001,
        type: 1,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 20,
        conditionparams: [0],
        divided: 1,
        maxvalue: 3,
        desc: 'test',
        packaged_desc: '累计竞拍条件'
      },
      { completedMatches: 2, level: 1 }
    );

    expect(result.ok).toBe(false);
    expect(result.currentValue).toBe(2);
    expect(result.requiredValue).toBe(3);
  });

  it('evaluates restored auction item value conditions', () => {
    const highValueResult = evaluateBidKingCondition(
      {
        id: 100071,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 19,
        conditionparams: [10000, 0],
        divided: 1,
        maxvalue: 1,
        desc: 'condition_desc_100071',
        packaged_desc: '获得指定价值藏品'
      },
      { completedMatches: 0, level: 1, highestAuctionItemValue: 12000 }
    );
    const lowTotalResult = evaluateBidKingCondition(
      {
        id: 50069,
        type: 0,
        preorconditions: [4],
        preorconditionsparam: [[105]],
        preconditions: [],
        preconditionsparam: [],
        condition: 19,
        conditionparams: [0, 100000],
        divided: 1,
        maxvalue: 1,
        desc: 'condition_desc_50069',
        packaged_desc: '指定地图低总值竞拍成功'
      },
      {
        completedMatches: 0,
        level: 1,
        completedMapIds: [105],
        lowestAuctionItemTotalValueByMap: { 105: 90000 }
      }
    );

    expect(highValueResult.ok).toBe(true);
    expect(highValueResult.currentValue).toBe(1);
    expect(lowTotalResult.ok).toBe(true);
    expect(lowTotalResult.currentValue).toBe(1);
  });

  it('evaluates restored auction profit conditions', () => {
    const dailyResult = evaluateBidKingCondition(
      {
        id: 30002,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 24,
        conditionparams: [1],
        divided: 1,
        maxvalue: 100000,
        desc: 'condition_desc_30002',
        packaged_desc: '今日净利润'
      },
      { completedMatches: 0, level: 1, dailyAuctionProfit: 120000, totalAuctionProfit: 90000 }
    );
    const totalResult = evaluateBidKingCondition(
      {
        id: 50050,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 24,
        conditionparams: [1],
        divided: 1,
        maxvalue: 300000,
        desc: 'condition_desc_50050',
        packaged_desc: '累计竞拍利润'
      },
      { completedMatches: 0, level: 1, dailyAuctionProfit: 120000, totalAuctionProfit: 240000 }
    );

    expect(dailyResult.ok).toBe(true);
    expect(dailyResult.currentValue).toBe(120000);
    expect(totalResult.ok).toBe(false);
    expect(totalResult.currentValue).toBe(240000);
  });

  it('evaluates restored auction bid, failure, single profit, and asset conditions', () => {
    const bidResult = evaluateBidKingCondition(
      {
        id: 100133,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 14,
        conditionparams: [100000, 0],
        divided: 1,
        maxvalue: 1,
        desc: 'condition_desc_100133',
        packaged_desc: '单次出价达到阈值'
      },
      { completedMatches: 0, level: 1, highestAuctionBidAmount: 120000 }
    );
    const failResult = evaluateBidKingCondition(
      {
        id: 10006,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 17,
        conditionparams: [1],
        divided: 1,
        maxvalue: 2,
        desc: 'condition_desc_10006',
        packaged_desc: '竞拍失败次数'
      },
      { completedMatches: 0, level: 1, failedAuctionCount: 2 }
    );
    const singleProfitResult = evaluateBidKingCondition(
      {
        id: 100093,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 18,
        conditionparams: [100000],
        divided: 1,
        maxvalue: 1,
        desc: 'condition_desc_100093',
        packaged_desc: '单次净利润'
      },
      { completedMatches: 0, level: 1, highestSingleAuctionProfit: 99000 }
    );
    const assetResult = evaluateBidKingCondition(
      {
        id: 30006,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 25,
        conditionparams: [2, 100000],
        divided: 1,
        maxvalue: 1,
        desc: 'condition_desc_30006',
        packaged_desc: '当前总资产低于阈值'
      },
      { completedMatches: 0, level: 1, currentTotalAssets: 90000 }
    );

    expect(bidResult.ok).toBe(true);
    expect(failResult.ok).toBe(true);
    expect(failResult.currentValue).toBe(2);
    expect(singleProfitResult.ok).toBe(false);
    expect(singleProfitResult.currentValue).toBe(0);
    expect(assetResult.ok).toBe(true);
    expect(assetResult.currentValue).toBe(1);
  });

  it('evaluates restored specific BidMap and map-scoped auction count conditions', () => {
    const bidMapResult = evaluateBidKingCondition(
      {
        id: 5,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 5,
        conditionparams: [2101],
        divided: 1,
        maxvalue: 1,
        desc: 'condition_desc_5',
        packaged_desc: '指定关卡 ID'
      },
      { completedMatches: 0, level: 1, completedBidMapIds: [2101] }
    );
    const mapScopedSuccessResult = evaluateBidKingCondition(
      {
        id: 50060,
        type: 0,
        preorconditions: [4],
        preorconditionsparam: [[101]],
        preconditions: [],
        preconditionsparam: [],
        condition: 16,
        conditionparams: [1],
        divided: 1,
        maxvalue: 3,
        desc: 'condition_desc_50060',
        packaged_desc: '指定地图竞拍成功次数'
      },
      {
        completedMatches: 0,
        level: 1,
        completedMapIds: [101],
        successfulAuctionCount: 10,
        successfulAuctionCountByMap: { 101: 2 }
      }
    );

    expect(bidMapResult.ok).toBe(true);
    expect(bidMapResult.currentValue).toBe(1);
    expect(mapScopedSuccessResult.ok).toBe(false);
    expect(mapScopedSuccessResult.currentValue).toBe(2);
  });

  it('evaluates restored collection level and time interval conditions', () => {
    const collectionLevelResult = evaluateBidKingCondition(
      {
        id: 21,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 21,
        conditionparams: [0],
        divided: 1,
        maxvalue: 5,
        desc: 'condition_desc_21',
        packaged_desc: '收藏等级'
      },
      { completedMatches: 0, level: 2, collectionLevel: 6 }
    );
    const timeRangeResult = evaluateBidKingCondition(
      {
        id: 22,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 22,
        conditionparams: [9, 18],
        divided: 1,
        maxvalue: 1,
        desc: 'condition_desc_22',
        packaged_desc: '指定时间区间'
      },
      { completedMatches: 0, level: 1, now: Date.parse('2026-05-20T10:30:00+08:00') }
    );

    expect(collectionLevelResult.ok).toBe(true);
    expect(collectionLevelResult.currentValue).toBe(6);
    expect(timeRangeResult.ok).toBe(true);
    expect(timeRangeResult.currentValue).toBe(1);
  });

  it('evaluates restored item usage counters for total, daily, and specific items', () => {
    const totalResult = evaluateBidKingCondition(
      {
        id: 10003,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 6,
        conditionparams: [11, 0, 0, 0, 0, 1],
        divided: 1,
        maxvalue: 3,
        desc: 'condition_desc_10003',
        packaged_desc: '累计使用道具'
      },
      { completedMatches: 0, level: 1, usedItemCount: 4 }
    );
    const dailyResult = evaluateBidKingCondition(
      {
        id: 30003,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 6,
        conditionparams: [11, 0, 0, 0, 0, 1],
        divided: 1,
        maxvalue: 3,
        desc: 'condition_desc_30003',
        packaged_desc: '今日使用道具'
      },
      { completedMatches: 0, level: 1, usedItemCount: 10, dailyUsedItemCount: 2 }
    );
    const specificResult = evaluateBidKingCondition(
      {
        id: 50066,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 6,
        conditionparams: [0, 0, 100121, 0, 0, 1],
        divided: 1,
        maxvalue: 1,
        desc: 'condition_desc_50066',
        packaged_desc: '累计使用终极审计'
      },
      { completedMatches: 0, level: 1, usedItemCount: 10, usedItemCountsById: { 100121: 1 } }
    );

    expect(totalResult.ok).toBe(true);
    expect(totalResult.currentValue).toBe(4);
    expect(dailyResult.ok).toBe(false);
    expect(dailyResult.currentValue).toBe(2);
    expect(specificResult.ok).toBe(true);
    expect(specificResult.currentValue).toBe(1);
  });

  it('evaluates restored auction and shop acquired item counters', () => {
    const totalAuctionResult = evaluateBidKingCondition(
      {
        id: 10015,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 7,
        conditionparams: [0, 5, 0, 0, 0, 1],
        divided: 1,
        maxvalue: 2,
        desc: 'condition_desc_10015',
        packaged_desc: '累计竞拍获得藏品'
      },
      { completedMatches: 0, level: 1, auctionAcquiredItemIds: [100102, 100103] }
    );
    const specificAuctionResult = evaluateBidKingCondition(
      {
        id: 50049,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 7,
        conditionparams: [0, 0, 1056013, 0, 0, 1],
        divided: 1,
        maxvalue: 1,
        desc: 'condition_desc_50049',
        packaged_desc: '获得指定藏品'
      },
      { completedMatches: 0, level: 1, auctionAcquiredItemIds: [100102, 1056013] }
    );
    const shopResult = evaluateBidKingCondition(
      {
        id: 430008,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 8,
        conditionparams: [0],
        divided: 1,
        maxvalue: 1,
        desc: 'condition_desc_shop_item',
        packaged_desc: '商店获得道具'
      },
      { completedMatches: 0, level: 1, shopAcquiredItemIds: [100102] }
    );

    expect(totalAuctionResult.ok).toBe(true);
    expect(totalAuctionResult.currentValue).toBe(2);
    expect(specificAuctionResult.ok).toBe(true);
    expect(specificAuctionResult.currentValue).toBe(1);
    expect(shopResult.ok).toBe(true);
    expect(shopResult.currentValue).toBe(1);
  });

  it('can block unsupported condition types in strict parity mode', () => {
    const result = evaluateBidKingCondition(
      {
        id: 399999,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: 999,
        conditionparams: [],
        divided: 1,
        maxvalue: 1,
        desc: 'test',
        packaged_desc: '未知条件'
      },
      { completedMatches: 0, level: 1 },
      { strictUnsupported: true }
    );
    expect(result.ok).toBe(false);
    expect(result.unsupported).toBe(true);
  });

  it('audits every condition type in the synchronized table', () => {
    const coverage = bidKingConditionTypeCoverage();
    expect(coverage.unexpectedTypes).toEqual([]);
    expect(coverage.tableTypes).toEqual([...new Set(Condition.map((row) => row.condition))].sort((left, right) => left - right));
    expect(coverage.supportedTypes.length + coverage.explicitUnsupportedTypes.length).toBe(coverage.tableTypes.length);
  });

  it('keeps every table condition type covered by the restored engine', () => {
    const unsupportedTypes = bidKingConditionTypeCoverage().explicitUnsupportedTypes;
    expect(unsupportedTypes).toEqual([]);
    for (const conditionType of unsupportedTypes) {
      const row = {
        id: 400000 + conditionType,
        type: 0,
        preorconditions: [],
        preorconditionsparam: [],
        preconditions: [],
        preconditionsparam: [],
        condition: conditionType,
        conditionparams: [],
        divided: 1,
        maxvalue: 1,
        desc: 'test',
        packaged_desc: `Unsupported ${conditionType}`
      };
      const result = evaluateBidKingCondition(row, { completedMatches: 0, level: 1 }, { strictUnsupported: true });
      expect(result.ok).toBe(false);
      expect(result.unsupported).toBe(true);
      expect(result.reason).toContain('Unsupported');
    }
  });

  it('evaluates OR prerequisites before the primary condition', () => {
    const result = evaluateBidKingCondition(
      {
        id: 420001,
        type: 0,
        preorconditions: [3],
        preorconditionsparam: [[101]],
        preconditions: [],
        preconditionsparam: [],
        condition: 16,
        conditionparams: [1],
        divided: 1,
        maxvalue: 1,
        desc: 'test',
        packaged_desc: '带角色前置的成功竞拍条件'
      },
      { completedMatches: 0, level: 1, selectedHeroId: 102, successfulAuctionCount: 1 }
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('前置条件');
  });

  it('covers every Access requirement type from the synchronized table', () => {
    const requirementTypes = [...new Set(Access.map((row) => Number(row.columns[3] ?? 0)))].sort();
    expect(requirementTypes).toEqual([0, 1, 2]);
    for (const row of Access) {
      const result = checkBidKingAccess({ completedMatches: 999, level: 999 }, row.id, { strictUnsupported: true });
      expect(result.unsupported).not.toBe(true);
    }
  });
});
