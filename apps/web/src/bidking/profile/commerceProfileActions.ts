import type { PostProfileAction } from './profileActionClient';

export interface CommerceProfileActions {
  actOnMarketOrder: (orderId: string, action: 'settle' | 'cancel') => void;
  buyShopItem: (shopItemId: number) => void;
  cancelDemoPayOrder: (orderId: string) => void;
  claimGiftPackage: (packageId: string) => void;
  completeDemoPayOrder: (payId: string) => void;
  completePurchaseListOrder: (purchaseId: string) => void;
  createDemoPayOrder: (payId: string) => void;
  createMarketOrder: (refId: string, quantity: number, price: number, orderType: 'trade' | 'auction', note?: string) => void;
  refreshShop: (shopId?: number) => void;
  setShopItemCollection: (itemId: number, collected: boolean) => void;
  unlockDemoDlc: (dlcId: string) => void;
}

export function createCommerceProfileActions(postProfileAction: PostProfileAction): CommerceProfileActions {
  return {
    actOnMarketOrder: (orderId, action) => {
      postProfileAction('/api/market/order/action', { orderId, action });
    },
    buyShopItem: (shopItemId) => {
      postProfileAction('/api/shop/buy', { shopItemId });
    },
    cancelDemoPayOrder: (orderId) => {
      postProfileAction('/api/pay/order/cancel-demo', { orderId });
    },
    claimGiftPackage: (packageId) => {
      postProfileAction('/api/gift-package/claim', { packageId });
    },
    completeDemoPayOrder: (payId) => {
      postProfileAction('/api/pay/order/complete-demo', { payId });
    },
    completePurchaseListOrder: (purchaseId) => {
      postProfileAction('/api/purchase-list/complete-demo', { purchaseId });
    },
    createDemoPayOrder: (payId) => {
      postProfileAction('/api/pay/order', { payId });
    },
    createMarketOrder: (refId, quantity, price, orderType, note) => {
      postProfileAction('/api/market/order', { refId, quantity, price, orderType, note });
    },
    refreshShop: (shopId) => {
      postProfileAction('/api/shop/refresh', { shopId });
    },
    setShopItemCollection: (itemId, collected) => {
      postProfileAction('/api/shop/collect', { itemId, collected });
    },
    unlockDemoDlc: (dlcId) => {
      postProfileAction('/api/dlc/unlock-demo', { dlcId });
    }
  };
}
