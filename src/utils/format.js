/**
 * Formatting helpers.
 *
 * TENANT LEAK CONVERTED: the reference hard-coded `'en-US'` and a `'USD'`
 * default in its formatter. Both now come from the brand, so a tenant swap
 * changes € to $ and 06 Aug to Aug 06 without touching a component. This was
 * the same class of bug as the entity-weight map — a plausible default that
 * only misbehaves under a second tenant.
 */

import brand from '@/brand/brand.config';

const HOUR = 3_600_000;
const DAY = 86_400_000;

export const formatCurrency = (amount, currency = brand.currency) =>
  new Intl.NumberFormat(brand.locale, { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount ?? 0);

export const formatCompactCurrency = (amount, currency = brand.currency) =>
  new Intl.NumberFormat(brand.locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(amount ?? 0);

export const formatNumber = (n) => new Intl.NumberFormat(brand.locale).format(n ?? 0);

export const formatPercent = (n, digits = 1) => (n == null ? '—' : `${Number(n).toFixed(digits)}%`);

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(brand.locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
};

export const formatShortDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(brand.locale, { day: '2-digit', month: 'short' }).format(d);
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(brand.locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
};

export const relativeTime = (value) => {
  if (!value) return '—';
  const diff = new Date(value).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(brand.locale, { numeric: 'auto' });
  for (const [unit, ms] of [['day', DAY], ['hour', HOUR], ['minute', 60_000]]) {
    if (Math.abs(diff) >= ms || unit === 'minute') return rtf.format(Math.round(diff / ms), unit);
  }
  return 'just now';
};

export const daysUntil = (value) =>
  Math.floor((new Date(value).getTime() - new Date().setHours(0, 0, 0, 0)) / DAY);

/** Urgency band shared by the due pill, the bench sort and the KPI tiles. */
export const urgencyOf = (dueDate) => {
  if (!dueDate) return 'none';
  const days = daysUntil(dueDate);
  if (days < 0) return 'overdue';
  if (days === 0) return 'critical';
  if (days <= 2) return 'soon';
  return 'ok';
};

/** "3d", "Today", "Overdue 2d" — compact enough for a dense cell. */
export const formatDueIn = (dueDate) => {
  if (!dueDate) return '—';
  const days = daysUntil(dueDate);
  if (days < 0) return `Overdue ${Math.abs(days)}d`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days}d`;
};

export const formatMinutes = (minutes) => {
  if (!minutes) return '—';
  if (minutes < 60) return `${Math.round(minutes * 100) / 100}`;
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`;
};

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const pluralise = (count, singular, plural = `${singular}s`) =>
  `${formatNumber(count)} ${count === 1 ? singular : plural}`;

export const titleCase = (v = '') =>
  String(v).replace(/[_-]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

/** Truncation helper for cells that also get a tooltip. */
export const truncate = (value, max = 40) => {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};
