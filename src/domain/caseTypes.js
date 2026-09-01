/**
 * The hybrid model.
 * =================
 * Two intake paths, one queue, keyed on `caseType`:
 *
 *   chargeback — a card network dispute. ARN, masked PAN, acquirer case #,
 *                BIN, MID, MCC, scheme, reason code, cycle, cardholder,
 *                card type.
 *   claim      — a Buyer Protection claim raised inside the marketplace. No
 *                card leg: item, category, buyer, seller, order, claim reason,
 *                payment method.
 *
 * The payoff is that chargebacks ALSO carry the marketplace context. An analyst
 * defending a 13.3 ("not as described") is arguing about a listing, so the
 * listing sits on the case beside the ARN.
 *
 * The cost of one shared queue is a table that would otherwise be half N/A —
 * `columnsFor()` adapts the column set to the active case-type filter instead.
 */

export const CASE_TYPES = [
  { id: 'chargeback', label: 'Chargeback', short: 'CB', tone: 'info' },
  { id: 'claim', label: 'Claim', short: 'TP', tone: 'primary' },
];

const BY_ID = Object.fromEntries(CASE_TYPES.map((t) => [t.id, t]));
export const getCaseType = (id) => BY_ID[id] ?? BY_ID.chargeback;
export const isChargeback = (c) => c?.caseType === 'chargeback';
export const isClaim = (c) => c?.caseType === 'claim';

/* ------------------------------------------------------------------ *
 * Adaptive columns
 * ------------------------------------------------------------------ *
 * `appliesTo`: both | chargeback | claim | mixed.
 *   both      — always shown
 *   mixed     — only on the unfiltered view, where it renders whichever
 *               identifier the row actually has
 *   cb/claim  — only when filtered to that intake path
 *
 * `fw` is the fit-to-width flex weight; `width` is the comfortable width.
 */

export const CASE_COLUMNS = [
  { key: 'id', header: 'Case #', appliesTo: 'both', width: '116px', fw: 8, mono: true, sortable: true, description: 'Internal case identifier.' },
  { key: 'caseType', header: 'Type', appliesTo: 'both', width: '74px', fw: 5, align: 'center', description: 'Chargeback (card scheme dispute) or Claim (Traveler Protection).' },
  { key: 'reference', header: 'Reference', appliesTo: 'mixed', width: '210px', fw: 13, description: 'The ARN or claim reference, whichever this case has.' },

  { key: 'arn', header: 'ARN', appliesTo: 'chargeback', width: '160px', fw: 11, mono: true, description: 'Acquirer Reference Number — the scheme’s unique transaction identifier.' },
  { key: 'network', header: 'Scheme', appliesTo: 'chargeback', width: '104px', fw: 7, description: 'The card network this chargeback was raised on.' },
  { key: 'reasonCode', header: 'Reason code', appliesTo: 'chargeback', width: '190px', fw: 12, sortable: true, description: 'The scheme’s reason code for why this chargeback was raised.' },
  { key: 'bankCode', header: 'Bank code', appliesTo: 'chargeback', width: '120px', fw: 8, mono: true, sortable: true, description: 'The issuing bank’s own code for this reason — same code, the bank’s term for it.' },
  { key: 'cycle', header: 'Cycle', appliesTo: 'chargeback', width: '116px', fw: 8, description: 'Where this case sits in the dispute lifecycle — first chargeback, representment, pre-arbitration, etc.' },
  { key: 'cardholder', header: 'Cardholder', appliesTo: 'chargeback', width: '150px', fw: 10, description: 'The cardholder who filed the dispute.' },
  { key: 'mid', header: 'MID', appliesTo: 'chargeback', width: '130px', fw: 8, mono: true, description: 'Merchant ID the transaction was processed under.' },

  { key: 'itemTitle', header: 'Item', appliesTo: 'claim', width: '220px', fw: 14, description: 'The booking or item this claim is about.' },
  { key: 'claimReason', header: 'Claim reason', appliesTo: 'claim', width: '160px', fw: 10, sortable: true, description: 'Why the traveler raised this claim.' },
  { key: 'buyer', header: 'Buyer', appliesTo: 'claim', width: '150px', fw: 10, description: 'The traveler who filed the claim.' },
  { key: 'seller', header: 'Seller', appliesTo: 'claim', width: '150px', fw: 10, description: 'The supplier the booking was made with.' },
  { key: 'orderId', header: 'Order', appliesTo: 'claim', width: '130px', fw: 9, description: 'The booking or order this claim references.' },
  { key: 'paymentMethod', header: 'Payment', appliesTo: 'claim', width: '120px', fw: 8, description: 'How the traveler paid for the booking.' },

  { key: 'entityLabel', header: 'Entity', appliesTo: 'both', width: '120px', fw: 8, description: 'The billing entity or brand this case was processed under.' },
  { key: 'serviceDate', header: 'Service date', appliesTo: 'both', width: '120px', fw: 9, sortable: true, description: 'When the booked travel itself takes place — separate from the dispute timeline.' },
  { key: 'disputeAmount', header: 'Amount', appliesTo: 'both', width: '112px', fw: 8, align: 'right', mono: true, sortable: true, description: 'The disputed amount.' },
  { key: 'status', header: 'Status', appliesTo: 'both', width: '116px', fw: 8, sortable: true, align: 'center', description: 'Where this case is in the workflow.' },
  { key: 'outcome', header: 'Outcome', appliesTo: 'both', width: '112px', fw: 6, align: 'center', description: 'How this case was resolved, once closed.' },
  { key: 'docStatus', header: 'Doc status', appliesTo: 'both', width: '116px', fw: 7, align: 'center', description: 'Whether supporting evidence has been received.' },
  { key: 'queueLabel', header: 'Queue', appliesTo: 'both', width: '160px', fw: 10, description: 'The work queue this case is routed to.' },
  { key: 'worker', header: 'Assigned to', appliesTo: 'both', width: '170px', fw: 13, description: 'The analyst currently working this case.' },
  { key: 'dueDate', header: 'Due', appliesTo: 'both', width: '116px', fw: 12, sortable: true, pinned: true, description: 'Internal due date — the buffer we work to, ahead of the network deadline.' },
];

export function columnsFor(caseType = 'all') {
  if (caseType === 'chargeback' || caseType === 'claim') {
    return CASE_COLUMNS.filter((c) => c.appliesTo === 'both' || c.appliesTo === caseType);
  }
  return CASE_COLUMNS.filter((c) => c.appliesTo === 'both' || c.appliesTo === 'mixed');
}

/* ------------------------------------------------------------------ *
 * Work case detail sections
 * ------------------------------------------------------------------ */

/**
 * The CASE accordion. Chargebacks lead with the card leg; claims lead with the
 * claim. Both then get the marketplace block — that is the hybrid payoff made
 * visible rather than merely modeled.
 */
export function caseSectionFields(c) {
  if (!c) return [];

  if (c.caseType === 'chargeback') {
    return [
      { k: 'Case Number', v: c.id, mono: true },
      { k: 'Card Scheme', v: c.networkLabel },
      { k: 'Reason Code', v: c.reasonCode, mono: true },
      { k: 'Reason Description', v: c.reasonLabel, wide: true },
      { k: 'Dispute Cycle', v: c.cycleLabel },
      { k: 'Card Type', v: c.cardType },
      { k: 'Cardholder', v: c.cardholder },
    ];
  }

  return [
    { k: 'Case Number', v: c.id, mono: true },
    { k: 'Claim Reason', v: c.reasonLabel },
    { k: 'Reason Description', v: c.reasonDescription, wide: true },
    { k: 'Raised By', v: c.buyer },
    { k: 'Payment Method', v: c.paymentMethod },
  ];
}

export function transactionSectionFields(c) {
  if (!c) return [];
  const common = [
    { k: 'Transaction Amount', v: c.transactionAmount, format: 'money' },
    { k: 'Transaction Currency', v: c.currency },
    { k: 'Transaction Date', v: c.transDate, format: 'date' },
    { k: 'Post Date', v: c.postDate, format: 'date' },
    { k: 'Merchant Ref #', v: c.merchantRef, mono: true },
  ];

  if (c.caseType !== 'chargeback') return common;

  return [
    { k: 'ARN', v: c.arn, mono: true },
    { k: 'Acquirer Case #', v: c.acquirerCaseNumber, mono: true },
    { k: 'Card Number', v: c.pan, mono: true },
    { k: 'CC BIN', v: c.ccBin, mono: true },
    { k: 'CC Last 4', v: c.ccLast4, mono: true },
    { k: 'MID', v: c.mid, mono: true },
    { k: 'MCC', v: `${c.mcc} — ${c.mccLabel}` },
    { k: 'Acquirer', v: c.acquirer },
    ...common,
  ];
}

/** Always rendered, for both intake paths. */
export function marketplaceSectionFields(c) {
  if (!c) return [];
  return [
    { k: 'Item', v: c.itemTitle, wide: true },
    { k: 'Category', v: c.itemCategory },
    { k: 'Listed Price', v: c.itemPrice, format: 'money' },
    { k: 'Condition', v: c.itemCondition },
    { k: 'Order ID', v: c.orderId, mono: true },
    { k: 'Order Placed', v: c.orderPlacedAt, format: 'date' },
    { k: 'Buyer', v: c.buyer },
    { k: 'Seller', v: c.seller },
    { k: 'Seller Rating', v: c.sellerRating, format: 'rating' },
    { k: 'Carrier', v: c.carrier },
  ];
}

export function entitySectionFields(c) {
  if (!c) return [];
  return [
    { k: 'Entity', v: c.entityLabel },
    { k: 'Descriptor', v: c.entityDescriptor },
    { k: 'MID', v: c.mid, mono: true },
    { k: 'Market', v: c.market },
    { k: 'Party ID', v: c.partyId, mono: true },
  ];
}
