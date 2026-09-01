import { useMemo, useState } from 'react';
import { PageHeader, Card, Toolbar, Tabs, Button, IconButton, Badge, Kpi, EmptyState } from '@/components/ui/Surface';
import { DataTable, ExportButtons } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { SearchBar, SelectField, TextField } from '@/components/ui/Form';
import { BarChart, Donut, BarRows } from '@/components/charts/Charts';
import { Popover, TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { REPORT_FORMATS, REPORT_TEMPLATES, REPORT_TYPES, SAVED_REPORTS } from '@/data/content';
import { FILTER_OPERATORS, REPORT_FIELDS, applyReportScope, describeFilter, getReportField } from '@/domain/reportFields';
import { CASES } from '@/data/cases';
import { DUE_BUCKETS, caseActivityPerWeek, dueBucketOf, reasonCodeDonut, topSellersByVolume, totalsByQueue, weeklySeries } from '@/domain/metrics';
import brand, { categoryLabel } from '@/brand/brand.config';
import { useToast } from '@/context/ToastContext';
import { formatCompactCurrency, formatCurrency, formatDate, formatNumber } from '@/utils/format';

/**
 * Custom reports.
 *
 * Scheduling lives HERE, in the builder, rather than on a Scheduler page — a
 * schedule belongs to a report. Scheduled reports get their own tab in the list.
 */

const TABS = [{ value: 'reports', label: 'Reports' }, { value: 'scheduled', label: 'Scheduled reports' }, { value: 'builder', label: 'Report builder' }];

/** Each template covers a genuinely different angle, so each gets its own
 *  icon rather than the one generic "spreadsheet" glyph every template used
 *  to share. */
const TEMPLATE_META = {
  tpl_operational: { icon: 'inbox' },
  tpl_reason: { icon: 'searchCheck' },
  tpl_recovery: { icon: 'archive' },
  tpl_marketplace: { icon: 'layers' },
};

/** Real report columns, shared by every template — this is what the info
 *  popover's checklist actually controls, not a per-template blurb. */
const REPORT_COLUMN_DEFAULTS = [
  { key: 'id', label: 'Case #' },
  { key: 'queueLabel', label: 'Queue' },
  { key: 'worker', label: 'Assigned to' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'status', label: 'Status' },
  { key: 'disputeAmount', label: 'Disputed amount' },
];
const REPORT_COLUMN_OPTIONAL = [
  { key: 'networkDueDate', label: 'SLA target' },
  { key: 'reviewer', label: 'Reviewer' },
  { key: 'assignmentReason', label: 'Assignment reason' },
  { key: 'bankCode', label: 'Bank code' },
];

/** The second preview chart follows the template's own groupBy, not a fixed
 *  reason-code donut for every template — a recovery report should show
 *  entities, not schemes. */
function breakdownFor(scoped, groupBy) {
  const by = new Map();
  scoped.forEach((c) => {
    const key = groupBy === 'queue' ? c.queueLabel
      : groupBy === 'entity' ? c.entityLabel
        : groupBy === 'caseType' ? (c.caseType === 'chargeback' ? brand.terms.chargebacks : brand.terms.claims)
          : categoryLabel(c.reasonCategory) ?? 'Other';
    by.set(key, (by.get(key) ?? 0) + 1);
  });
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
}

/**
 * Each template renders a genuinely different pair of visuals, not the same
 * chart with a different groupBy — an operational review is about queue
 * pressure, a recovery report is about money, a marketplace report is about
 * sellers. `kpis` also swaps per template so the top row isn't identical
 * across all four.
 */
function templatePreview(templateId, scoped, brandRef) {
  const closed = scoped.filter((c) => ['completed', 'rejected', 'expired', 'written_off'].includes(c.status));

  if (templateId === 'tpl_operational') {
    const queueDepth = totalsByQueue(scoped)
      .filter((q) => q.casesInQueue > 0)
      .sort((a, b) => b.casesInQueue - a.casesInQueue)
      .map((q) => ({ label: q.label, value: q.casesInQueue, meta: formatCompactCurrency(q.value) }));

    const dueBuckets = DUE_BUCKETS.map((b) => ({
      label: b.label,
      value: scoped.filter((c) => dueBucketOf(c.dueDate) === b.id).length,
      color: b.id === 'pastDue' ? 'var(--c-nav-active)' : undefined,
    }));

    return {
      kpis: [
        { label: 'Open cases', value: formatNumber(scoped.filter((c) => !closed.includes(c)).length), spark: weeklySeries(scoped, 6, () => 1, (c) => !closed.includes(c)) },
        { label: 'Past due', value: formatNumber(scoped.filter((c) => dueBucketOf(c.dueDate) === 'pastDue').length), spark: weeklySeries(scoped, 6, () => 1, (c) => dueBucketOf(c.dueDate) === 'pastDue') },
        { label: 'Unassigned', value: formatNumber(scoped.filter((c) => c.worker === '—').length), spark: weeklySeries(scoped, 6, () => 1, (c) => c.worker === '—') },
        { label: 'Queues in use', value: formatNumber(queueDepth.length) },
      ],
      primary: { title: 'Cases by queue', kind: 'rows', data: queueDepth },
      secondary: { title: 'Due-date pressure', kind: 'donut', data: dueBuckets, small: true },
    };
  }

  if (templateId === 'tpl_reason') {
    const scheme = brandRef.schemes[0];
    const schemeDonut = reasonCodeDonut(scoped, scheme.id);
    const categoryBreakdown = breakdownFor(scoped, 'reasonCategory');

    return {
      kpis: [
        { label: 'Total cases', value: formatNumber(scoped.length), spark: weeklySeries(scoped, 6, () => 1) },
        { label: `${scheme.label} share`, value: formatNumber(schemeDonut.total), spark: weeklySeries(scoped, 6, () => 1, (c) => c.network === scheme.id) },
        { label: 'Reason categories', value: formatNumber(categoryBreakdown.length) },
        { label: 'Disputed value', value: formatCompactCurrency(scoped.reduce((s, c) => s + c.disputeAmount, 0)), spark: weeklySeries(scoped, 6, (c) => c.disputeAmount) },
      ],
      primary: { title: `${scheme.label} reason codes`, kind: 'donut', data: schemeDonut.slices, centerValue: formatNumber(schemeDonut.total), centerLabel: scheme.label, small: false },
      secondary: { title: 'Fraud vs. processing vs. consumer', kind: 'rows', data: categoryBreakdown },
    };
  }

  if (templateId === 'tpl_recovery') {
    const outcomeBreakdown = ['won', 'lost', 'written_off'].map((id) => ({
      label: id === 'won' ? 'Won' : id === 'lost' ? 'Lost' : 'Written off',
      value: closed.filter((c) => c.outcome === id).length,
      color: id === 'won' ? 'var(--c-success)' : id === 'lost' ? 'var(--c-nav-active)' : 'var(--c-series-neutral)',
    }));
    const recoveredByEntity = [...new Set(closed.map((c) => c.entityLabel))]
      .map((label) => ({ label, value: closed.filter((c) => c.entityLabel === label && c.outcome === 'won').reduce((s, c) => s + c.disputeAmount, 0) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((r) => ({ ...r, meta: formatCurrency(r.value) }));

    return {
      kpis: [
        { label: 'Closed cases', value: formatNumber(closed.length), spark: weeklySeries(closed, 6, () => 1) },
        { label: 'Won', value: formatNumber(closed.filter((c) => c.outcome === 'won').length), spark: weeklySeries(closed, 6, () => 1, (c) => c.outcome === 'won') },
        { label: 'Recovered value', value: formatCompactCurrency(closed.filter((c) => c.outcome === 'won').reduce((s, c) => s + c.disputeAmount, 0)), spark: weeklySeries(closed, 6, (c) => c.disputeAmount, (c) => c.outcome === 'won') },
        { label: 'Written off', value: formatCompactCurrency(closed.filter((c) => c.outcome === 'written_off').reduce((s, c) => s + c.disputeAmount, 0)), spark: weeklySeries(closed, 6, (c) => c.disputeAmount, (c) => c.outcome === 'written_off') },
      ],
      primary: { title: 'Outcome mix', kind: 'donut', data: outcomeBreakdown, small: true },
      secondary: { title: 'Recovered value by entity', kind: 'rows', data: recoveredByEntity.map((r) => ({ label: r.label, value: r.value, meta: r.meta })) },
    };
  }

  // tpl_marketplace
  const chargebacks = scoped.filter((c) => c.caseType === 'chargeback').length;
  const claims = scoped.length - chargebacks;
  const typeSplit = [
    { label: brandRef.terms.chargebacks, value: chargebacks },
    { label: brandRef.terms.claims, value: claims, color: 'var(--c-series-1)' },
  ];
  const sellerBreakdown = topSellersByVolume(scoped, 8);

  return {
    kpis: [
      { label: 'Total cases', value: formatNumber(scoped.length), spark: weeklySeries(scoped, 6, () => 1) },
      { label: brandRef.terms.claims, value: formatNumber(claims), spark: weeklySeries(scoped, 6, () => 1, (c) => c.caseType === 'claim') },
      { label: 'Distinct sellers', value: formatNumber(sellerBreakdown.length) },
      { label: 'Disputed value', value: formatCompactCurrency(scoped.reduce((s, c) => s + c.disputeAmount, 0)), spark: weeklySeries(scoped, 6, (c) => c.disputeAmount) },
    ],
    primary: { title: `${brandRef.terms.chargebacks} vs. ${brandRef.terms.claims}`, kind: 'donut', data: typeSplit, small: true },
    secondary: { title: 'Top sellers by volume', kind: 'rows', data: sellerBreakdown },
  };
}

function PreviewPanel({ panel }) {
  return (
    <div>
      <span className="t-section-label">{panel.title}</span>
      <div style={{ marginTop: 8 }}>
        {panel.kind === 'donut' ? (
          <Donut data={panel.data} size={panel.small ? 170 : 190} legend centerValue={panel.centerValue} centerLabel={panel.centerLabel} />
        ) : panel.data.length ? (
          <BarRows rows={panel.data} />
        ) : (
          <p className="micro subtle">No data in scope.</p>
        )}
      </div>
    </div>
  );
}

function AdvancedSearchModal({ open, onClose, value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Advanced search"
      size="lg"
      footer={<><Button variant="ghost" onClick={() => onChange({ name: '', type: '', createdBy: '', format: '', minRows: '', maxRows: '' })}>Reset</Button><Button variant="primary" onClick={onClose}>Apply</Button></>}
    >
      <div className="grid grid--3">
        <TextField label="Name" value={value.name} onChange={(e) => set({ name: e.target.value })} />
        <SelectField label="Type" value={value.type} onChange={(e) => set({ type: e.target.value })} placeholder="Any type" options={REPORT_TYPES.map((t) => ({ value: t, label: t }))} />
        <TextField label="Created by" value={value.createdBy} onChange={(e) => set({ createdBy: e.target.value })} />
        <SelectField label="Format" value={value.format} onChange={(e) => set({ format: e.target.value })} placeholder="Any format" options={REPORT_FORMATS.map((f) => ({ value: f, label: f }))} />
        <TextField label="Row count min" type="number" value={value.minRows} onChange={(e) => set({ minRows: e.target.value })} />
        <TextField label="Row count max" type="number" value={value.maxRows} onChange={(e) => set({ maxRows: e.target.value })} />
      </div>
    </Modal>
  );
}

function ReportBuilder({ onSave }) {
  const { notify } = useToast();

  const [templateId, setTemplateId] = useState(REPORT_TEMPLATES[0].id);
  const [name, setName] = useState('');
  const [type, setType] = useState(REPORT_TYPES[0]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [groupBy, setGroupBy] = useState(REPORT_FIELDS[0].id);
  const [filter, setFilter] = useState({ field: '', operator: 'gt', value: '' });
  const [format, setFormat] = useState('CSV');
  const [mode, setMode] = useState('on_demand');
  const [frequency, setFrequency] = useState('Weekly');
  const [emailOnComplete, setEmailOnComplete] = useState(true);
  const [recipients, setRecipients] = useState([`ops@${brand.emailDomain}`]);
  const [recipientDraft, setRecipientDraft] = useState('');

  const template = REPORT_TEMPLATES.find((t) => t.id === templateId);
  const [extraFields, setExtraFields] = useState({});
  const activeExtras = extraFields[templateId] ?? [];

  /* The preview is computed from the SCOPED set, not the whole book — the
     point of a builder is seeing the effect before you schedule it. */
  const scoped = useMemo(() => applyReportScope(CASES, { start, end, filter }), [start, end, filter]);
  const byPeriod = useMemo(() => caseActivityPerWeek(scoped, 6), [scoped]);
  const preview = useMemo(() => templatePreview(templateId, scoped, brand), [templateId, scoped]);

  const range = start && end ? `${formatDate(start)} – ${formatDate(end)}` : 'All time';
  const filterLabel = describeFilter(filter);
  const groupByLabel = getReportField(groupBy)?.label ?? groupBy;

  const addRecipient = () => {
    const v = recipientDraft.trim();
    if (!v || recipients.includes(v)) return;
    setRecipients((p) => [...p, v]);
    setRecipientDraft('');
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)', alignItems: 'start' }}>
      <Card title="Configuration">
        <div className="stack stack--tight">
          <TextField label="Report name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly counterfeit review" />
          <SelectField label="Report type" value={type} onChange={(e) => setType(e.target.value)} options={REPORT_TYPES.map((t) => ({ value: t, label: t }))} />

          <div className="field">
            <span className="field__label">Start date</span>
            <div className="row row--xtight row--nowrap">
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              {start && <IconButton icon="close" label="Clear start date" size={12} onClick={() => setStart('')} />}
            </div>
          </div>

          <div className="field">
            <span className="field__label">End date</span>
            <div className="row row--xtight row--nowrap">
              <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              {end && <IconButton icon="close" label="Clear end date" size={12} onClick={() => setEnd('')} />}
            </div>
          </div>

          <SelectField
            label="Group by"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            options={REPORT_FIELDS.map((f) => ({ value: f.id, label: f.label }))}
          />

          {/* Filter row — field, operator, value. The field list is the same
              REPORT_FIELDS the Group by above uses, so the two cannot drift. */}
          <div className="field">
            <span className="field__label">Filter</span>
            <div className="stack stack--xtight">
              <SelectField
                value={filter.field}
                onChange={(e) => setFilter((f) => ({ ...f, field: e.target.value }))}
                placeholder="No filter"
                options={REPORT_FIELDS.map((f) => ({ value: f.id, label: f.label }))}
              />
              {filter.field && (
                <>
                  <SelectField
                    value={filter.operator}
                    onChange={(e) => setFilter((f) => ({ ...f, operator: e.target.value }))}
                    options={FILTER_OPERATORS.map((o) => ({ value: o.id, label: o.label }))}
                  />
                  <div className="row row--xtight row--nowrap">
                    <input
                      className="input"
                      value={filter.value}
                      onChange={(e) => setFilter((f) => ({ ...f, value: e.target.value }))}
                      placeholder="Value"
                      aria-label="Filter value"
                    />
                    {(filter.field || filter.value) && (
                      <IconButton icon="close" label="Clear filter" size={12} onClick={() => setFilter({ field: '', operator: 'gt', value: '' })} />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <SelectField label="Format" value={format} onChange={(e) => setFormat(e.target.value)} options={REPORT_FORMATS.map((f) => ({ value: f, label: f }))} />

          <div className="field">
            <span className="field__label">Schedule</span>
            <div className="seg">
              <button type="button" className={`seg__btn ${mode === 'on_demand' ? 'is-active' : ''}`.trim()} onClick={() => setMode('on_demand')}>Run on demand</button>
              <button type="button" className={`seg__btn ${mode === 'recurring' ? 'is-active' : ''}`.trim()} onClick={() => setMode('recurring')}>Recurring</button>
            </div>
          </div>

          {mode === 'recurring' && (
            <SelectField label="Frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)} options={['Daily', 'Weekly', 'Monthly'].map((f) => ({ value: f, label: f }))} />
          )}

          <label className="row row--xtight" style={{ cursor: 'pointer' }}>
            <input type="checkbox" className="checkbox" checked={emailOnComplete} onChange={(e) => setEmailOnComplete(e.target.checked)} />
            <span className="small">Email on complete</span>
          </label>

          <div className="field">
            <span className="field__label">Recipients</span>
            <div className="row row--tight" style={{ marginBottom: 4 }}>
              {recipients.map((r) => (
                <span key={r} className="chip">
                  {r}
                  <button type="button" className="chip__remove" onClick={() => setRecipients((p) => p.filter((x) => x !== r))} aria-label={`Remove ${r}`}>
                    <Icon name="close" size={11} />
                  </button>
                </span>
              ))}
            </div>
            <div className="row row--xtight row--nowrap">
              <input className="input" value={recipientDraft} onChange={(e) => setRecipientDraft(e.target.value)} placeholder={`name@${brand.emailDomain}`} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())} />
              <Button variant="secondary" size="sm" onClick={addRecipient}>Add</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="stack stack--tight">
        <Card title="Choose a template">
          <div className="grid grid--4">
            {REPORT_TEMPLATES.map((t) => {
              const meta = TEMPLATE_META[t.id] ?? { icon: 'spreadsheet' };
              return (
                <div key={t.id} style={{ position: 'relative' }}>
                  <button type="button" className={`tile ${templateId === t.id ? 'is-selected' : ''}`.trim()} onClick={() => { setTemplateId(t.id); setType(t.type); setGroupBy(t.groupBy); }} style={{ width: '100%' }}>
                    <span className="tile__preview"><Icon name={meta.icon} size={20} /></span>
                    <span className="small strong">{t.name}</span>
                    <span className="micro subtle">{t.description}</span>
                    {templateId === t.id && <Badge tone="success">Selected</Badge>}
                  </button>
                  <div style={{ position: 'absolute', top: 6, right: 6 }} onClick={(e) => e.stopPropagation()}>
                    <Popover
                      align="right"
                      width={250}
                      trigger={({ toggle }) => (
                        <button type="button" className="icon-btn" onClick={toggle} aria-label={`Fields in ${t.name}`}>
                          <Icon name="info" size={13} className="subtle" />
                        </button>
                      )}
                    >
                      {({ close }) => {
                        const activeSet = new Set(extraFields[t.id] ?? []);
                        return (
                          <div className="stack stack--tight" style={{ padding: 'var(--s-2)' }}>
                            <div>
                              <span className="t-section-label">Included by default</span>
                              <div className="stack stack--xtight" style={{ marginTop: 4 }}>
                                {REPORT_COLUMN_DEFAULTS.map((f) => (
                                  <label key={f.key} className="row row--xtight" style={{ cursor: 'not-allowed' }}>
                                    <input type="checkbox" className="checkbox" checked disabled />
                                    <span className="micro">{f.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="t-section-label">Not included — add if you need it</span>
                              <div className="stack stack--xtight" style={{ marginTop: 4 }}>
                                {REPORT_COLUMN_OPTIONAL.map((f) => {
                                  const on = activeSet.has(f.key);
                                  return (
                                    <label key={f.key} className="row row--xtight" style={{ cursor: 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        className="checkbox"
                                        checked={on}
                                        onChange={() => setExtraFields((p) => ({
                                          ...p,
                                          [t.id]: on ? (p[t.id] ?? []).filter((x) => x !== f.key) : [...(p[t.id] ?? []), f.key],
                                        }))}
                                      />
                                      <span className="micro">{f.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                            <Button variant="secondary" size="sm" onClick={close} style={{ alignSelf: 'flex-end' }}>Done</Button>
                          </div>
                        );
                      }}
                    </Popover>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          title="Report preview"
          action={<Button variant="primary" icon="check" disabled={!name.trim()} onClick={() => { onSave({ name: name.trim(), type, format, mode, frequency, recipients, templateId, groupBy, filter, rowCount: scoped.length }); notify(`Report “${name.trim()}” saved — ${formatNumber(scoped.length)} rows.`, 'success'); setName(''); }}>Save report</Button>}
        >
          <div className="stack">
            <div>
              <h3>{name.trim() || template.name}</h3>
              <p className="micro subtle">
                {range} · Grouped by {groupByLabel} · {template.name} · {format}
                {mode === 'recurring' ? ` · ${frequency}` : ' · On demand'}
                {filterLabel && <> · Filtered: {filterLabel}</>}
              </p>
              <p className="micro" style={{ color: scoped.length ? 'var(--c-ink-muted)' : 'var(--c-warning)' }}>
                <strong className="mono">{formatNumber(scoped.length)}</strong> of{' '}
                <strong className="mono">{formatNumber(CASES.length)}</strong> cases in scope
                {scoped.length === 0 && ' — nothing matches, so the preview is empty.'}
              </p>
              {activeExtras.length > 0 && (
                <p className="micro subtle">
                  + Custom fields added: {activeExtras.map((k) => REPORT_COLUMN_OPTIONAL.find((f) => f.key === k)?.label ?? k).join(', ')}
                </p>
              )}
            </div>

            <div className="grid grid--4">
              {preview.kpis.map((k) => <Kpi key={k.label} label={k.label} value={k.value} spark={k.spark} />)}
            </div>

            <div className="grid grid--2">
              <PreviewPanel panel={preview.primary} />
              <PreviewPanel panel={preview.secondary} />
            </div>

            <div>
              <span className="t-section-label">Cases by period</span>
              <BarChart
                data={byPeriod}
                height={200}
                xLabel="Week"
                yLabel="Cases"
                series={[{ key: 'completed', name: 'Completed' }, { key: 'represented', name: 'Represented' }, { key: 'open', name: 'Open' }]}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function CustomReports() {
  const { notify } = useToast();
  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState(SAVED_REPORTS);
  const [search, setSearch] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [criteria, setCriteria] = useState({ name: '', type: '', createdBy: '', format: '', minRows: '', maxRows: '' });

  const scheduled = reports.filter((r) => r.schedule?.mode === 'recurring');
  const source = tab === 'scheduled' ? scheduled : reports;

  const filtered = source.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (criteria.name && !r.name.toLowerCase().includes(criteria.name.toLowerCase())) return false;
    if (criteria.type && r.type !== criteria.type) return false;
    if (criteria.createdBy && !r.createdBy.includes(criteria.createdBy)) return false;
    if (criteria.format && r.format !== criteria.format) return false;
    if (criteria.minRows && r.rowCount < Number(criteria.minRows)) return false;
    if (criteria.maxRows && r.rowCount > Number(criteria.maxRows)) return false;
    return true;
  });

  const columns = [
    { key: 'name', header: 'Name', fw: 14, cell: (r) => <span className="small strong">{r.name}</span> },
    { key: 'type', header: 'Type', fw: 8, cell: (r) => <span className="small" style={{ color: 'var(--c-primary)', fontWeight: 600 }}>{r.type}</span> },
    { key: 'dateCreated', header: 'Date created', fw: 8, cell: (r) => <span className="small">{formatDate(r.dateCreated)}</span> },
    { key: 'createdBy', header: 'Created by', fw: 11, cell: (r) => <TruncatedText value={r.createdBy} className="small mono" /> },
    { key: 'rowCount', header: 'Row count', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatNumber(r.rowCount)}</span> },
    { key: 'fileSize', header: 'File size', fw: 6, align: 'right', cell: (r) => <span className="mono small">{r.fileSize}</span> },
    ...(tab === 'scheduled' ? [
      { key: 'frequency', header: 'Frequency', fw: 7, align: 'center', cell: (r) => <Badge tone="info">{r.schedule.frequency}</Badge> },
      { key: 'recipients', header: 'Recipients', fw: 12, cell: (r) => <TruncatedText value={r.schedule.recipients.join(', ')} className="micro subtle" /> },
    ] : []),
    {
      key: 'actions', header: 'Actions', pinned: true, fw: 7, width: '86px', align: 'center',
      cell: (r) => (
        <div className="row row--xtight row--nowrap row--center">
          <IconButton icon="play" label="Run now" size={13} onClick={() => notify(`“${r.name}” queued.`, 'success')} />
          <IconButton icon="download" label="Download" size={13} onClick={() => notify('Download started.')} />
          <IconButton icon="trash" label="Delete" tone="danger" size={13} onClick={() => { setReports((p) => p.filter((x) => x.id !== r.id)); notify('Report deleted.', 'success'); }} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Custom reports"
        description="Build a report from the live book, preview it, and schedule delivery. Scheduling lives in the builder rather than on its own page."
        actions={tab !== 'builder' && <Button variant="primary" icon="plus" onClick={() => setTab('builder')}>Report Builder</Button>}
      />

      <div className="stack stack--tight">
        <Card bodyClassName="card__body--flush">
          <div style={{ padding: '0 var(--s-4)' }}>
            <Tabs
              tabs={TABS.map((t) => ({ ...t, badge: t.value === 'reports' ? reports.length : t.value === 'scheduled' ? scheduled.length : undefined }))}
              value={tab}
              onChange={setTab}
            />
          </div>
        </Card>

        {tab === 'builder' ? (
          <ReportBuilder onSave={(r) => {
            setReports((p) => [...p, {
              ...r, id: `rep${p.length + 1}`, dateCreated: new Date().toISOString(), createdBy: 'you',
              rowCount: r.rowCount ?? CASES.length, fileSize: '—',
              schedule: r.mode === 'recurring' ? { mode: 'recurring', frequency: r.frequency, recipients: r.recipients } : { mode: 'on_demand' },
            }]);
            setTab('reports');
          }} />
        ) : (
          <Card bodyClassName="card__body--flush">
            <Toolbar>
              <SearchBar value={search} onChange={setSearch} placeholder="Search reports…" onAdvanced={() => setAdvanced(true)} advancedCount={Object.values(criteria).filter(Boolean).length} />
              <ExportButtons columns={columns.filter((c) => c.key !== 'actions')} rows={filtered} name="reports" onCopied={(ok) => notify(ok ? 'Copied.' : 'Clipboard blocked.', ok ? 'success' : 'danger')} />
            </Toolbar>
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.id}
              empty={<EmptyState icon="spreadsheet" title={tab === 'scheduled' ? 'No scheduled reports' : 'No reports yet'} hint="Build a report and set a recurring schedule to see it here." action={<Button variant="primary" onClick={() => setTab('builder')}>Open report builder</Button>} />}
            />
          </Card>
        )}
      </div>

      <AdvancedSearchModal open={advanced} onClose={() => setAdvanced(false)} value={criteria} onChange={setCriteria} />
    </>
  );
}

export default CustomReports;
