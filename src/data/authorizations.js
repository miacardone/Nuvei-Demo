/**
 * ISSUER AUTHORIZATION FEED — everyday card activity for every cardholder in
 * data/cardholders.js, not just the ones with a live dispute.
 *
 * Deliberately a SEPARATE, purely-simulated book (deterministic via rng.js):
 * unlike cardholders.js, there is no "authorization" leg recorded anywhere in
 * the shared case book to dedupe from, so this is normal issuer activity
 * invented to give Approvals/Declines/Statements real content. Disputed
 * transactions still come from the shared `CASES` book at render time (see
 * Chargebacks.jsx, Fraud.jsx and Statements.jsx) — this file never duplicates
 * a dispute as an authorization row.
 */

import brand from '@/brand/brand.config';
import createDraw from '@/data/rng';
import { CARDHOLDERS } from '@/data/cardholders';

const SEED = 20260814;
const draw = createDraw(SEED);

const NOW = Date.now();
const DAY = 86_400_000;

/** Non-Expedia spend, so a cardholder's card doesn't read as single-purpose. */
const OTHER_MERCHANTS = [
  'Grocery', 'Gas station', 'Pharmacy', 'Coffee shop', 'Streaming service',
  'Ride share', 'Restaurant', 'Airport parking', 'Hotel Wi-Fi', 'Electronics store',
  'Department store', 'Home improvement', 'Utility bill pay', 'Insurance premium',
  'Office supplies', 'Mobile phone bill',
];

const ENTITY_WEIGHTS = brand.entities.map((e, i) => [e, i === 0 ? 55 : i === 1 ? 25 : 20]);

const DECLINE_REASONS = [
  ['Insufficient funds', 34],
  ['Suspected fraud', 22],
  ['Card restrictions', 18],
  ['Invalid CVV', 14],
  ['Expired card', 12],
];

function pickMerchant() {
  // Mostly Expedia — this is still an Expedia dispute console — with a
  // minority of everyday spend so the card reads as a real wallet.
  if (draw.bool(0.68)) return draw.weighted(ENTITY_WEIGHTS).label;
  return draw.pick(OTHER_MERCHANTS);
}

function amountFor(merchant) {
  const isFlagship = brand.entities.some((e) => e.label === merchant);
  return isFlagship ? draw.money(90, 2_800) : draw.money(6, 180);
}

let seq = 0;
export const AUTHORIZATIONS = CARDHOLDERS.flatMap((ch) => {
  // Every cardholder gets some normal history — 2 to 5 authorizations over
  // the last ~90 days — independent of whether they also have a dispute.
  const count = draw.int(2, 5);

  return Array.from({ length: count }, () => {
    seq += 1;
    const merchant = pickMerchant();
    const result = draw.bool(0.9) ? 'Approved' : 'Declined';
    const at = NOW - draw.int(0, 89) * DAY - draw.int(0, 86_399_000);

    return {
      id: `AUTH-${400000 + seq * 3}`,
      cardholderId: ch.id,
      cardholderName: ch.name,
      date: new Date(at).toISOString(),
      merchant,
      amount: amountFor(merchant),
      currency: brand.currency,
      scheme: ch.schemeLabel,
      result,
      declineReason: result === 'Declined' ? draw.weighted(DECLINE_REASONS) : null,
    };
  });
}).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export const authorizationsFor = (cardholderId) => AUTHORIZATIONS.filter((a) => a.cardholderId === cardholderId);

export default AUTHORIZATIONS;
