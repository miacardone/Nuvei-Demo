import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from '@/data/notifications-store';

/** Read-only view of the bell's contents. */
export function useNotifications() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export default useNotifications;
