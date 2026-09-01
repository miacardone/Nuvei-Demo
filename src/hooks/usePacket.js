import { useSyncExternalStore } from 'react';
import { getPacket, setPacket, subscribe } from '@/data/packet-store';

/**
 * `[packet, update]` for a case, shaped like `useState` so the editor's
 * existing functional updates did not have to be rewritten.
 */
export function usePacket(c) {
  const packet = useSyncExternalStore(subscribe, () => getPacket(c));
  return [packet, (update) => setPacket(c.id, update)];
}

export default usePacket;
