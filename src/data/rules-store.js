/**
 * RULES STORE
 * ===========
 * One live copy of the rule list, shared by every screen that reads or writes
 * it.
 *
 * WHY THIS EXISTS. Rule groups held the list in `useState(RULES)` and Add rule
 * held its draft in its own component state, so "Complete Rule" could only ever
 * fire a toast and navigate away — the new rule had nowhere to go, and the list
 * it landed back on was rebuilt from the original module constant. The same
 * applied to enabling, reordering and deleting: every edit was reverted by the
 * next navigation, while the toast said it had worked. A confirmation for
 * something that did not happen is worse than no confirmation.
 *
 * WHY NOT CONTEXT. Rules are read by three sibling routes and written by two.
 * A provider would have to sit at the router root and thread through pages that
 * do not care about rules, for state that is genuinely app-global. An external
 * store subscribed to with `useSyncExternalStore` keeps the pages unchanged
 * apart from the hook they call.
 *
 * PERSISTENCE is deliberate: a rule added during a demo survives a reload, so
 * "let me show you the rule I just built" works after a refresh. A corrupt or
 * stale payload falls back to the seed rather than taking the page down —
 * a saved preference must never be able to break a screen.
 */

import { RULES } from '@/data/rules';
import { readPref, writePref } from '@/utils/storage';

const KEY = 'ddc.rules';

/** A stored rule must still look like a rule, or we discard the payload. */
const isRuleShaped = (r) =>
  r && typeof r === 'object'
  && typeof r.id === 'string'
  && typeof r.groupId === 'string'
  && Array.isArray(r.criteria)
  && Array.isArray(r.actions);

function load() {
  try {
    const raw = readPref(KEY, null);
    if (!raw) return RULES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length || !parsed.every(isRuleShaped)) return RULES;
    return parsed;
  } catch {
    return RULES;
  }
}

let rules = load();
const listeners = new Set();

/**
 * The snapshot must be referentially stable between writes.
 * `useSyncExternalStore` compares snapshots by identity and re-renders on any
 * change, so returning a fresh array here would loop forever.
 */
const getSnapshot = () => rules;

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function commit(next) {
  rules = next;
  writePref(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

/** Accepts a value or an updater, so call sites read like `setState`. */
export function setRules(update) {
  commit(typeof update === 'function' ? update(rules) : update);
}

export function addRule(rule) {
  commit([...rules, rule]);
  return rule;
}

/**
 * Back to the shipped set — used by the reset control on Rule groups.
 *
 * CLEARS the key rather than writing the seed into it. Writing the seed left a
 * stored payload behind, and the next page load parsed it into a NEW array, so
 * `isCustomised()` — an identity check against the seed — reported true and
 * the Reset control stayed on screen for a list nobody had touched.
 */
export function resetRules() {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* storage unavailable — the in-memory reset below still applies */
  }
  rules = RULES;
  listeners.forEach((l) => l());
}

/** True once anything has been added, edited, reordered or deleted. */
export const isCustomised = () => rules !== RULES;

/**
 * Next free id and sort order for a group. Ids have to clear the seeded `r1…`
 * series and any rule added earlier in the session, so this scans rather than
 * counting — `RULES.length + 1` would collide the moment a seed rule is
 * deleted.
 */
export function nextRuleId() {
  let n = rules.length + 1;
  while (rules.some((r) => r.id === `r${n}`)) n += 1;
  return `r${n}`;
}

export function nextSortOrder(groupId) {
  const inGroup = rules.filter((r) => r.groupId === groupId && !r.parentId);
  return inGroup.reduce((max, r) => Math.max(max, r.sortOrder ?? 0), 0) + 1;
}

export { getSnapshot, subscribe };
