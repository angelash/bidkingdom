import { useCallback, useMemo, useState } from 'react';
import type { BidKingSocket } from '../socket/useBidKingSocket';

interface UseBidComposerActionsArgs {
  previousBid?: number;
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
  selfCash,
  socket
}: UseBidComposerActionsArgs): BidComposerActions {
  const [bidAmount, setBidAmount] = useState(0);
  const [bidComposerOpen, setBidComposerOpen] = useState(false);
  const [bidDraft, setBidDraft] = useState('');
  const [bidAmountHidden, setBidAmountHidden] = useState(false);
  const [confirmBidAmount, setConfirmBidAmount] = useState<number>();
  const [manualError, setManualError] = useState<string>();

  const availableCash = selfCash ?? Number.MAX_SAFE_INTEGER;
  const draftAmount = Number(bidDraft || 0);
  const draftValidationError = bidDraft === '' ? undefined : validateDraft(draftAmount, availableCash);
  const bidDraftError = manualError ?? draftValidationError;
  const bidDraftValid = bidDraft !== '' && !bidDraftError;

  const setDraftAmount = useCallback((amount: number): void => {
    const nextAmount = Math.max(0, Math.round(amount));
    setBidDraft(String(nextAmount));
    setManualError(undefined);
  }, []);

  const submitBidClick = useCallback((): void => {
    setBidDraft('');
    setManualError(undefined);
    setBidComposerOpen(true);
  }, []);

  const pressBidKey = useCallback((key: string): void => {
    setBidDraft((current) => {
      const next = `${current === '0' ? '' : current}${key}`.replace(/^0+(?=\d)/, '');
      return next.slice(0, 9);
    });
    setManualError(undefined);
  }, []);

  const backspaceBidDraft = useCallback((): void => {
    setBidDraft((current) => current.length > 1 ? current.slice(0, -1) : '');
    setManualError(undefined);
  }, []);

  const doubleBidDraft = useCallback((): void => {
    setDraftAmount(Math.min(availableCash, Number(bidDraft || 0) * 2));
  }, [availableCash, bidDraft, setDraftAmount]);

  const requestBidConfirm = useCallback((): void => {
    const rawAmount = Math.max(0, Number(bidDraft || 0));
    const error = validateDraft(rawAmount, availableCash);
    if (error) {
      setManualError(error);
      return;
    }
    setConfirmBidAmount(rawAmount);
    setBidComposerOpen(false);
  }, [availableCash, bidDraft]);

  const submitConfirmedBid = useCallback((): void => {
    if (confirmBidAmount === undefined) {
      return;
    }
    setBidAmount(confirmBidAmount);
    socket?.emit('submitBid', { amount: confirmBidAmount });
    setConfirmBidAmount(undefined);
    setBidDraft('');
  }, [confirmBidAmount, socket]);

  const resetBidComposer = useCallback((): void => {
    setBidAmount(0);
    setBidComposerOpen(false);
    setConfirmBidAmount(undefined);
    setBidDraft('');
    setManualError(undefined);
  }, []);

  const usePreviousBidAmount = useCallback((amount: number): void => {
    setDraftAmount(Math.min(availableCash, Math.max(0, amount)));
  }, [availableCash, setDraftAmount]);

  const setBidDraftToMinimum = useCallback((): void => {
    setDraftAmount(0);
  }, [setDraftAmount]);

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
      setBidDraft('');
      setManualError(undefined);
    },
    closeBidComposer: () => {
      setBidComposerOpen(false);
      setManualError(undefined);
    },
    closeConfirmBid: () => setConfirmBidAmount(undefined),
    confirmBidAmount,
    doubleBidDraft,
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

function validateDraft(amount: number, availableCash: number): string | undefined {
  if (!Number.isFinite(amount) || amount <= 0) {
    return '请输入有效出价';
  }
  if (amount > availableCash) {
    return `现金不足，最多 ${availableCash.toLocaleString()}`;
  }
  return undefined;
}
