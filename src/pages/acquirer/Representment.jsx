import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, IconButton, EmptyState, Kpi } from '@/components/ui/Surface';
import { DataTable, Pagination, TableToolbar } from '@/components/ui/DataTable';
import { buildCaseColumns } from '@/components/cases/caseColumns';
import useScopedCases from '@/hooks/useScopedCases';
import { isClosed } from '@/domain/statuses';
import { countTrend, sumTrend, weeklySeries } from '@/domain/metrics';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatCompactCurrency, formatNumber } from '@/utils/format';

/**
 * Representment — chargebacks queued for a representment packet. Scoped to
 * caseType 'chargeback' (claims have no card leg to represent) that are open
 * and not yet in the 'represented' status. This is a queue, not a workflow —
 * per-case action detail lives on the shared Work case page.
 */

const QUEUE_STATUSES = ['open', 'ready', 'assigned', 'working', 'pended'];

export function Representment() {
  // Scoped to the merchant picker in the rail. Every figure on this page
  // therefore describes the selected merchant or group, not the whole book.
  const CASES = useScopedCases();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { terms, routes } = usePerspective();

  const [search, setSearch] = useState('');

  // Table chrome. Density is new here; this page already tracked hidden
  // columns as a Set, which ColumnToggle handles, so that stays as it was.
  const [density, setDensity] = useState('comfortable');
  const [hidden, setHidden] = useState(new Set());
  const [sort, setSort] = useState({ key: 'dueDate', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const queue = useMemo(
    () => CASES.filter((c) => c.caseType === 'chargeback' && !isClosed(c.status) && QUEUE_STATUSES.includes(c.status)),
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter((c) =>
      [c.id, c.arn, c.cardholder, c.reasonCode, c.reasonLabel, c.entityLabel, c.worker].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [queue, search]);

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

  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      queued: queue.length,
      overdue: queue.filter((c) => c.dueDate < today).length,
      exposure: queue.reduce((s, c) => s + c.disputeAmount, 0),
    };
  }, [queue]);

  const inQueue = (c) => c.caseType === 'chargeback' && !isClosed(c.status) && QUEUE_STATUSES.includes(c.status);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const queuedTrend = useMemo(() => countTrend(CASES, inQueue), [CASES]);
  const overdueTrend = useMemo(() => countTrend(CASES, (c) => inQueue(c) && c.dueDate < today), [today]);
  const exposureTrend = useMemo(() => sumTrend(CASES.filter(inQueue), (c) => c.disputeAmount), [CASES]);
  const queuedSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, inQueue), [CASES]);
  const overdueSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, (c) => inQueue(c) && c.dueDate < today), [today]);
  const exposureSpark = useMemo(() => weeklySeries(CASES.filter(inQueue), 6, (c) => c.disputeAmount), [CASES]);

  const allColumns = useMemo(() => buildCaseColumns('chargeback'), []);
  // Hoisted out of the columns memo below: the toolbar exports exactly the
  // columns the table is showing, so it needs the same list.
  const visibleColumns = useMemo(
    () => allColumns.filter((c) => !hidden.has(c.key)),
    [allColumns, hidden],
  );
  const columns = useMemo(() => {
    return [
      ...visibleColumns,
      {
        key: 'actions',
        header: 'Actions', pinned: true,
        fw: 8,
        width: '150px',
        align: 'center',
        cell: (row) => (
          <div className="row row--xtight row--nowrap row--center" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="secondary"
              size="sm"
              icon="send"
              onClick={() => notify(`Representment packet queued for ${row.id} — forwarded to ${row.entityLabel}.`, 'success')}
            >
              Build packet
            </Button>
            <IconButton icon="wrench" label="Work this case" size={13} onClick={() => navigate(routes.workCaseDetail(row.id))} />
          </div>
        ),
      },
    ];
  }, [allColumns, hidden, navigate, notify, routes]);

  return (
    <>
      <PageHeader
        title="Representment"
        description={`Chargebacks queued to build and send a representment packet, worked by the ${terms.analyst.toLowerCase()} team.`}
      />

      <div className="stack">
        <div className="grid grid--3" style={{ gap: 'var(--s-3)' }}>
          <Kpi label="Queued for representment" value={formatNumber(kpis.queued)} trend={queuedTrend} spark={queuedSpark} />
          <Kpi label="Overdue" value={formatNumber(kpis.overdue)} invert trend={overdueTrend} spark={overdueSpark} />
          <Kpi label="Exposure in queue" value={formatCompactCurrency(kpis.exposure)} invert trend={exposureTrend} spark={exposureSpark} />
        </div>

        <Card bodyClassName="card__body--flush">
            <TableToolbar
              search={search}
              onSearch={(v) => { setSearch(v); setPage(1); }}
              searchPlaceholder="Case #, ARN, cardholder, reason…"
              density={density}
              onDensityChange={setDensity}
              columns={allColumns}
              hidden={hidden}
              onHiddenChange={setHidden}
              exportColumns={visibleColumns}
              exportRows={sorted}
              exportName="representment-queue"
              onCopied={(ok) => notify(ok ? 'Copied to clipboard.' : 'Your browser blocked clipboard access.', ok ? 'success' : 'danger')}
            />

          <DataTable
            columns={columns}
            density={density}
            rows={pageRows}
            rowKey={(r) => r.id}
            density="fit"
            sort={sort}
            onSort={(key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}
            onRowClick={(row) => navigate(routes.workCaseDetail(row.id))}
            empty={<EmptyState icon="search" title="Nothing queued" hint="No open chargebacks are waiting on a representment packet right now." />}
          />

          <Pagination total={sorted.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </Card>
      </div>
    </>
  );
}

export default Representment;
