import { useMemo, useState } from 'react';
import { PageHeader, Card, Kpi, EmptyState, StatusIcon } from '@/components/ui/Surface';
import { DataTable, Pagination, TableToolbar } from '@/components/ui/DataTable';
import { TruncatedText } from '@/components/ui/Overlay';
import { AUTHORIZATIONS } from '@/data/authorizations';
import { weeklySeries } from '@/domain/metrics';
import { useToast } from '@/context/ToastContext';

const authDateOf = (a) => a.date;
import { formatCompactCurrency, formatCurrency, formatDateTime, formatNumber, formatPercent } from '@/utils/format';

/**
 * Declines — the "Declined" half of the shared authorization feed
 * (data/authorizations.js). See Approvals.jsx for the other half.
 */

const REASON_TONE = {
  'Insufficient funds': 'warning',
  'Suspected fraud': 'danger',
  'Card restrictions': 'muted',
  'Invalid CVV': 'danger',
  'Expired card': 'neutral',
};
const REASON_ICON = {
  'Insufficient funds': 'card',
  'Suspected fraud': 'alert',
  'Card restrictions': 'lock',
  'Invalid CVV': 'close',
  'Expired card': 'clock',
};

export function Declines() {
  const { notify } = useToast();

  const [search, setSearch] = useState('');

  // Table chrome. Same controls in the same order as every other table.
  const [density, setDensity] = useState('comfortable');
  const [hidden, setHidden] = useState([]);
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const declined = useMemo(() => AUTHORIZATIONS.filter((a) => a.result === 'Declined'), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return declined;
    return declined.filter((a) => `${a.cardholderName} ${a.merchant} ${a.declineReason}`.toLowerCase().includes(q));
  }, [declined, search]);

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

  const totals = useMemo(() => {
    const byReason = new Map();
    declined.forEach((a) => byReason.set(a.declineReason, (byReason.get(a.declineReason) ?? 0) + 1));
    const topReason = [...byReason.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      count: declined.length,
      declineRate: AUTHORIZATIONS.length ? (declined.length / AUTHORIZATIONS.length) * 100 : 0,
      value: declined.reduce((s, a) => s + a.amount, 0),
      topReason: topReason ? topReason[0] : '—',
    };
  }, [declined]);

  const countSpark = useMemo(() => weeklySeries(AUTHORIZATIONS, 6, () => 1, (a) => a.result === 'Declined', authDateOf), []);
  const rateSpark = useMemo(() => {
    const now = Date.now();
    const DAY = 86_400_000;
    return Array.from({ length: 6 }, (_, i) => {
      const end = now - (5 - i) * 7 * DAY;
      const rows = AUTHORIZATIONS.filter((a) => { const at = new Date(a.date).getTime(); return at > end - 7 * DAY && at <= end; });
      return rows.length ? (rows.filter((a) => a.result === 'Declined').length / rows.length) * 100 : 0;
    });
  }, []);
  const valueSpark = useMemo(() => weeklySeries(AUTHORIZATIONS, 6, (a) => a.amount, (a) => a.result === 'Declined', authDateOf), []);

  const columns = [
    { key: 'date', header: 'Date', fw: 8, sortable: true, cell: (r) => <span className="micro subtle nowrap">{formatDateTime(r.date)}</span> },
    { key: 'cardholderName', header: 'Cardholder', fw: 11, sortable: true, cell: (r) => <TruncatedText value={r.cardholderName} className="small" /> },
    { key: 'scheme', header: 'Scheme', fw: 6, cell: (r) => <span className="small">{r.scheme}</span> },
    { key: 'merchant', header: 'Merchant', fw: 10, sortable: true, cell: (r) => <TruncatedText value={r.merchant} className="small" /> },
    { key: 'amount', header: 'Amount', fw: 6, align: 'right', sortable: true, cell: (r) => <span className="mono small strong">{formatCurrency(r.amount, r.currency)}</span> },
    { key: 'declineReason', header: 'Decline reason', fw: 9, sortable: true, align: 'center', cell: (r) => <StatusIcon icon={REASON_ICON[r.declineReason] ?? 'close'} tone={REASON_TONE[r.declineReason] ?? 'neutral'} label={r.declineReason} /> },
  ];

  const visibleColumns = columns.filter((c) => !hidden.includes(c.key));

  return (
    <>
      <PageHeader title="Declines" description="Authorization attempts declined for your cardholders, with the reason the network or the issuer's own rules returned." />

      <div className="stack">
        <div className="grid grid--4" style={{ gap: 'var(--s-3)' }}>
          <Kpi label="Declines" value={formatNumber(totals.count)} meta={`${formatNumber(AUTHORIZATIONS.length)} total attempts`} invert spark={countSpark} />
          <Kpi label="Decline rate" value={formatPercent(totals.declineRate, 1)} invert spark={rateSpark} />
          <Kpi label="Declined value" value={formatCompactCurrency(totals.value)} invert spark={valueSpark} />
          <Kpi label="Top reason" value={totals.topReason} />
        </div>

        <Card bodyClassName="card__body--flush">
          <TableToolbar
            search={search}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search cardholder, merchant, reason…"
            density={density}
            onDensityChange={setDensity}
            columns={columns}
            hidden={hidden}
            onHiddenChange={setHidden}
            exportColumns={visibleColumns}
            exportRows={sorted}
            exportName="declines"
            onCopied={(ok) => notify(ok ? 'Copied to clipboard.' : 'Your browser blocked clipboard access.', ok ? 'success' : 'danger')}
          />

          <DataTable
            columns={visibleColumns}
            density={density}
            rows={pageRows}
            rowKey={(r) => r.id}
            sort={sort}
            onSort={(key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))}
            empty={<EmptyState icon="search" title="No declines match this search" />}
          />

          <Pagination total={sorted.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </Card>
      </div>
    </>
  );
}

export default Declines;
