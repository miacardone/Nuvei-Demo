/**
 * REVENUE RULES
 * =============
 * The engine behind "show me every merchant that looks like X, and tell me
 * what indemnifying them would be worth".
 *
 * Two things live here and nothing else does: how a criterion is matched
 * against a merchant, and how an indemnification arrangement is valued. The
 * page is a form over the top of it.
 *
 * THE ECONOMICS, stated plainly, because a number on a slide that nobody can
 * derive is worse than no number:
 *
 *   disputed value = projected annual volume x chargeback ratio
 *   expected loss  = disputed value x (1 - win rate)
 *   revenue        = the same annualCharge() the merchant record uses
 *   net            = revenue - expected loss
 *
 * Expected loss is what Nuvei absorbs by taking the liability: the share of
 * disputed value that is not won back. It is an estimate and the page says so
 * — the point is that the comparison between two pricing choices is honest,
 * not that the absolute figure is a forecast.
 */

import { MERCHANT_GROUPS } from '@/data/merchants';
import { annualCharge } from '@/data/indemnification';

/* ------------------------------------------------------------------ *
 * Criteria
 * ------------------------------------------------------------------ */

export const RISK_TIERS = ['Low', 'Medium', 'High'];
export const MERCHANT_STATUSES = ['Active', 'Under review', 'Suspended', 'Onboarding'];

/**
 * The fields a rule can test. `kind` drives which operators and which input
 * the builder renders, so adding a field here is the only change needed to
 * make it available in the UI.
 */
export const CRITERIA_FIELDS = [
  { key: 'chargebackRatio', label: 'Chargeback ratio', kind: 'number', unit: '%', step: 0.01, get: (m) => m.chargebackRatio ?? 0, help: 'Disputes as a share of transactions.' },
  { key: 'projectedVolume', label: 'Annual volume', kind: 'currency', unit: '$', step: 1_000_000, get: (m) => m.projectedVolume ?? 0, help: 'Processed value per year.' },
  { key: 'disputeVolume', label: 'Dispute count', kind: 'number', unit: '', step: 10, get: (m) => m.disputeVolume ?? 0, help: 'Disputes raised against this merchant.' },
  { key: 'winRate', label: 'Win rate', kind: 'number', unit: '%', step: 1, get: (m) => m.winRate ?? 0, help: 'Share of defended cases won.' },
  { key: 'exposure', label: 'Open exposure', kind: 'currency', unit: '$', step: 10_000, get: (m) => m.exposure ?? 0, help: 'Money at stake in open cases.' },
  { key: 'riskTier', label: 'Risk tier', kind: 'select', options: RISK_TIERS, get: (m) => m.riskTier },
  { key: 'status', label: 'Status', kind: 'select', options: MERCHANT_STATUSES, get: (m) => m.status },
  { key: 'groupId', label: 'Merchant group', kind: 'select', options: MERCHANT_GROUPS.map((g) => g.id), optionLabel: (id) => MERCHANT_GROUPS.find((g) => g.id === id)?.label ?? id, get: (m) => m.groupId },
  { key: 'indemnified', label: 'Currently indemnified', kind: 'select', options: ['yes', 'no'], optionLabel: (v) => (v === 'yes' ? 'Yes' : 'No'), get: (m, ctx) => (ctx.settingsFor(m.id).enabled ? 'yes' : 'no') },
];

export const fieldFor = (key) => CRITERIA_FIELDS.find((f) => f.key === key);

const NUMBER_OPERATORS = [
  { value: 'gte', label: 'is at least', test: (a, b) => a >= b },
  { value: 'lte', label: 'is at most', test: (a, b) => a <= b },
  { value: 'gt', label: 'is greater than', test: (a, b) => a > b },
  { value: 'lt', label: 'is less than', test: (a, b) => a < b },
];

const SELECT_OPERATORS = [
  { value: 'is', label: 'is', test: (a, b) => String(a) === String(b) },
  { value: 'isNot', label: 'is not', test: (a, b) => String(a) !== String(b) },
];

export const operatorsFor = (kind) => (kind === 'select' ? SELECT_OPERATORS : NUMBER_OPERATORS);

/** One criterion: { field, operator, value }. */
export function matchesCriterion(merchant, criterion, ctx) {
  const field = fieldFor(criterion.field);
  if (!field) return true;
  const op = operatorsFor(field.kind).find((o) => o.value === criterion.operator);
  if (!op) return true;

  const actual = field.get(merchant, ctx);
  if (field.kind === 'select') return op.test(actual, criterion.value);

  const target = Number(criterion.value);
  if (!Number.isFinite(target)) return true; // an empty box is not a filter
  return op.test(Number(actual), target);
}

/** `mode` is 'all' (every criterion) or 'any' (at least one). */
export function matchMerchants(merchants, criteria, mode, ctx) {
  const live = criteria.filter((c) => c.field && c.operator);
  if (!live.length) return merchants;
  return merchants.filter((m) => (mode === 'any'
    ? live.some((c) => matchesCriterion(m, c, ctx))
    : live.every((c) => matchesCriterion(m, c, ctx))));
}

/* ------------------------------------------------------------------ *
 * Valuation
 * ------------------------------------------------------------------ */

/** Disputed value we would be on the hook for, before anything is won back. */
export const disputedValue = (m) => (m.projectedVolume ?? 0) * ((m.chargebackRatio ?? 0) / 100);

/** What we expect to absorb: the disputed value we do not win back. */
export function expectedAnnualLoss(m) {
  const winRate = Number.isFinite(m.winRate) ? m.winRate : 0;
  return disputedValue(m) * (1 - winRate / 100);
}

/**
 * Value one merchant under a pricing choice.
 * `pricing` is { basis: 'fee' | 'bps', fee, bps } — the same shape the
 * merchant record's panel edits, so a rule and a hand edit cannot disagree.
 */
export function projectMerchant(m, pricing) {
  const revenue = annualCharge(m, { enabled: true, ...pricing });
  const loss = expectedAnnualLoss(m);
  return {
    merchant: m,
    revenue,
    loss,
    net: revenue - loss,
    /** Revenue as a multiple of what we expect to pay out. Above 1 pays. */
    coverage: loss > 0 ? revenue / loss : Infinity,
  };
}

export function projectPortfolio(merchants, pricing) {
  const rows = merchants.map((m) => projectMerchant(m, pricing));
  return {
    rows,
    count: rows.length,
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    loss: rows.reduce((s, r) => s + r.loss, 0),
    net: rows.reduce((s, r) => s + r.net, 0),
    volume: merchants.reduce((s, m) => s + (m.projectedVolume ?? 0), 0),
  };
}

/**
 * The basis points that would exactly cover the expected loss on a book —
 * the break-even price. The builder shows it beside whatever you have typed,
 * so "is 22 bps enough?" has an answer rather than a feeling.
 */
export function breakEvenBps(merchants) {
  const volume = merchants.reduce((s, m) => s + (m.projectedVolume ?? 0), 0);
  if (!volume) return 0;
  const loss = merchants.reduce((s, m) => s + expectedAnnualLoss(m), 0);
  return (loss / volume) * 10_000;
}

/* ------------------------------------------------------------------ *
 * Suggestions
 * ------------------------------------------------------------------ *
 * Each play answers one question an account owner actually asks, returns the
 * merchants behind the answer, and hands back the criteria that produced it
 * so the builder can be opened already filled in. Nothing here is a canned
 * string — every figure is computed from the same portfolio the rest of the
 * console reads.
 */

const notIndemnified = (m, ctx) => !ctx.settingsFor(m.id).enabled;
const isIndemnified = (m, ctx) => ctx.settingsFor(m.id).enabled;

export const SUGGESTIONS = [
  {
    id: 'who-to-indemnify',
    question: 'Which merchants should we indemnify next?',
    intent: 'Merchants not on the programme whose disputes we would comfortably cover.',
    icon: 'shield',
    run: (merchants, ctx) => {
      const pricing = { basis: 'bps', bps: 25, fee: 0.04 };
      const candidates = merchants
        .filter((m) => notIndemnified(m, ctx))
        .filter((m) => m.status === 'Active')
        .filter((m) => (m.chargebackRatio ?? 0) < 0.65)
        .map((m) => projectMerchant(m, pricing))
        .filter((r) => r.net > 0)
        .sort((a, b) => b.net - a.net);

      return {
        pricing,
        rows: candidates,
        criteria: [
          { field: 'indemnified', operator: 'is', value: 'no' },
          { field: 'status', operator: 'is', value: 'Active' },
          { field: 'chargebackRatio', operator: 'lt', value: 0.65 },
        ],
        mode: 'all',
        headline: (f) => `${f.number(candidates.length)} merchants, ${f.money(candidates.reduce((s, r) => s + r.net, 0))} net`,
        because: 'Active, below the 0.65% early-warning threshold, and not indemnified today. At 25 bps each one earns more than we expect to pay out.',
      };
    },
  },
  {
    id: 'increase-revenue',
    question: 'How can we increase revenue?',
    intent: 'The biggest uncaptured indemnification revenue in the book, ranked.',
    icon: 'chart',
    run: (merchants, ctx) => {
      const pricing = { basis: 'bps', bps: 25, fee: 0.04 };
      const rows = merchants
        .filter((m) => notIndemnified(m, ctx))
        .map((m) => projectMerchant(m, pricing))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        pricing,
        rows,
        criteria: [{ field: 'indemnified', operator: 'is', value: 'no' }],
        mode: 'all',
        headline: (f) => `${f.money(rows.reduce((s, r) => s + r.revenue, 0))} on the table`,
        because: 'Every merchant not currently indemnified, ranked by what 25 bps of their volume would be worth. The top few are where a conversation is worth having.',
      };
    },
  },
  {
    id: 'underpriced',
    question: 'Who is underpriced?',
    intent: 'Merchants already indemnified where we expect to pay out more than we charge.',
    icon: 'alert',
    run: (merchants, ctx) => {
      const rows = merchants
        .filter((m) => isIndemnified(m, ctx))
        .map((m) => projectMerchant(m, ctx.settingsFor(m.id)))
        .filter((r) => r.net < 0)
        .sort((a, b) => a.net - b.net);

      return {
        pricing: null,
        rows,
        criteria: [{ field: 'indemnified', operator: 'is', value: 'yes' }],
        mode: 'all',
        headline: (f) => (rows.length
          ? `${f.number(rows.length)} merchants, ${f.money(Math.abs(rows.reduce((s, r) => s + r.net, 0)))} short`
          : 'Nothing underpriced'),
        because: 'Priced at their current rate, these merchants are expected to cost more in absorbed chargebacks than they pay us. Each one needs a re-price or a risk conversation.',
      };
    },
  },
  {
    id: 'over-exposed',
    question: 'Where are we over-exposed?',
    intent: 'High-risk merchants whose liability we are already carrying.',
    icon: 'activity',
    run: (merchants, ctx) => {
      const rows = merchants
        .filter((m) => isIndemnified(m, ctx))
        .filter((m) => m.riskTier === 'High' || (m.chargebackRatio ?? 0) >= 0.65)
        .map((m) => projectMerchant(m, ctx.settingsFor(m.id)))
        .sort((a, b) => b.loss - a.loss);

      return {
        pricing: null,
        rows,
        criteria: [
          { field: 'indemnified', operator: 'is', value: 'yes' },
          { field: 'chargebackRatio', operator: 'gte', value: 0.65 },
        ],
        mode: 'all',
        headline: (f) => `${f.money(rows.reduce((s, r) => s + r.loss, 0))} expected loss`,
        because: 'We carry the chargeback liability for these merchants and they are at or above the early-warning threshold. This is the number to watch, whatever the revenue says.',
      };
    },
  },
  {
    id: 'whole-book',
    question: 'What if we indemnified the whole book at 25 bps?',
    intent: 'A scenario across every active merchant, priced the same way.',
    icon: 'layers',
    run: (merchants) => {
      const pricing = { basis: 'bps', bps: 25, fee: 0.04 };
      const active = merchants.filter((m) => m.status !== 'Onboarding');
      const rows = active.map((m) => projectMerchant(m, pricing)).sort((a, b) => b.net - a.net);

      return {
        pricing,
        rows,
        criteria: [{ field: 'status', operator: 'isNot', value: 'Onboarding' }],
        mode: 'all',
        headline: (f) => `${f.money(rows.reduce((s, r) => s + r.net, 0))} net across ${f.number(rows.length)}`,
        because: `One flat price for everyone. Break-even across this book is ${breakEvenBps(active).toFixed(1)} bps, so 25 bps is the margin above that — the losers inside it are the merchants to carve out.`,
      };
    },
  },
];

export const suggestionFor = (id) => SUGGESTIONS.find((s) => s.id === id);
