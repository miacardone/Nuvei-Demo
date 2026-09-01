import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Badge, Kpi, IconButton, EmptyState, StatusIcon } from '@/components/ui/Surface';
import { DataTable, ExportButtons, Pagination } from '@/components/ui/DataTable';
import { Donut } from '@/components/charts/Charts';
import { TruncatedText } from '@/components/ui/Overlay';
import { DueCell, STATUS_ICON } from '@/components/cases/caseColumns';
import { CASES } from '@/data/cases';
import { getStatus } from '@/domain/statuses';
import { countTrend, weeklyRate, weeklySeries } from '@/domain/metrics';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from '@/utils/format';

/**
 * Fraud — the shared case book (chargebacks only — a claim has no card leg)
 * rolled up by `fraudMarker`. Same source as Chargebacks.jsx, different lens:
 * this page is about the fraud rate on the card, not the case queue.
 */

const FRAUD_TONE = {
  'Confirmed Fraud': 'danger',
  'Suspected Fraud': 'warning',
  'Fraud Reported by Issuer': 'info',
  'No Fraud Marker': 'muted',
};
const FRAUD_ICON = {
  'Confirmed Fraud': 'alert',
  'Suspected Fraud': 'alert',
  'Fraud Reported by Issuer': 'shield',
  'No Fraud Marker': 'check',
};

const DONUT_COLOR = {
  'Confirmed Fraud': 'var(--c-danger)',
  'Suspected Fraud': 'var(--c-warning)',
  'Fraud Reported by Issuer': 'var(--c-info)',
  'No Fraud Marker': 'var(--c-series-neutral)',
};

export function Fraud() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { routes } = usePerspective();

  const cardCases = useMemo(() => CASES.filter((c) => c.caseType === 'chargeback'), []);

  const [sort, setSort] = useState({ key: 'disputeAmount', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const byMarker = useMemo(() => {
    const map = new Map();
    cardCases.forEach((c) => {
      if (!map.has(c.fraudMarker)) map.set(c.fraudMarker, { label: c.fraudMarker, count: 0, value: 0 });
      const row = map.get(c.fraudMarker);
      row.count += 1;
      row.value += c.disputeAmount;
    });
    return map;
  }, [cardCases]);

  const donutData = useMemo(
    () => [...byMarker.values()]
      .sort((a, b) => b.count - a.count)
      .map((m) => ({ label: m.label, value: m.count, color: DONUT_COLOR[m.label] })),
    [byMarker],
  );

  const confirmed = byMarker.get('Confirmed Fraud') ?? { count: 0, value: 0 };
  const suspected = byMarker.get('Suspected Fraud') ?? { count: 0, value: 0 };
  const reportedByIssuer = byMarker.get('Fraud Reported by Issuer') ?? { count: 0, value: 0 };
  const fraudRate = cardCases.length ? ((confirmed.count + suspected.count) / cardCases.length) * 100 : 0;

  const confirmedTrend = useMemo(() => countTrend(cardCases, (c) => c.fraudMarker === 'Confirmed Fraud'), [cardCases]);
  const suspectedTrend = useMemo(() => countTrend(cardCases, (c) => c.fraudMarker === 'Suspected Fraud'), [cardCases]);
  const reportedTrend = useMemo(() => countTrend(cardCases, (c) => c.fraudMarker === 'Fraud Reported by Issuer'), [cardCases]);
  const fraudRateSpark = useMemo(() => weeklyRate(cardCases, 6, () => true, (c) => c.fraudMarker === 'Confirmed Fraud' || c.fraudMarker === 'Suspected Fraud'), [cardCases]);
  const confirmedSpark = useMemo(() => weeklySeries(cardCases, 6, () => 1, (c) => c.fraudMarker === 'Confirmed Fraud'), [cardCases]);
  const suspectedSpark = useMemo(() => weeklySeries(cardCases, 6, () => 1, (c) => c.fraudMarker === 'Suspected Fraud'), [cardCases]);
  const reportedSpark = useMemo(() => weeklySeries(cardCases, 6, () => 1, (c) => c.fraudMarker === 'Fraud Reported by Issuer'), [cardCases]);

  const flagged = useMemo(
    () => cardCases.filter((c) => c.fraudMarker === 'Confirmed Fraud' || c.fraudMarker === 'Suspected Fraud'),
    [cardCases],
  );

  const sorted = useMemo(() => {
    const rows = [...flagged];
    rows.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [flagged, sort]);

  const pageRows = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize]);

  const columns = [
    { key: 'cardholder', header: 'Cardholder', fw: 11, sortable: true, cell: (r) => <TruncatedText value={r.cardholder} className="small strong" /> },
    { key: 'ccLast4', header: 'Card', fw: 8, cell: (r) => <span className="mono small">{r.networkLabel} •••• {r.ccLast4}</span> },
    { key: 'reasonLabel', header: 'Reason', fw: 12, sortable: true, cell: (r) => <TruncatedText value={`${r.reasonCode} · ${r.reasonLabel}`} tooltip={r.reasonLabel} /> },
    { key: 'fraudMarker', header: 'Fraud marker', fw: 9, sortable: true, align: 'center', cell: (r) => <StatusIcon icon={FRAUD_ICON[r.fraudMarker] ?? 'shield'} tone={FRAUD_TONE[r.fraudMarker] ?? 'neutral'} label={r.fraudMarker} /> },
    { key: 'disputeAmount', header: 'Amount', fw: 7, align: 'right', sortable: true, cell: (r) => <span className="mono small strong">{formatCurrency(r.disputeAmount, r.currency)}</span> },
    { key: 'status', header: 'Status', fw: 7, align: 'center', cell: (r) => <StatusIcon icon={STATUS_ICON[r.status] ?? 'inbox'} tone={getStatus(r.status).tone} label={getStatus(r.status).label} /> },
    { key: 'dueDate', header: 'Due', fw: 6, sortable: true, cell: (r) => <DueCell dueDate={r.dueDate} /> },
    {
      key: 'actions', header: 'Actions', pinned: true, fw: 5, width: '68px', align: 'center',
      cell: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <IconButton icon="wrench" label="Work this case" size={13} onClick={() => navigate(routes.workCaseDetail(row.id))} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Fraud" description="Fraud markers across your cardholder base — confirmed and suspected fraud, and cases the issuer flagged itself." />

      <div className="stack">
        <div className="grid grid--4" style={{ gap: 'var(--s-3)' }}>
          <Kpi label="Confirmed fraud" value={formatNumber(confirmed.count)} meta={formatCompactCurrency(confirmed.value)} invert trend={confirmedTrend} spark={confirmedSpark} />
          <Kpi label="Suspected fraud" value={formatNumber(suspected.count)} meta={formatCompactCurrency(suspected.value)} invert trend={suspectedTrend} spark={suspectedSpark} />
          <Kpi label="Fraud rate" value={formatPercent(fraudRate, 1)} meta="Confirmed + suspected" spark={fraudRateSpark} />
          <Kpi label="Reported by issuer" value={formatNumber(reportedByIssuer.count)} meta={formatCompactCurrency(reportedByIssuer.value)} trend={reportedTrend} spark={reportedSpark} />
        </div>

        <div className="grid grid--2">
          <Card title="Chargebacks by fraud marker" action={<Badge tone="neutral">{formatNumber(cardCases.length)} cases</Badge>} bodyClassName="card__body--chart">
            <Donut data={donutData} centerValue={formatNumber(cardCases.length)} centerLabel="Chargebacks" />
          </Card>

          <Card title="What this means" bodyClassName="card__body--tight">
            <div className="stack stack--tight">
              <p className="small muted">
                <strong>Confirmed fraud</strong> cases are typically written off rather than represented — the
                cardholder did not authorize the transaction. <strong>Suspected fraud</strong> is still under
                review and may resolve either way.
              </p>
              <p className="small muted">
                <strong>Fraud reported by issuer</strong> cases originated from this bank's own monitoring rather
                than a cardholder complaint — worth a closer look at the underlying authorization.
              </p>
            </div>
          </Card>
        </div>

        <Card title="Confirmed and suspected fraud cases" action={<Badge tone="danger">{formatNumber(flagged.length)} flagged</Badge>} bodyClassName="card__body--flush">
          <DataTable
            columns={columns}
            rows={pageRows}
            rowKey={(r) => r.id}
            sort={sort}
            onSort={(key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))}
            onRowClick={(row) => navigate(routes.workCaseDetail(row.id))}
            empty={<EmptyState icon="shield" title="No flagged cases" hint="Nothing carries a confirmed or suspected fraud marker right now." />}
          />
          <Pagination total={sorted.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          <div className="row row--end" style={{ padding: '0 var(--s-4) var(--s-4)' }}>
            <ExportButtons
              columns={columns.filter((c) => c.key !== 'actions')}
              rows={sorted}
              name="fraud-cases"
              onCopied={(ok) => notify(ok ? 'Copied to clipboard.' : 'Your browser blocked clipboard access.', ok ? 'success' : 'danger')}
            />
          </div>
        </Card>
      </div>
    </>
  );
}

export default Fraud;
