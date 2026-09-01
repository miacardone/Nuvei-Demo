/**
 * EVIDENCE REQUIREMENTS
 * =====================
 * What a given reason code actually needs before a representment is worth
 * filing.
 *
 * THIS IS THE PIECE EVERYTHING ELSE HANGS OFF. Without it the editor can
 * assemble a packet but cannot say whether the packet is any good, and
 * "compile the case in the background" is meaningless — you can only compile
 * what you can specify. A checklist keyed to the code is also the difference
 * between an analyst who knows the rules and one who does not: 13.1 is won
 * with delivery evidence and lost with a screenshot of the order page.
 *
 * WHY REQUIREMENTS ARE GROUPED BY CATEGORY, NOT LISTED PER CODE.
 * There are nineteen codes across three schemes here and more the moment a
 * tenant adds one, but they resolve to four arguments: the cardholder did not
 * authorise it, the goods never arrived, the goods were not as described, or
 * we processed it wrong. Writing a list per code would mean nineteen lists to
 * keep in step, and a new code silently getting none. So the base comes from
 * the category every code already carries, and only codes with a genuine
 * quirk override it.
 *
 * `weight` drives the readiness score. `required` items are the ones an
 * issuer will look for first; a packet missing one of those is not "nearly
 * ready", it is a rejection with extra steps.
 */

import brand from '@/brand/brand.config';
import { findReasonCode, findClaimReason } from '@/brand/brand.config';

const t = brand.terms;

/* ------------------------------------------------------------------ *
 * The items themselves
 * ------------------------------------------------------------------ */

/**
 * `matches` decides whether a packet block satisfies the item. It reads the
 * block's kind and title rather than asking the user to tag things by hand —
 * an analyst who has just uploaded "proof_of_delivery.pdf" should not then
 * have to tell the console what it is.
 */
const ITEMS = {
  proof_of_delivery: {
    id: 'proof_of_delivery',
    label: 'Proof of delivery',
    hint: 'Carrier confirmation showing the consignment was scanned and delivered.',
    match: /deliver|carrier|tracking|consign|proof of delivery|pod\b/i,
  },
  tracking_reference: {
    id: 'tracking_reference',
    label: 'Tracking reference',
    hint: 'The tracking number, traceable on the carrier’s own site.',
    match: /tracking|consignment|waybill/i,
  },
  delivery_address_match: {
    id: 'delivery_address_match',
    label: 'Address match',
    hint: `Delivery address on the consignment matches the address held on the ${t.buyer}'s account.`,
    match: /address|billing|shipping/i,
  },
  listing_snapshot: {
    id: 'listing_snapshot',
    label: 'Listing as it stood',
    hint: `The ${t.item} description and photographs at the time of the ${t.order}.`,
    match: /listing|snapshot|description|photograph/i,
  },
  terms_acceptance: {
    id: 'terms_acceptance',
    label: 'Accepted terms',
    hint: `Record of the ${t.buyer} accepting the terms of sale, including the returns window.`,
    match: /terms|acceptance|policy|conditions/i,
  },
  sales_receipt: {
    id: 'sales_receipt',
    label: 'Sales receipt',
    hint: `Itemised receipt for the ${t.order}, showing what was charged and when.`,
    match: /receipt|invoice|order confirmation/i,
  },
  auth_record: {
    id: 'auth_record',
    label: 'Authorisation record',
    hint: 'Approval code with the AVS and CVV results returned at the time.',
    match: /auth|avs|cvv|approval/i,
  },
  prior_orders: {
    id: 'prior_orders',
    label: 'Prior undisputed orders',
    hint: `Earlier ${t.order}s on the same account and card that settled without dispute.`,
    match: /prior|history|previous|undisputed/i,
  },
  device_evidence: {
    id: 'device_evidence',
    label: 'Device or account evidence',
    hint: 'Login, device or IP evidence tying the transaction to the account holder.',
    match: /device|ip\b|login|session|fingerprint/i,
  },
  refund_record: {
    id: 'refund_record',
    label: 'Refund record',
    hint: 'Evidence the credit was already issued, with the date and amount.',
    match: /refund|credit|reimburse/i,
  },
  settlement_record: {
    id: 'settlement_record',
    label: 'Settlement record',
    hint: 'Settlement showing the transaction was processed once, for the correct amount.',
    match: /settle|processing|batch|duplicate/i,
  },
  correspondence: {
    id: 'correspondence',
    label: `${t.buyer[0].toUpperCase()}${t.buyer.slice(1)} correspondence`,
    hint: `Messages with the ${t.buyer}, particularly anything withdrawing the complaint.`,
    match: /message|correspond|chat|email|conversation/i,
  },
  authenticity: {
    id: 'authenticity',
    label: 'Authenticity evidence',
    hint: `Authentication record or the ${t.seller}'s proof of purchase.`,
    match: /authentic|certificat|proof of purchase|verification/i,
  },
};

export const EVIDENCE_ITEMS = ITEMS;

/* ------------------------------------------------------------------ *
 * Category → requirements
 * ------------------------------------------------------------------ */

const req = (id, required = true) => ({ ...ITEMS[id], required });

const BY_CATEGORY = {
  fraud: [
    req('auth_record'),
    req('device_evidence'),
    req('prior_orders', false),
    req('proof_of_delivery'),
    req('delivery_address_match', false),
  ],
  consumer: [
    req('proof_of_delivery'),
    req('tracking_reference'),
    req('listing_snapshot'),
    req('terms_acceptance', false),
    req('correspondence', false),
  ],
  authorisation: [
    req('auth_record'),
    req('sales_receipt'),
    req('settlement_record', false),
  ],
  processing: [
    req('settlement_record'),
    req('sales_receipt'),
    req('refund_record', false),
  ],
};

/**
 * Per-code overrides, only where the category answer is genuinely wrong.
 * Anything not listed here inherits its category — that is the point.
 */
const BY_CODE = {
  // "Credit not processed" turns entirely on whether the refund exists.
  '13.6': [req('refund_record'), req('sales_receipt'), req('correspondence', false)],
  4860: [req('refund_record'), req('sales_receipt'), req('correspondence', false)],

  // Duplicate processing is a settlement argument, not a delivery one.
  '12.6.2': [req('settlement_record'), req('sales_receipt')],

  // Cancelled merchandise hinges on the cancellation terms, not delivery.
  '13.7': [req('terms_acceptance'), req('correspondence'), req('refund_record', false)],

  // Not-as-described needs the listing and, for this marketplace, authenticity.
  '13.3': [req('listing_snapshot'), req('authenticity'), req('proof_of_delivery'), req('correspondence', false)],
  4853: [req('listing_snapshot'), req('authenticity'), req('proof_of_delivery'), req('correspondence', false)],
  C31: [req('listing_snapshot'), req('authenticity'), req('proof_of_delivery'), req('correspondence', false)],
};

/** Claim reasons have no scheme code, so they map from the claim reason id. */
const BY_CLAIM_REASON = {
  not_as_described: [req('listing_snapshot'), req('authenticity'), req('correspondence', false)],
  never_arrived: [req('proof_of_delivery'), req('tracking_reference'), req('delivery_address_match')],
  counterfeit: [req('authenticity'), req('listing_snapshot'), req('correspondence', false)],
  damaged: [req('listing_snapshot'), req('proof_of_delivery'), req('correspondence', false)],
  wrong_item: [req('listing_snapshot'), req('proof_of_delivery'), req('correspondence', false)],
};

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** The evidence this case needs, most important first. */
export function requirementsFor(c) {
  if (!c) return [];

  if (c.caseType === 'claim') {
    const byReason = BY_CLAIM_REASON[c.reasonCode];
    if (byReason) return byReason;
    const claim = findClaimReason(c.reasonCode);
    return BY_CATEGORY[claim?.category ?? 'consumer'] ?? BY_CATEGORY.consumer;
  }

  const override = BY_CODE[c.reasonCode];
  if (override) return override;

  const code = findReasonCode(c.reasonCode);
  return BY_CATEGORY[code?.category ?? c.reasonCategory ?? 'consumer'] ?? BY_CATEGORY.consumer;
}

/**
 * Which requirements the packet already satisfies.
 *
 * Matching is on the block's own title, so an evidence document already on the
 * case and a file the analyst has just uploaded are treated the same way —
 * there is no separate "tag your upload" step to forget.
 */
export function assessPacket(c, blocks = []) {
  const included = blocks.filter((b) => b.included !== false);
  const haystack = included.map((b) => `${b.title ?? ''} ${b.docKind ?? ''}`);

  const items = requirementsFor(c).map((item) => {
    const satisfiedBy = haystack.findIndex((h) => item.match.test(h));
    return {
      ...item,
      satisfied: satisfiedBy !== -1,
      satisfiedBy: satisfiedBy === -1 ? null : included[satisfiedBy].title,
    };
  });

  const required = items.filter((i) => i.required);
  const missingRequired = required.filter((i) => !i.satisfied);

  return {
    items,
    total: items.length,
    satisfied: items.filter((i) => i.satisfied).length,
    missingRequired,
    /** Whole-number percentage, weighted so required items carry the score. */
    readiness: required.length
      ? Math.round(((required.length - missingRequired.length) / required.length) * 100)
      : 100,
  };
}

/** One line explaining what this code is won and lost on. */
export function strategyFor(c) {
  if (!c) return '';
  const category = c.caseType === 'claim'
    ? findClaimReason(c.reasonCode)?.category
    : findReasonCode(c.reasonCode)?.category ?? c.reasonCategory;

  switch (category) {
    case 'fraud':
      return `Won by showing the cardholder participated: authorisation results, device or account evidence, and a delivery address they already use. Delivery evidence alone does not answer a fraud claim.`;
    case 'authorisation':
      return `Won on the authorisation record. If the approval code and AVS/CVV results are not on file, this is not defendable and the time is better spent elsewhere.`;
    case 'processing':
      return `Won on the settlement record. Show the transaction was processed once, for the amount charged, on the date shown.`;
    default:
      return `Won on delivery and description: carrier evidence that it arrived, and the listing showing it was what was promised.`;
  }
}
