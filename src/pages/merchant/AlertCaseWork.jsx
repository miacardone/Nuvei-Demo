import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Toolbar, Tabs, Button, IconButton, Badge, Kpi, EmptyState } from '@/components/ui/Surface';
import { DataTable, ExportButtons } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/Modal';
import { SearchBar, SelectField } from '@/components/ui/Form';
import { TruncatedText } from '@/components/ui/Overlay';
import { DueCell } from '@/components/cases/caseColumns';
import Icon from '@/components/ui/Icon';
import { ALERTS, ALERT_SOURCES, ALERT_OUTCOMES, findSource, findOutcome, entityRollup } from '@/data/alerts';
import brand from '@/brand/brand.config';
import { useToast } from '@/context/ToastContext';
import { ROUTES } from '@/data/navigation';
import { formatCompactCurrency, formatCurrency, formatDate, formatDateTime, formatNumber } from '@/utils/format';

/**
 * Alert case work.
 *
 * Overview rolls up by entity — Nutrameg is single-tenant, so that is the
 * meaningful grouping, not an invented client list. Alerts is the worklist:
 * every network alert with the short clock it actually carries (a few days,
 * not the scheme's full dispute window) and one-click actions that record a
 * real outcome against it, because that clock is the entire value of acting
 * on one of these before it becomes a chargeback.
 */

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'alerts', label: 'Alerts' },
];

function EntityCell({ entityId, entityLabel }) {
  return <span className="small strong">{entityLabel ?? brand.entities.find((e) => e.id === entityId)?.label ?? entityId}</span>;
}

function OverviewTable({ rows, onViewAlerts }) {
  const columns = [
    { key: 'entityLabel', header: 'Entity', fw: 12, cell: (r) => <EntityCell entityId={r.entityId} entityLabel={r.entityLabel} /> },
    { key: 'open', header: 'Open', fw: 6, align: 'right', cell: (r) => <span className="mono small" style={r.open ? { color: 'var(--c-warning)' } : undefined}>{formatNumber(r.open)}</span> },
    { key: 'refunded', header: 'Stopped', fw: 6, align: 'right', cell: (r) => <span className="mono small" style={{ color: 'var(--c-success)' }}>{formatNumber(r.refunded)}</span> },
    { key: 'missed', header: 'Missed', fw: 6, align: 'right', cell: (r) => <span className="mono small" style={r.missed ? { color: 'var(--c-danger)' } : undefined}>{formatNumber(r.missed)}</span> },
    { key: 'valueProtected', header: 'Value protected', fw: 8, align: 'right', cell: (r) => <span className="mono small">{formatCurrency(r.valueProtected)}</span> },
    { key: 'valueAtRisk', header: 'Value at risk', fw: 8, align: 'right', cell: (r) => <span className="mono small">{formatCurrency(r.valueAtRisk)}</span> },
    { key: 'lastAlertAt', header: 'Last alert received', fw: 9, cell: (r) => <span className="small">{r.lastAlertAt ? formatDateTime(r.lastAlertAt) : '—'}</span> },
    { key: 'serviceLevel', header: 'Service level', fw: 7, cell: (r) => <Badge tone={r.serviceLevel === 'Full Service' ? 'primary' : 'muted'}>{r.serviceLevel}</Badge> },
    {
      key: 'actions', header: 'Actions', fw: 6, width: '110px',
      cell: (r) => <Button variant="secondary" size="sm" onClick={() => onViewAlerts(r.entityId)}>View alerts</Button>,
    },
  ];
  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.entityId} />;
}

export function AlertCaseWork() {
  const navigate = useNavigate();
  const { notify } = useToast();

  const [tab, setTab] = useState('overview');
  const [alerts, setAlerts] = useState(ALERTS);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const rollup = useMemo(() => entityRollup(alerts), [alerts]);

  const filtered = useMemo(() => alerts.filter((a) => {
    if (entityFilter && a.entityId !== entityFilter) return false;
    if (sourceFilter && a.sourceId !== sourceFilter) return false;
    if (outcomeFilter && a.outcome !== outcomeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${a.id} ${a.caseId ?? ''} ${a.identifier ?? ''} ${a.mid}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [alerts, entityFilter, sourceFilter, outcomeFilter, search]);

  const openTotalSelected = [...selected]
    .map((id) => alerts.find((a) => a.id === id))
    .filter((a) => a?.outcome === 'open');
  const selectedValue = openTotalSelected.reduce((s, a) => s + a.amount, 0);

  const setOutcome = (id, outcome) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, outcome, processedAt: new Date().toISOString() } : a)));
  };

  const totals = {
    open: alerts.filter((a) => a.outcome === 'open').length,
    valueProtected: alerts.filter((a) => a.outcome === 'refunded').reduce((s, a) => s + a.amount, 0),
    valueAtRisk: alerts.filter((a) => a.outcome === 'open').reduce((s, a) => s + a.amount, 0),
    responseRate: (() => {
      const decided = alerts.filter((a) => a.outcome !== 'open');
      if (!decided.length) return 0;
      return (decided.filter((a) => a.outcome === 'refunded').length / decided.length) * 100;
    })(),
  };

  const columns = [
    { key: 'id', header: 'Alert ID', fw: 8, cell: (r) => <span className="mono strong nowrap">{r.id}</span> },
    { key: 'source', header: 'Source', fw: 7, cell: (r) => <Badge tone="neutral">{findSource(r.sourceId)?.label}</Badge> },
    { key: 'entityLabel', header: 'Entity', fw: 9, cell: (r) => <EntityCell entityId={r.entityId} entityLabel={r.entityLabel} /> },
    {
      key: 'caseId', header: 'Case', fw: 8,
      cell: (r) => (r.caseId
        ? <button type="button" className="mono small" style={{ border: 0, background: 'transparent', color: 'var(--c-primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate(ROUTES.workCaseDetail(r.caseId))}>{r.caseId}</button>
        : <span className="small subtle">Unmatched</span>),
    },
    { key: 'identifier', header: 'Identifier', fw: 10, cell: (r) => <TruncatedText value={r.identifier ?? '—'} className="mono small" /> },
    { key: 'amount', header: 'Amount', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatCurrency(r.amount, r.currency)}</span> },
    { key: 'alertDate', header: 'Alert received', fw: 8, cell: (r) => <span className="small">{formatDateTime(r.alertDate)}</span> },
    {
      key: 'expiresAt', header: 'Expires', fw: 8,
      cell: (r) => (r.outcome === 'open'
        ? <DueCell dueDate={r.expiresAt} />
        : <span className="micro subtle">Processed {formatDate(r.processedAt)}</span>),
    },
    { key: 'outcome', header: 'Outcome', fw: 6, cell: (r) => <Badge tone={findOutcome(r.outcome)?.tone} dot>{findOutcome(r.outcome)?.label}</Badge> },
    { key: 'serviceLevel', header: 'Service level', fw: 7, cell: (r) => <Badge tone={r.serviceLevel === 'Full Service' ? 'primary' : 'muted'}>{r.serviceLevel}</Badge> },
    {
      key: 'actions', header: 'Actions', fw: 8, width: '116px',
      cell: (r) => (
        <div className="row row--xtight row--nowrap">
          <IconButton icon="check" label="Refund now — stops the chargeback" tone="success" size={13} disabled={r.outcome !== 'open'} onClick={() => { setOutcome(r.id, 'refunded'); notify(`${r.id} refunded — chargeback stopped.`, 'success'); }} />
          <IconButton icon="close" label="Mark ineligible" tone="danger" size={13} disabled={r.outcome !== 'open'} onClick={() => { setOutcome(r.id, 'ineligible'); notify(`${r.id} marked ineligible.`); }} />
          {r.caseId && <IconButton icon="external" label="View linked case" size={13} onClick={() => navigate(ROUTES.workCaseDetail(r.caseId))} />}
          <IconButton icon="download" label="Download alert" size={13} onClick={() => notify('Download started.')} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Alert case work"
        description="Network early-warning alerts — Verifi CDRN, Visa RDR and Ethoca — refund in time and the chargeback never gets filed."
        actions={<Button variant="secondary" icon="upload" onClick={() => notify('Alert file received — processing in the background.', 'success')}>Upload alerts</Button>}
      />

      <div className="stack stack--tight">
        <Card bodyClassName="card__body--flush">
          <div style={{ padding: '0 var(--s-4)' }}>
            <Tabs tabs={TABS} value={tab} onChange={setTab} />
          </div>
        </Card>

        {tab === 'overview' ? (
          <div className="stack stack--tight">
            <div className="grid grid--4">
              <Kpi label="Open alerts" value={formatNumber(totals.open)} meta="need action before they expire" />
              <Kpi label="Value protected" value={formatCompactCurrency(totals.valueProtected)} meta="chargebacks stopped" />
              <Kpi label="Value at risk" value={formatCompactCurrency(totals.valueAtRisk)} meta="still open" />
              <Kpi label="Response rate" value={`${totals.responseRate.toFixed(0)}%`} meta="of decided alerts refunded" />
            </div>
            <Card title="By entity" bodyClassName="card__body--flush">
              <OverviewTable rows={rollup} onViewAlerts={(entityId) => { setEntityFilter(entityId); setTab('alerts'); }} />
            </Card>
          </div>
        ) : (
          <Card bodyClassName="card__body--flush">
            <Toolbar>
              <SearchBar value={search} onChange={setSearch} placeholder="Search alert ID, case ID, identifier…" />
              <div className="row row--tight">
                <SelectField value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} placeholder="All entities" options={brand.entities.map((e) => ({ value: e.id, label: e.label }))} />
                <SelectField value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} placeholder="All sources" options={ALERT_SOURCES.map((s) => ({ value: s.id, label: s.label }))} />
                <SelectField value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)} placeholder="All outcomes" options={ALERT_OUTCOMES.map((o) => ({ value: o.id, label: o.label }))} />
              </div>
              <span className="spacer" />
              {selected.size > 0 && (
                <Button variant="primary" icon="check" onClick={() => setBulkConfirm(true)}>Bulk complete ({selected.size})</Button>
              )}
              <ExportButtons columns={columns.filter((c) => c.key !== 'actions')} rows={filtered} name="alerts" onCopied={(ok) => notify(ok ? 'Copied.' : 'Clipboard blocked.', ok ? 'success' : 'danger')} />
            </Toolbar>

            {filtered.length === 0 ? (
              <EmptyState icon="bell" title="No alerts match" hint="Try clearing a filter or the search box." />
            ) : (
              <DataTable
                columns={columns}
                rows={filtered}
                rowKey={(r) => r.id}
                selection={{
                  selected,
                  onToggle: (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }),
                  onToggleAll: (ids, checked) => setSelected((p) => {
                    const n = new Set(p);
                    ids.forEach((id) => { const row = filtered.find((r) => r.id === id); if (row?.outcome === 'open') checked ? n.add(id) : n.delete(id); });
                    return n;
                  }),
                }}
              />
            )}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={bulkConfirm}
        title="Bulk complete alerts"
        danger={false}
        confirmLabel={`Refund ${openTotalSelected.length}`}
        message={
          openTotalSelected.length === 0
            ? 'None of the selected alerts are open — nothing to do.'
            : <>Mark <strong>{openTotalSelected.length}</strong> open alert{openTotalSelected.length === 1 ? '' : 's'} as refunded — <strong>{formatCurrency(selectedValue)}</strong> in chargebacks stopped.</>
        }
        onCancel={() => setBulkConfirm(false)}
        onConfirm={() => {
          if (openTotalSelected.length === 0) { setBulkConfirm(false); return; }
          const ids = new Set(openTotalSelected.map((a) => a.id));
          setAlerts((prev) => prev.map((a) => (ids.has(a.id) ? { ...a, outcome: 'refunded', processedAt: new Date().toISOString() } : a)));
          notify(`${openTotalSelected.length} alert${openTotalSelected.length === 1 ? '' : 's'} refunded — ${formatCurrency(selectedValue)} protected.`, 'success');
          setSelected(new Set());
          setBulkConfirm(false);
        }}
      />
    </>
  );
}

export default AlertCaseWork;
