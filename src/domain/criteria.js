/**
 * Criteria engine.
 *
 * One evaluator, three consumers:
 *   Add rule (full page) — the criteria rail and the live "Estimated impact"
 *   Bulk actions (modal) — the live match count
 *   Rule check           — per-criterion Pass/Fail for a single case
 *
 * Because all three share this module, a rule that claims to match 14 cases
 * matches the same 14 cases everywhere.
 *
 * Every option list is derived from brand.config — none of the categories name
 * a tenant value. The reference hard-coded its own merchant brands and a
 * travel-only MCC list here; both now come from the tenant.
 */

import brand, { allReasonCodes } from '@/brand/brand.config';
import { STATUSES } from '@/domain/statuses';

const DAY = 86_400_000;

/* ------------------------------------------------------------------ *
 * Criteria categories — the Step 1 rail
 * ------------------------------------------------------------------ *
 * `type`: 'chips' picks one or more values; 'operator' takes an operator plus
 * a typed value. `get` reads the comparable value off a case record.
 */

export const CRITERIA_CATEGORIES = [
  {
    key: 'reasonCodes',
    label: 'Reason Codes',
    type: 'chips',
    hint: 'Select the reason codes this rule should match.',
    get: (c) => c.reasonCode,
    options: () => [
      ...allReasonCodes().map((rc) => ({ value: rc.code, label: `${rc.schemeLabel.toUpperCase()} ${rc.code}` })),
      ...brand.claimReasons.map((r) => ({ value: r.id, label: r.label })),
    ],
  },
  {
    key: 'merchantLabel',
    label: 'Merchant Label',
    type: 'chips',
    hint: 'Match cases belonging to these entities.',
    get: (c) => c.entityId,
    options: () => brand.entities.map((e) => ({ value: e.id, label: e.label })),
  },
  {
    key: 'cardScheme',
    label: 'Card Scheme',
    type: 'chips',
    hint: 'Match cases on these card schemes.',
    get: (c) => c.network,
    options: () => brand.schemes.map((s) => ({ value: s.id, label: s.label })),
  },
  {
    key: 'transactionAmount',
    label: 'Transaction Amount',
    type: 'operator',
    hint: 'Match on the disputed amount.',
    get: (c) => c.disputeAmount,
    operators: ['is greater than', 'is less than', 'is equal to', 'is not equal to'],
    placeholder: '250',
    valueType: 'number',
  },
  {
    key: 'transactionCurrency',
    label: 'Transaction Currency',
    type: 'chips',
    hint: 'Match on the transaction currency.',
    get: (c) => c.currency,
    options: () => [{ value: brand.currency, label: brand.currency }],
  },
  {
    key: 'bin',
    label: 'BIN',
    type: 'operator',
    hint: 'Match on the card BIN.',
    get: (c) => c.ccBin ?? '',
    operators: ['is', 'is not', 'starts with'],
    placeholder: '453912',
    valueType: 'text',
  },
  {
    key: 'mcc',
    label: 'MCC',
    type: 'chips',
    hint: 'Match on the merchant category code.',
    get: (c) => c.mcc,
    options: () => brand.mccs.map((m) => ({ value: m.code, label: `${m.code} — ${m.label}` })),
  },
  {
    key: 'transactionType',
    label: 'Transaction Type',
    type: 'chips',
    hint: 'Match on the transaction type.',
    get: (c) => c.transactionType,
    options: () => ['Sale', 'Refund', 'Authorization', 'Recurring'].map((v) => ({ value: v, label: v })),
  },
  {
    key: 'salesMethod',
    label: 'Sales Method',
    type: 'chips',
    hint: 'Match on how the sale was taken.',
    get: (c) => c.salesMethod,
    options: () => ['Ecommerce', 'Mobile App', 'MOTO', 'Recurring Billing'].map((v) => ({ value: v, label: v })),
  },
  {
    key: 'fraud',
    label: 'Fraud',
    type: 'chips',
    hint: 'Match on fraud markers.',
    get: (c) => c.fraudMarker,
    options: () => ['Confirmed Fraud', 'Suspected Fraud', 'No Fraud Marker', 'Fraud Reported by Issuer'].map((v) => ({ value: v, label: v })),
  },
  {
    key: 'documentFields',
    label: 'Document Fields',
    type: 'chips',
    hint: 'Match on document state.',
    get: (c) => c.docStatus,
    options: () => [
      { value: 'received', label: 'Documents received' },
      { value: 'pending', label: 'Documents pending' },
      { value: 'missing', label: 'Documents missing' },
      { value: 'not_required', label: 'No documents required' },
    ],
  },
  {
    key: 'caseAge',
    label: 'Case Age',
    type: 'operator',
    hint: 'Match on how old the case is, in days.',
    get: (c) => Math.floor((Date.now() - new Date(c.dateCreated).getTime()) / DAY),
    operators: ['is greater than', 'is less than', 'is equal to'],
    placeholder: '10',
    valueType: 'number',
  },
];

export const getCategory = (key) => CRITERIA_CATEGORIES.find((c) => c.key === key) ?? null;

export const categoryOptions = (key) => getCategory(key)?.options?.() ?? [];

/** Human label for a stored value, e.g. '13.3' -> 'VISA 13.3'. */
export function optionLabel(key, value) {
  const opt = categoryOptions(key).find((o) => String(o.value) === String(value));
  return opt?.label ?? String(value);
}

/* ------------------------------------------------------------------ *
 * Evaluation
 * ------------------------------------------------------------------ */

/**
 * A criterion is either:
 *   { key, values: [...] }              — chips: passes if the case matches ANY
 *   { key, operator, value }            — operator form
 */
export function evaluateCriterion(caseRecord, criterion) {
  const category = getCategory(criterion.key);
  if (!category) return false;

  const actual = category.get(caseRecord);

  if (category.type === 'chips') {
    const values = criterion.values ?? [];
    if (!values.length) return false;
    return values.map(String).includes(String(actual));
  }

  const expected = criterion.value;
  if (expected == null || expected === '') return false;

  switch (criterion.operator) {
    case 'is greater than': return Number(actual) > Number(expected);
    case 'is less than': return Number(actual) < Number(expected);
    case 'is equal to': return String(actual) === String(expected);
    case 'is not equal to': return String(actual) !== String(expected);
    case 'is': return String(actual) === String(expected);
    case 'is not': return String(actual) !== String(expected);
    case 'starts with': return String(actual ?? '').startsWith(String(expected));
    default: return false;
  }
}

/** Readable summary of one criterion, used in chips and review steps. */
export function describeCriterion(criterion) {
  const category = getCategory(criterion.key);
  const label = category?.label ?? criterion.key;

  if (category?.type === 'chips') {
    const values = (criterion.values ?? []).map((v) => optionLabel(criterion.key, v));
    return `${label} is ${values.join(' or ')}`;
  }
  return `${label} ${criterion.operator} ${criterion.value}`;
}

/**
 * Per-criterion breakdown for one case — what Rule check renders as
 * "N of M criteria matched". Returns every criterion with its own verdict
 * rather than one boolean, because the near-miss is the useful answer.
 */
export function checkCase(caseRecord, criteria = [], matchType = 'all') {
  const results = criteria.map((criterion) => {
    const category = getCategory(criterion.key);
    return {
      criterion,
      label: category?.label ?? criterion.key,
      description: describeCriterion(criterion),
      actual: category?.get(caseRecord),
      passed: evaluateCriterion(caseRecord, criterion),
    };
  });

  const passedCount = results.filter((r) => r.passed).length;
  const matched = matchType === 'any' ? passedCount > 0 : passedCount === criteria.length && criteria.length > 0;

  return {
    results,
    passedCount,
    total: criteria.length,
    matched,
    verdict: matched ? 'full' : passedCount === 0 ? 'none' : 'partial',
  };
}

/** Every case the criteria select. Drives the live impact counts. */
export function matchCases(cases, criteria = [], matchType = 'all') {
  if (!criteria.length) return [];
  return cases.filter((c) => checkCase(c, criteria, matchType).matched);
}

/* ------------------------------------------------------------------ *
 * Rule actions
 * ------------------------------------------------------------------ */

export const RULE_ACTION_OPTIONS = [
  { key: 'route_queue', label: 'Route To Queue', valueType: 'queue' },
  { key: 'assign_user', label: 'Assign to User', valueType: 'user' },
  { key: 'assign_skill', label: 'Assign to User With Skill', valueType: 'skill' },
  { key: 'auto_represent', label: 'Auto Represent', valueType: 'none' },
  { key: 'expire_case', label: 'Expire Case', valueType: 'none' },
  { key: 'reject_case', label: 'Reject Case', valueType: 'none' },
  { key: 'write_off', label: 'Accept Liability', valueType: 'none' },
  { key: 'assign_reviewer', label: 'Assign Reviewer', valueType: 'user' },
  { key: 'notify', label: 'Create Notification', valueType: 'none' },
  { key: 'email_seller', label: `Email ${brand.terms.seller}`, valueType: 'none' },
];

export const getRuleAction = (key) => RULE_ACTION_OPTIONS.find((a) => a.key === key) ?? null;

/** Statuses a rule can be scoped to — Step 3 toggle chips. */
export const RULE_STATUS_OPTIONS = STATUSES.map((s) => ({ value: s.id, label: s.label }));
