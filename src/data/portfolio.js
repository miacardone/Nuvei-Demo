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
import { REVIEWER_OPTIONS } from '@/data/people';
import { caseKpis } from '@/domain/metrics';

const SEED = 20260812;
const draw = createDraw(SEED);

const NOW = Date.now();
const DAY = 86_400_000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

const MCC_BY_CODE = Object.fromEntries(brand.mccs.map((m) => [m.code, m]));

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

const kpis = caseKpis(CASES);
const chargebackCount = CASES.filter((c) => c.caseType === 'chargeback').length;
const avgBookingValue = Math.round((CASES.reduce((s, c) => s + c.caseAmount, 0) / CASES.length) * 100) / 100;

/** Illustrative annual card volume this acquirer processes for Expedia. */
const FLAGSHIP_PROJECTED_VOLUME = 4_820_000_000;

/**
 * The live book reads as roughly one quarter of activity (due-date offsets
 * run from ~60 days past to ~30 days out — see cases.js), so it is scaled
 * ×4 into an annualised estimate before it is divided by an estimated
 * transaction count. This keeps the ratio at a realistic industry scale
 * (a fraction of a percent for a well-run merchant) instead of reading as a
 * single quarter's raw count against a full year of volume.
 */
const estimatedAnnualTransactions = Math.round(FLAGSHIP_PROJECTED_VOLUME / avgBookingValue);
const FLAGSHIP_CHARGEBACK_RATIO = Math.round(((chargebackCount * 4) / estimatedAnnualTransactions) * 10000) / 100;

const FLAGSHIP = {
  id: 'flagship',
  name: brand.flagshipMerchant.name,
  vertical: brand.flagshipMerchant.vertical,
  mccCode: brand.flagshipMerchant.mccCode,
  mccLabel: MCC_BY_CODE[brand.flagshipMerchant.mccCode]?.label ?? brand.mccs[0].label,
  status: 'Active',
  riskTier: 'Low',
  onboardedDate: brand.flagshipMerchant.onboardedDate,
  projectedVolume: FLAGSHIP_PROJECTED_VOLUME,
  disputeVolume: kpis.total,
  chargebackCount,
  claimCount: kpis.claims,
  exposure: kpis.openValue,
  chargebackRatio: FLAGSHIP_CHARGEBACK_RATIO,
  winRate: Math.round(kpis.winRate * 10) / 10,
  flagship: true,
};

/* ------------------------------------------------------------------ *
 * Peer merchants — fictional travel-vertical brands, simulated stats.
 * ------------------------------------------------------------------ *
 * Status is deliberately varied so Onboarding and Underwriting have real
 * content: 3 Active, 2 Onboarding, 2 Under review, 1 Suspended.
 */

const PEER_STUBS = [
  { id: 'brightwave', name: 'Brightwave Electronics', vertical: 'Consumer electronics retail', mccCode: '5999', status: 'Active', riskTier: 'Low', onboardedDate: '2018-06-11', volume: [180_000_000, 260_000_000], disputes: [90, 160] },
  { id: 'pixelforge', name: 'PixelForge Studios', vertical: 'Games and in-app purchases', mccCode: '5816', status: 'Active', riskTier: 'Medium', onboardedDate: '2020-09-14', volume: [95_000_000, 140_000_000], disputes: [40, 80] },
  { id: 'lattice', name: 'Lattice Software', vertical: 'B2B SaaS subscriptions', mccCode: '7372', status: 'Active', riskTier: 'Low', onboardedDate: '2019-03-19', volume: [120_000_000, 175_000_000], disputes: [55, 100] },
  { id: 'flightpath', name: 'FlightPath Travel', vertical: 'Discount airline OTA', mccCode: '4722', status: 'Suspended', riskTier: 'High', onboardedDate: '2017-08-30', volume: [70_000_000, 110_000_000], disputes: [220, 340] },
  { id: 'harborside', name: 'Harborside Dining Group', vertical: 'Restaurant group', mccCode: '5812', status: 'Active', riskTier: 'Low', onboardedDate: '2021-05-08', volume: [30_000_000, 55_000_000], disputes: [30, 60] },
  { id: 'freshline', name: 'Freshline Markets', vertical: 'Online grocery', mccCode: '5411', status: 'Onboarding', riskTier: 'Medium', onboardedDate: null, volume: [40_000_000, 70_000_000], disputes: [0, 0] },
  { id: 'goldenspin', name: 'GoldenSpin Gaming', vertical: 'Licensed online gaming', mccCode: '7995', status: 'Under review', riskTier: 'High', onboardedDate: '2019-11-20', volume: [60_000_000, 90_000_000], disputes: [110, 190] },
  { id: 'meridian', name: 'Meridian Digital Bank', vertical: 'Neobank top-ups', mccCode: '6012', status: 'Onboarding', riskTier: 'High', onboardedDate: null, volume: [50_000_000, 80_000_000], disputes: [0, 0] },
];

function simulateStats(riskTier, disputeMin, disputeMax) {
  if (disputeMax <= 0) return { disputeVolume: 0, chargebackRatio: 0, exposure: 0 };

  const disputeVolume = draw.int(disputeMin, disputeMax);
  const [ratioMin, ratioMax] =
    riskTier === 'Low' ? [0.12, 0.34] : riskTier === 'Medium' ? [0.35, 0.64] : [0.68, 1.45];
  const chargebackRatio = Math.round(draw.float(ratioMin, ratioMax) * 100) / 100;

  const avgExposurePerCase = draw.money(220, 640);
  const openFraction = draw.float(0.28, 0.45);
  const exposure = Math.round(disputeVolume * openFraction * avgExposurePerCase * 100) / 100;

  return { disputeVolume, chargebackRatio, exposure };
}

function buildMerchant(stub) {
  const projectedVolume = Math.round(draw.float(stub.volume[0], stub.volume[1]) / 100_000) * 100_000;
  const stats = simulateStats(stub.riskTier, stub.disputes[0], stub.disputes[1]);
  const mcc = MCC_BY_CODE[stub.mccCode];

  return {
    id: stub.id,
    name: stub.name,
    vertical: stub.vertical,
    mccCode: stub.mccCode,
    mccLabel: mcc.label,
    status: stub.status,
    riskTier: stub.riskTier,
    onboardedDate: stub.onboardedDate,
    projectedVolume,
    disputeVolume: stats.disputeVolume,
    chargebackCount: stats.disputeVolume,
    claimCount: 0,
    exposure: stats.exposure,
    chargebackRatio: stats.chargebackRatio,
    winRate: null,
    flagship: false,
  };
}

export const MERCHANTS = [FLAGSHIP, ...PEER_STUBS.map(buildMerchant)];

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
    'Diversified booking mix across entities and markets',
    'Clean KYC file, no adverse media',
  ],
  Medium: [
    'Chargeback ratio trending toward the early-warning threshold',
    'Moderate concentration in a single booking category',
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
