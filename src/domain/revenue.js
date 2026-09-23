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

/**
 * The lowest rate worth quoting, whatever the arithmetic says.
 *
 * Expected loss covers the chargebacks and nothing else — not the analysts who
 * work them, not the capital behind the liability, and not the fact that a
 * chargeback ratio is a historic average rather than a guarantee. A book with
 * a low ratio breaks even near 3 bps; quoting 4 would be arithmetically
 * correct and commercially wrong.
 */
export const PRICING_FLOOR_BPS = 15;

/**
 * What chargeback management earns, per dispute worked.
 *
 * The two products are priced on completely different things, which is the
 * whole reason they are worth comparing. Indemnification is priced on
 * TURNOVER — a share of everything processed, whether or not anything goes
 * wrong — and in exchange we absorb the losses. Management is priced on
 * DISPUTES — a fee for every case we fight — and the merchant keeps its own
 * liability. So one scales with how big a merchant is and the other with how
 * much trouble it has, and for any given merchant one of them is clearly the
 * better fit.
 */
export const MANAGEMENT_FEE_PER_CASE = 42;

/** What we would earn working a merchant's disputes for them. */
export const managementRevenue = (m) => (m.disputeVolume ?? 0) * MANAGEMENT_FEE_PER_CASE;

/** What the merchant wins back when we fight on their behalf. */
export const recoveredValue = (m) => disputedValue(m) * ((m.winRate ?? 0) / 100);

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
    intent: 'The biggest uncaptured indemnification revenue, ranked.',
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
    id: 'chargebacks-vs-indemnification',
    question: 'Chargeback management or indemnification?',
    intent: 'The two models compared across every active merchant.',
    icon: 'card',
    run: (merchants) => {
      const pricing = { basis: 'bps', bps: 25, fee: 0.04 };
      const active = merchants.filter((m) => m.status !== 'Onboarding');

      const rows = active.map((m) => {
        const indemnify = projectMerchant(m, pricing);
        const manage = managementRevenue(m);
        return { ...indemnify, manage, better: manage > indemnify.net ? 'manage' : 'indemnify', gap: Math.abs(manage - indemnify.net) };
      }).sort((a, b) => b.gap - a.gap);

      const indemnifyNet = rows.reduce((s, r) => s + r.net, 0);
      const manageNet = rows.reduce((s, r) => s + r.manage, 0);
      const liability = rows.reduce((s, r) => s + r.loss, 0);

      return {
        pricing,
        rows,
        criteria: [{ field: 'status', operator: 'isNot', value: 'Onboarding' }],
        mode: 'all',
        headline: (f) => `${f.money(indemnifyNet)} vs ${f.money(manageNet)}`,
        because: `Indemnification at 25 bps nets ${fmtMoney(indemnifyNet)} but puts ${fmtMoney(liability)} of chargeback liability on us. Management earns ${fmtMoney(manageNet)} at ${fmtMoney(MANAGEMENT_FEE_PER_CASE)} a dispute and carries none of it. One is priced on turnover, the other on trouble — which is why the right answer differs merchant by merchant.`,
      };
    },
  },
  {
    id: 'whole-book',
    question: 'What if we indemnified every merchant at 25 bps?',
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
        because: `One flat price for everyone. Break-even across these merchants is ${breakEvenBps(active).toFixed(1)} bps, so 25 bps is the margin above that — the losers inside it are the merchants to carve out.`,
      };
    },
  },
];

export const suggestionFor = (id) => SUGGESTIONS.find((s) => s.id === id);

/* ================================================================== *
 * ASK — the engine behind the Create tab
 * ================================================================== *
 * The Create tab is a questionnaire: pick a category, pick a subject
 * (a merchant, or a set of criteria), pick the question you actually
 * have, and the answer builds as you type. Nothing here returns a
 * canned string — every answer is computed from the live portfolio and
 * case book, and every one carries the rows behind it so the reader can
 * check the working.
 */

export const CATEGORIES = [
  { id: 'revenue', label: 'Grow revenue', hint: 'Pricing and uncaptured income.', icon: 'chart' },
  { id: 'indemnification', label: 'Indemnification', hint: 'Who to cover, and at what rate.', icon: 'shield' },
  { id: 'chargebacks', label: 'Chargeback management', hint: 'Fighting and winning disputes, rather than carrying them.', icon: 'card' },
  { id: 'risk', label: 'Reduce risk', hint: 'Exposure and chargeback ratios.', icon: 'alert' },
  { id: 'operations', label: 'Operations', hint: 'Where the dispute load actually sits.', icon: 'inbox' },
];

export const categoryFor = (id) => CATEGORIES.find((c) => c.id === id);

/**
 * Activity score — "based on what is actually happening on the site".
 *
 * Four signals, each normalised against the busiest merchant in the book so
 * the score is a comparison rather than an absolute: recent case volume,
 * recent disputed value, how much of that is overdue, and how much analyst
 * time it consumed. A merchant nobody has touched scores zero however large
 * it is, which is the point — this ranks attention, not size.
 */
export function activityIndex(merchants, cases, days = 30) {
  const since = Date.now() - days * 86_400_000;
  const recent = cases.filter((c) => new Date(c.dateCreated).getTime() >= since);
  const today = new Date().toISOString().slice(0, 10);

  const raw = merchants.map((m) => {
    const mine = recent.filter((c) => c.merchantId === m.id);
    return {
      merchant: m,
      cases: mine.length,
      value: mine.reduce((s, c) => s + (c.disputeAmount ?? 0), 0),
      overdue: mine.filter((c) => c.dueDate < today && c.status !== 'completed').length,
      minutes: mine.reduce((s, c) => s + (c.handlingMinutes ?? 0), 0),
      touched: mine.filter((c) => c.worker && c.worker !== '—').length,
    };
  });

  const peak = (key) => Math.max(1, ...raw.map((r) => r[key]));
  const peaks = { cases: peak('cases'), value: peak('value'), overdue: peak('overdue'), minutes: peak('minutes') };

  return raw
    .map((r) => ({
      ...r,
      score: Math.round(
        ((r.cases / peaks.cases) * 40)
        + ((r.value / peaks.value) * 30)
        + ((r.overdue / peaks.overdue) * 20)
        + ((r.minutes / peaks.minutes) * 10),
      ),
    }))
    .sort((a, b) => b.score - a.score);
}

/** Group-level roll-up of the same signal, for the "merchant types" cut. */
export function activityByGroup(merchants, cases, days = 30) {
  const index = activityIndex(merchants, cases, days);
  const byGroup = new Map();

  index.forEach((row) => {
    const id = row.merchant.groupId;
    if (!byGroup.has(id)) {
      byGroup.set(id, {
        groupId: id,
        label: row.merchant.groupLabel ?? id,
        merchants: 0, cases: 0, value: 0, overdue: 0, score: 0,
      });
    }
    const g = byGroup.get(id);
    g.merchants += 1;
    g.cases += row.cases;
    g.value += row.value;
    g.overdue += row.overdue;
    g.score += row.score;
  });

  return [...byGroup.values()]
    .map((g) => ({ ...g, score: Math.round(g.score / Math.max(g.merchants, 1)) }))
    .sort((a, b) => b.score - a.score);
}

/* ---------- Goals ---------- *
 * One per question a user might actually have. `inputs` declares the extra
 * controls the questionnaire should render, so the form is data-driven and a
 * new question needs no new JSX.
 */

export const GOALS = [
  {
    id: 'what-to-charge',
    category: 'revenue',
    label: 'What should we charge?',
    blurb: 'Recommends a rate from break-even plus the margin you want.',
    inputs: [{ key: 'margin', label: 'Target margin over break-even', type: 'number', suffix: '%', default: 60, step: 5 }],
    answer: ({ subjects, values }) => {
      const be = breakEvenBps(subjects);
      const margin = Number(values.margin) || 0;
      /* Expected loss is not the whole cost of carrying a book — handling the
         disputes, the capital behind the liability, and the fact that a ratio
         is an average rather than a promise all sit on top of it. On a
         low-ratio book break-even lands near 3 bps, and a recommendation of
         4 bps would undercut every rate actually in use. The floor is what
         stops the arithmetic from being naive. */
      const recommended = Math.max(PRICING_FLOOR_BPS, Math.round(be * (1 + margin / 100)));
      const floored = recommended === PRICING_FLOOR_BPS && be * (1 + margin / 100) < PRICING_FLOOR_BPS;
      const pricing = { basis: 'bps', bps: recommended, fee: 0.04 };
      const p = projectPortfolio(subjects, pricing);

      return {
        headline: `${recommended} bps`,
        headlineNote: floored
          ? `Break-even is only ${be.toFixed(1)} bps, so this is the ${PRICING_FLOOR_BPS} bps floor for handling cost and volatility.`
          : `Break-even is ${be.toFixed(1)} bps. This adds your ${margin}% margin on top.`,
        narrative: `At ${recommended} bps these ${subjects.length === 1 ? 'merchant earns' : 'merchants earn'} ${fmtMoney(p.revenue)} a year against ${fmtMoney(p.loss)} of expected chargeback losses, leaving ${fmtMoney(p.net)} net.`,
        stats: [
          { label: 'Recommended rate', value: `${recommended} bps` },
          { label: 'Annual revenue', value: fmtMoney(p.revenue) },
          { label: 'Expected loss', value: fmtMoney(p.loss) },
          { label: 'Net', value: fmtMoney(p.net), tone: p.net >= 0 ? 'good' : 'bad' },
        ],
        rows: p.rows.sort((a, b) => b.net - a.net),
        apply: { enabled: true, ...pricing },
        applyLabel: `Apply ${recommended} bps`,
      };
    },
  },
  {
    id: 'revenue-left',
    category: 'revenue',
    label: 'What revenue are we leaving on the table?',
    blurb: 'Values everyone in the selection who is not indemnified today.',
    inputs: [{ key: 'rate', label: 'Rate to model', type: 'number', suffix: 'bps', default: 25, step: 1 }],
    answer: ({ subjects, values, ctx }) => {
      const pricing = { basis: 'bps', bps: Number(values.rate) || 0, fee: 0.04 };
      const uncovered = subjects.filter((m) => !ctx.settingsFor(m.id).enabled);
      const p = projectPortfolio(uncovered, pricing);

      return {
        headline: fmtMoney(p.revenue),
        headlineNote: `${uncovered.length} of ${subjects.length} in this selection are not indemnified today.`,
        narrative: uncovered.length
          ? `Priced at ${pricing.bps} bps, the merchants in this selection that carry no arrangement would bring in ${fmtMoney(p.revenue)} a year. After ${fmtMoney(p.loss)} of expected losses that is ${fmtMoney(p.net)} net.`
          : 'Everything in this selection is already indemnified — there is no uncaptured revenue here.',
        stats: [
          { label: 'Not indemnified', value: String(uncovered.length) },
          { label: 'Revenue available', value: fmtMoney(p.revenue) },
          { label: 'Expected loss', value: fmtMoney(p.loss) },
          { label: 'Net', value: fmtMoney(p.net), tone: p.net >= 0 ? 'good' : 'bad' },
        ],
        rows: p.rows.sort((a, b) => b.revenue - a.revenue),
        apply: { enabled: true, ...pricing },
        applyLabel: `Indemnify at ${pricing.bps} bps`,
      };
    },
  },
  {
    id: 'should-indemnify',
    category: 'indemnification',
    label: 'Should we indemnify them?',
    blurb: 'A yes or no per merchant at the rate you pick, with the reason.',
    inputs: [{ key: 'rate', label: 'Rate to test', type: 'number', suffix: 'bps', default: 25, step: 1 }],
    answer: ({ subjects, values }) => {
      const pricing = { basis: 'bps', bps: Number(values.rate) || 0, fee: 0.04 };
      const rows = subjects.map((m) => projectMerchant(m, pricing)).sort((a, b) => b.net - a.net);
      const yes = rows.filter((r) => r.net > 0);
      const no = rows.filter((r) => r.net <= 0);

      return {
        headline: `${yes.length} yes, ${no.length} no`,
        headlineNote: `Tested at ${pricing.bps} bps.`,
        narrative: yes.length
          ? `${yes.length} of ${rows.length} earn more than we expect to pay out at this rate — ${fmtMoney(yes.reduce((s, r) => s + r.net, 0))} net between them.${no.length ? ` The other ${no.length} would cost us money at ${pricing.bps} bps and need a higher rate or a decline.` : ''}`
          : `None of these clear their expected losses at ${pricing.bps} bps. Raise the rate or leave the liability with the merchant.`,
        stats: [
          { label: 'Worth covering', value: String(yes.length), tone: 'good' },
          { label: 'Not at this rate', value: String(no.length), tone: no.length ? 'bad' : undefined },
          { label: 'Net if all covered', value: fmtMoney(rows.reduce((s, r) => s + r.net, 0)) },
          { label: 'Break-even', value: `${breakEvenBps(subjects).toFixed(1)} bps` },
        ],
        rows,
        apply: { enabled: true, ...pricing },
        applyLabel: `Indemnify at ${pricing.bps} bps`,
      };
    },
  },
  {
    id: 'underpriced',
    category: 'indemnification',
    label: 'Is anyone underpriced?',
    blurb: 'Compares what each indemnified merchant pays against what we expect to lose.',
    inputs: [],
    answer: ({ subjects, ctx }) => {
      const covered = subjects.filter((m) => ctx.settingsFor(m.id).enabled);
      const rows = covered.map((m) => projectMerchant(m, ctx.settingsFor(m.id))).sort((a, b) => a.net - b.net);
      const short = rows.filter((r) => r.net < 0);
      const gap = Math.abs(short.reduce((s, r) => s + r.net, 0));

      return {
        headline: short.length ? `${short.length} underpriced` : 'All covered',
        headlineNote: short.length ? `${fmtMoney(gap)} short of covering expected losses.` : 'Every indemnified merchant in this selection clears its expected losses.',
        narrative: short.length
          ? `These merchants pay less than we expect to absorb on their behalf. Re-pricing them to break-even would close a ${fmtMoney(gap)} gap.`
          : 'Nothing in this selection is priced below what we expect it to cost. No action needed.',
        stats: [
          { label: 'Indemnified', value: String(covered.length) },
          { label: 'Underpriced', value: String(short.length), tone: short.length ? 'bad' : 'good' },
          { label: 'Shortfall', value: fmtMoney(gap), tone: short.length ? 'bad' : undefined },
          { label: 'Break-even', value: `${breakEvenBps(covered).toFixed(1)} bps` },
        ],
        rows,
        apply: covered.length ? { enabled: true, basis: 'bps', bps: Math.ceil(breakEvenBps(covered) * 1.6), fee: 0.04 } : null,
        applyLabel: covered.length ? `Re-price at ${Math.ceil(breakEvenBps(covered) * 1.6)} bps` : null,
      };
    },
  },
  {
    id: 'manage-vs-indemnify',
    category: 'chargebacks',
    label: 'Manage their chargebacks, or indemnify them?',
    blurb: 'Compares the two models side by side, per merchant.',
    inputs: [{ key: 'rate', label: 'Indemnification rate to compare against', type: 'number', suffix: 'bps', default: 25, step: 1 }],
    answer: ({ subjects, values }) => {
      const pricing = { basis: 'bps', bps: Number(values.rate) || 0, fee: 0.04 };

      const rows = subjects.map((m) => {
        const indemnify = projectMerchant(m, pricing);
        const manage = managementRevenue(m);
        return {
          ...indemnify,
          /* Management carries no liability, so its net IS its revenue. That
             asymmetry is the point of the comparison, not a rounding of it. */
          manage,
          better: manage > indemnify.net ? 'manage' : 'indemnify',
          gap: Math.abs(manage - indemnify.net),
        };
      }).sort((a, b) => b.gap - a.gap);

      const manageWins = rows.filter((r) => r.better === 'manage');
      const indemnifyWins = rows.filter((r) => r.better === 'indemnify');
      const indemnifyNet = rows.reduce((s2, r) => s2 + r.net, 0);
      const manageNet = rows.reduce((s2, r) => s2 + r.manage, 0);

      return {
        headline: `${indemnifyWins.length} to indemnify, ${manageWins.length} to manage`,
        headlineNote: `Indemnification priced at ${pricing.bps} bps, management at ${fmtMoney(MANAGEMENT_FEE_PER_CASE)} per dispute worked.`,
        narrative: `Indemnifying all of them nets ${fmtMoney(indemnifyNet)} but means carrying ${fmtMoney(rows.reduce((s2, r) => s2 + r.loss, 0))} of expected losses. Managing all of them earns ${fmtMoney(manageNet)} with no liability at all. ${
          manageWins.length
            ? `${manageWins.length === 1 ? 'One merchant is' : `${manageWins.length} merchants are`} worth more to us as management — they generate plenty of disputes without the turnover to justify a rate on it.`
            : 'Every merchant here is worth more indemnified than managed, because their turnover outweighs their dispute count.'
        }`,
        stats: [
          { label: 'Indemnify, net', value: fmtMoney(indemnifyNet), tone: indemnifyNet >= manageNet ? 'good' : undefined },
          { label: 'Manage, net', value: fmtMoney(manageNet), tone: manageNet > indemnifyNet ? 'good' : undefined },
          { label: 'Liability if indemnified', value: fmtMoney(rows.reduce((s2, r) => s2 + r.loss, 0)), tone: 'bad' },
          { label: 'Liability if managed', value: fmtMoney(0), tone: 'good' },
        ],
        rows,
        apply: { enabled: true, ...pricing },
        applyLabel: `Indemnify at ${pricing.bps} bps`,
      };
    },
  },
  {
    id: 'recovery',
    category: 'chargebacks',
    label: 'How much are we winning back?',
    blurb: 'What defending their disputes actually recovers.',
    inputs: [],
    answer: ({ subjects }) => {
      const rows = subjects
        .map((m) => ({ ...projectMerchant(m, { basis: 'bps', bps: 0, fee: 0 }), recovered: recoveredValue(m) }))
        .sort((a, b) => b.recovered - a.recovered);

      const recovered = rows.reduce((s2, r) => s2 + r.recovered, 0);
      const disputed = subjects.reduce((s2, m) => s2 + disputedValue(m), 0);
      const withVolume = subjects.filter((m) => (m.disputeVolume ?? 0) > 0);
      const avgWin = withVolume.length
        ? withVolume.reduce((s2, m) => s2 + (m.winRate ?? 0), 0) / withVolume.length
        : 0;
      const weakest = [...withVolume].sort((a, b) => (a.winRate ?? 0) - (b.winRate ?? 0))[0];

      return {
        headline: fmtMoney(recovered),
        headlineNote: `Won back out of ${fmtMoney(disputed)} disputed, at an average win rate of ${avgWin.toFixed(0)}%.`,
        narrative: weakest
          ? `${weakest.name} is the weakest at ${(weakest.winRate ?? 0).toFixed(0)}%, which is where extra evidence or a better representment packet would pay for itself fastest. Every point of win rate across this selection is worth about ${fmtMoney(disputed / 100)} a year.`
          : 'No dispute volume in this selection to recover anything from.',
        stats: [
          { label: 'Recovered', value: fmtMoney(recovered), tone: 'good' },
          { label: 'Disputed', value: fmtMoney(disputed) },
          { label: 'Average win rate', value: `${avgWin.toFixed(0)}%` },
          { label: 'Worth 1pt of win rate', value: fmtMoney(disputed / 100) },
        ],
        rows,
        apply: null,
        applyLabel: null,
      };
    },
  },
  {
    id: 'exposure',
    category: 'risk',
    label: 'How exposed are we?',
    blurb: 'The chargeback liability behind this selection, ranked.',
    inputs: [],
    answer: ({ subjects }) => {
      const rows = subjects
        .map((m) => projectMerchant(m, { basis: 'bps', bps: 0, fee: 0 }))
        .sort((a, b) => b.loss - a.loss);
      const total = rows.reduce((s, r) => s + r.loss, 0);
      const worst = rows[0];

      return {
        headline: fmtMoney(total),
        headlineNote: 'Expected annual chargeback losses across this selection.',
        narrative: worst
          ? `${worst.merchant.name} carries the most at ${fmtMoney(worst.loss)} — ${total ? Math.round((worst.loss / total) * 100) : 0}% of the total. Covering this selection needs at least ${breakEvenBps(subjects).toFixed(1)} bps to break even.`
          : 'Nothing in this selection.',
        stats: [
          { label: 'Merchants', value: String(rows.length) },
          { label: 'Expected loss', value: fmtMoney(total), tone: 'bad' },
          { label: 'Open exposure', value: fmtMoney(subjects.reduce((s, m) => s + (m.exposure ?? 0), 0)) },
          { label: 'Break-even', value: `${breakEvenBps(subjects).toFixed(1)} bps` },
        ],
        rows,
        apply: null,
        applyLabel: null,
      };
    },
  },
  {
    id: 'ratio-drivers',
    category: 'risk',
    label: 'Who is driving our chargeback ratio?',
    blurb: 'Ranks the selection by how much each one lifts the portfolio ratio.',
    inputs: [{ key: 'threshold', label: 'Flag above', type: 'number', suffix: '%', default: 0.65, step: 0.05 }],
    answer: ({ subjects, values }) => {
      const threshold = Number(values.threshold) || 0;
      const rows = subjects
        .map((m) => projectMerchant(m, { basis: 'bps', bps: 0, fee: 0 }))
        .sort((a, b) => (b.merchant.chargebackRatio ?? 0) - (a.merchant.chargebackRatio ?? 0));
      const over = rows.filter((r) => (r.merchant.chargebackRatio ?? 0) >= threshold);
      const volume = subjects.reduce((s, m) => s + (m.projectedVolume ?? 0), 0);
      const disputed = subjects.reduce((s, m) => s + disputedValue(m), 0);
      const blended = volume ? (disputed / volume) * 100 : 0;

      return {
        headline: `${over.length} above ${threshold}%`,
        headlineNote: `Blended ratio across this selection is ${blended.toFixed(2)}%.`,
        narrative: over.length
          ? `${over.map((r) => r.merchant.name).slice(0, 3).join(', ')}${over.length > 3 ? ` and ${over.length - 3} more` : ''} sit at or above ${threshold}%. They account for ${fmtMoney(over.reduce((s, r) => s + r.loss, 0))} of expected losses.`
          : `Nothing in this selection is at or above ${threshold}%. The blended ratio is ${blended.toFixed(2)}%.`,
        stats: [
          { label: 'Blended ratio', value: `${blended.toFixed(2)}%` },
          { label: `Above ${threshold}%`, value: String(over.length), tone: over.length ? 'bad' : 'good' },
          { label: 'Disputed value', value: fmtMoney(disputed) },
          { label: 'Expected loss', value: fmtMoney(rows.reduce((s, r) => s + r.loss, 0)) },
        ],
        rows,
        apply: null,
        applyLabel: null,
      };
    },
  },
  {
    id: 'load',
    category: 'operations',
    label: 'Where is the dispute load sitting?',
    blurb: 'Case volume, overdue count and analyst time across the selection.',
    inputs: [],
    answer: ({ subjects, ctx }) => {
      const index = ctx.activity.filter((a) => subjects.some((m) => m.id === a.merchant.id));
      const cases = index.reduce((s, a) => s + a.cases, 0);
      const overdue = index.reduce((s, a) => s + a.overdue, 0);
      const hours = index.reduce((s, a) => s + a.minutes, 0) / 60;
      const top = index[0];

      return {
        headline: `${cases} cases`,
        headlineNote: 'Raised in the last 30 days across this selection.',
        narrative: top
          ? `${top.merchant.name} is the busiest, with ${top.cases} cases and ${top.overdue} of them overdue. The selection has consumed about ${Math.round(hours)} analyst hours in the last 30 days.`
          : 'No recent case activity in this selection.',
        stats: [
          { label: 'Cases, 30 days', value: String(cases) },
          { label: 'Overdue', value: String(overdue), tone: overdue ? 'bad' : 'good' },
          { label: 'Analyst hours', value: String(Math.round(hours)) },
          { label: 'Merchants', value: String(subjects.length) },
        ],
        rows: index.map((a) => projectMerchant(a.merchant, { basis: 'bps', bps: 0, fee: 0 })),
        apply: null,
        applyLabel: null,
      };
    },
  },
];

export const goalsFor = (category) => GOALS.filter((g) => g.category === category);
export const goalFor = (id) => GOALS.find((g) => g.id === id);

/** Local money formatter so the engine owns its own phrasing. */
function fmtMoney(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}


/* ------------------------------------------------------------------ *
 * Criteria types, filters and solution types
 * ------------------------------------------------------------------ */

/**
 * Fields grouped into the kind of thing they describe.
 *
 * "Pick a field from a list of nine" asks the reader to hold the whole
 * vocabulary in their head. "What kind of criteria — risk, size,
 * classification, coverage?" is the question they actually have, and it makes
 * the field list short enough to read.
 */
export const CRITERIA_TYPES = [
  { id: 'risk', label: 'Risk profile', hint: 'Tier, chargeback ratio, win rate.', icon: 'alert', fields: ['riskTier', 'chargebackRatio', 'winRate'] },
  { id: 'size', label: 'Size and volume', hint: 'Processed value, dispute count, exposure.', icon: 'chart', fields: ['projectedVolume', 'disputeVolume', 'exposure'] },
  { id: 'classification', label: 'Classification', hint: 'Merchant group and trading status.', icon: 'folder', fields: ['groupId', 'status'] },
  { id: 'coverage', label: 'Coverage', hint: 'Whether we already carry the liability.', icon: 'shield', fields: ['indemnified'] },
];

export const criteriaTypeFor = (id) => CRITERIA_TYPES.find((t) => t.id === id);
export const fieldsForType = (id) => (criteriaTypeFor(id)?.fields ?? []).map(fieldFor).filter(Boolean);

/**
 * What shape of answer the reader wants back. This is a genuinely different
 * question from "what do you want to know" — the same question can be
 * answered with a recommendation, with a model of a number you supply, or
 * with nothing but the rows that fail. It changes the answer, not the wording.
 */
export const SOLUTION_TYPES = [
  { id: 'recommend', label: 'A recommendation', hint: 'Work out the number and tell me.', icon: 'shield' },
  { id: 'model', label: 'An impact model', hint: 'I will set the number — show me the effect.', icon: 'sliders' },
  { id: 'exceptions', label: 'The exceptions only', hint: 'Just the ones that fail the test.', icon: 'alert' },
];

export const solutionTypeFor = (id) => SOLUTION_TYPES.find((s) => s.id === id);

/**
 * Applies the chosen solution type to a computed answer.
 *
 * Kept out of the goals themselves so every goal gets the behaviour for free,
 * and so a goal that has no meaningful "exception" (an exposure ranking, say)
 * degrades to the full list rather than to an empty one.
 */
export function shapeAnswer(answer, solutionType) {
  if (!answer || solutionType !== 'exceptions') return answer;
  const failing = answer.rows.filter((r) => r.net < 0 || r.merchant.riskTier === 'High');
  if (!failing.length) {
    return {
      ...answer,
      rows: [],
      headline: 'No exceptions',
      headlineNote: 'Nothing in this selection fails the test.',
      narrative: 'Every merchant here either clears its expected losses or sits outside the high-risk tier. There is nothing to action.',
    };
  }
  /* The original narrative describes the whole selection, so appending it here
     leaves two sentences arguing with each other — "1 exception" followed by
     "1 of 2 earn more than we expect to pay out". The exception view gets its
     own sentence and names the merchants, which is the only thing a reader
     wants from a list of exceptions. */
  const names = failing.map((r) => r.merchant.name);
  const named = names.length <= 3
    ? names.join(', ')
    : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;

  return {
    ...answer,
    rows: failing,
    headline: `${failing.length} exception${failing.length === 1 ? '' : 's'}`,
    headlineNote: `${failing.length} of ${answer.rows.length} in this selection need attention.`,
    narrative: `${named} ${failing.length === 1 ? 'either costs' : 'either cost'} more than ${failing.length === 1 ? 'it earns' : 'they earn'} at this rate, or ${failing.length === 1 ? 'sits' : 'sit'} in the high-risk tier. Everything else in the selection is fine and has been left out.`,
  };
}
