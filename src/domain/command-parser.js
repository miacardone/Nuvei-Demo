/**
 * COMMAND PARSER
 * ==============
 * Turns "indemnify all low risk merchants at 25 bps" into the structured rule
 * the questionnaire already understands.
 *
 * TWO PRINCIPLES, both about trust rather than cleverness.
 *
 * It is DETERMINISTIC. No model, no network, no guessing — a vocabulary and a
 * scan. The same sentence produces the same rule every time, which is what
 * makes it safe to put in front of an audience and what makes a wrong result
 * something you can point at and explain.
 *
 * It EXPLAINS ITSELF AND NEVER ACTS ALONE. The parse fills the form in and
 * reports, in words, what it understood and what it ignored. The reader can
 * see the criteria it chose and fix them. A command bar that silently applies
 * its own interpretation to four hundred merchants would be the single most
 * dangerous control on the site; one that fills in a form you then check is
 * just a fast way to type.
 *
 * Returns `null` for input it cannot make sense of, rather than a half-rule —
 * a confident wrong answer is worse than admitting the sentence did not land.
 */

import { MERCHANTS } from '@/data/portfolio';
import { MERCHANT_GROUPS } from '@/data/merchants';

/* ---------- Vocabulary ---------- */

const ACTION_WORDS = [
  { id: 'indemnify', words: ['indemnify', 'indemnifying', 'cover', 'covering', 'insure'], category: 'indemnification', goalId: 'should-indemnify' },
  { id: 'price', words: ['price', 'pricing', 'charge', 'charging', 'rate'], category: 'revenue', goalId: 'what-to-charge' },
  { id: 'review', words: ['flag', 'review', 'underwrite', 'underwriting'], category: 'risk', goalId: 'exposure' },
  { id: 'watchlist', words: ['watch', 'watchlist', 'monitor', 'monitoring'], category: 'risk', goalId: 'exposure' },
  { id: 'assign', words: ['assign', 'owner', 'allocate'], category: 'operations', goalId: 'load' },
  { id: 'export', words: ['export', 'download', 'csv', 'spreadsheet'], category: 'operations', goalId: 'load' },
];

/** Questions that name a goal without naming an action. */
const GOAL_PHRASES = [
  { match: /\b(uncaptured|left on the table|missing revenue|more revenue|increase revenue|grow revenue)\b/, category: 'revenue', goalId: 'revenue-left' },
  { match: /\b(what should we charge|what to charge|how much should we charge|recommend a rate|right rate)\b/, category: 'revenue', goalId: 'what-to-charge' },
  { match: /\b(should we indemnify|worth indemnifying|who to indemnify|should we cover)\b/, category: 'indemnification', goalId: 'should-indemnify' },
  { match: /\b(underpriced|under priced|priced too low|losing money)\b/, category: 'indemnification', goalId: 'underpriced' },
  { match: /\b(exposed|exposure|liability|at risk)\b/, category: 'risk', goalId: 'exposure' },
  { match: /\b(driving|drivers?|worst ratio|highest ratio|chargeback ratio)\b/, category: 'risk', goalId: 'ratio-drivers' },
  { match: /\b(load|workload|busiest|case volume|overdue)\b/, category: 'operations', goalId: 'load' },
];

const RISK_TIERS = ['low', 'medium', 'high'];
const STATUSES = [
  { words: ['active'], value: 'Active' },
  { words: ['suspended'], value: 'Suspended' },
  { words: ['under review', 'reviewing'], value: 'Under review' },
  { words: ['onboarding'], value: 'Onboarding' },
];

const SOLUTION_WORDS = [
  { match: /\b(exceptions?|only the ones|problems?|failures?)\b/, id: 'exceptions' },
  { match: /\b(model|simulate|what if|scenario)\b/, id: 'model' },
];

/* ---------- Helpers ---------- */

const money = (raw) => {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return null;
  if (/bn|b\b|billion/i.test(raw)) return n * 1_000_000_000;
  if (/m\b|million/i.test(raw)) return n * 1_000_000;
  if (/k\b|thousand/i.test(raw)) return n * 1_000;
  return n;
};

/* ---------- Parse ---------- */

export function parseCommand(input) {
  const text = String(input ?? '').trim().toLowerCase();
  if (text.length < 3) return null;

  const understood = [];
  const criteria = [];
  let category = null;
  let goalId = null;
  let action = null;
  let pricing = null;
  let solution = 'recommend';
  let mode = 'criteria';
  const merchantIds = [];

  /* --- action --- */
  for (const a of ACTION_WORDS) {
    if (a.words.some((w) => new RegExp(`\\b${w}\\b`).test(text))) {
      action = a.id;
      category = a.category;
      goalId = a.goalId;
      understood.push(`action: ${a.id}`);
      break;
    }
  }

  /* --- an explicit question overrides the action's default goal --- */
  for (const g of GOAL_PHRASES) {
    if (g.match.test(text)) {
      category = g.category;
      goalId = g.goalId;
      understood.push(`question: ${g.goalId.replace(/-/g, ' ')}`);
      break;
    }
  }

  /* --- named merchants beat every other subject, so check them first --- */
  MERCHANTS.forEach((m) => {
    const first = m.name.split(' ')[0].toLowerCase();
    if (first.length > 3 && new RegExp(`\\b${first}`).test(text)) {
      merchantIds.push(m.id);
      understood.push(`merchant: ${m.name}`);
    }
  });
  if (merchantIds.length) mode = 'merchant';

  /* --- merchant group --- */
  if (!merchantIds.length) {
    MERCHANT_GROUPS.forEach((g) => {
      const head = g.label.split(' ')[0].toLowerCase();
      if (new RegExp(`\\b${head}`).test(text)) {
        criteria.push({ field: 'groupId', operator: 'is', value: g.id });
        understood.push(`group: ${g.label}`);
      }
    });
  }

  /* --- risk tier --- */
  const tier = RISK_TIERS.find((t) => new RegExp(`\\b${t}[- ]?risk\\b`).test(text) || new RegExp(`\\b${t}\\b`).test(text));
  if (tier) {
    const value = tier[0].toUpperCase() + tier.slice(1);
    criteria.push({ field: 'riskTier', operator: 'is', value });
    understood.push(`risk tier: ${value}`);
  }

  /* --- trading status --- */
  const status = STATUSES.find((s) => s.words.some((w) => text.includes(w)));
  if (status) {
    criteria.push({ field: 'status', operator: 'is', value: status.value });
    understood.push(`status: ${status.value}`);
  }

  /* --- coverage --- */
  if (/\b(not indemnified|uncovered|no arrangement|without indemnification)\b/.test(text)) {
    criteria.push({ field: 'indemnified', operator: 'is', value: 'no' });
    understood.push('not currently indemnified');
  } else if (/\b(already indemnified|indemnified merchants|covered merchants)\b/.test(text)) {
    criteria.push({ field: 'indemnified', operator: 'is', value: 'yes' });
    understood.push('currently indemnified');
  }

  /* --- chargeback ratio comparison --- */
  const ratio = text.match(/\b(above|over|more than|greater than|below|under|less than)\s*([0-9]*\.?[0-9]+)\s*%/);
  if (ratio) {
    const op = /above|over|more than|greater than/.test(ratio[1]) ? 'gte' : 'lt';
    criteria.push({ field: 'chargebackRatio', operator: op, value: parseFloat(ratio[2]) });
    understood.push(`chargeback ratio ${op === 'gte' ? 'at or above' : 'below'} ${ratio[2]}%`);
  }

  /* --- volume comparison --- */
  const vol = text.match(/\b(above|over|more than|below|under|less than)\s*\$?\s*([0-9]*\.?[0-9]+\s*(?:bn|b|m|k|billion|million|thousand)?)\b/);
  if (vol && !ratio) {
    const amount = money(vol[2]);
    if (amount) {
      const op = /above|over|more than/.test(vol[1]) ? 'gte' : 'lt';
      criteria.push({ field: 'projectedVolume', operator: op, value: amount });
      understood.push(`annual volume ${op === 'gte' ? 'at or above' : 'below'} $${amount.toLocaleString()}`);
    }
  }

  /* --- price --- */
  const bps = text.match(/\b([0-9]+)\s*(?:bps|basis points?)\b/);
  if (bps) {
    pricing = { basis: 'bps', bps: Number(bps[1]), fee: 0.04 };
    understood.push(`rate: ${bps[1]} bps`);
  } else {
    const fee = text.match(/\$\s*([0-9]*\.?[0-9]+)\s*(?:per|\/)\s*(?:txn|transaction)/);
    if (fee) {
      pricing = { basis: 'fee', fee: parseFloat(fee[1]), bps: 25 };
      understood.push(`rate: $${fee[1]} per transaction`);
    }
  }

  /* --- what shape of answer --- */
  for (const s of SOLUTION_WORDS) {
    if (s.match.test(text)) { solution = s.id; understood.push(`answer: ${s.id}`); break; }
  }
  if (pricing && solution === 'recommend' && action === 'indemnify') solution = 'model';

  /* Nothing recognised at all — say so rather than open an empty form and
     let the reader think it worked. */
  if (!understood.length) return null;

  /* A subject with no question still deserves a sensible default, but only
     once something was actually recognised — and the default should follow
     what was actually said. Someone who typed a chargeback ratio is asking
     about risk, not about whether to indemnify; defaulting them into a
     pricing question is a worse guess than the sentence deserves. */
  if (!goalId) {
    if (criteria.some((c) => c.field === 'chargebackRatio')) {
      category = 'risk';
      goalId = 'ratio-drivers';
      understood.push('question: who is driving the ratio (assumed)');
    } else if (criteria.some((c) => c.field === 'projectedVolume')) {
      category = 'revenue';
      goalId = 'revenue-left';
      understood.push('question: what revenue is uncaptured (assumed)');
    } else {
      category = 'indemnification';
      goalId = 'should-indemnify';
      understood.push('question: should we indemnify them (assumed)');
    }
  }

  return {
    mode,
    merchantIds,
    criteria,
    category,
    goalId,
    solution,
    pricing,
    action: action ?? (category === 'indemnification' || category === 'revenue' ? 'indemnify' : null),
    understood,
  };
}

/** Examples offered under the bar — real commands, not illustrations. */
export const COMMAND_EXAMPLES = [
  'Indemnify all low risk merchants at 25 bps',
  'Who should we indemnify?',
  'Show merchants above 0.65%',
  'What should we charge travel merchants?',
  'Flag high risk merchants for review',
  'Where are we exposed?',
];
