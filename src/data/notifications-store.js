/**
 * NOTIFICATIONS
 * =============
 * The bell in the top bar, promoted from a hardcoded array to a real store so
 * that something in the console can actually raise one.
 *
 * This exists because "alert me when a merchant crosses X%" needs somewhere
 * for the alert to arrive. A standing rule that only reports when you open
 * the screen it lives on is a report, not an alert — the whole point is that
 * it finds you. The bell is on every page, so that is where it goes.
 *
 * `alertKey` is how a rule avoids shouting twice about the same merchant. A
 * threshold rule is re-evaluated on every page load, and without a key it
 * would raise a fresh notification every time you navigated, which is the
 * fastest way to teach someone to ignore the bell entirely.
 */

import { readPref, writePref } from '@/utils/storage';

const KEY = 'ddc.notifications';

const SEED = [
  { id: 'n1', title: 'Cases due within 24 hours', detail: '18 cases across three queues.', hours: 1, read: false, alertKey: null },
  { id: 'n2', title: 'Consolidation detected', detail: 'A transaction is disputed through two channels.', hours: 3, read: false, alertKey: null },
  { id: 'n3', title: 'Upload completed', detail: '147 of 148 rows imported.', hours: 6, read: true, alertKey: null },
];

const isShaped = (v) => v && typeof v === 'object' && typeof v.id === 'string' && typeof v.title === 'string';

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

let notes = load();
const listeners = new Set();

const getSnapshot = () => notes;
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

function commit(next) {
  notes = next;
  writePref(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

let seq = 0;

/**
 * Raise a notification. Returns false without doing anything if one carrying
 * the same `alertKey` is already on the list.
 */
export function raiseNotification({ title, detail, alertKey = null }) {
  if (alertKey && notes.some((n) => n.alertKey === alertKey)) return false;
  seq += 1;
  commit([
    { id: `n-${Date.now()}-${seq}`, title, detail, hours: 0, read: false, alertKey },
    ...notes,
  ]);
  return true;
}

/** Has this rule already alerted on this merchant? */
export const hasAlert = (alertKey) => notes.some((n) => n.alertKey === alertKey);

export const markRead = (id) => commit(notes.map((n) => (n.id === id ? { ...n, read: true } : n)));
export const markAllRead = () => commit(notes.map((n) => ({ ...n, read: true })));

export function resetNotifications() {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* storage unavailable — the in-memory reset below still applies */
  }
  notes = SEED;
  listeners.forEach((l) => l());
}

export { getSnapshot, subscribe };
