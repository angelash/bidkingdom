import { describe, expect, it } from 'vitest';
import { bidKingPayRuntime } from './payRuntime';
import { Pay } from './tables/Pay';

describe('BidKing Pay runtime helpers', () => {
  it('explains coin amount, prices, description keys, and simulation boundary', () => {
    const first = bidKingPayRuntime(Pay[0]!);
    const sixth = bidKingPayRuntime(Pay[5]!);

    expect(first).toEqual(expect.objectContaining({
      payId: '1',
      typeCode: 1,
      descriptionKey: 'pay_desc1',
      baseCoins: 700,
      bonusCoins: 0,
      totalCoins: 700,
      rmb: 99,
      usd: 70,
      orderDescriptionKey: 'pay_orderdesc_1',
      iconKey: 'ui_purchase_pic_1',
      steamDescriptionKey: 'pay_steamdesc_1',
      serviceMode: 'external_payment_metadata',
      serviceModeLabel: '外部支付元数据'
    }));
    expect(sixth.totalCoins).toBe(70750);
    expect(sixth.rmb).toBe(9999);
    expect(sixth.usd).toBe(7000);
  });
});
