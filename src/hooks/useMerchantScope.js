import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from '@/data/merchant-scope';

/** The active merchant scope. Components re-render when the operator changes it. */
export function useMerchantScope() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export default useMerchantScope;
