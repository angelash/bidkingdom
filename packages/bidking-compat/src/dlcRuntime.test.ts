import { describe, expect, it } from 'vitest';
import { bidKingDlcRuntime } from './dlcRuntime';
import { Dlc } from './tables/Dlc';

describe('BidKing Dlc runtime helpers', () => {
  it('explains platform SKU, rewards, mail template, and simulation boundary', () => {
    const dlc = Dlc[0]!;
    const runtime = bidKingDlcRuntime(dlc);

    expect(runtime).toEqual(expect.objectContaining({
      dlcId: '4464600',
      platformSku: '4464600',
      typeCode: 2,
      mailTemplateId: '110',
      serviceMode: 'local_simulated_platform_unlock',
      serviceModeLabel: '本地模拟平台解锁',
      price: 0
    }));
    expect(runtime.rewardRows).toEqual([[5, 7101, 2], [1, 2, 200], [1, 1, 2000000]]);
  });
});
