/**
 * PRE-DISPUTE ALERTS — RDR, Ethoca and Verifi.
 *
 * A different animal from the operational alerts on the other tab, and the
 * distinction is the whole point of the screen:
 *
 *   · An operational alert says a case in this console needs attention.
 *   · A PRE-DISPUTE alert arrives from the networks BEFORE a chargeback
 *     exists. Refund inside the window and the chargeback never happens —
 *     no representment, no scheme fee, no effect on the dispute ratio.
 *
 * The money argument is the ratio, not the refund. Refunding a €40 order that
 * would have been lost anyway saves €40 and a scheme fee; keeping the
 * chargeback count down is what keeps the account out of a monitoring
 * programme, which costs vastly more than the refunds do.
 *
 * WHY THESE ARE BUILT FROM THE REAL BOOK. An alert that references an order
 * nobody can find teaches a reviewer nothing. Most alerts here point at real
 * orders that never became chargebacks — deflected — and a deliberate handful
 * point at orders that DID, which is how the "already a chargeback" outcome
 * gets to be real rather than a label in a dropdown. That overlap is the
 * number worth arguing about: an alert that arrives after the chargeback is an
 * alert you paid for and could not use.
 */

import brand from '@/brand/brand.config';
import createDraw from '@/data/rng';
import { CASES } from '@/data/cases';

const DAY = 86_400_000;
const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

/* ------------------------------------------------------------------ *
 * Reference
 * ------------------------------------------------------------------ */

/**
 * Who sends the alert. Each network runs its own programme and they behave
 * differently, which is why the source column earns its place: RDR refunds
 * automatically under a rule you set with Visa, while an Ethoca alert is a
 * notification you still have to act on.
 */
export const ALERT_SOURCES = [
  { id: 'rdr', label: 'RDR', network: 'Visa', auto: true, description: 'Visa Rapid Dispute Resolution. Resolves to your standing rule automatically — you never touch it, and it cannot become a chargeback.' },
  { id: 'ethoca', label: 'Ethoca', network: 'Mastercard', auto: false, description: 'Mastercard’s alert network. A notification you must action inside the window, usually 24-72 hours.' },
  { id: 'verifi_cdrn', label: 'Verifi CDRN', network: 'Visa', auto: false, description: 'Verifi’s Cardholder Dispute Resolution Network. Manual resolution, wider issuer coverage than RDR.' },
  { id: 'order_insight', label: 'Order Insight', network: 'Visa', auto: false, description: 'Sends order detail back to the issuer while the cardholder is still on the phone. Often ends the query with no refund at all.' },
  { id: 'consumer_clarity', label: 'Consumer Clarity', network: 'Mastercard', auto: false, description: 'Mastercard’s equivalent enquiry service — richer transaction detail at the point the cardholder questions it.' },
];

export const getSource = (id) => ALERT_SOURCES.find((s) => s.id === id) ?? ALERT_SOURCES[0];

export const ALERT_OUTCOMES = [
  { id: 'refunded', label: 'Refunded', tone: 'success', deflected: true, description: 'Refunded inside the window. The chargeback never happened.' },
  { id: 'resolved_no_refund', label: 'Resolved, no refund', tone: 'success', deflected: true, description: 'The issuer accepted the order detail and the cardholder withdrew. Best possible outcome — deflected without paying.' },
  { id: 'already_refunded', label: 'Already refunded', tone: 'info', deflected: true, description: 'We had already refunded before the alert arrived.' },
  { id: 'already_chargeback', label: 'Already a chargeback', tone: 'danger', deflected: false, description: 'The alert arrived after the chargeback was raised. Paid for, and too late to use.' },
  { id: 'no_match', label: 'No match', tone: 'muted', deflected: false, description: 'No order in the book matched the alert.' },
];

export const getOutcome = (id) => ALERT_OUTCOMES.find((o) => o.id === id) ?? ALERT_OUTCOMES[4];

export const ALERT_STATUSES = [
  { id: 'open', label: 'Open', tone: 'warning' },
  { id: 'resolved', label: 'Resolved', tone: 'success' },
  { id: 'expired', label: 'Expired', tone: 'danger' },
];

export const getAlertStatus = (id) => ALERT_STATUSES.find((s) => s.id === id) ?? ALERT_STATUSES[0];

/* ------------------------------------------------------------------ *
 * Generation
 * ------------------------------------------------------------------ */

const SEED = 5140977;
const COUNT = 240;

/** Response windows differ by programme and drive the expiry clock. */
const WINDOW_HOURS = { rdr: 0, ethoca: 24, verifi_cdrn: 72, order_insight: 24, consumer_clarity: 24 };

function build() {
  const draw = createDraw(SEED);

  // Chargebacks in the book, used to plant the "arrived too late" overlap.
  const chargebacks = CASES.filter((c) => c.caseType === 'chargeback');

  return Array.from({ length: COUNT }, (_, i) => {
    /*
     * One alert in nine points at an order that already became a chargeback.
     * That is the number the account manager is asked about, so it has to come
     * from the same book the chargeback screens read rather than being a
     * sprinkling of a label.
     */
    const tooLate = i % 9 === 0 && chargebacks.length > 0;
    const linked = tooLate ? chargebacks[(i * 7) % chargebacks.length] : null;

    const source = draw.weighted([
      ['ethoca', 30], ['rdr', 26], ['verifi_cdrn', 20], ['order_insight', 14], ['consumer_clarity', 10],
    ]);
    const spec = getSource(source);

    const alertedMs = NOW - draw.int(0, 45) * DAY - draw.int(0, 23) * 3_600_000;
    const transMs = alertedMs - draw.int(1, 9) * DAY;
    const expiresMs = alertedMs + (WINDOW_HOURS[source] ?? 24) * 3_600_000;

    // RDR resolves itself, so it is never open and never expires.
    const status = spec.auto
      ? 'resolved'
      : expiresMs < NOW
        ? draw.weighted([['resolved', 78], ['expired', 22]])
        : 'open';

    const outcome = tooLate
      ? 'already_chargeback'
      : status === 'open'
        ? null
        : spec.auto
          ? 'refunded'
          : draw.weighted([
            ['refunded', 54],
            ['resolved_no_refund', source === 'order_insight' ? 30 : 12],
            ['already_refunded', 10],
            ['no_match', 6],
          ]);

    const amount = linked ? linked.disputeAmount : draw.money(8, 240);

    return {
      id: `ALT-${1750000 + i * 7 + draw.int(0, 5)}`,
      source,
      sourceLabel: spec.label,
      network: spec.network,
      status,
      outcome,
      orderId: linked ? linked.orderId : `ORD-${draw.digits(8)}`,
      caseId: linked ? linked.id : null,
      amount,
      currency: brand.currency,
      cardBrand: linked ? linked.networkLabel : draw.pick(brand.schemes).label,
      last4: linked ? linked.ccLast4 : String(draw.int(1000, 9999)),
      entityLabel: linked ? linked.entityLabel : draw.pick(brand.entities).label,
      buyer: linked ? linked.buyer : null,
      alertDate: iso(alertedMs),
      alertedAt: new Date(alertedMs).toISOString(),
      transDate: iso(transMs),
      expiresAt: new Date(expiresMs).toISOString(),
      hoursLeft: Math.round((expiresMs - NOW) / 3_600_000),
      autoResolved: spec.auto,
      resolvedBy: spec.auto ? 'Auto rule' : status === 'open' ? '—' : draw.pick(['matteo.rossi', 'lena.fischer', 'zofia.nowak', 'petr.svoboda']) + `@${brand.emailDomain}`,
    };
  });
}

export const PRE_DISPUTE_ALERTS = build();

/* ------------------------------------------------------------------ *
 * Derived
 * ------------------------------------------------------------------ */

export function preDisputeKpis(rows = PRE_DISPUTE_ALERTS) {
  const resolved = rows.filter((a) => a.status === 'resolved');
  const deflected = resolved.filter((a) => getOutcome(a.outcome).deflected);
  const tooLate = rows.filter((a) => a.outcome === 'already_chargeback');
  const refunded = resolved.filter((a) => a.outcome === 'refunded');

  return {
    total: rows.length,
    open: rows.filter((a) => a.status === 'open').length,
    expired: rows.filter((a) => a.status === 'expired').length,
    autoResolved: rows.filter((a) => a.autoResolved).length,
    deflected: deflected.length,
    /** The headline: share of alerts that stopped a chargeback happening. */
    deflectionRate: rows.length ? (deflected.length / rows.length) * 100 : 0,
    refundValue: Math.round(refunded.reduce((s, a) => s + a.amount, 0) * 100) / 100,
    /**
     * What deflection was worth. The refund itself is not a saving — that
     * money was going out either way once the cardholder disputed. The saving
     * is the scheme fee and the handling time avoided, plus the chargeback
     * never counting against the ratio.
     */
    feesAvoided: Math.round(deflected.length * 15 * 100) / 100,
    tooLate: tooLate.length,
    tooLateValue: Math.round(tooLate.reduce((s, a) => s + a.amount, 0) * 100) / 100,
  };
}

export const bySource = (rows = PRE_DISPUTE_ALERTS) =>
  ALERT_SOURCES.map((s) => {
    const mine = rows.filter((a) => a.source === s.id);
    const deflected = mine.filter((a) => getOutcome(a.outcome).deflected);
    return {
      ...s,
      count: mine.length,
      deflected: deflected.length,
      rate: mine.length ? (deflected.length / mine.length) * 100 : 0,
      value: Math.round(mine.reduce((sum, a) => sum + a.amount, 0) * 100) / 100,
    };
  }).filter((s) => s.count > 0);

/* ------------------------------------------------------------------ *
 * Auto-resolve rules
 * ------------------------------------------------------------------ *
 * The operational point of the screen: alerts arrive around the clock with
 * windows as short as 24 hours, so anything that depends on an analyst being
 * awake will expire. These resolve inbound alerts before a human sees them.
 */
export const AUTO_RULES = [
  {
    id: 'par-1',
    name: 'Low-value instant refund',
    criteria: `Amount under ${brand.currency} 75 · any source`,
    action: 'Refund',
    enabled: true,
    matched30: 214,
  },
  {
    id: 'par-2',
    name: 'RDR standing rule',
    criteria: 'Source is RDR · any amount',
    action: 'Refund',
    enabled: true,
    matched30: 96,
  },
  {
    id: 'par-3',
    name: 'High value to an analyst',
    criteria: `Amount over ${brand.currency} ${brand.thresholds.riskAmount} · any source`,
    action: 'Route to analyst',
    enabled: true,
    matched30: 38,
  },
  {
    id: 'par-4',
    name: 'Repeat cardholder review',
    criteria: 'Second alert on the same card inside 30 days',
    action: 'Route to fraud team',
    enabled: false,
    matched30: 12,
  },
];

export const RULE_ACTIONS = ['Refund', 'Route to analyst', 'Route to fraud team', 'Decline'];
