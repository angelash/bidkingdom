import { Dlc, Pay, PurchaseList, bidKingDlcRuntime, bidKingPayRuntime } from '@bitkingdom/bidking-compat';
import type { PlayerProfile, ProfileTransaction, PurchaseOrderState } from '@bitkingdom/shared';
import { randomUUID } from 'node:crypto';
import {
  dlcRewards,
  payCoinAmount,
  payForPurchaseList,
  payPriceAmount
} from '../profile/profileRewardCatalog';
import { addMailFromTemplate } from '../profile/profileMailRuntime';

export type PurchaseNumberChangeApplier = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: Extract<ProfileTransaction['resource'], 'coins' | 'rankPoints' | 'xp'>,
  amountChange: number
) => void;

export type PurchaseRewardRowsApplier = (
  profile: PlayerProfile,
  sourcePrefix: string,
  rewards: readonly (readonly number[])[],
  reason: string
) => void;

export type PurchaseTransactionRecorder = (
  profile: PlayerProfile,
  sourceId: string,
  reason: string,
  resource: ProfileTransaction['resource'],
  before: number,
  quantity: number
) => void;

export type PurchaseSourceChecker = (sourceId: string) => boolean;

export function createDemoPayOrderForProfile(
  profile: PlayerProfile,
  payId: string,
  recordTransaction: PurchaseTransactionRecorder
): void {
  const pay = Pay.find((row) => row.id === payId);
  if (!pay) {
    throw new Error('充值配置不存在');
  }
  const runtime = bidKingPayRuntime(pay);
  getOrCreatePurchaseOrder(profile, 'pay', runtime.payId, runtime.totalCoins, runtime.rmb, recordTransaction);
  profile.updatedAt = Date.now();
}

export function completeDemoPayOrderForProfile(
  profile: PlayerProfile,
  payId: string,
  applyNumberChange: PurchaseNumberChangeApplier,
  recordTransaction: PurchaseTransactionRecorder,
  hasTransactionSource: PurchaseSourceChecker
): boolean {
  const pay = Pay.find((row) => row.id === payId);
  if (!pay) {
    throw new Error('充值配置不存在');
  }
  const completed = profile.purchaseOrders?.find(
    (order) => order.source === 'pay' && order.refId === pay.id && order.status === 'completed'
  );
  if (completed) {
    return false;
  }
  const runtime = bidKingPayRuntime(pay);
  const amount = runtime.totalCoins;
  if (amount <= 0) {
    throw new Error('充值配置未配置可发放铜钱');
  }
  const order = getOrCreatePurchaseOrder(profile, 'pay', runtime.payId, amount, runtime.rmb, recordTransaction);
  completePurchaseOrder(profile, order, amount, 'pay_demo_complete', applyNumberChange, recordTransaction, hasTransactionSource);
  return true;
}

export function cancelDemoPayOrderForProfile(
  profile: PlayerProfile,
  orderId: string,
  recordTransaction: PurchaseTransactionRecorder
): boolean {
  const order = profile.purchaseOrders?.find((candidate) => candidate.id === orderId);
  if (!order) {
    throw new Error('订单不存在');
  }
  if (order.status === 'completed') {
    throw new Error('已完成订单不能取消');
  }
  if (order.status === 'cancelled') {
    return false;
  }
  order.status = 'cancelled';
  order.cancelledAt = Date.now();
  order.updatedAt = Date.now();
  recordTransaction(profile, `purchase_order:${profile.playerId}:${order.id}:cancel`, 'purchase_order_cancel', 'task', 0, 1);
  profile.updatedAt = Date.now();
  return true;
}

export function completePurchaseListOrderForProfile(
  profile: PlayerProfile,
  purchaseId: string,
  applyNumberChange: PurchaseNumberChangeApplier,
  recordTransaction: PurchaseTransactionRecorder,
  hasTransactionSource: PurchaseSourceChecker
): boolean {
  const purchase = PurchaseList.find((row) => row.id === purchaseId);
  if (!purchase) {
    throw new Error('平台商品配置不存在');
  }
  const completed = profile.purchaseOrders?.find(
    (order) => order.source === 'purchaseList' && order.refId === purchase.id && order.status === 'completed'
  );
  if (completed) {
    return false;
  }
  const pay = payForPurchaseList(purchase);
  const amount = pay ? payCoinAmount(pay) : 0;
  if (amount <= 0) {
    throw new Error('平台商品未关联可发放档位');
  }
  const order = getOrCreatePurchaseOrder(profile, 'purchaseList', purchase.id, amount, pay ? payPriceAmount(pay) : 0, recordTransaction);
  completePurchaseOrder(profile, order, amount, 'purchase_list_demo_complete', applyNumberChange, recordTransaction, hasTransactionSource);
  return true;
}

export function unlockDemoDlcForProfile(
  profile: PlayerProfile,
  dlcId: string,
  applyRewardRows: PurchaseRewardRowsApplier,
  recordTransaction: PurchaseTransactionRecorder,
  hasTransactionSource: PurchaseSourceChecker
): boolean {
  const dlc = Dlc.find((row) => row.id === dlcId);
  if (!dlc) {
    throw new Error('DLC 配置不存在');
  }
  if (profile.dlcUnlocks?.includes(dlc.id)) {
    return false;
  }
  const runtime = bidKingDlcRuntime(dlc);
  const order = getOrCreatePurchaseOrder(profile, 'dlc', runtime.platformSku, 0, runtime.price, recordTransaction);
  if (order.status === 'cancelled') {
    throw new Error('已取消订单不能完成');
  }
  const sourceId = `dlc_demo:${profile.playerId}:${dlc.id}`;
  if (hasTransactionSource(sourceId)) {
    return false;
  }
  applyRewardRows(profile, sourceId, runtime.rewardRows.length > 0 ? runtime.rewardRows : dlcRewards(dlc), 'dlc_reward');
  if (runtime.mailTemplateId) {
    const delivered = addMailFromTemplate(profile, runtime.mailTemplateId, `dlc_${dlc.id}`);
    if (delivered) {
      recordTransaction(profile, `${sourceId}:mail:${runtime.mailTemplateId}`, 'dlc_mail_delivered', 'mail', 0, 1);
    }
  }
  profile.dlcUnlocks ??= [];
  profile.dlcUnlocks.push(dlc.id);
  order.status = 'completed';
  order.completedAt = Date.now();
  order.updatedAt = Date.now();
  recordTransaction(profile, `${sourceId}:unlock`, 'dlc_unlock', 'task', 0, 1);
  profile.updatedAt = Date.now();
  return true;
}

function getOrCreatePurchaseOrder(
  profile: PlayerProfile,
  source: PurchaseOrderState['source'],
  refId: string,
  coins: number,
  price: number,
  recordTransaction: PurchaseTransactionRecorder
): PurchaseOrderState {
  profile.purchaseOrders ??= [];
  const existing = profile.purchaseOrders.find(
    (order) => order.source === source && order.refId === refId && order.status === 'created'
  );
  if (existing) {
    return existing;
  }
  const order: PurchaseOrderState = {
    id: `order_${randomUUID()}`,
    source,
    refId,
    status: 'created',
    coins,
    price,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  profile.purchaseOrders.unshift(order);
  recordTransaction(profile, `purchase_order:${profile.playerId}:${order.id}:create`, 'purchase_order_create', 'task', 0, 1);
  return order;
}

function completePurchaseOrder(
  profile: PlayerProfile,
  order: PurchaseOrderState,
  amount: number,
  reason: string,
  applyNumberChange: PurchaseNumberChangeApplier,
  recordTransaction: PurchaseTransactionRecorder,
  hasTransactionSource: PurchaseSourceChecker
): void {
  if (order.status === 'cancelled') {
    throw new Error('已取消订单不能完成');
  }
  const sourceId = `purchase_order:${profile.playerId}:${order.id}:complete`;
  if (hasTransactionSource(sourceId)) {
    return;
  }
  applyNumberChange(profile, sourceId, reason, 'coins', amount);
  order.status = 'completed';
  order.completedAt = Date.now();
  order.updatedAt = Date.now();
  recordTransaction(profile, `${sourceId}:state`, reason, 'task', 0, 1);
  profile.updatedAt = Date.now();
}
