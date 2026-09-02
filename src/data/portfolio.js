/**
 * ACQUIRER PORTFOLIO — the book of merchants this acquirer processes for.
 *
 * Same rule as cases.js: Expedia's own numbers are DERIVED from the real case
 * book (src/data/cases.js), never invented — if the case book says 1,200
 * disputes, this file says 1,200 disputes for Expedia, and its exposure is
 * the same open-dispute total the Overview and Disputes screens show. The
 * peer merchants are fictional travel-vertical brands with SIMULATED
 * aggregate stats (deterministic, via rng.js) — they are never wired into
 * CASES, just given believable numbers so Portfolio, Onboarding and
 * Underwriting have real content beyond the flagship.
 */

import brand from '@/brand/brand.config';
import createDraw from '@/data/rng';
import { CASES } from '@/data/cases';
import { MERCHANT_ROSTER, MERCHANT_GROUPS } from '@/data/merchants';
import { REVIEWER_OPTIONS } from '@/data/people';
import { caseKpis } from '@/domain/metrics';

const SEED = 20260812;
const draw = createDraw(SEED);

const NOW = Date.now();
const DAY = 86_400_000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);


/**
 * The acquirer whose seat this perspective sits in.
 *
 * For a processor tenant that is the tenant itself, not an entry from
 * brand.acquirers — that list is the OTHER processors a merchant might also
 * use. Reading it from the list produced "Every merchant Chase processes for,
 * Nuvei included", which names a competitor as the operator of this console.
 */
export const ACQUIRER_NAME = brand.name;

/* ------------------------------------------------------------------ *
 * Expedia — the flagship merchant. Every stat below reads straight off
 * the real case book, the same way Overview.jsx and metrics.js do.
 * ------------------------------------------------------------------ */

const AVG_CASE_VALUE = Math.round((CASES.reduce((s, c) => s + c.caseAmount, 0) / CASES.length) * 100) / 100;

/**
 * Every merchant's numbers are COUNTED from the case book, not invented — the
 * same rule the flagship always followed, now applied to the whole roster.
 * Cases carry a merchantId (see data/cases.js), so if the book says a merchant
 * has 84 disputes, Portfolio says 84 and the scope picker filters to 84.
 *
 * The live book reads as roughly one quarter of activity (due-date offsets run
 * from ~60 days past to ~30 days out), so counts are scaled x4 into an
 * annualised estimate before being divided by an estimated transaction count.
 * That keeps the chargeback ratio at a realistic scale — a fraction of a
 * percent for a well-run merchant — instead of reading a single quarter's raw
 * count against a full year of volume.
 */
function buildMerchant(stub) {
  const mine = CASES.filter((c) => c.merchantId === stub.id);
  const kpis = caseKpis(mine);
  const chargebackCount = mine.filter((c) => c.caseType === 'chargeback').length;

  const estimatedAnnualTransactions = Math.max(
    1,
    Math.round(stub.projectedVolume / (AVG_CASE_VALUE || 1)),
  );
  const chargebackRatio =
    Math.round(((chargebackCount * 4) / estimatedAnnualTransactions) * 10000) / 100;

  return {
    id: stub.id,
    name: stub.name,
    vertical: stub.vertical,
    mccCode: stub.mccCode,
    mccLabel: stub.mccLabel,
    groupId: stub.groupId,
    groupLabel: stub.groupLabel,
    status: stub.status,
    riskTier: stub.riskTier,
    onboardedDate: stub.onboardedDate,
    projectedVolume: stub.projectedVolume,
    disputeVolume: mine.length,
    chargebackCount,
    claimCount: kpis.claims,
    exposure: kpis.openValue,
    chargebackRatio,
    // A merchant with no closed cases has no win rate to report; null renders
    // as an em dash rather than a misleading 0%.
    winRate: mine.length ? Math.round(kpis.winRate * 10) / 10 : null,
    flagship: stub.flagship,
  };
}

export const MERCHANTS = MERCHANT_ROSTER.map(buildMerchant);

export { MERCHANT_GROUPS };

export const merchantById = (id) => MERCHANTS.find((m) => m.id === id) ?? null;

/* ------------------------------------------------------------------ *
 * Onboarding — merchants currently mid-onboarding.
 * ------------------------------------------------------------------ */

const CHECKLIST_STEPS = [
  { id: 'kyc', label: 'KYC verification' },
  { id: 'banking', label: 'Banking details verified' },
  { id: 'mcc', label: 'MCC classification' },
  { id: 'compliance', label: 'Compliance review' },
  { id: 'contract', label: 'Contract signed' },
];

function buildChecklist(currentIndex, blocked) {
  return CHECKLIST_STEPS.map((step, i) => ({
    ...step,
    status: i < currentIndex ? 'completed' : i === currentIndex ? (blocked ? 'blocked' : 'in_progress') : 'pending',
  }));
}

export const ONBOARDING_APPLICATIONS = MERCHANTS.filter((m) => m.status === 'Onboarding').map((m, i) => {
  const currentIndex = draw.int(1, CHECKLIST_STEPS.length - 1);
  const blocked = draw.bool(0.4);

  return {
    id: `APP-${2001 + i}`,
    merchantId: m.id,
    merchantName: m.name,
    vertical: m.vertical,
    mccLabel: m.mccLabel,
    submittedDate: isoDay(NOW - draw.int(10, 45) * DAY),
    targetGoLive: isoDay(NOW + draw.int(7, 30) * DAY),
    assignedAnalyst: draw.pick(REVIEWER_OPTIONS),
    steps: buildChecklist(currentIndex, blocked),
    note: blocked
      ? 'Blocked — awaiting an updated document from the merchant.'
      : 'On track for the target go-live date.',
  };
});

/* ------------------------------------------------------------------ *
 * Underwriting — risk review records.
 * ------------------------------------------------------------------ */

const FINDINGS_POOL = {
  Low: [
    'Established processing history with no material chargeback trend',
    'Strong win rate on recent representments',
    'Diversified transaction mix across entities and markets',
    'Clean KYC file, no adverse media',
  ],
  Medium: [
    'Chargeback ratio trending toward the early-warning threshold',
    'Moderate concentration in a single merchant category',
    'Supplier documentation turnaround slower than target',
    'Banking history under three years',
  ],
  High: [
    'Chargeback ratio above the network early-warning threshold',
    'Elevated fraud-marker rate on recent transactions',
    'Thin banking history, limited processing track record',
    'Concentration risk — high dependency on a single market',
    'Adverse media flag requiring further review',
  ],
};

const RECOMMENDATION_WEIGHTS = {
  Low: [['Approve', 85], ['Approve with conditions', 15]],
  Medium: [['Approve with conditions', 55], ['Approve', 30], ['Escalate', 15]],
  High: [['Decline', 35], ['Escalate', 35], ['Approve with conditions', 30]],
};

const RISK_SCORE_RANGE = { Low: [78, 96], Medium: [55, 78], High: [22, 55] };

let reviewSeq = 0;
function buildReview(merchant, reviewType) {
  reviewSeq += 1;
  const pool = FINDINGS_POOL[merchant.riskTier] ?? FINDINGS_POOL.Medium;
  const [min, max] = RISK_SCORE_RANGE[merchant.riskTier] ?? RISK_SCORE_RANGE.Medium;

  return {
    id: `UW-${3000 + reviewSeq}`,
    merchantId: merchant.id,
    merchantName: merchant.name,
    vertical: merchant.vertical,
    reviewType,
    riskScore: draw.int(min, max),
    findings: draw.sample(pool, draw.int(2, 3)),
    recommendation: draw.weighted(RECOMMENDATION_WEIGHTS[merchant.riskTier] ?? RECOMMENDATION_WEIGHTS.Medium),
    reviewer: draw.pick(REVIEWER_OPTIONS),
    reviewDate: isoDay(NOW - draw.int(2, 120) * DAY),
  };
}

export const UNDERWRITING_REVIEWS = MERCHANTS.flatMap((m) => {
  if (m.status === 'Onboarding') return [buildReview(m, 'Initial')];
  if (m.status === 'Under review' || m.status === 'Suspended') return [buildReview(m, 'Escalation'), buildReview(m, 'Periodic')];
  return [buildReview(m, 'Periodic')];
}).sort((a, b) => (a.reviewDate < b.reviewDate ? 1 : -1));

export default MERCHANTS;
