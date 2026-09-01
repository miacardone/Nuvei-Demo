/**
 * Documentation and help content: API reference, custom-report definitions,
 * and the Help center.
 */

import brand from '@/brand/brand.config';
import { CURRENT_USER, USERS } from '@/data/people';

const NOW = Date.now();
const DAY = 86_400_000;
const ago = (d) => new Date(NOW - d * DAY).toISOString();
const ahead = (d) => new Date(NOW + d * DAY).toISOString();

/* ------------------------------------------------------------------ *
 * API documentation
 * ------------------------------------------------------------------ */

export const API_BASE = 'https://api.example.com/v1';

export const API_GROUPS = ['Cases', 'Rules', 'Case admin', 'Reports', 'Users', 'System'];

export const API_ENDPOINTS = [
  {
    id: 'list_cases', group: 'Cases', method: 'GET', path: '/cases',
    summary: 'List cases across both intake paths.',
    description: 'One collection holds chargebacks and Buyer Protection claims, distinguished by `caseType`. Card fields are null on claims; marketplace fields are present on both.',
    query: [
      { name: 'caseType', type: 'string', required: false, description: 'chargeback | claim' },
      { name: 'status', type: 'string[]', required: false, description: 'Lifecycle statuses to include.' },
      { name: 'queueId', type: 'string', required: false, description: 'Restrict to one queue.' },
      { name: 'search', type: 'string', required: false, description: 'Matches case #, ARN, order, item, buyer or seller.' },
      { name: 'page', type: 'integer', required: false, description: 'Defaults to 1.' },
      { name: 'pageSize', type: 'integer', required: false, description: 'Defaults to 25, max 200.' },
    ],
    response: {
      data: [{ id: 'EXP-810008', caseType: 'chargeback', status: 'working', disputeAmount: 621.9, currency: 'EUR', network: 'visa', reasonCode: '13.1', cycleId: 'first_cb', queueId: 'bank_non_fraud_code', arn: '74537286104920117364520', orderId: 'ORD-38340681', seller: '@archive_amsterdam' }],
      meta: { page: 1, pageSize: 25, total: 1200 },
    },
    errors: [{ code: 400, meaning: 'Unknown filter value.' }, { code: 401, meaning: 'Missing or expired bearer token.' }],
  },
  {
    id: 'get_case', group: 'Cases', method: 'GET', path: '/cases/{caseId}',
    summary: 'Retrieve one case with documents, history and notes.',
    description: 'Includes the marketplace context a chargeback carries — item, order and seller — which is what makes a 13.3 defensible without a second system.',
    params: [{ name: 'caseId', type: 'string', required: true, description: 'e.g. EXP-810008' }],
    response: { id: 'EXP-810008', caseType: 'chargeback', status: 'working', itemTitle: 'Mulberry Bayswater, oak', documents: [{ id: 'EXP-810008-merchant-1', title: 'Representment Letter' }], flags: ['consolidated', 'high_value'] },
    errors: [{ code: 404, meaning: 'No case with that id.' }],
  },
  {
    id: 'patch_case', group: 'Cases', method: 'PATCH', path: '/cases/{caseId}',
    summary: 'Update status, queue or assignment.',
    params: [{ name: 'caseId', type: 'string', required: true }],
    body: [
      { name: 'status', type: 'string', required: false },
      { name: 'queueId', type: 'string', required: false },
      { name: 'worker', type: 'string', required: false },
      { name: 'assignmentReason', type: 'string', required: false, description: 'Required whenever the assignee changes.' },
    ],
    response: { id: 'EXP-810008', status: 'pended' },
    errors: [{ code: 422, meaning: 'Assignment reason missing while changing the assignee.' }],
  },
  {
    id: 'decision', group: 'Cases', method: 'POST', path: '/cases/{caseId}/decision',
    summary: 'Record a resolution against a case.',
    params: [{ name: 'caseId', type: 'string', required: true }],
    body: [
      { name: 'resolution', type: 'string', required: true, description: 'representment | write_off | charge_entity | split_case' },
      { name: 'amounts', type: 'object', required: false, description: 'Required for split_case; the three parts must sum to the case amount.' },
      { name: 'note', type: 'string', required: false },
    ],
    response: { id: 'EXP-810008', status: 'represented', outcome: 'pending' },
    errors: [{ code: 409, meaning: 'A blocking special instruction prevents this resolution.' }, { code: 422, meaning: 'Split amounts do not sum to the case amount.' }],
  },
  {
    id: 'consolidation', group: 'Cases', method: 'GET', path: '/cases/{caseId}/consolidation',
    summary: 'Linked cases that should be worked together.',
    description: 'Returns every group the case belongs to. `duplicateRefundRisk` marks the dangerous one — the same order disputed through two channels. A shared seller across different orders is NOT flagged, because those are separate losses.',
    params: [{ name: 'caseId', type: 'string', required: true }],
    response: { groups: [{ id: 'same_order:ORD-48030237', ruleId: 'same_order', size: 2, totalExposure: 1734.1, crossChannel: true, duplicateRefundRisk: true, caseIds: ['EXP-810872', 'EXP-810078'] }] },
    errors: [{ code: 404, meaning: 'No case with that id.' }],
  },
  {
    id: 'rule_groups', group: 'Rules', method: 'GET', path: '/rule-groups',
    summary: 'List rule groups with their rules and execution order.',
    response: { data: [{ id: 'rg2', name: '00_Case Creation', triggeredBy: 'Case Import', enabled: true, ruleCount: 4, subRuleCount: 1 }] },
    errors: [{ code: 401, meaning: 'Missing or expired bearer token.' }],
  },
  {
    id: 'rule_check', group: 'Rules', method: 'POST', path: '/rules/{ruleId}/check',
    summary: 'Test one case against one rule.',
    description: 'Returns a verdict per criterion so a rule that did not fire can be explained rather than guessed at.',
    params: [{ name: 'ruleId', type: 'string', required: true }],
    body: [{ name: 'caseId', type: 'string', required: true, description: 'Case # or ARN.' }],
    response: { verdict: 'partial', passedCount: 5, total: 6, results: [{ label: 'Card Scheme', actual: 'visa', passed: true }] },
    errors: [{ code: 404, meaning: 'Rule or case not found.' }],
  },
  {
    id: 'bulk_preview', group: 'Rules', method: 'POST', path: '/bulk-actions/preview',
    summary: 'Count the cases a criteria set would match.',
    body: [{ name: 'criteria', type: 'object[]', required: true }, { name: 'matchType', type: 'string', required: false, description: 'all | any' }],
    response: { matched: 46, total: 1200, sample: ['EXP-810012'] },
    errors: [{ code: 400, meaning: 'Unknown criterion key.' }],
  },
  {
    id: 'queues', group: 'Case admin', method: 'GET', path: '/queues',
    summary: 'Queues with live depth and service targets.',
    response: { data: [{ id: 'all_chargebacks', label: 'All Chargebacks', sla: 24, casesInQueue: 143 }] },
    errors: [{ code: 401, meaning: 'Missing or expired bearer token.' }],
  },
  {
    id: 'import', group: 'Case admin', method: 'POST', path: '/cases/import',
    summary: 'Import cases from CSV.',
    description: 'Multipart upload. Rows failing validation are rejected individually and reported rather than failing the batch.',
    body: [{ name: 'file', type: 'file', required: true, description: 'CSV matching the documented column set.' }],
    response: { uploadId: 'up15', rows: 148, accepted: 147, rejected: 1 },
    errors: [{ code: 415, meaning: 'File is not a CSV.' }, { code: 422, meaning: 'Required column missing from the header row.' }],
  },
  {
    id: 'reports_summary', group: 'Reports', method: 'GET', path: '/reports/summary',
    summary: 'Totals by reason category and due-date bucket.',
    response: { byCategory: [{ category: 'consumer', pastDue: 12, today: 8, total: 604 }] },
    errors: [{ code: 401, meaning: 'Missing or expired bearer token.' }],
  },
  {
    id: 'run_report', group: 'Reports', method: 'POST', path: '/reports/{reportId}/run',
    summary: 'Run a saved report now.',
    params: [{ name: 'reportId', type: 'string', required: true }],
    response: { rows: 1200, format: 'csv', url: `${API_BASE}/downloads/rep_01.csv` },
    errors: [{ code: 404, meaning: 'No report with that id.' }],
  },
  {
    id: 'users', group: 'Users', method: 'GET', path: '/users',
    summary: 'Users with roles, groups and skills.',
    response: { data: [{ id: 'u5', name: 'Lena Fischer', role: brand.terms.analyst, skills: ['All Dispute Response'] }] },
    errors: [{ code: 403, meaning: 'Role lacks the User Management permission.' }],
  },
  {
    id: 'permissions', group: 'Users', method: 'GET', path: '/permissions',
    summary: 'The permission matrix by role.',
    response: { data: [{ role: 'manager', granted: ['Dashboard', 'Case Management'], total: 26 }] },
    errors: [{ code: 403, meaning: 'Role lacks the Permissions permission.' }],
  },
  {
    id: 'prefs', group: 'System', method: 'GET', path: '/system/preferences',
    summary: 'Numbering, due-date offsets and thresholds.',
    response: { numbering: { prefix: 'EXP', digits: 6 }, dueDateOffsets: { schemeDays: { visa: 30, mastercard: 45, amex: 20 }, internalBufferDays: 4 }, thresholds: { riskAmount: 250 } },
    errors: [{ code: 403, meaning: 'Role lacks the System Preferences permission.' }],
  },
  {
    id: 'webhooks', group: 'System', method: 'POST', path: '/webhooks',
    summary: 'Register a webhook endpoint.',
    body: [{ name: 'topic', type: 'string', required: true }, { name: 'endpoint', type: 'string', required: true, description: 'Must be HTTPS.' }],
    response: { id: 'wh_1', status: 'Active' },
    errors: [{ code: 422, meaning: 'Endpoint is not HTTPS.' }],
  },
];

export const AUTH_NOTE = {
  title: 'Authentication',
  body: 'Every request takes a bearer token in the Authorization header. Tokens are scoped to a tenant, so the same credentials cannot read another tenant’s book.',
  sample: 'Authorization: Bearer <token>',
};

/* ------------------------------------------------------------------ *
 * Custom reports
 * ------------------------------------------------------------------ */

export const REPORT_TYPES = ['Operational', 'Financial', 'Compliance', 'Marketplace'];
export const REPORT_FORMATS = ['CSV', 'XLSX', 'JSON', 'PDF'];
/**
 * Group-by and filter options both come from domain/reportFields.js so the two
 * controls cannot drift. Nothing here duplicates that list.
 */

export const REPORT_TEMPLATES = [
  { id: 'tpl_operational', name: 'Operational queue review', description: 'Open cases by queue and assignee with due-date pressure.', type: 'Operational', groupBy: 'queue' },
  { id: 'tpl_reason', name: 'Reason code analysis', description: 'Volume and value by scheme reason code and category.', type: 'Compliance', groupBy: 'reasonCategory' },
  { id: 'tpl_recovery', name: 'Recovery and write-off', description: 'Closed cases with outcome and recovered value.', type: 'Financial', groupBy: 'entity' },
  { id: 'tpl_marketplace', name: 'Marketplace exposure', description: 'Seller and item context across both intake paths.', type: 'Marketplace', groupBy: 'caseType' },
];

export const SAVED_REPORTS = [
  { id: 'rep1', name: 'Daily queue standup', type: 'Operational', templateId: 'tpl_operational', dateCreated: ago(64), createdBy: CURRENT_USER.email, rowCount: 901, fileSize: '182 KB', format: 'CSV', schedule: { mode: 'recurring', frequency: 'Daily', hour: 8, recipients: [`ops@${brand.emailDomain}`], nextRunAt: ahead(1) } },
  { id: 'rep2', name: 'Weekly reason-code mix', type: 'Compliance', templateId: 'tpl_reason', dateCreated: ago(120), createdBy: USERS[2].email, rowCount: 1200, fileSize: '311 KB', format: 'XLSX', schedule: { mode: 'recurring', frequency: 'Weekly', hour: 9, recipients: [`risk@${brand.emailDomain}`, `ops@${brand.emailDomain}`], nextRunAt: ahead(4) } },
  { id: 'rep3', name: 'Month-end recovery', type: 'Financial', templateId: 'tpl_recovery', dateCreated: ago(210), createdBy: CURRENT_USER.email, rowCount: 299, fileSize: '74 KB', format: 'XLSX', schedule: { mode: 'recurring', frequency: 'Monthly', hour: 7, recipients: [`finance@${brand.emailDomain}`], nextRunAt: ahead(9) } },
  { id: 'rep4', name: 'Counterfeit seller review', type: 'Marketplace', templateId: 'tpl_marketplace', dateCreated: ago(18), createdBy: USERS[6].email, rowCount: 64, fileSize: '21 KB', format: 'CSV', schedule: { mode: 'on_demand' } },
  { id: 'rep5', name: 'Pre-arbitration watchlist', type: 'Operational', templateId: 'tpl_operational', dateCreated: ago(7), createdBy: USERS[8].email, rowCount: 108, fileSize: '33 KB', format: 'PDF', schedule: { mode: 'on_demand' } },
];

/* ------------------------------------------------------------------ *
 * Help
 * ------------------------------------------------------------------ */

export const HELP_VIDEOS = [
  { id: 'v1', title: 'Working your first case', description: 'The three-column workspace, the document viewer and recording a decision.', duration: '6:12', level: 'Getting started' },
  { id: 'v2', title: 'Understanding consolidation', description: 'Why cases get linked, and what to do when one order is disputed twice.', duration: '4:48', level: 'Getting started' },
  { id: 'v3', title: 'Building a routing rule', description: 'Criteria, actions and details in the add-rule builder.', duration: '8:31', level: 'Intermediate' },
  { id: 'v4', title: 'Bulk actions without breaking things', description: 'Using the live match count to check scope before you apply.', duration: '5:07', level: 'Intermediate' },
  { id: 'v5', title: 'Custom reports and scheduling', description: 'Templates, field grouping and recurring delivery.', duration: '7:24', level: 'Intermediate' },
  { id: 'v6', title: 'Reading the monitoring dashboards', description: 'Document processing, outcomes and what the error types mean.', duration: '5:52', level: 'Advanced' },
];

export const HELP_DOCS = [
  { id: 'd1', title: 'Reason code reference', description: 'Every Visa, Mastercard and Amex code handled, with evidence requirements.', category: 'Reference', readingMinutes: 14 },
  { id: 'd2', title: 'Due dates and internal buffers', description: 'How network windows, cycles and the internal buffer combine.', category: 'Reference', readingMinutes: 6 },
  { id: 'd3', title: 'Evidence that actually wins', description: 'What issuers accept for non-receipt and not-as-described disputes.', category: 'Playbook', readingMinutes: 11 },
  { id: 'd4', title: 'Consolidation thresholds explained', description: 'Why the seller rule needs three cases and the card rule needs two.', category: 'Playbook', readingMinutes: 7 },
  { id: 'd5', title: 'CSV import specification', description: 'Column-by-column reference for case uploads.', category: 'Reference', readingMinutes: 9 },
  { id: 'd6', title: 'Webhook payload schemas', description: 'Every topic, its payload and delivery guarantees.', category: 'Integration', readingMinutes: 12 },
  { id: 'd7', title: 'Roles and permissions model', description: 'What each role can do, and how group membership interacts.', category: 'Administration', readingMinutes: 8 },
  { id: 'd8', title: 'Writing off responsibly', description: 'When accepting the loss is the correct commercial decision.', category: 'Playbook', readingMinutes: 5 },
];

export const HELP_FAQ = [
  {
    id: 'f1',
    question: 'Why does a chargeback show marketplace details like the item and seller?',
    answer: 'Because you usually cannot defend a card dispute without them. A “not as described” reason code is an argument about the listing, so the listing, its photos and the seller’s history sit on the case alongside the ARN. Both intake paths share one record shape for exactly this reason.',
  },
  {
    id: 'f2',
    question: 'What does the consolidation flag actually mean?',
    answer: 'That this case is linked to at least one other by card, order or seller. The Related cases panel shows what linked them, the group size and the total exposure across the group.',
  },
  {
    id: 'f3',
    question: 'Is every consolidated group a double-refund risk?',
    answer: 'No, and the distinction matters. Only a shared ORDER can be refunded twice. A seller group that happens to contain a chargeback and a claim across two different orders is two separate losses — real money, but not the same money twice. Only shared-order groups carry the danger treatment.',
  },
  {
    id: 'f4',
    question: 'Why is Accept Liability disabled on some cases?',
    answer: 'A blocking special instruction is in force — for example a regulatory hold on a confirmed-fraud case above the risk amount. Hover the disabled tile and it names the instruction. The instruction card and the buttons are wired to the same rule, so they can never disagree.',
  },
  {
    id: 'f5',
    question: 'What is the difference between the internal and network due date?',
    answer: 'The network due date is the scheme’s hard deadline. The internal due date is that date minus a configurable buffer, so there is time to fix a rejected submission. Analysts work to the internal date; both appear on the case.',
  },
  {
    id: 'f6',
    question: 'Why did my rule not fire on a case I expected it to match?',
    answer: 'Run it through Rule check. It evaluates each criterion separately and shows which passed, so a rule that matched five of six tells you exactly which one to change.',
  },
  {
    id: 'f7',
    question: 'Does the bulk-action match count reflect real cases?',
    answer: 'Yes. The wizard evaluates your criteria against the live book as you build them, using the same engine the rules use. The number in the review step is the number of cases that will change.',
  },
  {
    id: 'f8',
    question: 'Where did the Scheduler page go?',
    answer: 'A schedule belongs to a report, so scheduling is a step inside the Custom reports builder rather than a separate screen. Scheduled reports have their own tab in the reports list.',
  },
];

export const HELP_CONTACT_TOPICS = ['Access or permissions', 'Case data looks wrong', 'Rules and automation', 'API or webhooks', 'Billing and contract', 'Something else'];
