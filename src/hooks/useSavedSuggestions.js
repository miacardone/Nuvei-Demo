import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from '@/data/suggestions-store';

/** Read-only view of every saved suggestion and what was decided about it. */
export function useSavedSuggestions() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export default useSavedSuggestions;
