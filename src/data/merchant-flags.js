/**
 * MERCHANT FLAGS
 * ==============
 * The operational marks a bulk action can leave on a merchant that are not a
 * price: flagged for risk review, on the watchlist, owned by someone.
 *
 * These exist so the bulk actions are REAL. An action that fires a toast and
 * changes nothing is worse than no action at all — it teaches the reader that
 * the buttons are decorative. Everything written here is read back by the
 * Portfolio table and by Revenue rules, so applying a flag to forty merchants
 * is visible afterwards in the place you would go looking for it.
 *
 * Same store shape as indemnification.js: persisted, fail-safe on a corrupt
 * payload, and referentially stable between writes for useSyncExternalStore.
 */

import { readPref, writePref } from '@/utils/storage';

const KEY = 'ddc.merchant.flags';

/** Seeded so the columns are not blank on first load. */
const SEED = {
  'flightpath': { review: true, watchlist: true, owner: null, note: 'Ratio above threshold two cycles running.' },
  'goldenspin': { review: false, watchlist: true, owner: null, note: 'Volume growth outpacing controls.' },
};

const isShaped = (v) => v && typeof v === 'object'
  && typeof v.review === 'boolean'
  && typeof v.watchlist === 'boolean';

function load() {
  try {
    const raw = readPref(KEY, null);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return SEED;
    if (!Object.values(parsed).every(isShaped)) return SEED;
    return parsed;
  } catch {
    return SEED;
  }
}

let flags = load();
const listeners = new Set();

const getSnapshot = () => flags;
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

function commit(next) {
  flags = next;
  writePref(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export const EMPTY_FLAGS = { review: false, watchlist: false, owner: null, note: null };

export const flagsFor = (merchantId) => flags[merchantId] ?? EMPTY_FLAGS;

/** Merge a partial change into one merchant's flags. */
export function setFlags(merchantId, patch) {
  commit({ ...flags, [merchantId]: { ...flagsFor(merchantId), ...patch } });
}

/** One write for a whole selection — a bulk action should not fan out into
 *  forty separate commits, each one re-rendering every subscriber. */
export function setFlagsBulk(merchantIds, patch) {
  const next = { ...flags };
  merchantIds.forEach((id) => { next[id] = { ...flagsFor(id), ...patch }; });
  commit(next);
}

export function resetFlags() {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* storage unavailable — the in-memory reset below still applies */
  }
  flags = SEED;
  listeners.forEach((l) => l());
}

export { getSnapshot, subscribe };
