import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Toolbar, IconButton, EmptyState, Button, Kpi } from '@/components/ui/Surface';
import { DataTable, ColumnToggle, DensityToggle, ExportButtons, Pagination } from '@/components/ui/DataTable';
import { SearchBar } from '@/components/ui/Form';
import { AdvancedFiltersModal, CaseFiltersDrawer, EMPTY_FILTERS, applyFilters, countActive } from '@/components/cases/CaseFilters';
import { buildCaseColumns } from '@/components/cases/caseColumns';
import brand from '@/brand/brand.config';
import { CASES } from '@/data/cases';
import { buildConsolidationGroups } from '@/domain/consolidation';
import { isClosed } from '@/domain/statuses';
import { caseKpis, countTrend, rateTrend, sumTrend, volumeTrend, weeklyRate, weeklySeries } from '@/domain/metrics';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { readPref, writePref } from '@/utils/storage';
import { formatCompactCurrency, formatNumber, formatPercent } from '@/utils/format';

const DENSITY_KEY = 'edc.disputes.density';

const COPY = {
  acquirer: {
    title: 'Disputes',
    description: `Every chargeback and ${brand.terms.claimProgramme} claim across the ${brand.terms.seller} portfolio.`,
    search: 'Case #, ARN, transaction, line item, merchant…',
  },
  issuer: {
    title: 'Disputes',
    description: `Every chargeback and ${brand.terms.claimProgramme} claim raised by your ${brand.terms.buyer}s.`,
    search: 'Case #, ARN, transaction, cardholder…',
  },
};

export function DisputesCases() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { id, routes } = usePerspective();
  const copy = COPY[id] ?? COPY.acquirer;

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [density, setDensity] = useState(() => readPref(DENSITY_KEY, 'fit'));
  const [hidden, setHidden] = useState(new Set());
  const [sort, setSort] = useState({ key: 'dueDate', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const linkedIds = useMemo(() => new Set(buildConsolidationGroups(CASES).flatMap((g) => g.caseIds)), []);
  const filtered = useMemo(() => applyFilters(CASES, filters, search), [filters, search]);
  const kpis = useMemo(() => caseKpis(CASES), []);
  const trend = useMemo(() => volumeTrend(CASES), []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const overdueTrend = useMemo(() => countTrend(CASES, (c) => !isClosed(c.status) && c.dueDate < today), [today]);
  const unassignedTrend = useMemo(() => countTrend(CASES, (c) => !isClosed(c.status) && c.worker === '—'), []);
  const exposureTrend = useMemo(() => sumTrend(CASES.filter((c) => !isClosed(c.status)), (c) => c.disputeAmount), []);
  const winRateTrend = useMemo(() => rateTrend(CASES, (c) => isClosed(c.status), (c) => c.outcome === 'won'), []);
  const representedTrend = useMemo(() => countTrend(CASES, (c) => c.status === 'represented'), []);
  const docsMissingTrend = useMemo(() => countTrend(CASES, (c) => !isClosed(c.status) && c.docStatus === 'missing'), []);

  const openSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, (c) => !isClosed(c.status)), []);
  const overdueSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, (c) => !isClosed(c.status) && c.dueDate < today), [today]);
  const unassignedSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, (c) => !isClosed(c.status) && c.worker === '—'), []);
  const exposureSpark = useMemo(() => weeklySeries(CASES.filter((c) => !isClosed(c.status)), 6, (c) => c.disputeAmount), []);
  const winRateSpark = useMemo(() => weeklyRate(CASES, 6, (c) => isClosed(c.status), (c) => c.outcome === 'won'), []);
  const representedSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, (c) => c.status === 'represented'), []);
  const docsMissingSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, (c) => !isClosed(c.status) && c.docStatus === 'missing'), []);

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
        fw: 5,
        width: '68px',
        align: 'center',
        cell: (row) => (
          <div onClick={(e) => e.stopPropagation()}>
            <IconButton icon="wrench" label="Work this case" size={13} onClick={() => navigate(routes.workCaseDetail(row.id))} />
          </div>
        ),
      },
    ];
  }, [allColumns, hidden, navigate, routes]);

  const changeFilters = (next) => { setFilters(next); setPage(1); };
  const setDensityPref = (d) => { setDensity(d); writePref(DENSITY_KEY, d); };

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        meta={
          <p className="page-head__desc">
            <strong className="mono">{formatNumber(filtered.length)}</strong> of{' '}
            <strong className="mono">{formatNumber(CASES.length)}</strong> cases
          </p>
        }
      />

      <div className="grid grid--auto" style={{ gap: 'var(--s-3)', marginBottom: 'var(--s-4)' }}>
        <Kpi label="Open cases" value={formatNumber(kpis.openCases)} trend={trend} spark={openSpark} tooltip="New cases opened in the last 30 days vs. the 30 days before that." />
        <Kpi label="Overdue" value={formatNumber(kpis.overdueCases)} meta="Past internal due date" trend={overdueTrend} invert spark={overdueSpark} tooltip="Overdue cases opened in the last 30 days vs. the 30 days before that." />
        <Kpi label="Unassigned" value={formatNumber(kpis.unassigned)} meta="No analyst assigned" trend={unassignedTrend} invert spark={unassignedSpark} tooltip="Unassigned cases opened in the last 30 days vs. the 30 days before that." />
        <Kpi label="Exposure" value={formatCompactCurrency(kpis.openValue)} meta="Open case value" trend={exposureTrend} invert spark={exposureSpark} tooltip="Open case value from the last 30 days vs. the 30 days before that." />
        <Kpi label="Win rate" value={formatPercent(kpis.winRate, 0)} meta="Of closed cases" trend={winRateTrend} spark={winRateSpark} tooltip="Win rate for cases closed in the last 30 days vs. the 30 days before that." />
        <Kpi label="Represented" value={formatNumber(kpis.represented)} meta="Submitted, awaiting decision" trend={representedTrend} spark={representedSpark} tooltip="Represented cases opened in the last 30 days vs. the 30 days before that." />
        <Kpi label="Docs missing" value={formatNumber(kpis.docsMissing)} meta="Open cases with no evidence on file" trend={docsMissingTrend} invert spark={docsMissingSpark} tooltip="Open cases missing documents, opened in the last 30 days vs. the 30 days before that." />
      </div>

      <Card bodyClassName="card__body--flush">
        <Toolbar>
          <div className="row row--tight">
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder={copy.search}
              onAdvanced={() => setAdvancedOpen(true)}
              advancedCount={countActive(filters)}
            />
            <CaseFiltersDrawer
              rows={CASES}
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
              name="disputes"
              onCopied={(ok) => notify(ok ? 'Copied to clipboard.' : 'Your browser blocked clipboard access.', ok ? 'success' : 'danger')}
            />
          </div>
        </Toolbar>

        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(r) => r.id}
          density={density}
          sort={sort}
          onSort={(key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}
          onRowClick={(row) => navigate(routes.workCaseDetail(row.id))}
          empty={
            <EmptyState
              icon="search"
              title="No cases match this view"
              hint="Widen the filters to see more of the book."
              action={<Button variant="secondary" icon="refresh" onClick={() => { changeFilters({ ...EMPTY_FILTERS }); setSearch(''); }}>Reset filters</Button>}
            />
          }
        />

        <Pagination total={sorted.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </Card>

      <AdvancedFiltersModal open={advancedOpen} onClose={() => setAdvancedOpen(false)} filters={filters} onApply={changeFilters} />
    </>
  );
}

export default DisputesCases;
