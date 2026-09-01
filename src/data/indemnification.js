/**
 * INDEMNIFICATION STORE
 * =====================
 * Per-merchant chargeback indemnification: the acquirer absorbs the liability
 * for a merchant's chargebacks in exchange for a charge, priced either as a
 * flat fee per dispute or in basis points of processed volume.
 *
 * This is a SERVICE-LEVEL setting, so it lives beside the merchant in the
 * acquirer's portfolio rather than in the merchant's own settings — the
 * merchant does not get to switch its own liability off.
 *
 * Written the same way as data/rules-store.js, and for the same reason: the
 * screens that read this are siblings, an edit made on one has to survive
 * navigating to another, and an edit that a toast confirms but that silently
 * reverts on the next render is worse than no edit at all.
 *
 * PERSISTENCE is deliberate — an indemnification switched on during a demo
 * survives a reload. A corrupt or stale payload falls back to the seed rather
 * than taking the page down.
 */

import { MERCHANTS } from '@/data/portfolio';
import { readPref, writePref } from '@/utils/storage';

const KEY = 'ddc.indemnification';

/** Basis points are integers; a fee is currency. Both are stored, so toggling
 *  between them does not discard the figure you typed for the other. */
export const BASES = [
  { id: 'fee', label: 'Set fee', hint: 'A flat charge per dispute.' },
  { id: 'bps', label: 'Basis points', hint: 'A share of processed volume. 100 bps = 1%.' },
];

export const DEFAULT_FEE = 25;
export const DEFAULT_BPS = 15;

/**
 * Seeded from risk tier rather than at random, so the screen shows both states
 * on first load and shows the SAME ones every time it is demoed. Higher-risk
 * merchants are the ones an acquirer prices in basis points, because the
 * exposure scales with their volume rather than with their dispute count.
 */
const seedFor = (m) => {
  if (m.status === 'Onboarding') return { enabled: false, basis: 'fee', fee: DEFAULT_FEE, bps: DEFAULT_BPS };
  if (m.riskTier === 'High') return { enabled: true, basis: 'bps', fee: DEFAULT_FEE, bps: 45 };
  if (m.riskTier === 'Medium') return { enabled: true, basis: 'bps', fee: DEFAULT_FEE, bps: 22 };
  if (m.flagship) return { enabled: true, basis: 'fee', fee: 18, bps: DEFAULT_BPS };
  return { enabled: false, basis: 'fee', fee: DEFAULT_FEE, bps: DEFAULT_BPS };
};

const SEED = Object.fromEntries(MERCHANTS.map((m) => [m.id, seedFor(m)]));

/** A stored entry must still look like one, or the whole payload is discarded. */
const isShaped = (v) =>
  v && typeof v === 'object'
  && typeof v.enabled === 'boolean'
  && (v.basis === 'fee' || v.basis === 'bps')
  && Number.isFinite(v.fee) && Number.isFinite(v.bps);

function load() {
  try {
    const raw = readPref(KEY, null);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return SEED;
    if (!Object.values(parsed).every(isShaped)) return SEED;
    // Merge over the seed so a merchant added since the payload was written
    // still has settings rather than reading back undefined.
    return { ...SEED, ...parsed };
  } catch {
    return SEED;
  }
}

let settings = load();
const listeners = new Set();

/** Referentially stable between writes — useSyncExternalStore compares by
 *  identity, so returning a fresh object here would loop forever. */
const getSnapshot = () => settings;

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function commit(next) {
  settings = next;
  writePref(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export const settingsFor = (merchantId) =>
  settings[merchantId] ?? { enabled: false, basis: 'fee', fee: DEFAULT_FEE, bps: DEFAULT_BPS };

/** Applies a whole entry at once — the form edits a draft and commits on Apply,
 *  so a half-typed rate is never live. */
export function applyIndemnification(merchantId, entry) {
  const current = settingsFor(merchantId);
  commit({
    ...settings,
    [merchantId]: {
      enabled: Boolean(entry.enabled),
      basis: entry.basis === 'bps' ? 'bps' : 'fee',
      fee: Number.isFinite(Number(entry.fee)) ? Number(entry.fee) : current.fee,
      bps: Number.isFinite(Number(entry.bps)) ? Number(entry.bps) : current.bps,
    },
  });
}

export function resetIndemnification() {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* storage unavailable — the in-memory reset below still applies */
  }
  settings = SEED;
  listeners.forEach((l) => l());
}

export const isCustomised = () => settings !== SEED;

/**
 * What the arrangement costs the merchant over a year, so the choice between
 * the two bases is a comparison rather than a guess.
 *
 * A flat fee is charged per dispute, so it scales with the dispute book. Basis
 * points are charged on processed volume, so they scale with turnover — which
 * is why the two can differ by an order of magnitude for the same merchant.
 */
export function annualCharge(merchant, entry) {
  if (!merchant || !entry?.enabled) return 0;
  return entry.basis === 'bps'
    ? (merchant.projectedVolume ?? 0) * (entry.bps / 10_000)
    : (merchant.disputeVolume ?? 0) * entry.fee;
}

/** Short human label for a table cell. */
export const describe = (entry, formatCurrencyFn) =>
  !entry?.enabled
    ? 'Not indemnified'
    : entry.basis === 'bps'
      ? `${entry.bps} bps`
      : `${formatCurrencyFn(entry.fee)} / dispute`;

export { getSnapshot, subscribe };
