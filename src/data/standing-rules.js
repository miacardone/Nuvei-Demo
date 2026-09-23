/**
 * STANDING RULES
 * ==============
 * A rule that keeps applying, rather than a change made once.
 *
 * "Indemnify low-risk merchants at 25 bps" is two different instructions
 * depending on when you mean it. Applied once it is a decision about the
 * merchants that qualify today. Left standing it is a policy: anything that
 * qualifies later gets the same treatment without anyone opening the screen.
 * The console previously only did the first, which is why bulk RULES were
 * missing while bulk actions existed.
 *
 * WHAT "STANDING" ACTUALLY MEANS HERE. There is no server and no scheduler, so
 * a rule cannot fire on its own overnight. What it does instead is real and
 * honest: it is re-evaluated against the live portfolio every time anything is
 * read, so it always reports how many merchants qualify NOW and how many of
 * those do not yet match what the rule would do. That drift is the number a
 * policy is actually judged on, and "Run now" closes it. The UI says exactly
 * this rather than implying a cron job that does not exist.
 */

import { readPref, writePref } from '@/utils/storage';
import { CURRENT_USER } from '@/data/people';

const KEY = 'ddc.standing.rules';

const SEED = [
  {
    id: 'sr-1',
    name: 'Cover low-risk merchants at 25 bps',
    action: 'indemnify',
    config: { basis: 'bps', bps: 25, fee: 0.04 },
    criteria: [
      { field: 'riskTier', operator: 'is', value: 'Low' },
      { field: 'status', operator: 'is', value: 'Active' },
    ],
    enabled: true,
    createdBy: CURRENT_USER.email,
    createdAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
    lastRunAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
  },
  {
    id: 'sr-2',
    name: 'Watchlist anything above the 0.65% threshold',
    action: 'watchlist',
    config: {},
    criteria: [{ field: 'chargebackRatio', operator: 'gte', value: 0.65 }],
    enabled: true,
    createdBy: CURRENT_USER.email,
    createdAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
    lastRunAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
  },
];

const isShaped = (v) => v && typeof v === 'object'
  && typeof v.id === 'string'
  && typeof v.name === 'string'
  && Array.isArray(v.criteria);

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

let rules = load();
const listeners = new Set();

const getSnapshot = () => rules;
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

function commit(next) {
  rules = next;
  writePref(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

let seq = 100;

export function addStandingRule(rule) {
  seq += 1;
  const record = {
    id: `sr-${seq}`,
    enabled: true,
    createdBy: CURRENT_USER.email,
    createdAt: new Date().toISOString(),
    lastRunAt: null,
    ...rule,
  };
  commit([record, ...rules]);
  return record;
}

export function toggleStandingRule(id) {
  commit(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
}

export function removeStandingRule(id) {
  commit(rules.filter((r) => r.id !== id));
}

export function markRuleRun(id) {
  commit(rules.map((r) => (r.id === id ? { ...r, lastRunAt: new Date().toISOString() } : r)));
}

export function resetStandingRules() {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* storage unavailable — the in-memory reset below still applies */
  }
  rules = SEED;
  listeners.forEach((l) => l());
}

export { getSnapshot, subscribe };
