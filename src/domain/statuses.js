/**
 * Case lifecycle vocabulary.
 *
 * The reference product carried TWO parallel status systems — a 4-value
 * `CaseStatus` and a 9-value `WorkState`, with a comment admitting the richer
 * one had not been adopted everywhere. That split is a bug generator, so this
 * build has exactly one status list and everything derives from it.
 */

export const STATUSES = [
  { id: 'open', label: 'Open', tone: 'neutral', stage: 'intake', group: 'Representment Queues' },
  { id: 'ready', label: 'Ready', tone: 'info', stage: 'intake', group: 'Representment Queues' },
  { id: 'assigned', label: 'Assigned', tone: 'info', stage: 'active', group: 'Representment Queues' },
  { id: 'working', label: 'Working', tone: 'primary', stage: 'active', group: 'Representment Queues' },
  { id: 'pended', label: 'Pended', tone: 'warning', stage: 'active', group: 'Representment Queues' },
  { id: 'represented', label: 'Represented', tone: 'primary', stage: 'submitted', group: 'Representment Queues' },
  { id: 'completed', label: 'Completed', tone: 'success', stage: 'closed', group: 'Issues' },
  { id: 'rejected', label: 'Rejected', tone: 'danger', stage: 'closed', group: 'Issues' },
  { id: 'expired', label: 'Expired', tone: 'danger', stage: 'closed', group: 'Issues' },
  { id: 'written_off', label: 'Written Off', tone: 'muted', stage: 'closed', group: 'Issues' },
];

const BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

export const getStatus = (id) => BY_ID[id] ?? { id, label: id, tone: 'neutral', stage: 'active' };
export const statusLabel = (id) => getStatus(id).label;
export const statusTone = (id) => getStatus(id).tone;

export const CLOSED_STATUSES = STATUSES.filter((s) => s.stage === 'closed').map((s) => s.id);
export const isClosed = (id) => CLOSED_STATUSES.includes(id);
export const isOpen = (id) => !isClosed(id);

/** Statuses an analyst can actually pick up and work. */
export const WORKABLE_STATUSES = ['ready', 'assigned', 'working', 'pended'];

/** Status Filter popover groups on Case management. */
export const STATUS_GROUPS = ['Representment Queues', 'Issues'];

/* ------------------------------------------------------------------ *
 * Outcomes and document status
 * ------------------------------------------------------------------ */

export const OUTCOMES = [
  { id: 'pending', label: 'Pending', tone: 'warning' },
  { id: 'won', label: 'Won', tone: 'success' },
  { id: 'lost', label: 'Lost', tone: 'danger' },
  { id: 'written_off', label: 'Written Off', tone: 'muted' },
];

const OUTCOME_BY_ID = Object.fromEntries(OUTCOMES.map((o) => [o.id, o]));
export const getOutcome = (id) => OUTCOME_BY_ID[id] ?? null;

export const DOC_STATUSES = [
  { id: 'received', label: 'Received', tone: 'success' },
  { id: 'pending', label: 'Pending', tone: 'warning' },
  { id: 'missing', label: 'Missing', tone: 'danger' },
  { id: 'not_required', label: 'Not Required', tone: 'muted' },
];

const DOC_BY_ID = Object.fromEntries(DOC_STATUSES.map((d) => [d.id, d]));
export const getDocStatus = (id) => DOC_BY_ID[id] ?? null;

/* ------------------------------------------------------------------ *
 * Resolutions — the four Actions tiles on Work case
 * ------------------------------------------------------------------ */

export const RESOLUTIONS = [
  { id: 'representment', label: 'Representment', icon: 'shield', nextStatus: 'represented', outcome: 'pending', description: 'Defend the transaction with compelling evidence.' },
  { id: 'write_off', label: 'Accept Liability', icon: 'archive', nextStatus: 'written_off', outcome: 'written_off', description: 'Accept the loss — recovery costs more than it returns.' },
  { id: 'charge_entity', label: 'Charge to Entity', icon: 'building', nextStatus: 'completed', outcome: 'lost', description: 'Pass the liability to the selling entity.' },
  { id: 'split_case', label: 'Split Case', icon: 'layers', nextStatus: 'represented', outcome: 'pending', description: 'Divide the amount across more than one outcome.' },
];

export const getResolution = (id) => RESOLUTIONS.find((r) => r.id === id) ?? null;

/* ------------------------------------------------------------------ *
 * Priority — derived, never stored
 * ------------------------------------------------------------------ *
 * There is no Case priority page in this build, so priority is computed from
 * the due date and the amount rather than being a field somebody maintains.
 */

export function priorityOf(caseRecord, riskAmount = 250) {
  if (!caseRecord?.dueDate) return 'low';
  const days = Math.floor((new Date(caseRecord.dueDate).getTime() - Date.now()) / 86_400_000);
  const highValue = (caseRecord.disputeAmount ?? 0) >= riskAmount;

  if (days < 0) return 'critical';
  if (days <= 1) return 'critical';
  if (days <= 3) return highValue ? 'critical' : 'high';
  if (days <= 7) return highValue ? 'high' : 'normal';
  return 'low';
}

export const PRIORITY_TONE = { critical: 'danger', high: 'warning', normal: 'neutral', low: 'muted' };
