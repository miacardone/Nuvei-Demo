import { useMemo } from 'react';
import { CASES } from '@/data/cases';
import { withinScope } from '@/data/merchant-scope';
import useMerchantScope from '@/hooks/useMerchantScope';

/**
 * The case book, narrowed to the merchant scope.
 *
 * Pages read this instead of importing CASES directly, so scoping is applied in
 * one place. Returns the original array unchanged when the scope is "all", so
 * the common case costs nothing.
 */
export function useScopedCases() {
  const scope = useMerchantScope();
  return useMemo(() => withinScope(CASES, scope), [scope]);
}

export default useScopedCases;
