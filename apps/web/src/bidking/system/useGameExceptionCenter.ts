import { useCallback, useMemo, useState } from 'react';
import {
  createGameExceptionRecord,
  mergeGameExceptionRecord,
  type GameExceptionInput,
  type GameExceptionRecord
} from './gameExceptionRuntime';

const MAX_EXCEPTION_RECORDS = 24;

export interface GameExceptionCenterState {
  activeExceptions: GameExceptionRecord[];
  dismissAllExceptions: () => void;
  dismissException: (key: string) => void;
  exceptionCenterOpen: boolean;
  openException?: GameExceptionRecord;
  openExceptionCenter: (key?: string) => void;
  recentExceptions: GameExceptionRecord[];
  reportException: (input: GameExceptionInput) => void;
  resolveException: (key: string) => void;
  setExceptionCenterOpen: (open: boolean) => void;
}

export function useGameExceptionCenter(): GameExceptionCenterState {
  const [records, setRecords] = useState<GameExceptionRecord[]>([]);
  const [openKey, setOpenKey] = useState<string>();

  const reportException = useCallback((input: GameExceptionInput): void => {
    const now = Date.now();
    const draft = createGameExceptionRecord(input, now);
    setRecords((current) => {
      const existingIndex = current.findIndex((record) => record.status === 'active' && record.key === draft.key);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = mergeGameExceptionRecord(next[existingIndex]!, input, now);
        return sortRecords(next).slice(0, MAX_EXCEPTION_RECORDS);
      }
      return [draft, ...current].slice(0, MAX_EXCEPTION_RECORDS);
    });
    if (draft.modal) {
      setOpenKey(draft.key);
    }
  }, []);

  const dismissException = useCallback((key: string): void => {
    setRecords((current) => current.map((record) => (
      record.key === key ? { ...record, status: 'dismissed', updatedAt: Date.now() } : record
    )));
    setOpenKey((current) => current === key ? undefined : current);
  }, []);

  const resolveException = useCallback((key: string): void => {
    setRecords((current) => current.map((record) => (
      record.key === key ? { ...record, status: 'resolved', updatedAt: Date.now() } : record
    )));
    setOpenKey((current) => current === key ? undefined : current);
  }, []);

  const dismissAllExceptions = useCallback((): void => {
    const now = Date.now();
    setRecords((current) => current.map((record) => (
      record.status === 'active' ? { ...record, status: 'dismissed', updatedAt: now } : record
    )));
    setOpenKey(undefined);
  }, []);

  const openExceptionCenter = useCallback((key?: string): void => {
    setOpenKey(key ?? records.find((record) => record.status === 'active')?.key ?? records[0]?.key);
  }, [records]);

  const setExceptionCenterOpen = useCallback((open: boolean): void => {
    if (open) {
      openExceptionCenter();
    } else {
      setOpenKey(undefined);
    }
  }, [openExceptionCenter]);

  const activeExceptions = useMemo(
    () => records.filter((record) => record.status === 'active'),
    [records]
  );
  const recentExceptions = useMemo(
    () => sortRecords(records).slice(0, MAX_EXCEPTION_RECORDS),
    [records]
  );
  const openException = useMemo(
    () => openKey ? records.find((record) => record.key === openKey) : undefined,
    [openKey, records]
  );

  return {
    activeExceptions,
    dismissAllExceptions,
    dismissException,
    exceptionCenterOpen: Boolean(openKey),
    openException,
    openExceptionCenter,
    recentExceptions,
    reportException,
    resolveException,
    setExceptionCenterOpen
  };
}

function sortRecords(records: GameExceptionRecord[]): GameExceptionRecord[] {
  return [...records].sort((left, right) => right.updatedAt - left.updatedAt);
}
