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
    // Indemnification is priced per transaction, so the count is part of the
    // merchant record rather than being re-derived at each call site.
    annualTransactions: estimatedAnnualTransactions,
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
  { id: 'kyc', label: 'KYC verification', team: 'Financial crime' },
  { id: 'banking', label: 'Banking details verified', team: 'Onboarding ops' },
  { id: 'mcc', label: 'MCC classification', team: 'Onboarding ops' },
  { id: 'compliance', label: 'Compliance review', team: 'Compliance' },
  { id: 'contract', label: 'Contract signed', team: 'Commercial' },
];

/**
 * What each step actually says once it has been worked.
 *
 * A checklist row that carries only a status pill tells a reader nothing they
 * could act on — who holds it, when it moved and what it is waiting for are
 * the questions anyone looking at a stalled application asks first. These are
 * the answers, one line per step and state.
 */
const STEP_DETAIL = {
  kyc: {
    completed: 'Beneficial owners verified against the registry; no adverse media.',
    in_progress: 'Registry check running on two beneficial owners.',
    blocked: 'Awaiting a certified copy of the incorporation document.',
    pending: 'Starts once the application is picked up.',
  },
  banking: {
    completed: 'Penny test confirmed on the settlement account.',
    in_progress: 'Penny test sent — awaiting confirmation from the merchant.',
    blocked: 'Bank letter does not match the legal entity name on file.',
    pending: 'Needs the settlement account details from the merchant.',
  },
  mcc: {
    completed: 'Classification agreed with the merchant and recorded.',
    in_progress: 'Draft classification sent to the merchant for sign-off.',
    blocked: 'Merchant disputes the proposed category — rate impact under review.',
    pending: 'Follows KYC; the trading description drives the category.',
  },
  compliance: {
    completed: 'Sanctions and PEP screening clear; file signed off.',
    in_progress: 'Sanctions and PEP screening in review.',
    blocked: 'Escalated to second-line compliance for a manual decision.',
    pending: 'Runs once classification is agreed.',
  },
  contract: {
    completed: 'Countersigned and filed; pricing schedule attached.',
    in_progress: 'Out for signature with the merchant.',
    blocked: 'Legal redlines on the liability clause still outstanding.',
    pending: 'Issued after compliance sign-off.',
  },
};

/**
 * Dates the checklist backwards from today so the worked steps land between
 * submission and now in the order they were actually done, rather than each
 * step carrying an unrelated random date.
 */
function buildChecklist(currentIndex, blocked, submittedMs) {
  const span = Math.max(NOW - submittedMs, DAY);
  const workedCount = Math.min(currentIndex + 1, CHECKLIST_STEPS.length);

  return CHECKLIST_STEPS.map((step, i) => {
    const status = i < currentIndex ? 'completed' : i === currentIndex ? (blocked ? 'blocked' : 'in_progress') : 'pending';
    const worked = status !== 'pending';
    // Spread the worked steps evenly across submission → now, so step 1 is
    // the oldest and the live step is the most recent.
    const at = worked ? submittedMs + Math.round((span * (i + 1)) / (workedCount + 1)) : null;

    return {
      ...step,
      status,
      detail: STEP_DETAIL[step.id][status],
      owner: worked ? draw.pick(REVIEWER_OPTIONS) : null,
      date: at ? isoDay(at) : null,
      days: worked ? Math.max(1, Math.round((NOW - at) / DAY)) : null,
    };
  });
}

/**
 * Prospects in the pipeline that are NOT yet in the merchant roster.
 *
 * Onboarding previously derived only from merchants already carrying the
 * "Onboarding" status, of which there are two — so the page showed two cards
 * and read as unfinished. But an onboarding pipeline is mostly made of
 * applicants who are not merchants yet; that is the whole point of it. These
 * are those applicants, spread across the four portfolio groups and across
 * every stage of the checklist so the page shows the full shape of a pipeline
 * rather than one slice of it.
 */
const PIPELINE_PROSPECTS = [
  { name: 'Cobalt Rail', groupId: 'ground', vertical: 'Intercity rail ticketing', mccCode: '4112', mccLabel: 'Passenger Railways', projectedVolume: 53_100_000 },
  { name: 'Solstice Resorts', groupId: 'lodging', vertical: 'All-inclusive resort group', mccCode: '7011', mccLabel: 'Lodging — Hotels and Resorts', projectedVolume: 67_800_000 },
  { name: 'Meridian Charter', groupId: 'air', vertical: 'Private charter booking', mccCode: '4511', mccLabel: 'Airlines and Air Carriers', projectedVolume: 22_300_000 },
  { name: 'Halcyon Voyages', groupId: 'experiences', vertical: 'Expedition cruise operator', mccCode: '4411', mccLabel: 'Cruise Lines', projectedVolume: 18_400_000 },
  { name: 'Verity Serviced Apartments', groupId: 'lodging', vertical: 'Extended-stay apartments', mccCode: '7011', mccLabel: 'Lodging — Hotels and Resorts', projectedVolume: 31_900_000 },
  { name: 'Kestrel Airways', groupId: 'air', vertical: 'Regional short-haul carrier', mccCode: '4511', mccLabel: 'Airlines and Air Carriers', projectedVolume: 26_200_000 },
  { name: 'Northgate Attractions', groupId: 'experiences', vertical: 'Theme parks and attractions', mccCode: '7996', mccLabel: 'Attractions and Tourist Experiences', projectedVolume: 44_500_000 },
  { name: 'Anvil Coach Tours', groupId: 'ground', vertical: 'Coach touring operator', mccCode: '4112', mccLabel: 'Passenger Railways', projectedVolume: 12_700_000 },
  { name: 'Lumen Restaurant Group', groupId: 'dining', vertical: 'Casual dining chain', mccCode: '5812', mccLabel: 'Eating Places and Restaurants', projectedVolume: 39_600_000 },
  { name: 'Torrent Travel Agency', groupId: 'air', vertical: 'Corporate travel management', mccCode: '4722', mccLabel: 'Travel Agencies and Tour Operators', projectedVolume: 71_200_000 },
];

const groupLabelFor = (groupId) => MERCHANT_GROUPS.find((g) => g.id === groupId)?.label ?? '—';

/** The two roster merchants already flagged Onboarding, plus the prospects. */
const ONBOARDING_SOURCES = [
  ...MERCHANTS.filter((m) => m.status === 'Onboarding').map((m) => ({
    merchantId: m.id,
    name: m.name,
    groupId: m.groupId,
    vertical: m.vertical,
    mccLabel: m.mccLabel,
    projectedVolume: m.projectedVolume,
  })),
  ...PIPELINE_PROSPECTS.map((p, i) => ({ merchantId: `prospect-${i + 1}`, ...p })),
];

export const ONBOARDING_APPLICATIONS = ONBOARDING_SOURCES.map((m, i) => {
  /* Walk the checklist position rather than drawing it. A random draw left
     whole stages empty on some seeds — "Ready for go-live" read zero and its
     filter returned nothing, which is the one thing a pipeline view must not
     do. Cycling guarantees every stage, including fully complete, is
     represented whatever the seed. */
  const currentIndex = 1 + (i % CHECKLIST_STEPS.length);
  // Same reasoning as the position above: a 30% draw returned no blocked
  // applications at all on this seed, leaving that KPI and filter dead.
  const blocked = currentIndex < CHECKLIST_STEPS.length && i % 4 === 2;
  const submittedMs = NOW - draw.int(10, 75) * DAY;
  const goLiveMs = NOW + draw.int(7, 60) * DAY;

  return {
    id: `APP-${2001 + i}`,
    merchantId: m.merchantId,
    merchantName: m.name,
    groupId: m.groupId,
    groupLabel: groupLabelFor(m.groupId),
    vertical: m.vertical,
    mccLabel: m.mccLabel,
    projectedVolume: m.projectedVolume,
    submittedDate: isoDay(submittedMs),
    daysOpen: Math.max(1, Math.round((NOW - submittedMs) / DAY)),
    daysToGoLive: Math.round((goLiveMs - NOW) / DAY),
    targetGoLive: isoDay(goLiveMs),
    assignedAnalyst: draw.pick(REVIEWER_OPTIONS),
    steps: buildChecklist(currentIndex, blocked, submittedMs),
    note: blocked
      ? 'Blocked — awaiting an updated document from the merchant.'
      : currentIndex >= CHECKLIST_STEPS.length
        ? 'All steps complete — ready to move to Active.'
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
