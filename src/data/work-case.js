/**
 * Work case detail data — documents, notes, flags, special instructions,
 * history and related cases.
 *
 * All derived per case id from the case record itself, so a document always
 * matches its case. Nothing here is a static blob keyed to a tenant.
 */

import brand from '@/brand/brand.config';
import createDraw from '@/data/rng';
import { getCase } from '@/data/cases';
import { CURRENT_USER, STAFF } from '@/data/people';
import { isClosed } from '@/domain/statuses';

const DAY = 86_400_000;

/** Stable per-case pseudo-randomness without storing anything. */
const seedOf = (caseId) => [...caseId].reduce((a, ch) => a + ch.charCodeAt(0), 0);
const drawFor = (caseId, salt = 0) => createDraw(seedOf(caseId) + salt);

/* ------------------------------------------------------------------ *
 * Documents
 * ------------------------------------------------------------------ */

export const DOC_KINDS = {
  representment_letter: 'Representment Letter',
  sales_receipt: 'Sales Receipt',
  listing_snapshot: 'Listing Snapshot',
  delivery_confirmation: 'Delivery Confirmation',
  terms_acceptance: 'Terms Acceptance',
  issuer_memo: 'Issuer Cover Memo',
  cardholder_statement: 'Cardholder Statement',
  buyer_claim_form: 'Buyer Claim Form',
};

const MERCHANT_SEQUENCE = ['representment_letter', 'sales_receipt', 'listing_snapshot', 'delivery_confirmation', 'terms_acceptance'];
const ISSUER_SEQUENCE = ['issuer_memo', 'cardholder_statement', 'buyer_claim_form'];

function buildDocs(caseId, side, sequence) {
  const draw = drawFor(caseId, side === 'merchant' ? 1 : 2);
  const count = draw.int(2, sequence.length);

  return sequence.slice(0, count).map((kind, i) => ({
    id: `${caseId}-${side}-${i + 1}`,
    side,
    kind,
    title: DOC_KINDS[kind],
    pageLabel: `Page ${i + 1}`,
    receivedAt: new Date(Date.now() - draw.int(1, 20) * DAY).toISOString().slice(0, 10),
  }));
}

export function getCaseDocs(caseId) {
  return {
    merchant: buildDocs(caseId, 'merchant', MERCHANT_SEQUENCE),
    issuer: buildDocs(caseId, 'issuer', ISSUER_SEQUENCE),
  };
}

/* ------------------------------------------------------------------ *
 * Notes
 * ------------------------------------------------------------------ */

const NOTE_SEEDS = [
  { title: 'Evidence reviewed', text: 'Tracking confirms delivery to the buyer’s chosen pickup point. Scan weight matches the listing despatch weight.' },
  { title: 'Awaiting issuer documents', text: 'Buyer claims non-receipt. Awaiting issuer documentation before deciding the next action.' },
  { title: 'Ready to build packet', text: 'Documents complete on both sides. Ready to assemble the representment package.' },
  { title: 'Seller responded', text: 'Seller supplied the original purchase receipt and the authentication card for the item.' },
  { title: 'Escalated', text: 'Second dispute from this cardholder inside a fortnight. Flagged to fraud operations.' },
  { title: 'Below threshold', text: 'Value sits below the accept-liability threshold once handling cost is included.' },
];

export function getCaseNotes(caseId) {
  const draw = drawFor(caseId, 3);
  const count = draw.int(1, 3);

  return Array.from({ length: count }, (_, i) => {
    const seed = NOTE_SEEDS[(seedOf(caseId) + i) % NOTE_SEEDS.length];
    const author = STAFF[(seedOf(caseId) + i) % STAFF.length];
    return {
      id: `${caseId}-note-${i + 1}`,
      title: seed.title,
      text: seed.text,
      author: author.email,
      timestamp: new Date(Date.now() - (count - i) * draw.int(4, 40) * 3_600_000).toISOString(),
    };
  });
}

/* ------------------------------------------------------------------ *
 * Special instructions — these GATE BEHAVIOUR
 * ------------------------------------------------------------------ *
 * The reference rendered these as decorative bullets while every action button
 * stayed enabled. A card that says "do not write off" beside an enabled Write
 * Off button is theatre, so each instruction can declare `blocks`, and the
 * Actions card disables exactly those tiles and explains why on hover.
 */

export const INSTRUCTION_TONES = {
  danger: 'Red — blocking, action required',
  warning: 'Amber — proceed with care',
  info: 'Blue — context',
  success: 'Green — cleared',
};

export function getSpecialInstructions(caseId) {
  const c = getCase(caseId);
  if (!c) return [];

  const out = [];

  // Applies to every case — this booking product carries no cancellation coverage to reference.
  out.push({
    id: `${caseId}-si-no-cancellation`,
    tone: 'info',
    title: 'No cancellation policy purchased',
    text: 'The cardholder did not purchase purchase-protection coverage on this transaction — there is no policy to reference when evaluating the dispute.',
    blocks: [],
  });

  // A small, deterministic slice of cases — always including EXP-810063 — have a voucher on file.
  const sequence = Number(caseId.split('-')[1]);
  if (caseId === 'EXP-810063' || sequence % 97 === 0) {
    out.push({
      id: `${caseId}-si-voucher`,
      tone: 'success',
      title: 'Credit voucher available',
      text: 'A goodwill credit is on file for this cardholder and can be offered in lieu of a refund — check eligibility before representing.',
      blocks: [],
    });
  }

  // Regulatory hold on high-value fraud — genuinely blocking.
  if (c.disputeAmount >= brand.thresholds.riskAmount && c.fraudMarker === 'Confirmed Fraud') {
    out.push({
      id: `${caseId}-si-hold`,
      tone: 'danger',
      title: 'Regulatory hold',
      text: 'Confirmed fraud above the risk amount. Do not accept liability — this case must be defended or referred.',
      blocks: ['write_off'],
    });
  }

  if (c.cycleId === 'pre_arb') {
    out.push({
      id: `${caseId}-si-prearb`,
      tone: 'danger',
      title: 'Pre-arbitration',
      text: 'Pre-arbitration cannot be split. Submit a single decision for the full amount.',
      blocks: ['split_case'],
    });
  }

  if (c.docStatus === 'missing') {
    out.push({
      id: `${caseId}-si-docs`,
      tone: 'warning',
      title: 'Documents missing',
      text: 'No evidence on file. A representment without documents will almost certainly be rejected.',
      blocks: [],
    });
  }

  if (c.caseType === 'claim') {
    out.push({
      id: `${caseId}-si-escrow`,
      tone: 'info',
      title: `${brand.terms.claimProgramme}`,
      text: `No card leg on this case — resolve inside the ${brand.terms.marketplace}. Representment is unavailable.`,
      blocks: ['representment'],
    });
  }

  if (c.sellerRating < 3.8) {
    out.push({
      id: `${caseId}-si-seller`,
      tone: 'warning',
      title: `Low-rated ${brand.terms.seller}`,
      text: `${brand.terms.seller} rating is ${c.sellerRating}. Check their dispute history before defending.`,
      blocks: [],
    });
  }

  return out;
}

/** Which action tiles are blocked, and by what. */
export function blockedActions(caseId) {
  const map = new Map();
  getSpecialInstructions(caseId).forEach((si) => {
    (si.blocks ?? []).forEach((action) => {
      if (!map.has(action)) map.set(action, si);
    });
  });
  return map;
}

/* ------------------------------------------------------------------ *
 * History
 * ------------------------------------------------------------------ */

const RULE_EVENTS = [
  'Rule "Route high value" assigned queue',
  'Rule "Due date by scheme" set internal due date',
  'Rule "Zero doc indicator" flagged case',
  'Rule "Auto represent low value" evaluated',
];

const USER_EVENTS = [
  'Case assigned',
  'Status changed',
  'Document attached',
  'Note added',
  'Queue changed',
  'Case pended',
];

export function getCaseHistory(caseId) {
  const c = getCase(caseId);
  if (!c) return [];

  const draw = drawFor(caseId, 4);
  const created = new Date(c.dateCreated).getTime();
  const span = Math.max(Date.now() - created, DAY);
  const count = draw.int(5, 10);

  const events = [
    { id: `${caseId}-ev-0`, kind: 'system', action: 'Case received', detail: 'Imported from the acquirer feed.', at: new Date(created).toISOString(), user: 'System' },
  ];

  for (let i = 1; i < count; i += 1) {
    const isRule = draw.bool(0.4);
    events.push({
      id: `${caseId}-ev-${i}`,
      kind: isRule ? 'rule' : 'user',
      action: isRule ? draw.pick(RULE_EVENTS) : draw.pick(USER_EVENTS),
      detail: isRule ? 'Applied automatically by the rules engine.' : `Recorded by ${draw.pick(STAFF).email}.`,
      at: new Date(created + (span / (count + 1)) * i).toISOString(),
      user: isRule ? 'Rule engine' : draw.pick(STAFF).email,
    });
  }

  return events.sort((a, b) => new Date(b.at) - new Date(a.at));
}

/* ------------------------------------------------------------------ *
 * Case flags
 * ------------------------------------------------------------------ */

export const FLAG_DEFS = [
  { id: 'consolidated', label: 'Consolidated', tone: 'info', description: 'Linked to other cases by card, order or seller.' },
  { id: 'rfi_present', label: 'RFI Present', tone: 'info', description: 'A request for information is attached to this case.' },
  { id: 'timeframe_breached', label: 'Time Frame Breached', tone: 'danger', description: 'Past the internal due date.' },
  { id: 'pre_arbitration', label: 'Pre Arbitration', tone: 'warning', description: 'Case has reached the pre-arbitration cycle.' },
  { id: 'failed_enrichment', label: 'Failed Enrichment', tone: 'warning', description: 'Automatic data enrichment did not complete.' },
  { id: 'auto_represented', label: 'Auto Represented', tone: 'success', description: 'Submitted automatically by a rule.' },
  { id: 'high_value', label: 'High Value', tone: 'warning', description: 'At or above the configured risk amount.' },
  { id: 'docs_missing', label: 'Docs Missing', tone: 'danger', description: 'No supporting evidence on file.' },
];

export function getCaseFlags(caseId, consolidationGroups = []) {
  const c = getCase(caseId);
  if (!c) return [];

  const today = new Date().toISOString().slice(0, 10);
  const set = {
    consolidated: consolidationGroups.length > 0,
    rfi_present: c.cycleId === 'rfi',
    timeframe_breached: c.dueDate < today && !isClosed(c.status),
    pre_arbitration: c.cycleId === 'pre_arb',
    failed_enrichment: c.caseType === 'chargeback' && !c.arn,
    auto_represented: c.status === 'represented' && c.handlingMinutes === 0,
    high_value: c.disputeAmount >= brand.thresholds.riskAmount,
    docs_missing: c.docStatus === 'missing',
  };

  return FLAG_DEFS.filter((f) => set[f.id]);
}

/* ------------------------------------------------------------------ *
 * Option lists for the work-view forms
 * ------------------------------------------------------------------ */

export const REPRESENTMENT_REASONS = [
  'Compelling evidence — goods delivered',
  'Item matches the listing description',
  'Buyer no longer disputes',
  'Credit previously issued',
  'Invalid dispute — past time limit',
  'Proof of authorization / AVS match',
  'Duplicate dispute',
];

export const WRITE_OFF_REASONS = [
  'Below recovery threshold',
  'No compelling evidence available',
  `${brand.terms.seller} accepts liability`,
  'Documentation not received in time',
  'Goodwill / customer retention',
];

export const ENTITY_TEMPLATES = [
  'Request supporting documents',
  'Notify of representment',
  'Request proof of delivery',
  'Dispute accepted — no action',
  'Escalation notice',
];

export const INTERMEMBER_MESSAGES = [
  'Goods delivered as described; tracking and signature attached.',
  'Cardholder participated in the transaction; AVS and CVV matched.',
  'Refund already processed on the date shown in the attached statement.',
  'Item returned outside the returns window stated in the accepted terms.',
];

export const REFERRAL_TARGETS = ['Airline', 'Hotel', 'Supervisor', 'OTA', 'Other'];

export const PEND_REASONS = [
  `Awaiting ${brand.terms.seller} documents`,
  'Awaiting issuer response',
  `Awaiting ${brand.terms.buyer} response`,
  'Awaiting authentication report',
  'Awaiting carrier investigation',
];

export const ASSIGN_SKILLS = ['All Dispute Response', 'Buyer Protection Response', 'High Value Access', 'Pre-Arbitration', 'Authenticity Review'];

export const ASSIGN_USERS = STAFF.filter((u) => u.status === 'Active').map((u) => u.email);

export const CURRENT_USER_EMAIL = CURRENT_USER.email;

/* ------------------------------------------------------------------ *
 * Card transaction history — the TRANSACTION HISTORY accordion
 * ------------------------------------------------------------------ */

export function getCardTransactions(caseId) {
  const c = getCase(caseId);
  if (!c || c.caseType !== 'chargeback') return [];

  const draw = drawFor(caseId, 5);
  const count = draw.int(3, 6);

  return Array.from({ length: count }, (_, i) => ({
    id: `${caseId}-txn-${i + 1}`,
    date: new Date(new Date(c.transDate).getTime() - i * draw.int(3, 30) * DAY).toISOString().slice(0, 10),
    description: i === 0 ? c.itemTitle : `${brand.name} order`,
    amount: i === 0 ? c.transactionAmount : draw.money(8, 220),
    currency: c.currency,
    status: i === 0 ? 'Disputed' : draw.pick(['Settled', 'Settled', 'Refunded']),
  }));
}
