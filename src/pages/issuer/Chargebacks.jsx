import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Toolbar, IconButton, EmptyState, Button, Kpi, StatusIcon } from '@/components/ui/Surface';
import { DataTable, ExportButtons, Pagination } from '@/components/ui/DataTable';
import { SearchInput } from '@/components/ui/Form';
import { TruncatedText } from '@/components/ui/Overlay';
import { CaseFiltersDrawer } from '@/components/cases/CaseFilters';
import { DueCell } from '@/components/cases/caseColumns';
import { CASES } from '@/data/cases';
import { caseKpis, countTrend, rateTrend, sumTrend, weeklyRate, weeklySeries } from '@/domain/metrics';
import { getStatus, isClosed } from '@/domain/statuses';
import { STATUS_ICON } from '@/components/cases/caseColumns';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from '@/utils/format';

/**
 * Chargebacks — the issuer's view of the SAME chargeback cases the merchant
 * and acquirer perspectives see on Disputes > Cases, re-framed around the
 * cardholder and the card leg rather than the booking or the supplier. No
 * separate dataset: this filters the shared `CASES` book to `caseType ===
 * 'chargeback'`, same as buildCaseColumns does for the merchant/acquirer view.
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

export function Chargebacks() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { routes } = usePerspective();

  const chargebackCases = useMemo(() => CASES.filter((c) => c.caseType === 'chargeback'), []);

  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [sort, setSort] = useState({ key: 'dueDate', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chargebackCases.filter((c) => {
      if (statuses.length && !statuses.includes(c.status)) return false;
      if (!q) return true;
      return [c.id, c.cardholder, c.arn, c.reasonCode, c.reasonLabel, c.ccLast4]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [chargebackCases, search, statuses]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filtered, sort]);

  const pageRows = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize]);

  const kpis = useMemo(() => caseKpis(chargebackCases), [chargebackCases]);
  const openTrend = useMemo(() => countTrend(chargebackCases, (c) => !isClosed(c.status)), [chargebackCases]);
  const exposureTrend = useMemo(() => sumTrend(chargebackCases.filter((c) => !isClosed(c.status)), (c) => c.disputeAmount), [chargebackCases]);
  const winRateTrend = useMemo(() => rateTrend(chargebackCases, (c) => isClosed(c.status), (c) => c.outcome === 'won'), [chargebackCases]);
  const representedTrend = useMemo(() => countTrend(chargebackCases, (c) => c.status === 'represented'), [chargebackCases]);
  const openSpark = useMemo(() => weeklySeries(chargebackCases, 6, () => 1, (c) => !isClosed(c.status)), [chargebackCases]);
  const exposureSpark = useMemo(() => weeklySeries(chargebackCases.filter((c) => !isClosed(c.status)), 6, (c) => c.disputeAmount), [chargebackCases]);
  const winRateSpark = useMemo(() => weeklyRate(chargebackCases, 6, (c) => isClosed(c.status), (c) => c.outcome === 'won'), [chargebackCases]);
  const representedSpark = useMemo(() => weeklySeries(chargebackCases, 6, () => 1, (c) => c.status === 'represented'), [chargebackCases]);

  const columns = [
    { key: 'cardholder', header: 'Cardholder', fw: 11, sortable: true, cell: (r) => <TruncatedText value={r.cardholder} className="small strong" /> },
    {
      key: 'ccLast4', header: 'Card', fw: 8,
      cell: (r) => <span className="mono small">{r.networkLabel} •••• {r.ccLast4}</span>,
    },
    { key: 'reasonLabel', header: 'Reason', fw: 13, sortable: true, cell: (r) => <TruncatedText value={`${r.reasonCode} · ${r.reasonLabel}`} tooltip={r.reasonLabel} /> },
    { key: 'fraudMarker', header: 'Fraud marker', fw: 9, align: 'center', cell: (r) => <StatusIcon icon={FRAUD_ICON[r.fraudMarker] ?? 'shield'} tone={FRAUD_TONE[r.fraudMarker] ?? 'neutral'} label={r.fraudMarker} /> },
    { key: 'disputeAmount', header: 'Amount', fw: 7, align: 'right', sortable: true, cell: (r) => <span className="mono small strong">{formatCurrency(r.disputeAmount, r.currency)}</span> },
    { key: 'status', header: 'Status', fw: 7, sortable: true, align: 'center', cell: (r) => <StatusIcon icon={STATUS_ICON[r.status] ?? 'inbox'} tone={getStatus(r.status).tone} label={getStatus(r.status).label} /> },
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
      <PageHeader
        title="Chargebacks"
        description="Every chargeback raised by your cardholders — the card-leg view of the same cases the merchant and acquirer work."
        meta={
          <p className="page-head__desc">
            <strong className="mono">{formatNumber(filtered.length)}</strong> of{' '}
            <strong className="mono">{formatNumber(chargebackCases.length)}</strong> chargebacks
          </p>
        }
      />

      <div className="stack">
        <div className="grid grid--4" style={{ gap: 'var(--s-3)' }}>
          <Kpi label="Open chargebacks" value={formatNumber(kpis.openCases)} meta={`${formatNumber(kpis.overdueCases)} overdue`} trend={openTrend} spark={openSpark} />
          <Kpi label="Exposure" value={formatCompactCurrency(kpis.openValue)} invert trend={exposureTrend} spark={exposureSpark} />
          <Kpi label="Win rate" value={formatPercent(kpis.winRate, 0)} meta="Issuer-side, informational" trend={winRateTrend} spark={winRateSpark} />
          <Kpi label="Represented" value={formatNumber(kpis.represented)} trend={representedTrend} spark={representedSpark} />
        </div>

        <Card bodyClassName="card__body--flush">
          <Toolbar>
            <div className="row row--tight">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Cardholder, case #, ARN, reason…" />
              <CaseFiltersDrawer rows={chargebackCases} statusSelected={statuses} onStatusChange={(v) => { setStatuses(v); setPage(1); }} />
            </div>
            <ExportButtons
              columns={columns.filter((c) => c.key !== 'actions')}
              rows={sorted}
              name="chargebacks"
              onCopied={(ok) => notify(ok ? 'Copied to clipboard.' : 'Your browser blocked clipboard access.', ok ? 'success' : 'danger')}
            />
          </Toolbar>

          <DataTable
            columns={columns}
            rows={pageRows}
            rowKey={(r) => r.id}
            sort={sort}
            onSort={(key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}
            onRowClick={(row) => navigate(routes.workCaseDetail(row.id))}
            empty={
              <EmptyState
                icon="search"
                title="No chargebacks match this view"
                hint="Widen the filters to see more of the book."
                action={<Button variant="secondary" icon="refresh" onClick={() => { setStatuses([]); setSearch(''); }}>Reset filters</Button>}
              />
            }
          />

          <Pagination total={sorted.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </Card>
      </div>
    </>
  );
}

export default Chargebacks;
