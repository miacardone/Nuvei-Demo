/**
 * MERCHANT SCOPE — which slice of the acquirer's book the console is showing.
 *
 * Nuvei is the acquirer, so the operator does not switch persona; they choose
 * whose disputes they are looking at. A scope is one of:
 *
 *   { kind: 'all' }                    every merchant in the book
 *   { kind: 'group',    id: 'retail' } one group's merchants
 *   { kind: 'merchant', id: 'lattice' } a single merchant
 *
 * Same external-store shape as indemnification.js so components subscribe with
 * useSyncExternalStore and never hold a second copy of this state. The choice
 * persists per browser: an operator who scoped to one merchant yesterday should
 * not have to find them again today.
 */

import { MERCHANT_ROSTER, MERCHANT_GROUPS } from '@/data/merchants';
import { readPref, writePref } from '@/utils/storage';

const KEY = 'ndc.merchant-scope';
export const ALL_SCOPE = { kind: 'all' };

const isValid = (s) =>
  s?.kind === 'all'
  || (s?.kind === 'group' && MERCHANT_GROUPS.some((g) => g.id === s.id))
  || (s?.kind === 'merchant' && MERCHANT_ROSTER.some((m) => m.id === s.id));

function load() {
  try {
    const parsed = JSON.parse(readPref(KEY, 'null'));
    return isValid(parsed) ? parsed : ALL_SCOPE;
  } catch {
    return ALL_SCOPE;
  }
}

let scope = load();
const listeners = new Set();

export const getSnapshot = () => scope;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setScope(next) {
  if (!isValid(next)) return;
  scope = next;
  writePref(KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

/** Merchant ids a scope covers. `null` means "everything" — callers should
 *  skip filtering entirely rather than compare against every id. */
export function merchantIdsFor(s = scope) {
  if (s.kind === 'all') return null;
  if (s.kind === 'merchant') return [s.id];
  return MERCHANT_ROSTER.filter((m) => m.groupId === s.id).map((m) => m.id);
}

export function labelFor(s = scope) {
  if (s.kind === 'all') return 'All merchants';
  if (s.kind === 'group') return MERCHANT_GROUPS.find((g) => g.id === s.id)?.label ?? 'Group';
  return MERCHANT_ROSTER.find((m) => m.id === s.id)?.name ?? 'Merchant';
}

/** Filter any collection of merchant-stamped records down to the scope. */
export function withinScope(rows, s = scope, key = 'merchantId') {
  const ids = merchantIdsFor(s);
  if (!ids) return rows;
  const set = new Set(ids);
  return rows.filter((r) => set.has(r[key]));
}
