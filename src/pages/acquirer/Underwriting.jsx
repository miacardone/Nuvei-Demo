import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, Card, Badge, Kpi, StatusIcon } from '@/components/ui/Surface';
import { DataTable, Pagination, TableToolbar } from '@/components/ui/DataTable';
import { TruncatedText } from '@/components/ui/Overlay';
import { MERCHANTS, UNDERWRITING_REVIEWS } from '@/data/portfolio';
import { describe as describeIndemnity, settingsFor } from '@/data/indemnification';
import useIndemnification from '@/hooks/useIndemnification';
import { weeklySeries } from '@/domain/metrics';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

const reviewDateOf = (r) => r.reviewDate;
const DAY = 86_400_000;

/** Average per week, not a sum — weeklySeries only sums, so this buckets by
 *  hand for the one KPI that needs a mean rather than a total. */
function weeklyAverage(rows, weeks, valueFn, dateOf) {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY;
    const inRange = rows.filter((r) => { const at = new Date(dateOf(r)).getTime(); return at > end - 7 * DAY && at <= end; });
    return inRange.length ? Math.round(inRange.reduce((s, r) => s + valueFn(r), 0) / inRange.length) : 0;
  });
}

/**
 * Underwriting — risk review records for merchants before and during their
 * relationship with the acquirer. See src/data/portfolio.js for how each
 * review's risk score, findings and recommendation are simulated.
 */

/** Recommendations that accept risk on a condition, rather than clean approvals. */
const CONDITIONAL = new Set(['Approve with conditions', 'Decline', 'Escalate']);

const RECOMMENDATION_TONE = {
  Approve: 'success',
  'Approve with conditions': 'warning',
  Decline: 'danger',
  Escalate: 'danger',
};
const RECOMMENDATION_ICON = {
  Approve: 'check',
  'Approve with conditions': 'alert',
  Decline: 'close',
  Escalate: 'searchCheck',
};

function ScoreBar({ score }) {
  const tone = score >= 70 ? 'var(--c-success)' : score >= 45 ? 'var(--c-warning)' : 'var(--c-danger)';
  return (
    <div className="row row--xtight row--nowrap" style={{ minWidth: 90 }}>
      <div className="meter" style={{ width: 52 }}>
        <div className="meter__fill" style={{ width: `${score}%`, background: tone }} />
      </div>
      <span className="mono small strong">{score}</span>
    </div>
  );
}

export function Underwriting() {
  const { notify } = useToast();
  const { terms } = usePerspective();
  const [searchParams] = useSearchParams();
  const merchantFilter = searchParams.get('merchant');

  const [search, setSearch] = useState('');

  // Table chrome. Same controls in the same order as every other table.

  const [density, setDensity] = useState('comfortable');

  const [hidden, setHidden] = useState([]);
  const [sort, setSort] = useState({ key: 'reviewDate', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const scoped = useMemo(
    () => (merchantFilter ? UNDERWRITING_REVIEWS.filter((r) => r.merchantId === merchantFilter) : UNDERWRITING_REVIEWS),
    [merchantFilter],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((r) => `${r.merchantName} ${r.recommendation} ${r.reviewer}`.toLowerCase().includes(q));
  }, [scoped, search]);

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

  const kpis = useMemo(() => ({
    total: UNDERWRITING_REVIEWS.length,
    escalations: UNDERWRITING_REVIEWS.filter((r) => r.recommendation === 'Escalate').length,
    declines: UNDERWRITING_REVIEWS.filter((r) => r.recommendation === 'Decline').length,
    avgScore: Math.round(UNDERWRITING_REVIEWS.reduce((s, r) => s + r.riskScore, 0) / UNDERWRITING_REVIEWS.length),
  }), []);

  const totalSpark = useMemo(() => weeklySeries(UNDERWRITING_REVIEWS, 6, () => 1, () => true, reviewDateOf), []);
  const avgScoreSpark = useMemo(() => weeklyAverage(UNDERWRITING_REVIEWS, 6, (r) => r.riskScore, reviewDateOf), []);
  const escalationsSpark = useMemo(() => weeklySeries(UNDERWRITING_REVIEWS, 6, () => 1, (r) => r.recommendation === 'Escalate', reviewDateOf), []);
  const declinesSpark = useMemo(() => weeklySeries(UNDERWRITING_REVIEWS, 6, () => 1, (r) => r.recommendation === 'Decline', reviewDateOf), []);

  // Subscribing here is what keeps this column honest: change a merchant's
  // terms on their record and this table reflects it without a reload.
  useIndemnification();

  const columns = [
    { key: 'merchantName', header: 'Merchant', fw: 12, sortable: true, cell: (r) => <TruncatedText value={r.merchantName} className="small strong" /> },
    { key: 'reviewType', header: 'Review type', fw: 7, align: 'center', cell: (r) => <Badge tone="neutral">{r.reviewType}</Badge> },
    { key: 'riskScore', header: 'Risk score', fw: 8, sortable: true, cell: (r) => <ScoreBar score={r.riskScore} /> },
    { key: 'findings', header: 'Findings', fw: 20, cell: (r) => <TruncatedText value={r.findings.join('; ')} className="small" /> },
    { key: 'recommendation', header: 'Recommendation', fw: 10, sortable: true, align: 'center', cell: (r) => <StatusIcon icon={RECOMMENDATION_ICON[r.recommendation] ?? 'searchCheck'} tone={RECOMMENDATION_TONE[r.recommendation] ?? 'neutral'} label={r.recommendation} /> },
    {
      key: 'indemnification',
      header: 'Indemnification',
      fw: 9,
      align: 'center',
      /* Read-only. A commercial term is edited in exactly one place — the
         merchant's record — so it can never be set to two different values
         from two screens. Shown here because this is where the risk decision
         is made, and a condition you cannot see is a condition you forget to
         price. */
      cell: (r) => {
        const entry = settingsFor(r.merchantId);
        const label = describeIndemnity(entry, formatCurrency);
        if (entry?.enabled) return <Badge tone="primary">{label}</Badge>;
        // Risk accepted on a condition but never priced — the row worth arguing about.
        return <Badge tone={CONDITIONAL.has(r.recommendation) ? 'warning' : 'muted'}>{label}</Badge>;
      },
    },
    { key: 'reviewer', header: 'Reviewer', fw: 10, cell: (r) => <TruncatedText value={r.reviewer} className="mono small" /> },
    { key: 'reviewDate', header: 'Review date', fw: 7, sortable: true, cell: (r) => <span className="small">{formatDate(r.reviewDate)}</span> },
  ];

  const visibleColumns = columns.filter((c) => !hidden.includes(c.key));

  const scopedMerchant = merchantFilter ? MERCHANTS.find((m) => m.id === merchantFilter) : null;

  return (
    <>
      <PageHeader
        title="Underwriting"
        description={`Risk review for merchants before and during their relationship, conducted by the ${terms.analyst.toLowerCase()} team.`}
      />

      <div className="stack">
        <div className="grid grid--4" style={{ gap: 'var(--s-3)' }}>
          <Kpi label="Reviews on file" value={formatNumber(kpis.total)} spark={totalSpark} />
          <Kpi label="Avg. risk score" value={kpis.avgScore} meta="0 (highest risk) – 100" spark={avgScoreSpark} />
          <Kpi label="Escalations" value={formatNumber(kpis.escalations)} invert spark={escalationsSpark} />
          <Kpi label="Declines" value={formatNumber(kpis.declines)} invert spark={declinesSpark} />
        </div>

        <Card bodyClassName="card__body--flush">
          <TableToolbar
            search={search}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search reviews…"
            density={density}
            onDensityChange={setDensity}
            columns={columns}
            hidden={hidden}
            onHiddenChange={setHidden}
            exportColumns={visibleColumns}
            exportRows={sorted}
            exportName="underwriting-reviews"
            onCopied={(ok) => notify(ok ? 'Copied to clipboard.' : 'Your browser blocked clipboard access.', ok ? 'success' : 'danger')}
          />

          {scopedMerchant && (
            <div className="row row--between" style={{ padding: 'var(--s-2) var(--s-4)', background: 'var(--c-primary-tint)' }}>
              <span className="small strong">Filtered to {scopedMerchant.name}</span>
            </div>
          )}

          <DataTable
            columns={visibleColumns}
            density={density}
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

export default Underwriting;
