/**
 * Derived analytics.
 *
 * Everything the dashboard and reports draw is computed from the same book the
 * tables show — no parallel "analytics" fixture that can quietly disagree with
 * the queue. If the table says 901 open cases, the KPI says 901.
 */

import brand, { REASON_CATEGORIES } from '@/brand/brand.config';
import { isClosed } from '@/domain/statuses';

const DAY = 86_400_000;

const startOfDay = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const weekLabel = (ms) => {
  const d = new Date(ms);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return `Week ${Math.ceil(((d - jan1) / DAY + jan1.getDay() + 1) / 7)}`;
};

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

/** Case Activity Per Week — stacked by outcome-ish status, last 6 weeks. */
export function caseActivityPerWeek(cases, weeks = 6) {
  const now = Date.now();
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY;
    return { period: weekLabel(end), start: end - 7 * DAY, end, completed: 0, represented: 0, expired: 0, rejected: 0, open: 0 };
  });

  cases.forEach((c) => {
    const at = new Date(c.dateCreated).getTime();
    const b = buckets.find((x) => at > x.start && at <= x.end);
    if (!b) return;
    if (c.status === 'completed') b.completed += 1;
    else if (c.status === 'represented') b.represented += 1;
    else if (c.status === 'expired') b.expired += 1;
    else if (c.status === 'rejected') b.rejected += 1;
    else b.open += 1;
  });

  return buckets.map(({ period, completed, represented, expired, rejected, open }) => ({
    period, completed, represented, expired, rejected, open,
  }));
}

/** Chargeback vs. claim volume, same weekly buckets as caseActivityPerWeek — a line reads the intake-mix trend better than another stacked bar. */
export function caseTypeTrend(cases, weeks = 6) {
  const now = Date.now();
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY;
    return { period: weekLabel(end), start: end - 7 * DAY, end, chargeback: 0, claim: 0 };
  });

  cases.forEach((c) => {
    const at = new Date(c.dateCreated).getTime();
    const b = buckets.find((x) => at > x.start && at <= x.end);
    if (!b) return;
    if (c.caseType === 'chargeback') b.chargeback += 1; else b.claim += 1;
  });

  return buckets.map(({ period, chargeback, claim }) => ({ period, chargeback, claim }));
}

/** New Cases Per Day — area chart. */
export function newCasesPerDay(cases, days = 28) {
  const today = startOfDay(Date.now());
  const buckets = Array.from({ length: days }, (_, i) => {
    const at = today - (days - 1 - i) * DAY;
    return {
      at,
      period: new Intl.DateTimeFormat(brand.locale, { day: '2-digit', month: 'short' }).format(at),
      value: 0,
    };
  });

  cases.forEach((c) => {
    const day = startOfDay(new Date(c.dateCreated).getTime());
    const b = buckets.find((x) => x.at === day);
    if (b) b.value += 1;
  });

  return buckets;
}

/** Reason-code split for one scheme — the two dashboard donuts. */
export function reasonCodeDonut(cases, schemeId, topN = 5) {
  const relevant = cases.filter((c) => c.caseType === 'chargeback' && c.network === schemeId);

  const counts = new Map();
  relevant.forEach((c) => {
    if (!counts.has(c.reasonCode)) counts.set(c.reasonCode, { label: c.reasonCode, description: c.reasonLabel, value: 0 });
    counts.get(c.reasonCode).value += 1;
  });

  const sorted = [...counts.values()].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, topN);
  const tail = sorted.slice(topN);

  if (tail.length) {
    head.push({ label: 'Other', description: `${tail.length} further codes`, value: tail.reduce((s, e) => s + e.value, 0), other: true });
  }

  return { slices: head, total: relevant.length };
}

/** Analyst activity table — EMAIL / AHT (MINUTES) / CASES PER USER. */
export function analystActivity(cases) {
  const byUser = new Map();

  cases.forEach((c) => {
    if (c.worker === '—') return;
    if (!byUser.has(c.worker)) byUser.set(c.worker, { email: c.worker, minutes: 0, handled: 0, cases: 0 });
    const row = byUser.get(c.worker);
    row.cases += 1;
    if (c.handlingMinutes > 0) {
      row.minutes += c.handlingMinutes;
      row.handled += 1;
    }
  });

  return [...byUser.values()]
    .map((r) => ({ email: r.email, aht: r.handled ? r.minutes / r.handled : 0, casesPerUser: r.cases }))
    .sort((a, b) => b.casesPerUser - a.casesPerUser);
}

export function caseKpis(cases) {
  const open = cases.filter((c) => !isClosed(c.status));
  const closed = cases.filter((c) => isClosed(c.status));
  const won = closed.filter((c) => c.outcome === 'won');
  const today = new Date().toISOString().slice(0, 10);

  return {
    total: cases.length,
    openCases: open.length,
    overdueCases: open.filter((c) => c.dueDate < today).length,
    unassigned: open.filter((c) => c.worker === '—').length,
    openValue: Math.round(open.reduce((s, c) => s + c.disputeAmount, 0) * 100) / 100,
    recoveredValue: Math.round(won.reduce((s, c) => s + c.disputeAmount, 0) * 100) / 100,
    winRate: closed.length ? (won.length / closed.length) * 100 : 0,
    represented: cases.filter((c) => c.status === 'represented').length,
    docsMissing: open.filter((c) => c.docStatus === 'missing').length,
    chargebacks: cases.filter((c) => c.caseType === 'chargeback').length,
    claims: cases.filter((c) => c.caseType === 'claim').length,
  };
}

/** Weekly bucketed count or sum by dateCreated — feeds a KPI sparkline. */
export function weeklySeries(cases, weeks, valueFn = () => 1, predicate = () => true, dateOf = (c) => c.dateCreated) {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY;
    const rows = cases.filter((c) => predicate(c) && inWindow(dateOf(c), end - 7 * DAY, end));
    return rows.reduce((s, c) => s + valueFn(c), 0);
  });
}

/** Weekly rate (0-100) among cases matching `closedPredicate` — for a win-rate sparkline. */
export function weeklyRate(cases, weeks, closedPredicate, successPredicate, dateOf = (c) => c.dateCreated) {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY;
    const rows = cases.filter((c) => closedPredicate(c) && inWindow(dateOf(c), end - 7 * DAY, end));
    return rows.length ? (rows.filter(successPredicate).length / rows.length) * 100 : 0;
  });
}

/**
 * New-case volume this period vs. the one before it — the delta badge on a
 * KPI tile. Not a trend line, just "up/down X% vs prior N days," computed
 * from the same `dateCreated` field the Dashboard's own charts use.
 */
const inWindow = (dateCreated, from, to) => {
  const at = new Date(dateCreated).getTime();
  return at > from && at <= to;
};

/** Shared clamp-and-label core every count/value trend badge renders through.
 *  The book is deliberately weighted toward recent activity (see cases.js),
 *  so a raw ratio can swing huge — clamp to a range a KPI tile can actually
 *  say out loud. */
function pctTrend(recent, prior, days) {
  if (!prior) return { direction: 'up', label: recent ? 'new' : '—' };
  const pct = Math.max(-75, Math.min(75, Math.round(((recent - prior) / prior) * 100)));
  return { direction: pct >= 0 ? 'up' : 'down', label: `${pct >= 0 ? '+' : ''}${pct}% vs prior ${days}d` };
}

export function volumeTrend(cases, days = 30) {
  const now = Date.now();
  const cutoff = now - days * DAY;
  const priorCutoff = now - 2 * days * DAY;
  const recent = cases.filter((c) => inWindow(c.dateCreated, cutoff, now)).length;
  const prior = cases.filter((c) => inWindow(c.dateCreated, priorCutoff, cutoff)).length;
  return pctTrend(recent, prior, days);
}

/** Same recent-vs-prior-window comparison, scoped to a subset — e.g. overdue
 *  or unassigned cases — instead of the whole book. */
export function countTrend(cases, predicate, days = 30) {
  return volumeTrend(cases.filter(predicate), days);
}

/** Recent-vs-prior window comparison on a summed value (e.g. exposure)
 *  instead of a row count. */
export function sumTrend(cases, valueFn, days = 30) {
  const now = Date.now();
  const cutoff = now - days * DAY;
  const priorCutoff = now - 2 * days * DAY;
  const recent = cases.filter((c) => inWindow(c.dateCreated, cutoff, now)).reduce((s, c) => s + valueFn(c), 0);
  const prior = cases.filter((c) => inWindow(c.dateCreated, priorCutoff, cutoff)).reduce((s, c) => s + valueFn(c), 0);
  return pctTrend(recent, prior, days);
}

/** Win-rate trend as a percentage-POINT delta, not a percent change of a
 *  percent — comparing two rates the way a percent change would (rate1 /
 *  rate2) reads misleadingly on small closed-case cohorts. */
export function rateTrend(cases, closedPredicate, successPredicate, days = 30) {
  const now = Date.now();
  const cutoff = now - days * DAY;
  const priorCutoff = now - 2 * days * DAY;
  const recentClosed = cases.filter((c) => closedPredicate(c) && inWindow(c.dateCreated, cutoff, now));
  const priorClosed = cases.filter((c) => closedPredicate(c) && inWindow(c.dateCreated, priorCutoff, cutoff));

  if (!priorClosed.length) return { direction: 'up', label: recentClosed.length ? 'new' : '—' };

  const recentRate = recentClosed.length ? (recentClosed.filter(successPredicate).length / recentClosed.length) * 100 : 0;
  const priorRate = (priorClosed.filter(successPredicate).length / priorClosed.length) * 100;
  const delta = Math.max(-75, Math.min(75, Math.round(recentRate - priorRate)));
  return { direction: delta >= 0 ? 'up' : 'down', label: `${delta >= 0 ? '+' : ''}${delta}pt vs prior ${days}d` };
}

/* ------------------------------------------------------------------ *
 * Reports center
 * ------------------------------------------------------------------ */

export const DUE_BUCKETS = [
  { id: 'pastDue', label: 'Past due' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'd2', label: '2 days' },
  { id: 'd3', label: '3 days' },
  { id: 'd4', label: '4 days' },
  { id: 'd5plus', label: '5+ days' },
];

export function dueBucketOf(dueDate) {
  const days = Math.floor((new Date(dueDate).getTime() - startOfDay(Date.now())) / DAY);
  if (days < 0) return 'pastDue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === 2) return 'd2';
  if (days === 3) return 'd3';
  if (days === 4) return 'd4';
  return 'd5plus';
}

/** Cases by due date per week — bar chart on Reports center. */
export function casesByDueDatePerWeek(cases, weeks = 6) {
  const now = Date.now();
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = now + i * 7 * DAY;
    return { period: weekLabel(start), start, end: start + 7 * DAY, chargeback: 0, claim: 0 };
  });

  cases.filter((c) => !isClosed(c.status)).forEach((c) => {
    const at = new Date(c.dueDate).getTime();
    const b = buckets.find((x) => at >= x.start && at < x.end);
    if (b) b[c.caseType] += 1;
  });

  return buckets;
}

/** Entity case totals by due date — full-width bar. */
export function entityTotalsByDueDate(cases) {
  return brand.entities.map((entity) => {
    const rows = cases.filter((c) => c.entityId === entity.id && !isClosed(c.status));
    const out = { period: entity.label };
    DUE_BUCKETS.forEach((b) => { out[b.id] = 0; });
    rows.forEach((c) => { out[dueBucketOf(c.dueDate)] += 1; });
    return out;
  });
}

/** Case totals by reason category and due date — the table. */
export function reasonCategoryByDueDate(cases) {
  const open = cases.filter((c) => !isClosed(c.status));

  return REASON_CATEGORIES.map((category) => {
    const rows = open.filter((c) => c.reasonCategory === category.id);
    const out = { id: category.id, description: category.label, total: rows.length };
    DUE_BUCKETS.forEach((b) => { out[b.id] = 0; });
    rows.forEach((c) => { out[dueBucketOf(c.dueDate)] += 1; });
    return out;
  }).filter((r) => r.total > 0);
}

export function totalsByQueue(cases) {
  const open = cases.filter((c) => !isClosed(c.status));
  const today = new Date().toISOString().slice(0, 10);

  return brand.queues.map((queue) => {
    const rows = open.filter((c) => c.queueId === queue.id);
    return {
      id: queue.id,
      label: queue.label,
      description: queue.description,
      sla: queue.sla,
      casesInQueue: rows.length,
      overdue: rows.filter((c) => c.dueDate < today).length,
      value: Math.round(rows.reduce((s, c) => s + c.disputeAmount, 0) * 100) / 100,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Monitoring — derived from the book, not a separate fixture
 * ------------------------------------------------------------------ */

export function documentProcessing(cases, weeks = 8) {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY;
    const rows = cases.filter((c) => {
      const at = new Date(c.dateCreated).getTime();
      return at > end - 7 * DAY && at <= end;
    });
    return {
      period: weekLabel(end),
      received: rows.filter((c) => c.docStatus === 'received').length,
      pending: rows.filter((c) => c.docStatus === 'pending').length,
      missing: rows.filter((c) => c.docStatus === 'missing').length,
    };
  });
}

export function disputeOutcomes(cases, weeks = 8) {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY;
    const rows = cases.filter((c) => {
      const at = new Date(c.dateCreated).getTime();
      return at > end - 7 * DAY && at <= end;
    });
    return {
      period: weekLabel(end),
      won: rows.filter((c) => c.outcome === 'won').length,
      lost: rows.filter((c) => c.outcome === 'lost').length,
      written_off: rows.filter((c) => c.outcome === 'written_off').length,
    };
  });
}

/** Error handling by response type — the one genuinely synthetic series. */
export const ERROR_TYPES = [
  { id: 'timeout', label: 'Gateway timeout', http: '504', remedy: 'Retried automatically with backoff.' },
  { id: 'validation', label: 'Validation rejected', http: '422', remedy: 'Row quarantined for manual correction.' },
  { id: 'upstream', label: 'Upstream unavailable', http: '502', remedy: 'Queued for redelivery.' },
  { id: 'auth', label: 'Authentication failed', http: '401', remedy: 'Credential rotation required.' },
];

export function errorHandling(cases, weeks = 8) {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY;
    const volume = cases.filter((c) => {
      const at = new Date(c.dateCreated).getTime();
      return at > end - 7 * DAY && at <= end;
    }).length;
    // Deterministic from the week's own volume, so it moves with the book.
    return {
      period: weekLabel(end),
      timeout: Math.round(volume * 0.018) + (i % 3),
      validation: Math.round(volume * 0.041) + (i % 4),
      upstream: Math.round(volume * 0.012) + ((i + 1) % 3),
      auth: (i + 2) % 4,
    };
  });
}

/** Suppliers with the most disputed cases — a leaderboard, not a chart. */
export function topSellersByVolume(cases, topN = 8) {
  const bySeller = new Map();
  cases.forEach((c) => {
    if (!c.seller) return;
    bySeller.set(c.seller, (bySeller.get(c.seller) ?? 0) + 1);
  });
  return [...bySeller.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label, value]) => ({ label, value }));
}

/** Disputed value per week — a line, not a bar, since the point is the trend. */
export function disputedValueTrend(cases, weeks = 8) {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY;
    const rows = cases.filter((c) => {
      const at = new Date(c.dateCreated).getTime();
      return at > end - 7 * DAY && at <= end;
    });
    return { period: weekLabel(end), disputed: Math.round(rows.reduce((s, c) => s + c.disputeAmount, 0)) };
  });
}

/** Case count and disputed value per market — feeds the geographic view. */
export function totalsByMarket(cases) {
  const by = new Map();
  cases.forEach((c) => {
    if (!c.market) return;
    const cur = by.get(c.market) ?? { market: c.market, count: 0, value: 0 };
    cur.count += 1;
    cur.value += c.disputeAmount;
    by.set(c.market, cur);
  });
  return [...by.values()].sort((a, b) => b.count - a.count);
}

/** Where missing documents are concentrated — the map that matters to Monitoring. */
export function missingDocsByMarket(cases) {
  const by = new Map();
  cases.filter((c) => c.docStatus === 'missing').forEach((c) => {
    if (!c.market) return;
    const cur = by.get(c.market) ?? { market: c.market, count: 0, value: 0 };
    cur.count += 1;
    cur.value += c.disputeAmount;
    by.set(c.market, cur);
  });
  return [...by.values()].sort((a, b) => b.count - a.count);
}

/** Average disputed amount per entity — a dot plot reads this better than a bar. */
export function avgAmountByEntity(cases) {
  const by = new Map();
  cases.forEach((c) => {
    const cur = by.get(c.entityLabel) ?? { label: c.entityLabel, total: 0, count: 0 };
    cur.total += c.disputeAmount;
    cur.count += 1;
    by.set(c.entityLabel, cur);
  });
  return [...by.values()].map((e) => ({ label: e.label, value: Math.round((e.total / e.count) * 100) / 100 }));
}
