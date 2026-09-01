import { useSyncExternalStore } from 'react';
import { getSnapshot, setRules, subscribe } from '@/data/rules-store';

/** Read-only view of the live rule list. */
export function useRules() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * `[rules, setRules]`, shaped like `useState` so the pages that already wrote
 * `setRules((p) => …)` against local state did not have to be rewritten — only
 * the line that creates the state.
 */
export function useRulesState() {
  return [useRules(), setRules];
}

export default useRules;
