import { Badge } from '@/components/ui/Surface';
import { Tooltip, TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import brand from '@/brand/brand.config';
import { columnsFor, getCaseType } from '@/domain/caseTypes';
import { getDocStatus, getOutcome, getStatus } from '@/domain/statuses';
import { formatCurrency, formatDueIn, formatShortDate, urgencyOf } from '@/utils/format';

/**
 * Cell renderers for the case table, shared by Case management and Work case.
 *
 * The `reference` column is the adaptive one: on the mixed view it renders
 * whichever identifier the row actually has — an ARN for a chargeback, the item
 * title for a claim — instead of showing both columns half-empty.
 */

const schemeVar = (colorKey) => `var(--c-${colorKey.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)})`;

export function SchemeChip({ networkId }) {
  const scheme = brand.schemes.find((s) => s.id === networkId);
  if (!scheme) return <span className="subtle">—</span>;
  return (
    <span className="scheme-chip">
      <span className="scheme-chip__mark" style={{ background: schemeVar(scheme.colorKey) }} />
      {scheme.label}
    </span>
  );
}

export function DueCell({ dueDate }) {
  const urgency = urgencyOf(dueDate);
  return (
    <span className={`due due--${urgency}`} title={formatShortDate(dueDate)}>
      {urgency === 'overdue' && <Icon name="alert" size={10} />}
      {formatDueIn(dueDate)}
    </span>
  );
}

export function CaseTypeBadge({ caseType }) {
  const spec = getCaseType(caseType);
  const label = caseType === 'claim' ? `${spec.short} — ${brand.terms.claimProgramme}` : `${spec.short} — ${spec.label} (card scheme dispute)`;
  return <Tooltip label={label}><Badge tone={spec.tone}>{spec.short}</Badge></Tooltip>;
}

/**
 * Status/outcome/doc-status as an icon, not a pill — the label moves into a
 * hover tooltip instead of sitting in the cell as text. Icon color reuses
 * the same tone the Badge/dot system already defines (domain/statuses.js),
 * so nothing about the semantics changes, only the shape.
 */
const TONE_VAR = {
  neutral: 'var(--c-ink-muted)',
  muted: 'var(--c-ink-subtle)',
  primary: 'var(--c-primary)',
  info: 'var(--c-info)',
  success: 'var(--c-success)',
  warning: 'var(--c-warning)',
  danger: 'var(--c-danger)',
};

export const STATUS_ICON = {
  open: 'inbox', ready: 'checklist', assigned: 'user', working: 'edit',
  pended: 'pause', represented: 'shield', completed: 'check',
  rejected: 'close', expired: 'clock', written_off: 'archive',
};
export const OUTCOME_ICON = { pending: 'clock', won: 'check', lost: 'close', written_off: 'archive' };
export const DOC_STATUS_ICON = { received: 'check', pending: 'clock', missing: 'alert', not_required: 'close' };

function ToneIcon({ icon, tone, label }) {
  return (
    <Tooltip label={label}>
      <span className="row row--xtight row--nowrap" style={{ display: 'inline-flex' }}>
        <Icon name={icon} size={15} style={{ color: TONE_VAR[tone] ?? TONE_VAR.neutral }} />
      </span>
    </Tooltip>
  );
}

function Reference({ row }) {
  if (row.caseType === 'chargeback') {
    return (
      <TruncatedText value={row.arn} className="mono" tooltip={`ARN ${row.arn} · ${row.reasonCode} ${row.reasonLabel}`} />
    );
  }
  return <TruncatedText value={row.itemTitle} tooltip={`${row.itemTitle} · ${row.reasonLabel}`} />;
}

const RENDERERS = {
  id: (r) => <span className="mono strong nowrap">{r.id}</span>,
  caseType: (r) => <CaseTypeBadge caseType={r.caseType} />,
  reference: (r) => <Reference row={r} />,
  arn: (r) => <TruncatedText value={r.arn ?? '—'} className="mono" />,
  network: (r) => <SchemeChip networkId={r.network} />,
  reasonCode: (r) => <TruncatedText value={`${r.reasonCode} · ${r.reasonLabel}`} tooltip={r.reasonLabel} />,
  bankCode: (r) => <span className="mono small">{r.reasonCode ?? '—'}</span>,
  cycle: (r) => <TruncatedText value={r.cycleLabel ?? '—'} />,
  cardholder: (r) => <TruncatedText value={r.cardholder ?? '—'} />,
  mid: (r) => <span className="mono">{r.mid}</span>,
  itemTitle: (r) => <TruncatedText value={r.itemTitle} />,
  claimReason: (r) => <TruncatedText value={r.reasonLabel} />,
  buyer: (r) => <TruncatedText value={r.buyer} />,
  seller: (r) => <TruncatedText value={r.seller} />,
  orderId: (r) => <span className="mono">{r.orderId}</span>,
  paymentMethod: (r) => <TruncatedText value={r.paymentMethod} />,
  entityLabel: (r) => <TruncatedText value={r.entityLabel} />,
  serviceDate: (r) => <span className="small">{formatShortDate(r.serviceDate)}</span>,
  disputeAmount: (r) => <span className="mono">{formatCurrency(r.disputeAmount, r.currency)}</span>,
  status: (r) => {
    const s = getStatus(r.status);
    return <ToneIcon icon={STATUS_ICON[r.status] ?? 'inbox'} tone={s.tone} label={s.label} />;
  },
  outcome: (r) => {
    const o = getOutcome(r.outcome);
    return o ? <ToneIcon icon={OUTCOME_ICON[r.outcome] ?? 'clock'} tone={o.tone} label={o.label} /> : <span className="subtle">—</span>;
  },
  docStatus: (r) => {
    const d = getDocStatus(r.docStatus);
    return d ? <ToneIcon icon={DOC_STATUS_ICON[r.docStatus] ?? 'clock'} tone={d.tone} label={d.label} /> : <span className="subtle">—</span>;
  },
  queueLabel: (r) => <TruncatedText value={r.queueLabel} />,
  worker: (r) => (r.worker === '—' ? <span className="subtle">eConsumer Services</span> : <TruncatedText value={r.worker} className="mono" />),
  dueDate: (r) => <DueCell dueDate={r.dueDate} />,
};

/** Table columns for a case-type filter, with renderers and export accessors. */
export function buildCaseColumns(caseType = 'all', { linkedIds } = {}) {
  return columnsFor(caseType).map((c) => ({
    ...c,
    cell: (row) => {
      const content = RENDERERS[c.key]?.(row) ?? <TruncatedText value={String(row[c.key] ?? '—')} />;
      if (c.key !== 'id' || !linkedIds?.has(row.id)) return content;
      return (
        <span className="row row--xtight row--nowrap">
          {content}
          <Icon name="link" size={11} style={{ color: 'var(--c-primary)' }} title="Consolidated with other cases" />
        </span>
      );
    },
    exportValue: (row) => {
      if (c.key === 'reference') return row.caseType === 'chargeback' ? row.arn : row.itemTitle;
      if (c.key === 'status') return getStatus(row.status).label;
      if (c.key === 'outcome') return getOutcome(row.outcome)?.label ?? '';
      if (c.key === 'docStatus') return getDocStatus(row.docStatus)?.label ?? '';
      if (c.key === 'bankCode') return row.reasonCode ?? '';
      return row[c.key] ?? '';
    },
  }));
}
