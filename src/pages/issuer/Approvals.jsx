import { useMemo, useState } from 'react';
import { PageHeader, Card, Kpi, EmptyState, StatusIcon } from '@/components/ui/Surface';
import { DataTable, Pagination, TableToolbar } from '@/components/ui/DataTable';
import { TruncatedText } from '@/components/ui/Overlay';
import brand from '@/brand/brand.config';
import { AUTHORIZATIONS } from '@/data/authorizations';
import { MERCHANTS } from '@/data/portfolio';
import { weeklySeries } from '@/domain/metrics';
import { useToast } from '@/context/ToastContext';

const authDateOf = (a) => a.date;
import { formatCompactCurrency, formatCurrency, formatDateTime, formatNumber } from '@/utils/format';

/** The acquirer's flagship merchant — named rather than assumed. */
const flagshipName = MERCHANTS.find((m) => m.flagship)?.name ?? brand.name;

/**
 * Approvals — the "Approved" half of the shared authorization feed
 * (data/authorizations.js). Declines.jsx is the other half; both read the
 * same book so the two never disagree on totals.
 */

export function Approvals() {
  const { notify } = useToast();

  const [search, setSearch] = useState('');

  // Table chrome. Same controls in the same order as every other table.
  const [density, setDensity] = useState('comfortable');
  const [hidden, setHidden] = useState([]);
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const approved = useMemo(() => AUTHORIZATIONS.filter((a) => a.result === 'Approved'), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return approved;
    return approved.filter((a) => `${a.cardholderName} ${a.merchant} ${a.scheme}`.toLowerCase().includes(q));
  }, [approved, search]);

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

  const totals = useMemo(() => ({
    count: approved.length,
    value: approved.reduce((s, a) => s + a.amount, 0),
    avgTicket: approved.length ? approved.reduce((s, a) => s + a.amount, 0) / approved.length : 0,
    cardholders: new Set(approved.map((a) => a.cardholderId)).size,
  }), [approved]);

  const countSpark = useMemo(() => weeklySeries(AUTHORIZATIONS, 6, () => 1, (a) => a.result === 'Approved', authDateOf), []);
  const valueSpark = useMemo(() => weeklySeries(AUTHORIZATIONS, 6, (a) => a.amount, (a) => a.result === 'Approved', authDateOf), []);
  const cardholdersSpark = useMemo(() => {
    const now = Date.now();
    const DAY = 86_400_000;
    return Array.from({ length: 6 }, (_, i) => {
      const end = now - (5 - i) * 7 * DAY;
      const rows = approved.filter((a) => { const at = new Date(a.date).getTime(); return at > end - 7 * DAY && at <= end; });
      return new Set(rows.map((a) => a.cardholderId)).size;
    });
  }, [approved]);

  const columns = [
    { key: 'date', header: 'Date', fw: 8, sortable: true, cell: (r) => <span className="micro subtle nowrap">{formatDateTime(r.date)}</span> },
    { key: 'cardholderName', header: 'Cardholder', fw: 11, sortable: true, cell: (r) => <TruncatedText value={r.cardholderName} className="small" /> },
    { key: 'scheme', header: 'Scheme', fw: 6, cell: (r) => <span className="small">{r.scheme}</span> },
    { key: 'merchant', header: 'Merchant', fw: 11, sortable: true, cell: (r) => <TruncatedText value={r.merchant} className="small" /> },
    { key: 'amount', header: 'Amount', fw: 7, align: 'right', sortable: true, cell: (r) => <span className="mono small strong">{formatCurrency(r.amount, r.currency)}</span> },
    { key: 'result', header: 'Result', fw: 6, align: 'center', cell: () => <StatusIcon icon="check" tone="success" label="Approved" /> },
  ];

  const visibleColumns = columns.filter((c) => !hidden.includes(c.key));

  return (
    <>
      <PageHeader title="Approvals" description={`Authorization attempts approved for your ${brand.terms.buyer}s across every ${brand.terms.seller}, not only ${flagshipName}.`} />

      <div className="stack">
        <div className="grid grid--4" style={{ gap: 'var(--s-3)' }}>
          <Kpi label="Approvals" value={formatNumber(totals.count)} meta={`${formatNumber(AUTHORIZATIONS.length)} total attempts`} spark={countSpark} />
          <Kpi label="Approved value" value={formatCompactCurrency(totals.value)} spark={valueSpark} />
          <Kpi label="Average ticket" value={formatCurrency(totals.avgTicket)} />
          <Kpi label="Cardholders active" value={formatNumber(totals.cardholders)} meta="Last 90 days" spark={cardholdersSpark} />
        </div>

        <Card bodyClassName="card__body--flush">
          <TableToolbar
            search={search}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search cardholder, merchant, scheme…"
            density={density}
            onDensityChange={setDensity}
            columns={columns}
            hidden={hidden}
            onHiddenChange={setHidden}
            exportColumns={visibleColumns}
            exportRows={sorted}
            exportName="approvals"
            onCopied={(ok) => notify(ok ? 'Copied to clipboard.' : 'Your browser blocked clipboard access.', ok ? 'success' : 'danger')}
          />

          <DataTable
            columns={visibleColumns}
            density={density}
            rows={pageRows}
            rowKey={(r) => r.id}
            sort={sort}
            onSort={(key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))}
            empty={<EmptyState icon="search" title="No approvals match this search" />}
          />

          <Pagination total={sorted.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </Card>
      </div>
    </>
  );
}

export default Approvals;
