/**
 * ISSUER CARDHOLDER BOOK — the people behind the card leg of the shared case
 * book, seen from the issuing bank's side.
 *
 * Same rule as portfolio.js on the acquirer side: nothing here is a parallel
 * dataset. Every cardholder is deduped straight off `CASES` (the `cardholder`
 * field, chargeback-type cases only — a claim has no card leg), so Cardholders,
 * Fraud, Chargebacks and Statements all agree with each other and with the
 * shared Disputes > Cases screen. Only the enrichment (member-since, status,
 * lifetime spend) is simulated, deterministically, via rng.js.
 */

import createDraw from '@/data/rng';
import { CASES } from '@/data/cases';

const SEED = 20260813;
const draw = createDraw(SEED);

const NOW = Date.now();
const DAY = 86_400_000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** A fictional issuing bank — invented for this build, not a real institution. */
export const ISSUING_BANK = {
  name: 'Union Harbor Bank, N.A.',
  shortName: 'Union Harbor',
  founded: 1988,
  headquarters: 'Wilmington, DE',
  cardsInForce: 4_180_000,
  tagline: 'Consumer and small-business card issuing, nationwide.',
};

/* ------------------------------------------------------------------ *
 * Dedupe cardholders off the real chargeback book.
 * ------------------------------------------------------------------ */

const chargebackCases = CASES.filter((c) => c.caseType === 'chargeback' && c.cardholder);

const byName = new Map();
chargebackCases.forEach((c) => {
  if (!byName.has(c.cardholder)) byName.set(c.cardholder, []);
  byName.get(c.cardholder).push(c);
});

function statusWeightsFor(disputeCount) {
  if (disputeCount >= 4) return [['Active', 55], ['Under review', 30], ['Blocked', 15]];
  if (disputeCount >= 2) return [['Active', 80], ['Under review', 15], ['Blocked', 5]];
  return [['Active', 94], ['Under review', 4], ['Blocked', 2]];
}

export const CARDHOLDERS = [...byName.entries()].map(([name, cases], i) => {
  // Cases sharing a card (see cases.js SHARING.cardGroups) already carry the
  // same card fields, so the first case is a representative "anchor" for the
  // whole group — no need to reconcile conflicting BINs across duplicates.
  const anchor = cases[0];
  const disputeCount = cases.length;
  const disputeValue = Math.round(cases.reduce((s, c) => s + c.disputeAmount, 0) * 100) / 100;

  const memberYears = draw.int(1, 14);
  const memberSince = isoDay(NOW - memberYears * 365 * DAY - draw.int(0, 364) * DAY);

  // Lifetime spend simulated from a plausible monthly pattern, capped at five
  // years of history even for a longer-tenured member — a spend figure should
  // read as "this account", not "this account since the dawn of time".
  const avgTicket = draw.money(60, 420);
  const monthlyAuths = draw.int(8, 40);
  const monthsOfHistory = Math.min(memberYears * 12, 60);
  const lifetimeSpend = Math.round(avgTicket * monthlyAuths * monthsOfHistory * draw.float(0.6, 1.15) * 100) / 100;

  return {
    id: `CH-${100000 + i * 7}`,
    name,
    cardLast4: anchor.ccLast4,
    cardBin: anchor.ccBin,
    cardType: anchor.cardType,
    pan: anchor.pan,
    scheme: anchor.network,
    schemeLabel: anchor.networkLabel,
    market: anchor.market,
    memberSince,
    status: draw.weighted(statusWeightsFor(disputeCount)),
    disputeCount,
    disputeValue,
    lifetimeSpend,
  };
});

export const cardholderById = (id) => CARDHOLDERS.find((c) => c.id === id) ?? null;
export const cardholderByName = (name) => CARDHOLDERS.find((c) => c.name === name) ?? null;

/** Every chargeback case tied to a given cardholder, straight off the shared book. */
export const casesForCardholder = (name) => chargebackCases.filter((c) => c.cardholder === name);

export default CARDHOLDERS;
