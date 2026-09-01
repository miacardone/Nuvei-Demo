import { useMemo, useState } from 'react';
import { PageHeader, Card, Toolbar, Button, Kpi, Badge } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { SearchInput, SelectField } from '@/components/ui/Form';
import { ALERTS, findOutcome, findSource } from '@/data/alerts';
import { useToast } from '@/context/ToastContext';
import { downloadCsv, downloadExcel } from '@/utils/export';
import { formatCompactCurrency, formatCurrency, formatDate, formatNumber } from '@/utils/format';

/**
 * Alert reporting.
 *
 * A QA pass over alerts already decided, not a live worklist — hence a date
 * range instead of a queue, and an "Audit result" a reviewer sets rather
 * than an outcome an agent sets. Both downloads are real files built from
 * exactly the rows on screen, not a stub toast.
 */

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

const AUDIT_RESULTS = ['Good', 'Needs review', 'Incorrect'];

export function AlertReporting() {
  const { notify } = useToast();
  const [range, setRange] = useState('30');
  const [search, setSearch] = useState('');
  const [audits, setAudits] = useState({});

  const rows = useMemo(() => {
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86_400_000;
    return ALERTS.filter((a) => new Date(a.alertDate).getTime() >= cutoff && a.outcome !== 'open')
      .filter((a) => !search || `${a.id} ${a.caseId ?? ''} ${a.entityLabel}`.toLowerCase().includes(search.toLowerCase()));
  }, [range, search]);

  const totals = {
    total: rows.length,
    refunded: rows.filter((a) => a.outcome === 'refunded').length,
    missed: rows.filter((a) => a.outcome !== 'refunded').length,
    valueProtected: rows.filter((a) => a.outcome === 'refunded').reduce((s, a) => s + a.amount, 0),
  };

  const columns = [
    { key: 'id', header: 'Alert ID', fw: 8, cell: (r) => <span className="mono strong">{r.id}</span> },
    { key: 'entityLabel', header: 'Entity', fw: 9 },
    { key: 'sourceId', header: 'Source', fw: 7, exportValue: (r) => findSource(r.sourceId)?.label, cell: (r) => <Badge tone="neutral">{findSource(r.sourceId)?.label}</Badge> },
    { key: 'transactionDate', header: 'Transaction date', fw: 8, cell: (r) => formatDate(r.transactionDate) },
    { key: 'amount', header: 'Amount', fw: 6, align: 'right', cell: (r) => <span className="mono">{formatCurrency(r.amount, r.currency)}</span> },
    { key: 'panMasked', header: 'Card number', fw: 9, cell: (r) => <span className="mono small">{r.panMasked}</span> },
    { key: 'outcome', header: 'Outcome', fw: 6, exportValue: (r) => findOutcome(r.outcome)?.label, cell: (r) => <Badge tone={findOutcome(r.outcome)?.tone} dot>{findOutcome(r.outcome)?.label}</Badge> },
    { key: 'refundAmount', header: 'Refund amount', fw: 7, align: 'right', exportValue: (r) => (r.outcome === 'refunded' ? r.amount : 0), cell: (r) => <span className="mono">{r.outcome === 'refunded' ? formatCurrency(r.amount, r.currency) : '—'}</span> },
    { key: 'caseId', header: 'Case ID', fw: 8, cell: (r) => <span className="mono small">{r.caseId ?? '—'}</span> },
    {
      key: 'auditResult', header: 'Audit result', fw: 9,
      exportValue: (r) => audits[r.id] ?? '',
      cell: (r) => (
        <SelectField
          value={audits[r.id] ?? ''}
          onChange={(e) => setAudits((p) => ({ ...p, [r.id]: e.target.value }))}
          placeholder="Please select"
          options={AUDIT_RESULTS.map((v) => ({ value: v, label: v }))}
        />
      ),
    },
  ];

  const auditedCount = Object.values(audits).filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Alert reporting"
        description="Audit already-decided alerts and export what you find."
        actions={
          <div className="row row--tight">
            <Button variant="secondary" icon="download" onClick={() => downloadExcel(columns, rows, 'alert-report')}>Download alert report</Button>
            <Button
              variant="primary"
              icon="download"
              disabled={!auditedCount}
              onClick={() => { downloadCsv(columns, rows.filter((r) => audits[r.id]), 'audit-summary'); notify(`Audit summary downloaded — ${auditedCount} row${auditedCount === 1 ? '' : 's'}.`, 'success'); }}
            >
              Download audit summary
            </Button>
          </div>
        }
      />

      <div className="stack stack--tight">
        <div className="grid grid--4">
          <Kpi label="Decided alerts" value={formatNumber(totals.total)} meta={RANGES.find((r) => r.value === range)?.label.toLowerCase()} />
          <Kpi label="Refunded" value={formatNumber(totals.refunded)} meta="chargeback stopped" />
          <Kpi label="Missed" value={formatNumber(totals.missed)} meta="ineligible or expired" />
          <Kpi label="Value protected" value={formatCompactCurrency(totals.valueProtected)} meta="in this range" />
        </div>

        <Card bodyClassName="card__body--flush">
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search alert ID, case ID, entity…" />
            <span className="spacer" />
            <SelectField value={range} onChange={(e) => setRange(e.target.value)} options={RANGES} />
          </Toolbar>
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
        </Card>
      </div>
    </>
  );
}

export default AlertReporting;
