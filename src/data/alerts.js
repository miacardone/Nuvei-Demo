/**
 * Early-warning alerts.
 *
 * A network alert (Verifi CDRN, Visa RDR, Ethoca) arrives BEFORE a chargeback
 * is filed — refund in time and the chargeback never happens. That is a
 * different product to the case book: it has its own short clock (a few days,
 * not the scheme's full window), its own outcome vocabulary, and it is billed
 * per alert rather than per case.
 *
 * Nutrameg is single-tenant, unlike a multi-client alerts platform, so the
 * "client" rollup dimension here is the tenant's own three entities rather
 * than an invented client roster.
 */

import brand from '@/brand/brand.config';
import createDraw from '@/data/rng';
import { CASES } from '@/data/cases';
import { ASSIGNABLE, USERS } from '@/data/people';

const DAY = 86_400_000;
const NOW = Date.now();
const SEED = 20260812;

export const ALERT_SOURCES = [
  { id: 'verifi_cdrn', label: 'Verifi CDRN', network: 'Visa' },
  { id: 'visa_rdr', label: 'Visa RDR', network: 'Visa' },
  { id: 'ethoca', label: 'Ethoca', network: 'Mastercard' },
];

export const findSource = (id) => ALERT_SOURCES.find((s) => s.id === id) ?? null;

export const ALERT_OUTCOMES = [
  { id: 'open', label: 'Open', tone: 'warning' },
  { id: 'refunded', label: 'Refunded', tone: 'success' },
  { id: 'ineligible', label: 'Ineligible', tone: 'muted' },
  { id: 'expired', label: 'Expired', tone: 'danger' },
];

export const findOutcome = (id) => ALERT_OUTCOMES.find((o) => o.id === id) ?? null;

/** Statement descriptors a network alert arrives carrying — matched to route it
 *  to an entity.
 *
 *  Derived POSITIONALLY from brand.entities rather than keyed on literal entity
 *  ids. A table keyed on one tenant's ids silently produces entity-less rows the
 *  moment another tenant is generated — the exact failure brand.config.js
 *  documents for ENTITY_WEIGHTS. Suffixes are per-entity shapes, not names. */
const DESCRIPTOR_SUFFIXES = [
  ['*ECOM', ' PAYMENTS', '*ONLINE'],
  [' IN-STORE', '*POS', ' TERMINAL'],
  ['*PAYLINK', ' INVOICE', '*REMOTE'],
];

const descriptorStem = (label) => label.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

const IDENTIFIER_SEED = brand.entities.flatMap((entity, i) =>
  (DESCRIPTOR_SUFFIXES[i % DESCRIPTOR_SUFFIXES.length]).map((suffix) => ({
    entityId: entity.id,
    mid: entity.mid,
    identifier: `${descriptorStem(entity.label)}${suffix}`,
  })),
);

export const IDENTIFIERS = IDENTIFIER_SEED.map((row, i) => ({
  id: `id${i + 1}`,
  ...row,
  active: i !== 5, // one inactive, so Identifiers has something to demonstrate re-enabling
}));

/** Who gets emailed when an alert lands for that entity. */
const staffFor = (email) => USERS.find((u) => u.email === email) ?? USERS[2];

export const CONTACT_EMAILS = brand.entities.flatMap((e, i) => {
  const staff = staffFor(USERS[(i * 3 + 2) % USERS.length]?.email);
  return [
    { id: `ce${i * 2 + 1}`, entityId: e.id, name: staff?.name ?? 'Ops team', email: staff?.email ?? `alerts@${brand.emailDomain}` },
    { id: `ce${i * 2 + 2}`, entityId: e.id, name: `${e.label} alerts distro`, email: `${e.id.replace(/_/g, '-')}-alerts@${brand.emailDomain}` },
  ];
});

/** Per entity: overall service level, plus autocomplete (auto-refund) per source. */
export const SELF_SERVICE = brand.entities.map((e, i) => ({
  entityId: e.id,
  serviceLevel: i === 2 ? 'Full Service' : 'Self Service',
  autoComplete: {
    verifi_cdrn: i === 2,
    visa_rdr: false,
    ethoca: i === 1,
  },
}));

/** No access | Alerts User | Alerts Manager — leadership and managers get Manager, most
 *  operational staff get User, and a couple of niche groups (Weekend Cover, Authenticity)
 *  don't touch alerts day to day, same as they wouldn't in a real access model. */
export const ALERTS_ROLES = ['No access', 'Alerts User', 'Alerts Manager'];

const roleFor = (u) => {
  if (u.roleId === 'admin' || u.roleId === 'manager') return 'Alerts Manager';
  if (['Weekend Cover', 'Authenticity'].includes(u.group)) return 'No access';
  return 'Alerts User';
};

export const AGENT_ROLES = USERS.filter((u) => u.status === 'Active').map((u) => ({
  userId: u.id,
  name: u.name,
  email: u.email,
  alertsRole: roleFor(u),
}));

export const findAgentRole = (email) => AGENT_ROLES.find((a) => a.email === email) ?? null;

/** Agents eligible to work alert queues — anyone with the User or Manager role. */
const ELIGIBLE_AGENTS = AGENT_ROLES.filter((a) => a.alertsRole !== 'No access').map((a) => a.email);

/** Which entities each eligible agent can work — round-robin, 2 entities each. */
export const WORKABLE_ENTITIES = Object.fromEntries(
  brand.entities.map((e, i) => [
    e.id,
    ELIGIBLE_AGENTS.filter((_, idx) => idx % brand.entities.length === i || idx % brand.entities.length === (i + 1) % brand.entities.length),
  ]),
);

export const canWork = (email, entityId) => (WORKABLE_ENTITIES[entityId] ?? []).includes(email);

/* ------------------------------------------------------------------ *
 * Alert generation — one book per entity, anchored to now() like cases.js.
 * ------------------------------------------------------------------ */

function generate() {
  const draw = createDraw(SEED);
  const alerts = [];
  let seq = 100000;

  brand.entities.forEach((entity) => {
    const entityIdentifiers = IDENTIFIERS.filter((id) => id.entityId === entity.id);
    const entityCases = CASES.filter((c) => c.entityId === entity.id && c.caseType === 'chargeback');
    const selfService = SELF_SERVICE.find((s) => s.entityId === entity.id);
    const entityAgents = WORKABLE_ENTITIES[entity.id] ?? [];
    const count = draw.int(35, 60);

    for (let i = 0; i < count; i += 1) {
      seq += 1;
      const source = ALERT_SOURCES[draw.weighted([[0, 55], [1, 25], [2, 20]])];
      const matched = draw.bool(0.7);
      const identifier = matched ? draw.pick(entityIdentifiers) : null;
      const linkedCase = matched && draw.bool(0.6) ? draw.pick(entityCases) : null;

      // Alerts skew recent — the whole point is a short clock. Some already
      // resolved in the past, some still open with a live countdown.
      const isPast = draw.bool(0.55);
      const alertOffsetDays = isPast ? -draw.int(1, 45) : -draw.int(0, 2);
      const alertMs = NOW + alertOffsetDays * DAY;
      const windowDays = draw.int(3, 5);
      const expiresMs = alertMs + windowDays * DAY;
      const transMs = alertMs - draw.int(1, 3) * DAY;

      let outcome;
      let processedMs = null;
      if (expiresMs < NOW) {
        outcome = draw.weighted([['refunded', 62], ['ineligible', 20], ['expired', 18]]);
        processedMs = draw.int(alertMs, Math.min(expiresMs, NOW));
      } else {
        outcome = 'open';
      }

      const autoWillHandle = selfService?.autoComplete?.[source.id] && outcome === 'open';
      // Roughly 60% of OPEN alerts already have an owner; the rest sit in the
      // unassigned backlog, which is what makes "balance workload" meaningful.
      const assignedTo = outcome === 'open' && entityAgents.length && draw.bool(0.6) ? draw.pick(entityAgents) : null;

      alerts.push({
        id: `EWA-${seq}`,
        sourceId: source.id,
        entityId: entity.id,
        entityLabel: entity.label,
        mid: entity.mid,
        caseId: linkedCase?.id ?? null,
        identifier: identifier?.identifier ?? (matched ? entityIdentifiers[0]?.identifier : null),
        matched: Boolean(identifier),
        amount: linkedCase?.disputeAmount ?? draw.money(15, 320),
        currency: brand.currency,
        panMasked: `${source.network === 'Visa' ? '4' : '5'}${draw.digits(5)} ${draw.digits(2)}•• •••• ${draw.digits(4)}`,
        transactionDate: new Date(transMs).toISOString().slice(0, 10),
        alertDate: new Date(alertMs).toISOString(),
        expiresAt: new Date(expiresMs).toISOString(),
        outcome,
        processedAt: processedMs ? new Date(processedMs).toISOString() : null,
        serviceLevel: selfService?.serviceLevel ?? 'Self Service',
        autoWillHandle,
        assignedTo,
        billable: draw.bool(0.85),
      });
    }
  });

  return alerts.sort((a, b) => new Date(b.alertDate) - new Date(a.alertDate));
}

export const ALERTS = generate();

export const getAlert = (id) => ALERTS.find((a) => a.id === id) ?? null;

/** Overview-tab rollup, one row per entity. Takes a live list so bulk actions in the Alerts tab reflect here too. */
export function entityRollup(alerts = ALERTS) {
  return brand.entities.map((entity) => {
    const rows = alerts.filter((a) => a.entityId === entity.id);
    const open = rows.filter((a) => a.outcome === 'open');
    const refunded = rows.filter((a) => a.outcome === 'refunded');
    const missed = rows.filter((a) => a.outcome === 'ineligible' || a.outcome === 'expired');
    const selfService = SELF_SERVICE.find((s) => s.entityId === entity.id);
    const lastAlert = rows.reduce((latest, a) => (!latest || a.alertDate > latest ? a.alertDate : latest), null);

    return {
      entityId: entity.id,
      entityLabel: entity.label,
      total: rows.length,
      open: open.length,
      refunded: refunded.length,
      missed: missed.length,
      valueProtected: Math.round(refunded.reduce((s, a) => s + a.amount, 0) * 100) / 100,
      valueAtRisk: Math.round(open.reduce((s, a) => s + a.amount, 0) * 100) / 100,
      lastAlertAt: lastAlert,
      serviceLevel: selfService?.serviceLevel ?? 'Self Service',
    };
  });
}

/** Assignments-page rollup, one row per eligible agent. Takes a live list for the same reason as entityRollup. */
export function agentRollup(alerts = ALERTS) {
  return AGENT_ROLES.filter((a) => a.alertsRole !== 'No access').map((agent) => {
    const entities = brand.entities.filter((e) => canWork(agent.email, e.id));
    const assigned = alerts.filter((a) => a.assignedTo === agent.email);
    const openLoad = assigned.filter((a) => a.outcome === 'open');

    return {
      email: agent.email,
      name: agent.name,
      alertsRole: agent.alertsRole,
      entities,
      assignedAlerts: assigned.length,
      openLoad: openLoad.length,
      openValue: Math.round(openLoad.reduce((s, a) => s + a.amount, 0) * 100) / 100,
    };
  });
}

/** Open alerts nobody owns yet, optionally scoped to one entity. */
export function unassignedOpenAlerts(alerts = ALERTS, entityId = null) {
  return alerts.filter((a) => a.outcome === 'open' && !a.assignedTo && (!entityId || a.entityId === entityId));
}

/* ------------------------------------------------------------------ *
 * Validations — Order Insight-style transaction checks that run BEFORE
 * an alert or a dispute exists, confirming the transaction data an issuer
 * sees matches what Nutrameg has on file. Informational, not actionable:
 * a check either runs or it doesn't, so every row lands Completed —
 * there's no outcome for a human to decide here.
 * ------------------------------------------------------------------ */

function generateValidations() {
  const draw = createDraw(SEED + 41);
  const rows = [];
  let seq = 500000;

  brand.entities.forEach((entity) => {
    const entityIdentifiers = IDENTIFIERS.filter((id) => id.entityId === entity.id);
    const count = draw.int(20, 45);

    for (let i = 0; i < count; i += 1) {
      seq += 1;
      const ccType = draw.weighted([['Visa', 65], ['Mastercard', 35]]);
      const identifier = draw.pick(entityIdentifiers);
      const transMs = NOW - draw.int(0, 60) * DAY;

      rows.push({
        id: `VAL-${seq}`,
        entityId: entity.id,
        entityLabel: entity.label,
        source: 'Order Insight',
        amount: draw.money(15, 320),
        currency: brand.currency,
        transactionDate: new Date(transMs).toISOString().slice(0, 10),
        panMasked: `${ccType === 'Visa' ? '4' : '5'}${draw.digits(5)}xxxxxx${draw.digits(4)}`,
        ccType,
        descriptor: identifier?.identifier ?? `${entity.label.toUpperCase()}*APP`,
        mid: entity.mid,
        validatedAt: new Date(transMs + draw.int(0, 3) * DAY + draw.int(0, 86_000_000)).toISOString(),
        arn: `${draw.digits(2)}${draw.digits(21)}`,
        outcome: 'Completed',
      });
    }
  });

  return rows.sort((a, b) => new Date(b.validatedAt) - new Date(a.validatedAt));
}

export const VALIDATIONS = generateValidations();

export default ALERTS;
