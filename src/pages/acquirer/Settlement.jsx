import { useMemo, useState } from 'react';
import { PageHeader, Card, Toolbar, Kpi, StatusIcon } from '@/components/ui/Surface';
import { DataTable, ExportButtons, Pagination } from '@/components/ui/DataTable';
import { SearchInput, SelectField } from '@/components/ui/Form';
import { TruncatedText } from '@/components/ui/Overlay';
import { MERCHANTS } from '@/data/portfolio';
import { SETTLEMENT_BATCHES, settlementKpis } from '@/data/settlement';
import { weeklySeries } from '@/domain/metrics';
import { useToast } from '@/context/ToastContext';

const batchDateOf = (b) => b.date;
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

/**
 * Settlement — batches across the portfolio, weighted toward Expedia. See
 * src/data/settlement.js for how disputeDeductions ties back to Expedia's
 * real open-dispute exposure from the shared case book.
 */

const STATUS_TONE = { Settled: 'success', Pending: 'warning', Held: 'danger' };
const STATUS_ICON = { Settled: 'check', Pending: 'clock', Held: 'lock' };

export function Settlement() {
  const { notify } = useToast();

  const [search, setSearch] = useState('');
  const [merchant, setMerchant] = useState('');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const merchantOptions = useMemo(
    () => MERCHANTS.filter((m) => SETTLEMENT_BATCHES.some((b) => b.merchantId === m.id)).map((m) => ({ value: m.id, label: m.name })),
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SETTLEMENT_BATCHES.filter((b) => {
      if (merchant && b.merchantId !== merchant) return false;
      if (!q) return true;
      return `${b.id} ${b.merchantName} ${b.status}`.toLowerCase().includes(q);
    });
  }, [search, merchant]);

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

  const kpis = useMemo(() => settlementKpis(SETTLEMENT_BATCHES), []);
  const scopedKpis = useMemo(() => settlementKpis(filtered), [filtered]);

  const batchSpark = useMemo(() => weeklySeries(SETTLEMENT_BATCHES, 6, () => 1, () => true, batchDateOf), []);
  const netSpark = useMemo(() => weeklySeries(SETTLEMENT_BATCHES, 6, (b) => b.net, (b) => b.status === 'Settled', batchDateOf), []);
  const heldValueSpark = useMemo(() => weeklySeries(SETTLEMENT_BATCHES, 6, (b) => b.disputeDeductions, () => true, batchDateOf), []);
  const heldBatchSpark = useMemo(() => weeklySeries(SETTLEMENT_BATCHES, 6, () => 1, (b) => b.status === 'Held', batchDateOf), []);

  const columns = [
    { key: 'id', header: 'Batch', fw: 8, mono: true, sortable: true, cell: (r) => <span className="mono strong small">{r.id}</span> },
    { key: 'merchantName', header: 'Merchant', fw: 12, sortable: true, cell: (r) => <TruncatedText value={r.merchantName} className="small" /> },
    { key: 'date', header: 'Date', fw: 7, sortable: true, cell: (r) => <span className="small">{formatDate(r.date)}</span> },
    { key: 'gross', header: 'Gross', fw: 9, align: 'right', sortable: true, cell: (r) => <span className="mono small">{formatCurrency(r.gross, r.currency)}</span> },
    { key: 'fees', header: 'Fees', fw: 7, align: 'right', cell: (r) => <span className="mono small subtle">{formatCurrency(r.fees, r.currency)}</span> },
    { key: 'disputeDeductions', header: 'Held for disputes', fw: 9, align: 'right', sortable: true, cell: (r) => <span className="mono small" style={r.disputeDeductions > 0 ? { color: 'var(--c-danger)' } : undefined}>{formatCurrency(r.disputeDeductions, r.currency)}</span> },
    { key: 'net', header: 'Net', fw: 9, align: 'right', sortable: true, cell: (r) => <span className="mono small strong">{formatCurrency(r.net, r.currency)}</span> },
    { key: 'status', header: 'Status', fw: 6, sortable: true, align: 'center', cell: (r) => <StatusIcon icon={STATUS_ICON[r.status] ?? 'clock'} tone={STATUS_TONE[r.status] ?? 'neutral'} label={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Settlement" description="Settlement batches across the portfolio — gross, fees and what's held back for open disputes." />

      <div className="stack">
        <div className="grid grid--4" style={{ gap: 'var(--s-3)' }}>
          <Kpi label="Batches on file" value={formatNumber(kpis.batchCount)} spark={batchSpark} />
          <Kpi label="Net settled" value={formatCurrency(kpis.totalNetSettled)} meta="Settled batches only" spark={netSpark} />
          <Kpi label="Held for disputes" value={formatCurrency(kpis.totalHeldForDisputes)} invert spark={heldValueSpark} />
          <Kpi label="Batches held" value={formatNumber(kpis.heldBatchCount)} invert spark={heldBatchSpark} />
        </div>

        <Card bodyClassName="card__body--flush">
          <Toolbar>
            <div className="row row--tight">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Batch, merchant, status…" />
              <SelectField
                value={merchant}
                onChange={(e) => { setMerchant(e.target.value); setPage(1); }}
                placeholder="All merchants"
                options={merchantOptions}
                style={{ width: 220 }}
              />
            </div>
            <ExportButtons
              columns={columns}
              rows={sorted}
              name="settlement-batches"
              onCopied={(ok) => notify(ok ? 'Copied to clipboard.' : 'Your browser blocked clipboard access.', ok ? 'success' : 'danger')}
            />
          </Toolbar>

          {merchant && (
            <div className="row row--between" style={{ padding: 'var(--s-2) var(--s-4)', background: 'var(--c-primary-tint)' }}>
              <span className="small strong">{formatNumber(filtered.length)} batches · {formatCurrency(scopedKpis.totalNetSettled)} net settled</span>
            </div>
          )}

          <DataTable
            columns={columns}
            rows={pageRows}
            rowKey={(r) => r.id}
            sort={sort}
            onSort={(key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))}
          />

          <Pagination total={sorted.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </Card>
      </div>
    </>
  );
}

export default Settlement;
