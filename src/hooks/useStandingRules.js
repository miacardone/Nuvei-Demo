import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from '@/data/standing-rules';

/** Read-only view of the rules left switched on. */
export function useStandingRules() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export default useStandingRules;
