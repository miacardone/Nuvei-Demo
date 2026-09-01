/**
 * The demo book: ~1,200 cases across both intake paths.
 *
 * TWO PROPERTIES PULL AGAINST EACH OTHER:
 *
 * 1. Determinism — everything is drawn from one fixed seed, so the tables,
 *    charts and consolidation groups are identical on every reload.
 *
 * 2. Live dates — if the seed also froze the calendar, every due date would be
 *    stale by the time anyone ran the demo. So dates anchor to now() at module
 *    load and the seed controls the OFFSETS.
 *
 * Two invariants the generator guarantees, both previously broken:
 *   · Presentment never post-dates today. A short window (Amex + RFI computes
 *     to a NEGATIVE window) combined with a far-future due date used to place
 *     the presentment in the future. `windowDays` is floored and the due offset
 *     is clamped to it.
 *   · Consolidation lands in the 10-15% band. Sharing is planted deliberately
 *     rather than left to emerge — see the SHARING block.
 */

import brand from '@/brand/brand.config';
import createDraw from '@/data/rng';
import {
  CARRIERS, CONDITIONS, FIRST_NAMES, FRAUD_MARKERS, ITEMS, LAST_NAMES, LAST_NOTES,
  MARKET_CITIES, SALES_METHODS, SELLER_HANDLES, TRANSACTION_TYPES,
} from '@/data/catalogue';
import { ASSIGNABLE, REVIEWER_OPTIONS } from '@/data/people';
import { isClosed } from '@/domain/statuses';

const SEED = 20260806;
const COUNT = 1200;

/** Captured once so every date in the book shares one reference point. */
const NOW = Date.now();
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const isoAt = (ms) => new Date(ms).toISOString();

/* ------------------------------------------------------------------ *
 * Distributions
 * ------------------------------------------------------------------ */

const STATUS_WEIGHTS = [
  ['ready', 30], ['open', 10], ['assigned', 9], ['working', 8], ['pended', 6],
  ['represented', 12], ['completed', 13], ['rejected', 5], ['expired', 3], ['written_off', 4],
];

/**
 * TENANT LEAK CONVERTED. The reference keyed entity weights to literal ids.
 * Deriving positionally from the tenant's own list means a second tenant with
 * different entity ids still gets a valid distribution instead of `undefined`.
 */
const ENTITY_WEIGHT_BY_POSITION = [64, 24, 12];
const ENTITY_WEIGHTS = brand.entities.map((e, i) => [e.id, ENTITY_WEIGHT_BY_POSITION[i] ?? 5]);

const SCHEME_WEIGHTS = [['visa', 52], ['mastercard', 38], ['amex', 10]];
const CYCLE_WEIGHTS = [['first_cb', 58], ['second_cb', 17], ['pre_arb', 9], ['retrieval', 8], ['rfi', 8]];
const DOC_WEIGHTS = [['received', 46], ['pending', 26], ['missing', 16], ['not_required', 12]];

/**
 * Which queue a case lands in. Queue ids are shared across tenants by design.
 * This taxonomy is chargeback/fraud-ops specific (no dedicated claims queue) —
 * claims land in the general landing queue alongside everything else unsorted.
 */
function queueFor(caseType, reasonCode, reasonCategory, amount, cycleId, fraudMarker) {
  if (caseType === 'claim') return 'all_chargebacks';
  if (fraudMarker === 'Confirmed Fraud' && amount >= brand.thresholds.riskAmount) return 'supervisor';
  if (cycleId === 'second_cb' || cycleId === 'pre_arb') return 'arbitration_chargebacks';
  if (amount < brand.thresholds.minimumProcessingAmount) return 'below_minimum_value';
  if (amount >= brand.thresholds.routingHighValue) return 'high_value_chargebacks';
  if (reasonCategory === 'fraud') return 'bank_fraud_code';
  if (fraudMarker === 'Confirmed Fraud') return 'analyst_confirmed_fraud';
  if (fraudMarker === 'Suspected Fraud' || fraudMarker === 'Fraud Reported by Issuer') return 'analyst_non_fraud';
  return 'bank_non_fraud_code';
}

/* ------------------------------------------------------------------ *
 * SHARING — how consolidation groups are planted
 * ------------------------------------------------------------------ *
 * Left to chance across 1,200 cases, shared sellers either never happen or
 * snowball. These counts are tuned against the measured flag rate; changing
 * them changes how much of the book carries the flag.
 *
 * Every case starts with a UNIQUE card, order and seller. Sharing is then
 * introduced only on the index sets chosen below, which are disjoint so the
 * three rules do not interfere.
 */
const SHARING = {
  cardGroups: 40,      // sizes 2-3, chargebacks only (a claim has no card leg)
  orderGroups: 15,     // size 2; a third of them span both channels
  sellerGroups: 9,     // sizes 3-4, forced open and inside the 30-day window
  crossChannelEvery: 3, // every Nth order group is chargeback + claim
};

/* ------------------------------------------------------------------ *
 * Generator
 * ------------------------------------------------------------------ */

function buildPeople(draw) {
  const buyers = Array.from({ length: 420 }, (_, i) => {
    const market = draw.pick(brand.markets);
    const name = `${draw.pick(FIRST_NAMES)} ${draw.pick(LAST_NAMES)}`;
    return {
      id: `BYR-${100000 + i * 7}`,
      name,
      // Consumer address, deliberately on a neutral domain — the buyer is not
      // an employee of the tenant.
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@mail.example`,
      market,
      city: draw.pick(MARKET_CITIES[market] ?? ['—']),
    };
  });

  // One seller per case to start with; sharing is planted, never accidental.
  const sellers = Array.from({ length: COUNT }, (_, i) => {
    const handle = `${SELLER_HANDLES[i % SELLER_HANDLES.length]}_${Math.floor(i / SELLER_HANDLES.length) + 1}`;
    const market = draw.pick(brand.markets);
    return {
      id: `SLR-${200000 + i * 3}`,
      name: `@${handle}`,
      handle,
      market,
      rating: Math.round(draw.float(3.3, 5) * 10) / 10,
      sales: draw.int(8, 2600),
    };
  });

  return { buyers, sellers: draw.shuffle(sellers) };
}

function generate() {
  const draw = createDraw(SEED);
  const { buyers, sellers } = buildPeople(draw);
  const { schemeDays, cycleDays, claimDays, internalBufferDays } = brand.dueDateOffsets;

  const cases = Array.from({ length: COUNT }, (_, index) => {
    // Exactly 1 in 3 is a claim — the 2:1 chargeback-to-claim split.
    const caseType = index % 3 === 2 ? 'claim' : 'chargeback';

    const status = draw.weighted(STATUS_WEIGHTS);
    const closed = isClosed(status);

    const entityId = draw.weighted(ENTITY_WEIGHTS);
    const entity = brand.entities.find((e) => e.id === entityId);

    const itemSpec = draw.pick(ITEMS);
    const itemPrice = draw.money(itemSpec.low, itemSpec.high);
    const shipping = draw.money(2.5, 9.9);
    const orderTotal = Math.round((itemPrice + shipping) * 100) / 100;
    const disputeAmount = draw.bool(0.84) ? orderTotal : Math.round(orderTotal * draw.float(0.35, 0.8) * 100) / 100;

    const buyer = draw.pick(buyers);
    const seller = sellers[index];
    const market = buyer.market;

    /* --- Reason, scheme, cycle ------------------------------------------ */
    let network = null;
    let networkLabel = null;
    let reasonCode;
    let reasonLabel;
    let reasonCategory;
    let cycleId = null;
    let cycleLabel = null;

    if (caseType === 'chargeback') {
      const schemeId = draw.weighted(SCHEME_WEIGHTS);
      const scheme = brand.schemes.find((s) => s.id === schemeId);
      const rc = draw.pick(scheme.reasonCodes);
      network = scheme.id;
      networkLabel = scheme.label;
      reasonCode = rc.code;
      reasonLabel = rc.label;
      reasonCategory = rc.category;

      const drawnCycle = draw.weighted(CYCLE_WEIGHTS);
      const cycle = brand.cycles.find((c) => c.id === drawnCycle);
      cycleId = cycle.id;
      cycleLabel = cycle.label;
    } else {
      const reason = draw.pick(brand.claimReasons);
      reasonCode = reason.id;
      reasonLabel = reason.label;
      reasonCategory = reason.category;
    }

    /* --- Dates ------------------------------------------------------------ *
     * Work backwards from the due date so the queue always holds live work.
     * windowDays is floored at 5: Amex(20) + RFI(-18) - buffer(4) computes to
     * -2, which would otherwise invert the arithmetic and post-date the
     * presentment. The due offset is then clamped so dateCreated <= yesterday. */
    const rawWindow =
      caseType === 'claim'
        ? claimDays - internalBufferDays
        : schemeDays[network] + cycleDays[cycleId] - internalBufferDays;
    const windowDays = Math.max(5, rawWindow);

    const drawnOffset = closed
      ? -draw.int(2, 60)
      : draw.weighted([
          [-draw.int(1, 4), 10],   // overdue but still open
          [draw.int(0, 2), 15],
          [draw.int(3, 8), 32],
          [draw.int(9, 18), 28],
          [draw.int(19, 30), 15],
        ]);

    const dueOffsetDays = Math.min(drawnOffset, windowDays - 1);
    const dueMs = NOW + dueOffsetDays * DAY;
    const createdMs = dueMs - windowDays * DAY;
    const networkDueMs = createdMs + (caseType === 'chargeback' ? schemeDays[network] : claimDays) * DAY;

    const orderPlacedMs = createdMs - draw.int(4, 45) * DAY;
    const transMs = orderPlacedMs + draw.int(0, 2) * DAY;
    const postMs = transMs + draw.int(1, 3) * DAY;
    // When the booked travel itself happens — separate from the dispute
    // timeline. Wide window (well before to well after the order) so some
    // bookings are for travel that hasn't happened yet.
    const serviceMs = orderPlacedMs + draw.int(10, 150) * DAY;

    /* --- Ownership --------------------------------------------------------- */
    const needsOwner = ['assigned', 'working', 'pended', 'represented'].includes(status);
    const owner = needsOwner ? draw.pick(ASSIGNABLE) : null;

    const fraudMarker = draw.weighted([['No Fraud Marker', 68], ['Suspected Fraud', 16], ['Confirmed Fraud', 9], ['Fraud Reported by Issuer', 7]]);
    const queueId = queueFor(caseType, reasonCode, reasonCategory, disputeAmount, cycleId, fraudMarker);
    const queue = brand.queues.find((q) => q.id === queueId);

    const sequence = brand.numbering.nextSequence + index + 1;
    const id = `${brand.numbering.prefix}${brand.numbering.separator}${sequence}`;

    /* --- Card leg ---------------------------------------------------------- */
    const scheme = network ? brand.schemes.find((s) => s.id === network) : null;
    const bin = scheme ? `${scheme.binPrefix}${draw.digits(5)}` : null;
    const last4 = draw.digits(4);
    const mcc = draw.pick(brand.mccs);

    const outcome = closed
      ? status === 'completed' ? 'won'
        : status === 'written_off' ? 'written_off'
          : 'lost'
      : status === 'represented' ? 'pending' : 'pending';

    return {
      id,
      sequence,
      caseType,
      status,
      queueId,
      queueLabel: queue.label,

      worker: owner?.email ?? '—',
      workerName: owner?.name ?? null,
      workerInitials: owner?.initials ?? null,
      reviewer: needsOwner ? draw.pick(REVIEWER_OPTIONS) : '—',
      assignmentReason: needsOwner ? draw.pick(brand.assignmentReasons).label : '—',

      disputeAmount,
      caseAmount: orderTotal,
      transactionAmount: orderTotal,
      currency: brand.currency,

      entityId,
      entityLabel: entity.label,
      entityDescriptor: entity.descriptor,
      mid: entity.mid,
      market,
      partyId: `PTY-${300000 + index * 11}`,

      network,
      networkLabel,
      reasonCode,
      reasonLabel,
      reasonCategory,
      reasonDescription: reasonLabel,
      cycleId,
      cycleLabel,
      cardType: caseType === 'chargeback' ? draw.pick(brand.cardTypes) : null,
      cardholder: caseType === 'chargeback' ? `${draw.pick(FIRST_NAMES)} ${draw.pick(LAST_NAMES)}` : null,
      arn: caseType === 'chargeback' ? `${draw.digits(2)}${draw.digits(21)}` : null,
      acquirerCaseNumber: caseType === 'chargeback' ? `${draw.pick(brand.acquirers).slice(0, 3).toUpperCase()}-${draw.digits(7)}` : null,
      acquirer: caseType === 'chargeback' ? draw.pick(brand.acquirers) : null,
      pan: caseType === 'chargeback' ? `${bin.slice(0, 4)} ${bin.slice(4)}•• •••• ${last4}` : null,
      ccBin: bin,
      ccLast4: last4,
      mcc: mcc.code,
      mccLabel: mcc.label,

      paymentMethod: draw.pick(brand.paymentMethods),
      transactionType: draw.weighted([['Sale', 82], ['Refund', 8], ['Authorization', 6], ['Recurring', 4]]),
      salesMethod: draw.weighted([['Ecommerce', 52], ['Mobile App', 40], ['MOTO', 4], ['Recurring Billing', 4]]),
      fraudMarker,

      dueDate: iso(dueMs),
      networkDueDate: iso(networkDueMs),
      dateCreated: iso(createdMs),
      firstDate: iso(createdMs),
      postDate: iso(postMs),
      transDate: iso(transMs),
      orderPlacedAt: iso(orderPlacedMs),
      serviceDate: iso(serviceMs),
      updatedAt: isoAt(NOW - draw.int(0, 96) * 3_600_000),
      agingDays: Math.floor((dueMs - NOW) / DAY),

      orderId: `ORD-${draw.digits(8)}`,
      merchantRef: `MREF-${draw.digits(7)}`,
      itemTitle: itemSpec.title,
      itemCategory: itemSpec.category,
      itemPrice,
      itemCondition: draw.pick(CONDITIONS),
      shipping,
      carrier: draw.pick(CARRIERS),
      tracking: `${draw.digits(3)}-${draw.digits(9)}`,

      buyerId: buyer.id,
      buyer: buyer.name,
      buyerEmail: buyer.email,
      buyerCity: buyer.city,
      sellerId: seller.id,
      seller: seller.name,
      sellerHandle: seller.handle,
      sellerRating: seller.rating,
      sellerSales: seller.sales,

      docStatus: draw.weighted(DOC_WEIGHTS),
      outcome,
      merchantDocs: draw.bool(0.7),
      issuerDocs: draw.bool(0.55),
      lastNote: draw.pick(LAST_NOTES),
      handlingMinutes: needsOwner || closed ? draw.int(4, 48) : 0,
      touches: needsOwner ? draw.int(1, 9) : 0,
    };
  });

  applySharing(cases, createDraw(SEED + 17));
  return cases;
}

/* ------------------------------------------------------------------ *
 * Planting
 * ------------------------------------------------------------------ */

/** Disjoint index pools so the three rules never contend for the same case. */
function takePool(draw, used, predicate, size) {
  const out = [];
  let guard = 0;
  while (out.length < size && guard < COUNT * 6) {
    const i = draw.int(0, COUNT - 1);
    guard += 1;
    if (used.has(i)) continue;
    if (!predicate(i)) continue;
    used.add(i);
    out.push(i);
  }
  return out;
}

function applySharing(cases, draw) {
  const used = new Set();
  const isCb = (i) => cases[i].caseType === 'chargeback';
  const isClaimCase = (i) => cases[i].caseType === 'claim';

  /* --- Same card: chargebacks only ------------------------------------- */
  for (let g = 0; g < SHARING.cardGroups; g += 1) {
    const size = draw.bool(0.65) ? 2 : 3;
    const members = takePool(draw, used, isCb, size);
    if (members.length < 2) continue;

    const anchor = cases[members[0]];
    members.forEach((i, pos) => {
      const c = cases[i];
      c.ccBin = anchor.ccBin;
      c.ccLast4 = anchor.ccLast4;
      c.pan = anchor.pan;
      c.cardholder = anchor.cardholder;
      c.network = anchor.network;
      c.networkLabel = anchor.networkLabel;
      if (pos > 0) shiftDates(c, anchor, draw.int(2, 60));
    });
  }

  /* --- Same order: some spanning both channels -------------------------- */
  for (let g = 0; g < SHARING.orderGroups; g += 1) {
    const crossChannel = g % SHARING.crossChannelEvery === 0;
    const members = crossChannel
      ? [...takePool(draw, used, isCb, 1), ...takePool(draw, used, isClaimCase, 1)]
      : takePool(draw, used, isCb, 2);
    if (members.length < 2) continue;

    const anchor = cases[members[0]];
    members.forEach((i, pos) => {
      const c = cases[i];
      c.orderId = anchor.orderId;
      c.itemTitle = anchor.itemTitle;
      c.itemCategory = anchor.itemCategory;
      c.itemPrice = anchor.itemPrice;
      c.buyerId = anchor.buyerId;
      c.buyer = anchor.buyer;
      c.sellerId = anchor.sellerId;
      c.seller = anchor.seller;
      c.sellerHandle = anchor.sellerHandle;
      c.sellerRating = anchor.sellerRating;
      c.disputeAmount = anchor.disputeAmount;
      c.caseAmount = anchor.caseAmount;
      if (pos > 0) shiftDates(c, anchor, draw.int(1, 20));
    });

    // The cross-channel pair is the whole point of the hybrid model, so both
    // sides stay open and workable — a closed case cannot be double-refunded.
    if (crossChannel) {
      members.forEach((i, pos) => {
        const c = cases[i];
        c.status = pos === 0 ? 'working' : 'assigned';
        c.outcome = 'pending';
        c.queueId = 'all_chargebacks';
        c.queueLabel = brand.queues.find((q) => q.id === c.queueId).label;
      });
    }
  }

  /* --- Same seller: open only, inside the 30-day window ------------------ */
  const openStatuses = ['ready', 'assigned', 'working', 'pended', 'open'];
  for (let g = 0; g < SHARING.sellerGroups; g += 1) {
    const size = draw.bool(0.6) ? 3 : 4;
    const members = takePool(draw, used, () => true, size);
    if (members.length < 3) continue;

    const anchor = cases[members[0]];
    members.forEach((i, pos) => {
      const c = cases[i];
      c.sellerId = anchor.sellerId;
      c.seller = anchor.seller;
      c.sellerHandle = anchor.sellerHandle;
      c.sellerRating = anchor.sellerRating;
      // The rule is open-only inside 30 days; both must hold or the group
      // silently fails to form.
      c.status = openStatuses[pos % openStatuses.length];
      c.outcome = 'pending';
      const createdMs = NOW - draw.int(2, 26) * DAY;
      recomputeDates(c, createdMs);
    });
  }
}

/** Moves a case's whole date block to sit `offsetDays` after an anchor. */
function shiftDates(c, anchor, offsetDays) {
  const createdMs = new Date(anchor.dateCreated).getTime() + offsetDays * DAY;
  recomputeDates(c, Math.min(createdMs, NOW - DAY));
}

/** Rebuilds every derived date from a new creation date, preserving the window. */
function recomputeDates(c, createdMs) {
  const { schemeDays, cycleDays, claimDays, internalBufferDays } = brand.dueDateOffsets;
  const rawWindow =
    c.caseType === 'claim'
      ? claimDays - internalBufferDays
      : schemeDays[c.network] + cycleDays[c.cycleId] - internalBufferDays;
  const windowDays = Math.max(5, rawWindow);

  const safeCreated = Math.min(createdMs, NOW - DAY);
  const dueMs = safeCreated + windowDays * DAY;

  c.dateCreated = iso(safeCreated);
  c.firstDate = c.dateCreated;
  c.dueDate = iso(dueMs);
  c.networkDueDate = iso(safeCreated + (c.caseType === 'chargeback' ? schemeDays[c.network] : claimDays) * DAY);
  c.agingDays = Math.floor((dueMs - NOW) / DAY);
  c.orderPlacedAt = iso(safeCreated - 12 * DAY);
  c.transDate = iso(safeCreated - 11 * DAY);
  c.postDate = iso(safeCreated - 9 * DAY);
  c.serviceDate = iso(safeCreated - 12 * DAY + 45 * DAY);
}

export const CASES = generate();

export const CASE_BY_ID = Object.fromEntries(CASES.map((c) => [c.id, c]));

export const getCases = () => CASES;
export const getCase = (id) => CASE_BY_ID[id] ?? null;

/** Cases an analyst can pick up and work. */
export const getWorkableCases = () =>
  CASES.filter((c) => ['ready', 'assigned', 'working', 'pended'].includes(c.status));

export default CASES;
