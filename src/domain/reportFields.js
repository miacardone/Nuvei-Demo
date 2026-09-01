import { dueBucketOf } from '@/domain/metrics';

/**
 * Report fields — ONE registry, used by both the Group by dropdown and the
 * filter row.
 *
 * Sourcing both controls from here is the point: a field added for grouping is
 * immediately filterable, and the two lists cannot drift apart. Each entry
 * carries its own accessor, so the filter never needs to know how a value is
 * stored on the case record.
 */
export const REPORT_FIELDS = [
  { id: 'queue', label: 'Queue', get: (c) => c.queueLabel },
  { id: 'reasonCategory', label: 'Reason category', get: (c) => c.reasonCategory },
  { id: 'entity', label: 'Entity', get: (c) => c.entityLabel },
  { id: 'caseType', label: 'Case type', get: (c) => c.caseType },
  { id: 'assignee', label: 'Assignee', get: (c) => c.worker },
  { id: 'dueBucket', label: 'Due date bucket', get: (c) => dueBucketOf(c.dueDate) },
  { id: 'pan', label: 'PAN', get: (c) => c.pan ?? '—', numeric: false },
  { id: 'clientEmail', label: 'Client Email', get: (c) => c.buyerEmail },
  { id: 'amount', label: 'Disputed amount', get: (c) => c.disputeAmount, numeric: true },
];

export const getReportField = (id) => REPORT_FIELDS.find((f) => f.id === id) ?? null;

export const FILTER_OPERATORS = [
  { id: 'gt', label: 'Is greater than' },
  { id: 'lt', label: 'Is lower than' },
  { id: 'eq', label: 'Is equal to' },
];

/**
 * Compares numerically when both sides are numbers, and lexically otherwise —
 * so "is greater than" still means something on a text field like PAN or an
 * email address, rather than silently matching nothing.
 */
export function matchesFilter(caseRecord, filter) {
  if (!filter?.field) return true;
  if (filter.value == null || String(filter.value).trim() === '') return true;

  const field = getReportField(filter.field);
  if (!field) return true;

  const actual = field.get(caseRecord);
  const a = Number(actual);
  const b = Number(filter.value);
  const numeric = field.numeric !== false && !Number.isNaN(a) && !Number.isNaN(b) && String(actual).trim() !== '';

  switch (filter.operator) {
    case 'gt':
      return numeric ? a > b : String(actual).localeCompare(String(filter.value)) > 0;
    case 'lt':
      return numeric ? a < b : String(actual).localeCompare(String(filter.value)) < 0;
    case 'eq':
    default:
      return numeric ? a === b : String(actual).toLowerCase() === String(filter.value).trim().toLowerCase();
  }
}

/** Readable summary for the preview subtitle. */
export function describeFilter(filter) {
  if (!filter?.field || String(filter.value ?? '').trim() === '') return null;
  const field = getReportField(filter.field);
  const op = FILTER_OPERATORS.find((o) => o.id === filter.operator);
  return `${field?.label ?? filter.field} ${(op?.label ?? '').toLowerCase()} ${filter.value}`;
}

/** Date-range + filter, applied together — what the preview actually renders. */
export function applyReportScope(cases, { start, end, filter }) {
  return cases.filter((c) => {
    if (start && c.dateCreated < start) return false;
    if (end && c.dateCreated > end) return false;
    return matchesFilter(c, filter);
  });
}
