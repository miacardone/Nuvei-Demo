/**
 * SETTLEMENT — weekly settlement batches across the acquirer's portfolio.
 *
 * Weighted toward Expedia — by far the largest merchant by volume — with
 * smaller, intermittent batches for the peer merchants. Suspended and
 * still-onboarding merchants do not settle at all: no live processing, no
 * batch. `disputeDeductions` on Expedia's batches is scaled off the real
 * open-dispute exposure from src/data/cases.js (via domain/metrics.js), so
 * this screen never quotes a held-back figure the Disputes and Risk screens
 * would contradict.
 */

import createDraw from '@/data/rng';
import { CASES } from '@/data/cases';
import { caseKpis } from '@/domain/metrics';
import { MERCHANTS } from '@/data/portfolio';

const SEED = 20260814;
const draw = createDraw(SEED);

const NOW = Date.now();
const DAY = 86_400_000;
const WEEK = 7 * DAY;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

const WEEKS = 9;
const openExposure = caseKpis(CASES).openValue;

/** Suspended merchants don't process; still-onboarding merchants aren't live yet. */
const SETTLING = MERCHANTS.filter((m) => m.status === 'Active' || m.status === 'Under review');

let seq = 0;
const batches = [];

SETTLING.forEach((merchant) => {
  const isFlagship = merchant.flagship;

  for (let w = 0; w < WEEKS; w += 1) {
    // Smaller merchants don't necessarily settle every single week.
    if (!isFlagship && draw.bool(0.22)) continue;

    const weekEnd = NOW - w * WEEK;
    const grossRange = isFlagship
      ? [26_000_000, 39_000_000]
      : merchant.riskTier === 'High'
        ? [180_000, 520_000]
        : [400_000, 1_400_000];

    const gross = Math.round(draw.float(...grossRange) * 100) / 100;
    const feeRate = draw.float(0.024, 0.031);
    const fees = Math.round(gross * feeRate * 100) / 100;

    const disputeDeductions = isFlagship
      ? Math.round((openExposure / WEEKS) * draw.float(0.7, 1.3) * 100) / 100
      : Math.round(gross * (merchant.riskTier === 'High' ? draw.float(0.02, 0.05) : draw.float(0.004, 0.015)) * 100) / 100;

    const net = Math.round((gross - fees - disputeDeductions) * 100) / 100;

    const status = w === 0
      ? draw.weighted([['Pending', 55], ['Settled', 30], ['Held', 15]])
      : merchant.riskTier === 'High' && draw.bool(0.25)
        ? 'Held'
        : 'Settled';

    seq += 1;
    batches.push({
      id: `STL-${100000 + seq}`,
      merchantId: merchant.id,
      merchantName: merchant.name,
      date: isoDay(weekEnd),
      currency: 'USD',
      gross,
      fees,
      disputeDeductions,
      net,
      status,
    });
  }
});

batches.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.merchantName.localeCompare(b.merchantName)));

export const SETTLEMENT_BATCHES = batches;

export function settlementKpis(batches = SETTLEMENT_BATCHES) {
  const settled = batches.filter((b) => b.status === 'Settled');
  const held = batches.filter((b) => b.status === 'Held');

  return {
    totalNetSettled: Math.round(settled.reduce((s, b) => s + b.net, 0) * 100) / 100,
    totalHeldForDisputes: Math.round(batches.reduce((s, b) => s + b.disputeDeductions, 0) * 100) / 100,
    heldBatchCount: held.length,
    batchCount: batches.length,
  };
}

export default SETTLEMENT_BATCHES;
