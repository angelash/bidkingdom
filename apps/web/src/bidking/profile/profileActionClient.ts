import type { ProfileSnapshot } from '@bitkingdom/shared';

export interface UseProfileActionsArgs {
  onError: (message: string) => void;
  onProfileSnapshot: (snapshot: ProfileSnapshot) => void;
  playerId: string;
  serverUrl: string;
}

export type PostProfileAction = (path: string, body: Record<string, unknown>) => void;
