import { useCallback, useMemo, useState } from 'react';
import type { PlayerSnapshot } from '@bitkingdom/shared';
import type { BidKingSocket } from '../socket/useBidKingSocket';
import { minimumAllowedBid } from './BattlePanels';

interface UseBidComposerActionsArgs {
  currentRound?: NonNullable<PlayerSnapshot['public']['currentRound']>;
  previousBid?: number;
  recommendedBid?: { safePrice: number; reason: string };
  selfCash?: number;
  socket: BidKingSocket | null;
}

export interface BidComposerActions {
  availableCash: number;
  bidAmount: number;
  bidAmountHidden: boolean;
  bidComposerOpen: boolean;
  bidDraft: string;
  bidDraftError?: string;
  bidDraftValid: boolean;
  backspaceBidDraft: () => void;
  clearBidDraft: () => void;
  closeBidComposer: () => void;
  closeConfirmBid: () => void;
  confirmBidAmount?: number;
  doubleBidDraft: () => void;
  fillRecommendedBid: () => void;
  minimumBid: number;
  pressBidKey: (key: string) => void;
  requestBidConfirm: () => void;
  resetBidComposer: () => void;
  setBidDraftToMax: () => void;
  setBidDraftToMinimum: () => void;
  submitBidClick: () => void;
  submitConfirmedBid: () => void;
  toggleBidAmountHidden: () => void;
  usePreviousBidAmount: (amount: number) => void;
}

export function useBidComposerActions({
  currentRound,
  previousBid,
  recommendedBid,
  selfCash,
  socket
}: UseBidComposerActionsArgs): BidComposerActions {
  const [bidAmount, setBidAmount] = useState(10000);
  const [bidComposerOpen, setBidComposerOpen] = useState(false);
  const [bidDraft, setBidDraft] = useState('0');
  const [bidAmountHidden, setBidAmountHidden] = useState(false);
  const [confirmBidAmount, setConfirmBidAmount] = useState<number>();
  const [manualError, setManualError] = useState<string>();

  const minimumBid = currentRound ? minimumAllowedBid(currentRound) : 0;
  const availableCash = selfCash ?? Number.MAX_SAFE_INTEGER;
  const draftAmount = Number(bidDraft || 0);
  const bidDraftError = manualError ?? validateDraft(draftAmount, minimumBid, availableCash);
  const bidDraftValid = !bidDraftError;

  const setDraftAmount = useCallback((amount: number): void => {
    const nextAmount = Math.max(0, Math.round(amount));
    setBidDraft(String(nextAmount));
    setManualError(undefined);
  }, []);

  const preferredOpenAmount = useCallback((): number => {
    if (previousBid !== undefined && previousBid > 0) {
      return Math.min(availableCash, Math.max(minimumBid, previousBid));
    }
    return Math.min(availableCash, Math.max(0, minimumBid));
  }, [availableCash, minimumBid, previousBid]);

  const submitBidClick = useCallback((): void => {
    setDraftAmount(preferredOpenAmount());
    setBidComposerOpen(true);
  }, [preferredOpenAmount, setDraftAmount]);

  const fillRecommendedBid = useCallback((): void => {
    if (!recommendedBid) {
      return;
    }
    setDraftAmount(Math.min(availableCash, Math.max(minimumBid, recommendedBid.safePrice)));
    setBidComposerOpen(true);
  }, [availableCash, minimumBid, recommendedBid, setDraftAmount]);

  const pressBidKey = useCallback((key: string): void => {
    setBidDraft((current) => {
      const next = `${current === '0' ? '' : current}${key}`.replace(/^0+(?=\d)/, '');
      return next.slice(0, 9) || '0';
    });
    setManualError(undefined);
  }, []);

  const backspaceBidDraft = useCallback((): void => {
    setBidDraft((current) => current.length > 1 ? current.slice(0, -1) : '0');
    setManualError(undefined);
  }, []);

  const doubleBidDraft = useCallback((): void => {
    setDraftAmount(Math.min(availableCash, Number(bidDraft || 0) * 2));
  }, [availableCash, bidDraft, setDraftAmount]);

  const requestBidConfirm = useCallback((): void => {
    const rawAmount = Math.max(0, Number(bidDraft || 0));
    const error = validateDraft(rawAmount, minimumBid, availableCash);
    if (error) {
      setManualError(error);
      return;
    }
    setConfirmBidAmount(rawAmount);
    setBidComposerOpen(false);
  }, [availableCash, bidDraft, minimumBid]);

  const submitConfirmedBid = useCallback((): void => {
    if (confirmBidAmount === undefined) {
      return;
    }
    setBidAmount(confirmBidAmount);
    socket?.emit('submitBid', { amount: confirmBidAmount });
    setConfirmBidAmount(undefined);
  }, [confirmBidAmount, socket]);

  const resetBidComposer = useCallback((): void => {
    setBidAmount(10000);
    setBidComposerOpen(false);
    setConfirmBidAmount(undefined);
    setBidDraft('0');
    setManualError(undefined);
  }, []);

  const usePreviousBidAmount = useCallback((amount: number): void => {
    setDraftAmount(Math.min(availableCash, Math.max(minimumBid, amount)));
  }, [availableCash, minimumBid, setDraftAmount]);

  const setBidDraftToMinimum = useCallback((): void => {
    setDraftAmount(Math.min(availableCash, Math.max(0, minimumBid)));
  }, [availableCash, minimumBid, setDraftAmount]);

  const setBidDraftToMax = useCallback((): void => {
    setDraftAmount(availableCash);
  }, [availableCash, setDraftAmount]);

  return useMemo(() => ({
    availableCash,
    bidAmount,
    bidAmountHidden,
    bidComposerOpen,
    bidDraft,
    bidDraftError,
    bidDraftValid,
    backspaceBidDraft,
    clearBidDraft: () => {
      setBidDraft('0');
      setManualError(undefined);
    },
    closeBidComposer: () => {
      setBidComposerOpen(false);
      setManualError(undefined);
    },
    closeConfirmBid: () => setConfirmBidAmount(undefined),
    confirmBidAmount,
    doubleBidDraft,
    fillRecommendedBid,
    minimumBid,
    pressBidKey,
    requestBidConfirm,
    resetBidComposer,
    setBidDraftToMax,
    setBidDraftToMinimum,
    submitBidClick,
    submitConfirmedBid,
    toggleBidAmountHidden: () => setBidAmountHidden((current) => !current),
    usePreviousBidAmount
  }), [
    availableCash,
    backspaceBidDraft,
    bidAmount,
    bidAmountHidden,
    bidComposerOpen,
    bidDraft,
    bidDraftError,
    bidDraftValid,
    confirmBidAmount,
    doubleBidDraft,
    fillRecommendedBid,
    minimumBid,
    pressBidKey,
    requestBidConfirm,
    resetBidComposer,
    setBidDraftToMax,
    setBidDraftToMinimum,
    submitBidClick,
    submitConfirmedBid,
    usePreviousBidAmount
  ]);
}

function validateDraft(amount: number, minimumBid: number, availableCash: number): string | undefined {
  if (!Number.isFinite(amount) || amount <= 0) {
    return '请输入有效出价';
  }
  if (amount < minimumBid) {
    return `低于最低出价 ${minimumBid.toLocaleString()}`;
  }
  if (amount > availableCash) {
    return `现金不足，最多 ${availableCash.toLocaleString()}`;
  }
  return undefined;
}
