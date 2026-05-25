import type { PostProfileAction } from './profileActionClient';

export interface CommerceProfileActions {
  actOnMarketOrder: (orderId: string, action: 'settle' | 'cancel') => void;
  actOnSendAuction: (input: { action: 'settle'; sendAuctionId: string; finalPrice?: number } | { action: 'recycle'; slotId: number }) => void;
  buyShopItem: (shopItemId: number) => void;
  claimGiftPackage: (packageId: string) => void;
  createMarketOrder: (refId: string, quantity: number, price: number, orderType: 'trade' | 'auction', note?: string) => void;
  createSendAuction: (mapCid: number, itemSelections: Array<{ stockId: number; boxId: number }>, slotId?: number) => void;
  refreshShop: (shopId?: number) => void;
  setShopItemCollection: (itemId: number, collected: boolean) => void;
}

export function createCommerceProfileActions(postProfileAction: PostProfileAction): CommerceProfileActions {
  return {
    actOnMarketOrder: (orderId, action) => {
      postProfileAction('/api/market/order/action', { orderId, action });
    },
    actOnSendAuction: (input) => {
      postProfileAction('/api/send-auction/action', input);
    },
    buyShopItem: (shopItemId) => {
      postProfileAction('/api/shop/buy', { shopItemId });
    },
    claimGiftPackage: (packageId) => {
      postProfileAction('/api/gift-package/claim', { packageId });
    },
    createMarketOrder: (refId, quantity, price, orderType, note) => {
      postProfileAction('/api/market/order', { refId, quantity, price, orderType, note });
    },
    createSendAuction: (mapCid, itemSelections, slotId) => {
      postProfileAction('/api/send-auction', slotId === undefined ? { mapCid, itemSelections } : { mapCid, itemSelections, slotId });
    },
    refreshShop: (shopId) => {
      postProfileAction('/api/shop/refresh', { shopId });
    },
    setShopItemCollection: (itemId, collected) => {
      postProfileAction('/api/shop/collect', { itemId, collected });
    }
  };
}
