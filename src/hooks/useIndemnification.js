import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from '@/data/indemnification';

/** Read-only view of every merchant's indemnification settings. */
export function useIndemnification() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export default useIndemnification;
