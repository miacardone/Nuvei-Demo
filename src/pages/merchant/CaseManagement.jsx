import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, Card, Toolbar, Tabs, Button, IconButton, EmptyState, Badge, Kpi } from '@/components/ui/Surface';
import { DataTable, ColumnToggle, DensityToggle, ExportButtons, Pagination } from '@/components/ui/DataTable';
import { SearchBar } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { AdvancedFiltersModal, CaseFiltersDrawer, EMPTY_FILTERS, applyFilters, countActive } from '@/components/cases/CaseFilters';
import { buildCaseColumns } from '@/components/cases/caseColumns';
import brand from '@/brand/brand.config';
import { CASES } from '@/data/cases';

/** Vocabulary comes from the tenant, so column labels are capitalised here
 *  rather than stored pre-capitalised in two places. */
const titleCase = (w) => w.charAt(0).toUpperCase() + w.slice(1);
import { getCaseHistory } from '@/data/work-case';
import { buildConsolidationGroups } from '@/domain/consolidation';
import { isClosed } from '@/domain/statuses';
import { caseKpis, countTrend, rateTrend, sumTrend, volumeTrend, weeklyRate, weeklySeries } from '@/domain/metrics';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { readPref, writePref } from '@/utils/storage';
import { formatCompactCurrency, formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent } from '@/utils/format';

const DENSITY_KEY = 'edc.cases.density';

/** Archived is a TAB here, not a separate page. */
const TABS = [
  { value: 'open', label: 'Open' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
  { value: 'future', label: 'Future services' },
];

const FUTURE_SERVICE_DAYS = 30;

/* ---------- Inline detail shown by an expanded row ---------- */

function RowDetail({ row }) {
  const fields = row.caseType === 'chargeback'
    ? [
        ['Reason code', row.reasonCode], ['ARN', row.arn], ['MID', row.mid],
        ['Post date', formatDate(row.postDate)], ['Trans. date', formatDate(row.transDate)],
        ['CC BIN', row.ccBin], ['CC last 4', row.ccLast4],
        ['Trans. amount', formatCurrency(row.transactionAmount, row.currency)], ['Trans. curr.', row.currency],
        ['Merch. ref #', row.merchantRef], ['Reviewer', row.reviewer],
        ['Outcome', row.outcome], ['Doc status', row.docStatus],
      ]
    : [
        ['Claim reason', row.reasonLabel], ['Booking ID', row.orderId], ['Reservation', row.itemTitle],
        ['Category', row.itemCategory], [titleCase(brand.terms.buyer), row.buyer], [titleCase(brand.terms.seller), row.seller],
        ['Supplier rating', row.sellerRating], ['Payment method', row.paymentMethod],
        ['Trans. amount', formatCurrency(row.transactionAmount, row.currency)], ['Trans. curr.', row.currency],
        ['Merch. ref #', row.merchantRef], ['Reviewer', row.reviewer],
        ['Doc status', row.docStatus],
      ];

  return (
    <div className="stack stack--tight">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--s-2)' }}>
        {fields.map(([k, v]) => (
          <div key={k} className="detail-row">
            <span className="detail-row__k">{k}</span>
            <span className="detail-row__v mono">{v ?? '—'}</span>
          </div>
        ))}
      </div>
      <div className="detail-row detail-row--wide">
        <span className="detail-row__k">Last note</span>
        <span className="detail-row__v">{row.lastNote}</span>
      </div>
    </div>
  );
}

/* ---------- Case history modal ---------- */

function CaseHistoryModal({ row, onClose }) {
  const events = useMemo(() => (row ? getCaseHistory(row.id) : []), [row]);
  const [expanded, setExpanded] = useState(new Set());

  const columns = [
    { key: 'user', header: 'Username', fw: 10, cell: (e) => <span className="mono small">{e.user}</span> },
    { key: 'case', header: 'Case #', fw: 7, cell: () => <span className="mono small">{row.id}</span> },
    { key: 'action', header: 'Action', fw: 14 },
    { key: 'status', header: 'Status', fw: 7, align: 'center', cell: () => <Badge tone="neutral">{row.status}</Badge> },
    { key: 'cycle', header: 'Dispute cycle', fw: 8, cell: () => <span className="small">{row.cycleLabel ?? '—'}</span> },
    { key: 'at', header: 'When', fw: 9, cell: (e) => <span className="micro subtle nowrap">{formatDateTime(e.at)}</span> },
  ];

  return (
    <Modal
      open={Boolean(row)}
      onClose={onClose}
      title="Case history"
      subtitle={row ? `${row.id} · ${events.length} events` : undefined}
      size="xl"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="row row--end" style={{ marginBottom: 'var(--s-2)' }}>
        <ExportButtons columns={columns} rows={events} name={`case-history-${row?.id}`} />
      </div>
      <DataTable
        columns={columns}
        rows={events}
        rowKey={(e) => e.id}
        expansion={{
          expanded,
          onToggle: (id) => setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
          render: (e) => <p className="small muted">{e.detail}</p>,
        }}
      />
    </Modal>
  );
}

/* ---------- Page ---------- */

export function CaseManagement() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { routes } = usePerspective();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState('open');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    queues: searchParams.get('queue') ? [searchParams.get('queue')] : [],
  }));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [density, setDensity] = useState(() => readPref(DENSITY_KEY, 'fit'));
  const [hidden, setHidden] = useState(new Set());
  const [sort, setSort] = useState({ key: 'dueDate', dir: 'asc' });
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [historyRow, setHistoryRow] = useState(null);

  const linkedIds = useMemo(() => new Set(buildConsolidationGroups(CASES).flatMap((g) => g.caseIds)), []);

  const scoped = useMemo(() => {
    if (tab === 'open') return CASES.filter((c) => !isClosed(c.status));
    if (tab === 'archived') return CASES.filter((c) => isClosed(c.status));
    if (tab === 'future') {
      const cutoff = Date.now() + FUTURE_SERVICE_DAYS * 86_400_000;
      return CASES.filter((c) => !isClosed(c.status) && new Date(c.serviceDate).getTime() > cutoff);
    }
    return CASES;
  }, [tab]);

  const filtered = useMemo(() => applyFilters(scoped, filters, search), [scoped, filters, search]);
  const kpis = useMemo(() => caseKpis(scoped), [scoped]);
  // Win rate always reads off the full book — the "Open" tab has no closed
  // cases by definition, so scoping it to the tab would always show 0%.
  const winRate = useMemo(() => caseKpis(CASES).winRate, []);
  const trend = useMemo(() => volumeTrend(scoped), [scoped]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const overdueTrend = useMemo(() => countTrend(scoped, (c) => !isClosed(c.status) && c.dueDate < today), [scoped, today]);
  const unassignedTrend = useMemo(() => countTrend(scoped, (c) => !isClosed(c.status) && c.worker === '—'), [scoped]);
  const exposureTrend = useMemo(() => sumTrend(scoped.filter((c) => !isClosed(c.status)), (c) => c.disputeAmount), [scoped]);
  const winRateTrend = useMemo(() => rateTrend(CASES, (c) => isClosed(c.status), (c) => c.outcome === 'won'), []);
  const representedTrend = useMemo(() => countTrend(scoped, (c) => c.status === 'represented'), [scoped]);
  const docsMissingTrend = useMemo(() => countTrend(scoped, (c) => !isClosed(c.status) && c.docStatus === 'missing'), [scoped]);

  const openSpark = useMemo(() => weeklySeries(scoped, 6, () => 1, (c) => !isClosed(c.status)), [scoped]);
  const overdueSpark = useMemo(() => weeklySeries(scoped, 6, () => 1, (c) => !isClosed(c.status) && c.dueDate < today), [scoped, today]);
  const unassignedSpark = useMemo(() => weeklySeries(scoped, 6, () => 1, (c) => !isClosed(c.status) && c.worker === '—'), [scoped]);
  const exposureSpark = useMemo(() => weeklySeries(scoped.filter((c) => !isClosed(c.status)), 6, (c) => c.disputeAmount), [scoped]);
  const winRateSpark = useMemo(() => weeklyRate(CASES, 6, (c) => isClosed(c.status), (c) => c.outcome === 'won'), []);
  const representedSpark = useMemo(() => weeklySeries(scoped, 6, () => 1, (c) => c.status === 'represented'), [scoped]);
  const docsMissingSpark = useMemo(() => weeklySeries(scoped, 6, () => 1, (c) => !isClosed(c.status) && c.docStatus === 'missing'), [scoped]);

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

  const allColumns = useMemo(() => buildCaseColumns(filters.caseType, { linkedIds }), [filters.caseType, linkedIds]);
  const columns = useMemo(() => {
    const visible = allColumns.filter((c) => !hidden.has(c.key));
    return [
      ...visible,
      {
        key: 'actions',
        header: 'Actions', pinned: true,
        fw: 6,
        width: '92px',
        align: 'center',
        cell: (row) => (
          <div className="row row--xtight row--nowrap row--center" onClick={(e) => e.stopPropagation()}>
            <IconButton icon="history" label="Case history" size={13} onClick={() => setHistoryRow(row)} />
            <IconButton icon="wrench" label="Work this case" size={13} onClick={() => navigate(routes.workCaseDetail(row.id))} />
          </div>
        ),
      },
    ];
  }, [allColumns, hidden, navigate, routes]);

  const changeFilters = (next) => { setFilters(next); setPage(1); };
  const changeTab = (next) => { setTab(next); setPage(1); setSelected(new Set()); };

  const setDensityPref = (d) => {
    setDensity(d);
    writePref(DENSITY_KEY, d);
  };

  return (
    <>
      <PageHeader
        title="Case management"
        description={`Every chargeback and ${brand.terms.claimProgramme} claim in one queue. Columns adapt to the case type you filter on.`}
        meta={
          <p className="page-head__desc">
            <strong className="mono">{formatNumber(filtered.length)}</strong> of{' '}
            <strong className="mono">{formatNumber(CASES.length)}</strong> cases · Default view (All cycles)
          </p>
        }
      />

      <div className="grid grid--auto" style={{ gap: 'var(--s-3)', marginBottom: 'var(--s-4)' }}>
        <Kpi label="Open cases" value={formatNumber(kpis.openCases)} trend={trend} spark={openSpark} tooltip="New cases opened in the last 30 days vs. the 30 days before that." />
        <Kpi label="Overdue" value={formatNumber(kpis.overdueCases)} meta="Past internal due date" trend={overdueTrend} invert spark={overdueSpark} tooltip="Overdue cases opened in the last 30 days vs. the 30 days before that." />
        <Kpi label="Unassigned" value={formatNumber(kpis.unassigned)} meta="No analyst assigned" trend={unassignedTrend} invert spark={unassignedSpark} tooltip="Unassigned cases opened in the last 30 days vs. the 30 days before that." />
        <Kpi label="Exposure" value={formatCompactCurrency(kpis.openValue)} meta="Open case value" trend={exposureTrend} invert spark={exposureSpark} tooltip="Open case value from the last 30 days vs. the 30 days before that." />
        <Kpi label="Win rate" value={formatPercent(winRate, 0)} meta="Across all closed cases" trend={winRateTrend} spark={winRateSpark} tooltip="Win rate for cases closed in the last 30 days vs. the 30 days before that." />
        <Kpi label="Represented" value={formatNumber(kpis.represented)} meta="Submitted, awaiting decision" trend={representedTrend} spark={representedSpark} tooltip="Represented cases opened in the last 30 days vs. the 30 days before that." />
        <Kpi label="Docs missing" value={formatNumber(kpis.docsMissing)} meta="Open cases with no evidence on file" trend={docsMissingTrend} invert spark={docsMissingSpark} tooltip="Open cases missing documents, opened in the last 30 days vs. the 30 days before that." />
      </div>

      <Card bodyClassName="card__body--flush">
        <div style={{ padding: '0 var(--s-4)' }}>
          <Tabs
            tabs={TABS.map((t) => ({
              ...t,
              badge: formatNumber(
                t.value === 'open' ? CASES.filter((c) => !isClosed(c.status)).length
                  : t.value === 'archived' ? CASES.filter((c) => isClosed(c.status)).length
                    : t.value === 'future' ? CASES.filter((c) => !isClosed(c.status) && new Date(c.serviceDate).getTime() > Date.now() + FUTURE_SERVICE_DAYS * 86_400_000).length
                      : CASES.length,
              ),
            }))}
            value={tab}
            onChange={changeTab}
          />
        </div>

        <Toolbar>
          <div className="row row--tight">
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder={`Case #, ARN, ${brand.terms.order}, ${brand.terms.item}, ${brand.terms.buyer} or ${brand.terms.seller}…`}
              onAdvanced={() => setAdvancedOpen(true)}
              advancedCount={countActive(filters)}
            />
            <CaseFiltersDrawer
              rows={scoped}
              statusSelected={filters.statuses}
              onStatusChange={(v) => changeFilters({ ...filters, statuses: v })}
              queueSelected={filters.queues}
              onQueueChange={(v) => changeFilters({ ...filters, queues: v })}
            />
          </div>

          <div className="row row--tight">
            <DensityToggle value={density} onChange={setDensityPref} />
            <ColumnToggle columns={allColumns} hidden={hidden} onChange={setHidden} />
            <ExportButtons
              columns={columns.filter((c) => c.key !== 'actions')}
              rows={sorted}
              name="cases"
              onCopied={(ok) => notify(ok ? 'Copied to clipboard.' : 'Your browser blocked clipboard access.', ok ? 'success' : 'danger')}
            />
          </div>
        </Toolbar>

        {selected.size > 0 && (
          <div className="row row--between" style={{ padding: 'var(--s-2) var(--s-4)', background: 'var(--c-primary-tint)' }}>
            <span className="small strong">{selected.size} selected</span>
            <div className="row row--tight">
              <Button variant="secondary" size="sm" icon="edit" onClick={() => notify(`Bulk edit would apply to ${selected.size} cases.`)}>Bulk edit</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(r) => r.id}
          density={density}
          sort={sort}
          onSort={(key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}
          selection={{
            selected,
            onToggle: (id) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
            onToggleAll: (ids, check) => setSelected((p) => { const n = new Set(p); ids.forEach((id) => (check ? n.add(id) : n.delete(id))); return n; }),
          }}
          expansion={{
            expanded,
            onToggle: (id) => setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
            render: (row) => <RowDetail row={row} />,
          }}
          empty={
            <EmptyState
              icon="search"
              title="No cases match this view"
              hint="Widen the filters, or switch to the All tab to include archived cases."
              action={<Button variant="secondary" icon="refresh" onClick={() => { changeFilters({ ...EMPTY_FILTERS }); setSearch(''); }}>Reset filters</Button>}
            />
          }
        />

        <Pagination
          total={sorted.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </Card>

      <AdvancedFiltersModal open={advancedOpen} onClose={() => setAdvancedOpen(false)} filters={filters} onApply={changeFilters} />
      <CaseHistoryModal row={historyRow} onClose={() => setHistoryRow(null)} />
    </>
  );
}

export default CaseManagement;
