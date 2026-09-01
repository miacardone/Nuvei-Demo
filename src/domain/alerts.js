/**
 * ALERTS
 * ======
 * Everything an analyst would otherwise have to piece together from four
 * screens, derived from the SAME book the queues and charts read.
 *
 * THE DESIGN RULE HERE IS "AN ALERT MUST BE ACTIONABLE".
 * A notification that says "18 cases need attention" and links nowhere is
 * noise, and a console full of noise trains people to dismiss the one alert
 * that mattered. So every rule below has to answer four questions or it does
 * not ship:
 *
 *   1. WHAT changed          — `title`
 *   2. WHY it costs money    — `why`, in money or deadline terms
 *   3. WHICH cases           — `cases`, never just a count
 *   4. WHAT to do next       — `action`, a real route into this build
 *
 * WHY THE SEVERITIES ARE WHAT THEY ARE. Critical is reserved for money that
 * is already leaving or a deadline that has already passed — things where
 * waiting a day changes the outcome. Everything a good analyst would get to
 * this week is a warning. If everything is critical, nothing is.
 *
 * NO SEPARATE ALERT FIXTURE. The counts here and the counts on Case
 * management come from one array, so they cannot disagree. That was the whole
 * problem with the topbar's old hardcoded notification list — it cheerfully
 * claimed "18 cases due within 24 hours" no matter what the book said.
 */

import brand from '@/brand/brand.config';
import { CASES } from '@/data/cases';
import { buildConsolidationGroups, consolidationStats } from '@/domain/consolidation';
import { ERROR_TYPES, errorHandling } from '@/domain/metrics';
import { isClosed } from '@/domain/statuses';
import { ROUTES } from '@/data/navigation';
import { formatCurrency, formatNumber, pluralise } from '@/utils/format';

const DAY = 86_400_000;

export const SEVERITIES = [
  { id: 'critical', label: 'Critical', tone: 'danger', rank: 0, description: 'Money is leaving, or a deadline has already passed.' },
  { id: 'warning', label: 'Warning', tone: 'warning', rank: 1, description: 'Recoverable this week, expensive if left.' },
  { id: 'info', label: 'Info', tone: 'info', rank: 2, description: 'Worth knowing; nothing is on fire.' },
];

export const getSeverity = (id) => SEVERITIES.find((s) => s.id === id) ?? SEVERITIES[2];

/** The rule catalogue, so Alert settings can list rules without inventing them. */
export const ALERT_RULES = [
  { id: 'sla_breached', label: 'SLA breached', category: 'Deadlines' },
  { id: 'sla_today', label: 'Due today', category: 'Deadlines' },
  { id: 'sla_48h', label: 'Due within 48 hours', category: 'Deadlines' },
  { id: 'duplicate_refund', label: 'Duplicate refund exposure', category: 'Money' },
  { id: 'high_value_unowned', label: 'High value, unassigned', category: 'Money' },
  { id: 'no_docs_near_due', label: 'No evidence near deadline', category: 'Evidence' },
  { id: 'confirmed_fraud_open', label: 'Confirmed fraud still open', category: 'Risk' },
  { id: 'pre_arb_open', label: 'Pre-arbitration open', category: 'Risk' },
  { id: 'integration_errors', label: 'Integration health', category: 'Platform' },
];

const daysTo = (dateStr) => Math.floor((new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)) / DAY);
const sumValue = (cases) => Math.round(cases.reduce((s, c) => s + (c.disputeAmount ?? 0), 0) * 100) / 100;

/**
 * One alert. `cases` is capped for rendering but `count` is the true total —
 * a truncated list that silently understates the problem is worse than none.
 */
function makeAlert({ id, ruleId, severity, title, why, action, cases = [], count, value, meta }) {
  const all = cases;
  return {
    id,
    ruleId,
    severity,
    title,
    why,
    action,
    count: count ?? all.length,
    value: value ?? sumValue(all),
    cases: all.slice(0, 8),
    caseIds: all.map((c) => c.id),
    truncated: Math.max(all.length - 8, 0),
    meta: meta ?? null,
    /** Newest signal in the group — drives the "as of" stamp on the row. */
    at: all.length
      ? all.reduce((newest, c) => (c.updatedAt > newest ? c.updatedAt : newest), all[0].updatedAt)
      : new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * Deadline rules
 * ------------------------------------------------------------------ */

function deadlineAlerts(open) {
  const out = [];

  const breached = open.filter((c) => daysTo(c.dueDate) < 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (breached.length) {
    const worst = daysTo(breached[0].dueDate);
    out.push(makeAlert({
      id: 'sla-breached',
      ruleId: 'sla_breached',
      severity: 'critical',
      title: `${formatNumber(breached.length)} ${brand.terms.cases} past the internal due date`,
      why: `${formatCurrency(sumValue(breached))} of defendable value is sitting past its internal deadline. The oldest is ${Math.abs(worst)} days over. Once the network due date passes the ${brand.terms.chargeback} is lost by default, not on the merits.`,
      action: { label: 'Open the overdue queue', to: ROUTES.caseManagement },
      cases: breached,
    }));
  }

  const today = open.filter((c) => daysTo(c.dueDate) === 0);
  if (today.length) {
    out.push(makeAlert({
      id: 'sla-today',
      ruleId: 'sla_today',
      severity: 'critical',
      title: `${formatNumber(today.length)} ${brand.terms.cases} due today`,
      why: `These have to be submitted before end of day. ${formatCurrency(sumValue(today))} at stake, and ${today.filter((c) => c.worker === '—').length} of them have no owner.`,
      action: { label: 'Work these now', to: ROUTES.workCase },
      cases: today,
    }));
  }

  const soon = open.filter((c) => { const d = daysTo(c.dueDate); return d >= 1 && d <= 2; });
  if (soon.length) {
    out.push(makeAlert({
      id: 'sla-48h',
      ruleId: 'sla_48h',
      severity: 'warning',
      title: `${formatNumber(soon.length)} ${brand.terms.cases} due within 48 hours`,
      why: `Worth clearing before they become today's problem. ${formatCurrency(sumValue(soon))} across ${new Set(soon.map((c) => c.queueLabel)).size} ${brand.terms.queue}s.`,
      action: { label: 'Review the bench', to: ROUTES.workCase },
      cases: soon,
    }));
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Money rules
 * ------------------------------------------------------------------ */

function moneyAlerts(open, groups) {
  const out = [];

  /**
   * The one alert this product exists for. A shared order disputed through
   * both the card rails and Buyer Protection gets refunded twice unless
   * somebody spots it — and nothing else in the console surfaces it on a
   * screen an analyst visits before picking up work.
   */
  const dupes = groups.filter((g) => g.duplicateRefundRisk && g.openCount > 1);
  if (dupes.length) {
    const stats = consolidationStats(CASES, groups);
    const affected = dupes.flatMap((g) => g.cases).filter((c) => !isClosed(c.status));
    out.push(makeAlert({
      id: 'duplicate-refund',
      ruleId: 'duplicate_refund',
      severity: 'critical',
      title: `${formatNumber(dupes.length)} ${brand.terms.order}${dupes.length === 1 ? '' : 's'} disputed through two channels at once`,
      why: `Each of these is one ${brand.terms.order} running as a card ${brand.terms.chargeback} AND a ${brand.terms.claimProgramme} ${brand.terms.claim}. Worked separately by two people, the same ${brand.terms.order} is refunded twice — ${formatCurrency(stats.duplicateRefundExposure)} of avoidable double payment.`,
      action: { label: 'Open the linked cases', to: ROUTES.workCaseDetail(affected[0]?.id ?? '') },
      cases: affected,
      count: dupes.length,
      value: stats.duplicateRefundExposure,
      meta: { groups: dupes.map((g) => ({ id: g.id, label: g.label, size: g.size })) },
    }));
  }

  const unowned = open.filter((c) => c.disputeAmount >= brand.thresholds.riskAmount && c.worker === '—');
  if (unowned.length) {
    out.push(makeAlert({
      id: 'high-value-unowned',
      ruleId: 'high_value_unowned',
      severity: 'warning',
      title: `${formatNumber(unowned.length)} high-value ${brand.terms.cases} with no owner`,
      why: `At or above the ${formatCurrency(brand.thresholds.riskAmount)} risk amount and nobody is on them. ${formatCurrency(sumValue(unowned))} total. High-value ${brand.terms.cases} are the ones where a defence actually pays for the time it takes.`,
      action: { label: 'Assign these', to: ROUTES.caseManagement },
      cases: unowned,
    }));
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Evidence and risk rules
 * ------------------------------------------------------------------ */

function evidenceAlerts(open) {
  const out = [];

  const noDocs = open.filter((c) => c.docStatus === 'missing' && daysTo(c.dueDate) <= 5 && daysTo(c.dueDate) >= 0);
  if (noDocs.length) {
    out.push(makeAlert({
      id: 'no-docs-near-due',
      ruleId: 'no_docs_near_due',
      severity: 'warning',
      title: `${formatNumber(noDocs.length)} ${brand.terms.cases} due inside 5 days with no evidence on file`,
      why: `A representment with no documents is rejected almost every time, so these are effectively already lost unless the evidence is chased today. ${formatCurrency(sumValue(noDocs))} exposed.`,
      action: { label: 'Chase the evidence', to: ROUTES.workCase },
      cases: noDocs,
    }));
  }

  const fraud = open.filter((c) => c.fraudMarker === 'Confirmed Fraud' && c.disputeAmount >= brand.thresholds.riskAmount);
  if (fraud.length) {
    out.push(makeAlert({
      id: 'confirmed-fraud-open',
      ruleId: 'confirmed_fraud_open',
      severity: 'warning',
      title: `${formatNumber(fraud.length)} confirmed-fraud ${brand.terms.cases} above the risk amount still open`,
      why: `These carry a regulatory hold — they cannot be written off, so they must be defended or referred. Leaving them in the queue does not make them go away. ${formatCurrency(sumValue(fraud))} held.`,
      action: { label: 'Review fraud holds', to: ROUTES.workCase },
      cases: fraud,
    }));
  }

  const preArb = open.filter((c) => c.cycleId === 'pre_arb');
  if (preArb.length) {
    out.push(makeAlert({
      id: 'pre-arb-open',
      ruleId: 'pre_arb_open',
      severity: 'info',
      title: `${formatNumber(preArb.length)} ${brand.terms.cases} in pre-arbitration`,
      why: `Last cycle before arbitration, and the windows are the shortest in the book. Pre-arbitration cannot be split, so each of these needs one decision for the full amount.`,
      action: { label: 'Open pre-arb', to: ROUTES.caseManagement },
      cases: preArb,
    }));
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Platform health
 * ------------------------------------------------------------------ */

/**
 * Integration health reads the same series Monitoring charts, so the alert
 * and the chart can never tell two different stories. It fires on the latest
 * week only — a week-old spike that has since recovered is history, not an
 * alert.
 */
function integrationAlerts() {
  const weeks = errorHandling(CASES, 8);
  const latest = weeks[weeks.length - 1];
  const previous = weeks[weeks.length - 2];
  if (!latest) return [];

  const total = ERROR_TYPES.reduce((s, t) => s + (latest[t.id] ?? 0), 0);
  const priorTotal = previous ? ERROR_TYPES.reduce((s, t) => s + (previous[t.id] ?? 0), 0) : 0;
  if (total === 0) return [];

  const breakdown = ERROR_TYPES
    .map((t) => ({ ...t, count: latest[t.id] ?? 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const authFailing = (latest.auth ?? 0) > 0;
  const delta = total - priorTotal;

  return [makeAlert({
    id: 'integration-health',
    ruleId: 'integration_errors',
    severity: authFailing ? 'warning' : 'info',
    title: `${formatNumber(total)} integration errors in ${latest.period}`,
    why: authFailing
      ? `Includes ${pluralise(latest.auth, 'authentication failure')}, which do not retry — inbound ${brand.terms.cases} stop arriving until the credential is rotated. ${delta >= 0 ? `Up ${delta}` : `Down ${Math.abs(delta)}`} on the previous week.`
      : `All ${brand.terms.cases} recovered through retry or quarantine, nothing was dropped. ${delta >= 0 ? `Up ${delta}` : `Down ${Math.abs(delta)}`} on the previous week.`,
    action: { label: 'Open Monitoring', to: ROUTES.monitoring },
    cases: [],
    count: total,
    value: 0,
    meta: { breakdown, period: latest.period },
  })];
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** Every live alert, most severe first, then by money at stake. */
export function buildAlerts(cases = CASES) {
  const open = cases.filter((c) => !isClosed(c.status));
  const groups = buildConsolidationGroups(cases);

  return [
    ...deadlineAlerts(open),
    ...moneyAlerts(open, groups),
    ...evidenceAlerts(open),
    ...integrationAlerts(),
  ].sort((a, b) => {
    const bySeverity = getSeverity(a.severity).rank - getSeverity(b.severity).rank;
    return bySeverity !== 0 ? bySeverity : b.value - a.value;
  });
}

/**
 * Headline numbers. `casesAffected` is a SET, not a sum of counts — a case
 * that is both overdue and undocumented is one case in trouble, not two, and
 * summing the rules would overstate the book by a third.
 */
export function alertSummary(alerts) {
  const affected = new Set(alerts.flatMap((a) => a.caseIds));
  const critical = alerts.filter((a) => a.severity === 'critical');

  return {
    total: alerts.length,
    critical: critical.length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
    casesAffected: affected.size,
    /** Exposure counts each case ONCE, at its own value, for the same reason. */
    exposure: Math.round(
      [...affected].reduce((sum, id) => {
        const c = CASES.find((x) => x.id === id);
        return sum + (c?.disputeAmount ?? 0);
      }, 0) * 100,
    ) / 100,
    criticalExposure: Math.round(critical.reduce((s, a) => s + a.value, 0) * 100) / 100,
  };
}

/** The topbar bell — the same alerts, trimmed to what fits in a popover. */
export function bellAlerts(limit = 4) {
  return buildAlerts().slice(0, limit);
}
