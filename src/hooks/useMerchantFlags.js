import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from '@/data/merchant-flags';

/** Read-only view of every merchant's review, watchlist and owner marks. */
export function useMerchantFlags() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export default useMerchantFlags;
