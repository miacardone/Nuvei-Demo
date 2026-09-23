/**
 * Case-administration and settings fixtures.
 *
 * Queues and assignment reasons are tenant CONFIGURATION and live in
 * brand.config — this module only layers the administrative metadata
 * (who created it, when) and the runtime counts on top.
 */

import brand from '@/brand/brand.config';
import { CURRENT_USER, USERS } from '@/data/people';

const NOW = Date.now();
const DAY = 86_400_000;
const ago = (d, h = 0) => new Date(NOW - d * DAY - h * 3_600_000).toISOString();
const agoDate = (d) => new Date(NOW - d * DAY).toISOString().slice(0, 10);

/** Queue admin rows — live counts are joined in by the page from the book. */
export const QUEUE_META = brand.queues.map((q, i) => ({
  ...q,
  createdBy: USERS[i % USERS.length].email,
  dateCreated: agoDate(300 - i * 21),
}));

export const ASSIGNMENT_REASON_META = brand.assignmentReasons.map((r, i) => ({
  ...r,
  createdBy: i < 3 ? 'System' : USERS[i % USERS.length].email,
  dateCreated: agoDate(420 - i * 17),
}));

/* ------------------------------------------------------------------ *
 * Upload cases
 * ------------------------------------------------------------------ */

export const UPLOAD_HISTORY = [
  { id: 'up14', filename: `${brand.acquirers[0].toLowerCase()}-chargebacks-w32.csv`, uploadedAt: ago(0, 4), uploadedBy: CURRENT_USER.email, rows: 148, accepted: 147, rejected: 1, status: 'Completed', note: '1 row rejected: unknown reason code “13.9”.' },
  { id: 'up13', filename: 'buyer-protection-claims-w32.csv', uploadedAt: ago(1, 6), uploadedBy: USERS[2].email, rows: 64, accepted: 64, rejected: 0, status: 'Completed', note: null },
  { id: 'up12', filename: `${brand.acquirers[1].toLowerCase()}-visa-batch-0803.csv`, uploadedAt: ago(2, 2), uploadedBy: USERS[3].email, rows: 212, accepted: 209, rejected: 3, status: 'Completed', note: '3 rows rejected: order IDs not found.' },
  { id: 'up11', filename: 'prearb-responses-0801.csv', uploadedAt: ago(5, 8), uploadedBy: CURRENT_USER.email, rows: 19, accepted: 0, rejected: 19, status: 'Failed', note: 'Column “acquirer_case_number” missing from the header row.' },
  { id: 'up10', filename: 'manual-adjustments-july.csv', uploadedAt: ago(9), uploadedBy: USERS[4].email, rows: 6, accepted: 6, rejected: 0, status: 'Completed', note: null },
];

/**
 * CSV columns. Built from the brand so the worked examples use the active
 * tenant's own entity id and currency rather than a literal.
 */
export const buildUploadSchema = (b = brand) => [
  { column: 'case_type', required: true, example: 'chargeback', note: 'chargeback or claim' },
  { column: 'external_id', required: true, example: 'ADY-8834712', note: 'Acquirer case number or claim reference' },
  { column: 'amount', required: true, example: '128.40', note: 'Decimal, no currency symbol' },
  { column: 'currency', required: true, example: b.currency },
  { column: 'reason_code', required: true, example: '13.3', note: 'Scheme code, or claim reason for claims' },
  { column: 'scheme', required: false, example: 'visa', note: 'Chargebacks only' },
  { column: 'cycle', required: false, example: 'first_cb', note: 'Chargebacks only' },
  { column: 'arn', required: false, example: '74537286104920117364520', note: 'Chargebacks only' },
  { column: 'order_id', required: true, example: 'ORD-38340681' },
  { column: 'entity', required: true, example: b.entities[0].id },
  { column: 'presented_at', required: true, example: agoDate(14), note: 'ISO date, never in the future' },
];

/* ------------------------------------------------------------------ *
 * Webhooks
 * ------------------------------------------------------------------ */

export const WEBHOOK_TOPICS = [
  { id: 'case.created', label: 'Case created', description: 'A case entered the book from any intake path.' },
  { id: 'case.assigned', label: 'Case assigned', description: 'Ownership changed.' },
  { id: 'case.status_changed', label: 'Status changed', description: 'Any lifecycle transition.' },
  { id: 'case.due_soon', label: 'Case due soon', description: 'Inside the internal due-date buffer.' },
  { id: 'case.overdue', label: 'Case overdue', description: 'Past the internal due date.' },
  { id: 'case.decision_recorded', label: 'Decision recorded', description: 'A resolution was recorded.' },
  { id: 'consolidation.detected', label: 'Consolidation detected', description: 'A new linked group formed.' },
  { id: 'document.received', label: 'Document received', description: 'Evidence was attached to a case.' },
  { id: 'upload.completed', label: 'Upload completed', description: 'A CSV import finished.' },
];

/**
 * A live integration, not an empty page.
 *
 * This deliberately started empty so the empty state was the first thing you
 * saw, which reads as "unfinished" in a demo rather than as a design choice.
 * These are the subscriptions an acquirer actually runs: the case lifecycle
 * into a data warehouse, the deadline warnings into the ops channel, and the
 * money-adjacent events into the finance system. One is paused on purpose —
 * a page where every row says Active teaches the reader nothing about what
 * the status column is for.
 */
export const WEBHOOKS = [
  { id: 'wh1', topic: 'case.created', protocol: 'HTTPS', endpoint: 'https://events.nuvei.example/disputes/v2/case-created', createdBy: USERS[1].email, dateCreated: agoDate(412), status: 'Active' },
  { id: 'wh2', topic: 'case.status_changed', protocol: 'HTTPS', endpoint: 'https://events.nuvei.example/disputes/v2/lifecycle', createdBy: USERS[1].email, dateCreated: agoDate(412), status: 'Active' },
  { id: 'wh3', topic: 'case.due_soon', protocol: 'HTTPS', endpoint: 'https://hooks.nuvei.example/ops/deadline-watch', createdBy: USERS[4].email, dateCreated: agoDate(268), status: 'Active' },
  { id: 'wh4', topic: 'case.overdue', protocol: 'HTTPS', endpoint: 'https://hooks.nuvei.example/ops/escalations', createdBy: USERS[4].email, dateCreated: agoDate(268), status: 'Active' },
  { id: 'wh5', topic: 'case.decision_recorded', protocol: 'HTTPS', endpoint: 'https://ledger.nuvei.example/settlement/dispute-outcomes', createdBy: USERS[3].email, dateCreated: agoDate(190), status: 'Active' },
  { id: 'wh6', topic: 'document.received', protocol: 'HTTPS', endpoint: 'https://evidence.nuvei.example/intake/callback', createdBy: USERS[6].email, dateCreated: agoDate(151), status: 'Active' },
  { id: 'wh7', topic: 'consolidation.detected', protocol: 'HTTPS', endpoint: 'https://events.nuvei.example/disputes/v2/linked-groups', createdBy: USERS[2].email, dateCreated: agoDate(96), status: 'Active' },
  { id: 'wh8', topic: 'upload.completed', protocol: 'HTTPS', endpoint: 'https://internal.nuvei.example/batch/import-receipt', createdBy: USERS[5].email, dateCreated: agoDate(74), status: 'Active' },
  { id: 'wh9', topic: 'case.assigned', protocol: 'HTTPS', endpoint: 'https://hooks.nuvei.example/workforce/assignment-feed', createdBy: USERS[7].email, dateCreated: agoDate(38), status: 'Paused' },
];

/* ------------------------------------------------------------------ *
 * System preferences
 * ------------------------------------------------------------------ */

export const buildSystemPreferences = (b = brand) => ({
  numbering: { ...b.numbering },
  currency: b.currency,
  locale: b.locale,
  timezone: b.timezone,
  dueDateOffsets: {
    schemeDays: { ...b.dueDateOffsets.schemeDays },
    claimDays: b.dueDateOffsets.claimDays,
    internalBufferDays: b.dueDateOffsets.internalBufferDays,
  },
  thresholds: { ...b.thresholds },
  routing: {
    autoAssign: b.thresholds.autoAssign,
    highValue: b.thresholds.routingHighValue,
    defaultReviewer: CURRENT_USER.email,
  },
});

/* ------------------------------------------------------------------ *
 * Bulk action history
 * ------------------------------------------------------------------ */

export const BULK_ACTION_HISTORY = [
  { id: 'ba3', name: 'Route overdue non-receipt to logistics', runAt: ago(1, 2), runBy: CURRENT_USER.email, matched: 46, applied: 46, status: 'Completed' },
  { id: 'ba2', name: `Reassign ${USERS[7].name}’s open cases`, runAt: ago(4), runBy: CURRENT_USER.email, matched: 23, applied: 23, status: 'Completed' },
  { id: 'ba1', name: 'Accept liability below the processing minimum', runAt: ago(11), runBy: USERS[3].email, matched: 12, applied: 12, status: 'Completed' },
];

/* ------------------------------------------------------------------ *
 * Templates library — reusable representment letters and evidence
 * documents that can be attached to a case from Work case.
 * ------------------------------------------------------------------ */

export const TEMPLATE_LIBRARY = [
  { id: 'tpl7', name: 'Fraud Template.pdf', type: 'pdf', size: 142_336, modifiedBy: CURRENT_USER.email, lastModified: ago(2) },
  { id: 'tpl6', name: 'Non Fraud Template.pdf', type: 'pdf', size: 138_240, modifiedBy: USERS[2].email, lastModified: ago(5) },
  { id: 'tpl5', name: 'No Show Template.pdf', type: 'pdf', size: 96_256, modifiedBy: USERS[3].email, lastModified: ago(9) },
  { id: 'tpl4', name: 'Final Audit Template.pdf', type: 'pdf', size: 121_856, modifiedBy: USERS[3].email, lastModified: ago(14) },
  { id: 'tpl3', name: 'Sixt Template.pdf', type: 'pdf', size: 108_032, modifiedBy: USERS[4].email, lastModified: ago(22) },
  { id: 'tpl2', name: 'Refund Template.pdf', type: 'pdf', size: 88_064, modifiedBy: CURRENT_USER.email, lastModified: ago(30) },
  { id: 'tpl1', name: 'Compelling Evidence Template.pdf', type: 'pdf', size: 188_416, modifiedBy: USERS[7].email, lastModified: ago(41) },
];
