import { useCallback, useMemo } from 'react';
import { postProfileActionSnapshot } from '../api/bidkingApiClient';
import { createCommerceProfileActions, type CommerceProfileActions } from './commerceProfileActions';
import { createPreferenceProfileActions, type PreferenceProfileActions } from './preferenceProfileActions';
import { createProgressProfileActions, type ProgressProfileActions } from './progressProfileActions';
import type { PostProfileAction, UseProfileActionsArgs } from './profileActionClient';
import { createSocialProfileActions, type SocialProfileActions } from './socialProfileActions';

export interface ProfileActions
  extends CommerceProfileActions,
    PreferenceProfileActions,
    ProgressProfileActions,
    SocialProfileActions {}

export function useProfileActions({
  onError,
  onProfileSnapshot,
  playerId,
  serverUrl
}: UseProfileActionsArgs): ProfileActions {
  const postProfileAction = useCallback<PostProfileAction>((path, body) => {
    void postProfileActionSnapshot(serverUrl, playerId, path, body)
      .then(onProfileSnapshot)
      .catch((error: unknown) => {
        onError(error instanceof Error ? error.message : '操作失败');
      });
  }, [onError, onProfileSnapshot, playerId, serverUrl]);

  return useMemo(() => ({
    ...createCommerceProfileActions(postProfileAction),
    ...createPreferenceProfileActions(postProfileAction),
    ...createProgressProfileActions(postProfileAction),
    ...createSocialProfileActions(postProfileAction)
  }), [postProfileAction]);
}
