/**
 * SAVED SUGGESTIONS
 * =================
 * Anything built in Create can be saved, and whatever is done with it after
 * that is recorded here: saved, applied, or dismissed.
 *
 * Written the same way as data/indemnification.js and for the same reason —
 * the Suggestions tab and the Create tab are siblings, and a suggestion saved
 * on one has to be there when you switch to the other. Persisted, so a
 * suggestion built during a demo survives a reload.
 */

import { readPref, writePref } from '@/utils/storage';
import { CURRENT_USER } from '@/data/people';

const KEY = 'ddc.revenue.suggestions';

export const STATUSES = {
  saved: { label: 'Saved', tone: 'info' },
  applied: { label: 'Applied', tone: 'success' },
  dismissed: { label: 'Dismissed', tone: 'muted' },
};

/**
 * Seeded with a short history so the panel is not empty on first load — a
 * history section that starts blank teaches the reader nothing about what it
 * is for. These read as work already done by the team.
 */
const seed = () => {
  const now = Date.now();
  const ago = (d) => new Date(now - d * 86_400_000).toISOString();
  return [
    {
      id: 'sg-1003',
      title: 'Indemnify Brightwave Electronics at 25 bps',
      category: 'indemnification',
      mode: 'merchant',
      summary: '$536.3K revenue against $124.3K expected loss — net +$411.9K.',
      merchantCount: 1,
      status: 'applied',
      createdBy: CURRENT_USER.email,
      createdAt: ago(9),
      actionedAt: ago(7),
      actionNote: 'Applied after the Q3 pricing review.',
    },
    {
      id: 'sg-1002',
      title: 'Re-price merchants above the 0.65% threshold',
      category: 'risk',
      mode: 'criteria',
      summary: '2 merchants carrying liability we are not pricing for.',
      merchantCount: 2,
      status: 'saved',
      createdBy: CURRENT_USER.email,
      createdAt: ago(4),
      actionedAt: null,
      actionNote: null,
    },
    {
      id: 'sg-1001',
      title: 'Flat 40 bps across Travel & Hospitality',
      category: 'revenue',
      mode: 'criteria',
      summary: 'Rejected — the group average sits below break-even once FlightPath is included.',
      merchantCount: 3,
      status: 'dismissed',
      createdBy: CURRENT_USER.email,
      createdAt: ago(21),
      actionedAt: ago(20),
      actionNote: 'Revisit once FlightPath is off suspension.',
    },
  ];
};

const SEED = seed();

const isShaped = (v) =>
  v && typeof v === 'object' && typeof v.id === 'string' && typeof v.title === 'string' && v.status in STATUSES;

function load() {
  try {
    const raw = readPref(KEY, null);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isShaped)) return SEED;
    return parsed;
  } catch {
    return SEED;
  }
}

let items = load();
const listeners = new Set();

const getSnapshot = () => items;
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

function commit(next) {
  items = next;
  writePref(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

let seq = 1003;

export function saveSuggestion(entry) {
  seq += 1;
  const record = {
    id: `sg-${seq}`,
    status: 'saved',
    createdBy: CURRENT_USER.email,
    createdAt: new Date().toISOString(),
    actionedAt: null,
    actionNote: null,
    ...entry,
  };
  commit([record, ...items]);
  return record;
}

export function markSuggestion(id, status, actionNote = null) {
  commit(items.map((s) => (s.id === id
    ? { ...s, status, actionedAt: new Date().toISOString(), actionNote }
    : s)));
}

export function removeSuggestion(id) {
  commit(items.filter((s) => s.id !== id));
}

export function resetSuggestions() {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* storage unavailable — the in-memory reset below still applies */
  }
  items = SEED;
  listeners.forEach((l) => l());
}

export { getSnapshot, subscribe };
