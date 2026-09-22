import { useMemo, useState } from 'react';
import { PageHeader, Card, Badge, Kpi } from '@/components/ui/Surface';
import { BarChart, AreaChart, Donut, BarRows, LineChart, DeviationBars } from '@/components/charts/Charts';
import { DataTable } from '@/components/ui/DataTable';
import { TruncatedText } from '@/components/ui/Overlay';
import useScopedCases from '@/hooks/useScopedCases';
import { userByEmail } from '@/data/people';
import { useBrand } from '@/brand/BrandProvider';
import { isClosed } from '@/domain/statuses';
import { analystActivity, caseActivityPerWeek, caseKpis, caseTypeTrend, countTrend, disputeOutcomes,
  documentProcessing, newCasesPerDay, rateTrend, reasonCodeDonut, sumTrend, totalsByQueue, volumeTrend, weeklyRate, weeklySeries,
} from '@/domain/metrics';
import { formatCompactCurrency, formatNumber, formatPercent } from '@/utils/format';

/**
 * Dashboard.
 *
 * Row order is fixed by the brief: bar → donut → donut → area → table. The two
 * donut cards hold a 1:1 aspect so they read as a matched pair.
 */

const RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days'];

function RangeChip({ value, onChange }) {
  return (
    <select
      className="select"
      style={{ width: 'auto', height: 26, fontSize: 'var(--fs-micro)' }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Date range"
    >
      {RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
    </select>
  );
}

export function Dashboard() {
  // Scoped to the merchant picker in the rail. Every figure on this page
  // therefore describes the selected merchant or group, not the whole book.
  const CASES = useScopedCases();
  const brand = useBrand();
  const [range, setRange] = useState(RANGES[1]);

  // Weekly buckets per range. A chart with four bars is a table with
  // extra steps, so even the short range keeps enough columns to read as
  // a trend — short ranges bucket by half-week rather than by week.
  const weeks = range === 'Last 7 days' ? 10 : range === 'Last 90 days' ? 14 : 12;
  const days = range === 'Last 7 days' ? 7 : range === 'Last 90 days' ? 90 : 28;

  const kpis = useMemo(() => caseKpis(CASES), [CASES]);
  const openTrend = useMemo(() => volumeTrend(CASES), [CASES]);
  const overdueTrend = useMemo(() => countTrend(CASES, (c) => !isClosed(c.status) && c.dueDate < new Date().toISOString().slice(0, 10)), [CASES]);
  const unassignedTrend = useMemo(() => countTrend(CASES, (c) => !isClosed(c.status) && c.worker === '—'), [CASES]);
  const exposureTrend = useMemo(() => sumTrend(CASES.filter((c) => !isClosed(c.status)), (c) => c.disputeAmount), [CASES]);
  const winRateTrend = useMemo(() => rateTrend(CASES, (c) => isClosed(c.status), (c) => c.outcome === 'won'), [CASES]);
  const mixTrend = useMemo(() => countTrend(CASES, (c) => c.caseType === 'claim'), [CASES]);
  const openSpark = useMemo(() => weeklySeries(CASES, 12, () => 1, (c) => !isClosed(c.status)), [CASES]);
  const overdueSpark = useMemo(() => weeklySeries(CASES, 12, () => 1, (c) => !isClosed(c.status) && c.dueDate < new Date().toISOString().slice(0, 10)), [CASES]);
  const unassignedSpark = useMemo(() => weeklySeries(CASES, 12, () => 1, (c) => !isClosed(c.status) && c.worker === '—'), [CASES]);
  const exposureSpark = useMemo(() => weeklySeries(CASES.filter((c) => !isClosed(c.status)), 12, (c) => c.disputeAmount), [CASES]);
  const winRateSpark = useMemo(() => weeklyRate(CASES, 12, (c) => isClosed(c.status), (c) => c.outcome === 'won'), [CASES]);
  const mixSpark = useMemo(() => weeklySeries(CASES, 12, () => 1, (c) => c.caseType === 'claim'), [CASES]);

  // Every one of these reads CASES, so CASES belongs in the dependency list.
  // Without it the charts kept the figures from whichever merchant was in
  // scope when the page first mounted, while the KPI strip above them updated
  // — the same page showing two different books at once.
  const activity = useMemo(() => caseActivityPerWeek(CASES, weeks), [CASES, weeks]);
  const daily = useMemo(() => newCasesPerDay(CASES, days), [CASES, days]);
  const analysts = useMemo(() => analystActivity(CASES), [CASES]);
  const donuts = useMemo(
    () => brand.schemes.slice(0, 2).map((s) => ({ scheme: s, ...reasonCodeDonut(CASES, s.id) })),
    [CASES, brand.schemes],
  );
  const queueDepth = useMemo(
    () => [...totalsByQueue(CASES)].sort((a, b) => b.casesInQueue - a.casesInQueue).map((q) => ({ label: q.label, value: q.casesInQueue, meta: formatCompactCurrency(q.value) })),
    [CASES],
  );
  const outcomes = useMemo(() => disputeOutcomes(CASES), [CASES]);
  const docs = useMemo(() => documentProcessing(CASES), [CASES]);

  const typeTrend = useMemo(() => caseTypeTrend(CASES, weeks), [CASES, weeks]);

  const typeSplit = useMemo(() => {
    const chargebacks = CASES.filter((c) => c.caseType === 'chargeback').length;
    const claims = CASES.length - chargebacks;
    return [
      { label: brand.terms.chargebacks, value: chargebacks },
      { label: brand.terms.claims, value: claims, color: 'var(--c-series-1)' },
    ];
  }, [brand.terms]);

  // Sorted fastest first, so the bars read top-to-bottom as a ranking rather
  // than as an arbitrary order. Real names, not the email local part — a
  // column of `chris.sca…` was neither readable nor worth the space.
  const ahtByAnalyst = useMemo(
    () => [...analysts]
      .sort((a, b) => a.aht - b.aht)
      .slice(0, 8)
      .map((a) => {
        const u = userByEmail(a.email);
        return {
          label: u?.name ?? a.email.split('@')[0],
          meta: `${formatNumber(a.casesPerUser)} cases`,
          value: Math.round(a.aht * 100) / 100,
        };
      }),
    [analysts],
  );

  const analystColumns = [
    {
      key: 'email', header: brand.terms.analyst, fw: 16,
      cell: (r) => {
        const u = userByEmail(r.email);
        return (
          <span className="row row--xtight row--nowrap" style={{ minWidth: 0 }}>
            <span className="avatar avatar--sm avatar--tint">{u?.initials ?? '—'}</span>
            <span className="stack stack--xtight" style={{ minWidth: 0 }}>
              <span className="small strong truncate">{u?.name ?? r.email}</span>
              <TruncatedText value={u?.title ?? r.email} className="micro subtle" />
            </span>
          </span>
        );
      },
    },
    { key: 'casesPerUser', header: 'Cases', fw: 6, align: 'right', cell: (r) => <span className="mono">{formatNumber(r.casesPerUser)}</span> },
    { key: 'open', header: 'Open', fw: 6, align: 'right', cell: (r) => <span className="mono">{formatNumber(r.open)}</span> },
    {
      key: 'overdue', header: 'Overdue', fw: 7, align: 'right',
      // Zero overdue is the good case and should not shout; anything above it
      // is the number a supervisor is scanning this table for.
      cell: (r) => (r.overdue > 0
        ? <Badge tone="danger">{formatNumber(r.overdue)}</Badge>
        : <span className="mono subtle">0</span>),
    },
    { key: 'closed', header: 'Closed', fw: 6, align: 'right', cell: (r) => <span className="mono">{formatNumber(r.closed)}</span> },
    {
      key: 'winRate', header: 'Win rate', fw: 7, align: 'right',
      cell: (r) => (r.closed
        ? <span className="mono">{formatPercent(r.winRate, 0)}</span>
        : <span className="subtle">—</span>),
    },
    { key: 'aht', header: 'AHT (min)', fw: 7, align: 'right', cell: (r) => <span className="mono">{r.aht.toFixed(1)}</span> },
    { key: 'exposure', header: 'Open exposure', fw: 8, align: 'right', cell: (r) => <span className="mono">{formatCompactCurrency(r.exposure)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live position across both intake paths — volumes, reason-code mix and analyst throughput."
      />

      <div className="stack">
        <div className="kpi-row">
          <Kpi label="Open cases" value={formatNumber(kpis.openCases)} meta={`${formatNumber(kpis.overdueCases)} overdue`} trend={openTrend} spark={openSpark} tooltip="New cases opened in the last 30 days vs. the 30 days before that." />
          <Kpi label="Overdue" value={formatNumber(kpis.overdueCases)} meta="Past internal due date" trend={overdueTrend} invert spark={overdueSpark} tooltip="Overdue cases opened in the last 30 days vs. the 30 days before that." />
          <Kpi label="Unassigned" value={formatNumber(kpis.unassigned)} meta="No analyst assigned" trend={unassignedTrend} invert spark={unassignedSpark} tooltip="Unassigned cases opened in the last 30 days vs. the 30 days before that." />
          <Kpi label="Exposure" value={formatCompactCurrency(kpis.openValue)} trend={exposureTrend} invert spark={exposureSpark} tooltip="Open case value from the last 30 days vs. the 30 days before that." />
          <Kpi label="Win rate" value={formatPercent(kpis.winRate, 0)} trend={winRateTrend} spark={winRateSpark} tooltip="Win rate for cases closed in the last 30 days vs. the 30 days before that." />
          <Kpi label={`${brand.terms.chargebacks} : ${brand.terms.claims}`} value={`${formatNumber(kpis.chargebacks)} : ${formatNumber(kpis.claims)}`} trend={mixTrend} spark={mixSpark} tooltip={`${brand.terms.claims} opened in the last 30 days vs. the 30 days before that.`} />
        </div>

        {/* Row 1 — full-width stacked bar */}
        <Card title="Case Activity Per Week" description="Cases by their current status, grouped by the week they were created." action={<RangeChip value={range} onChange={setRange} />} bodyClassName="card__body--chart">
          <BarChart
            data={activity}
            height={200}
            series={[
              { key: 'completed', name: 'Completed', color: 'var(--c-series-4)' },
              { key: 'represented', name: 'Represented', color: 'var(--c-series-0)' },
              { key: 'open', name: 'Open', color: 'var(--c-series-1)' },
              { key: 'expired', name: 'Expired', color: 'var(--c-series-3)' },
              { key: 'rejected', name: 'Rejected', color: 'var(--c-nav-active)' },
            ]}
          />
        </Card>

        {/* Row 2 — three compact pies side by side, Intake Mix in the middle */}
        <div className="grid grid--3">
          <Card
            title={`${donuts[0].scheme.label} Reason Codes`}
            description={`Share of open ${donuts[0].scheme.label} disputes by reason code.`}
            action={<Badge tone="neutral">{formatNumber(donuts[0].total)}</Badge>}
            bodyClassName="card__body--chart card__body--pie-row"
          >
            <Donut data={donuts[0].slices} centerValue={formatNumber(donuts[0].total)} centerLabel={donuts[0].scheme.label} size={150} />
          </Card>
          <Card title="Intake Mix" description="Share of all cases coming in as chargebacks vs. cardholder claims." bodyClassName="card__body--chart card__body--pie-row">
            <Donut
              data={typeSplit}
              centerValue={formatNumber(typeSplit.reduce((t, d) => t + d.value, 0))}
              centerLabel="cases"
              size={150}
            />
          </Card>
          <Card
            title={`${donuts[1].scheme.label} Reason Codes`}
            description={`Share of open ${donuts[1].scheme.label} disputes by reason code.`}
            action={<Badge tone="neutral">{formatNumber(donuts[1].total)}</Badge>}
            bodyClassName="card__body--chart card__body--pie-row"
          >
            <Donut data={donuts[1].slices} centerValue={formatNumber(donuts[1].total)} centerLabel={donuts[1].scheme.label} size={150} />
          </Card>
        </div>

        {/* Row 3 — full-width area */}
        <Card title="New Cases Per Day" description="New cases created each day over the selected range." action={<RangeChip value={range} onChange={setRange} />} bodyClassName="card__body--chart">
          <AreaChart data={daily} height={165} />
        </Card>

        <div className="grid grid--2">
          <Card title="Dispute Outcomes Per Week" description="Closed cases by outcome, grouped by the week they closed." bodyClassName="card__body--chart">
            <BarChart
              data={outcomes}
              height={200}
              series={[
                { key: 'won', name: 'Won', color: 'var(--c-primary)' },
                { key: 'lost', name: 'Lost', color: 'var(--c-nav-active)' },
                { key: 'written_off', name: 'Written off', color: 'var(--c-series-neutral)' },
              ]}
            />
          </Card>
          <Card title="Document Processing Per Week" description="Evidence status across cases, grouped by the week they were created." bodyClassName="card__body--chart">
            <BarChart
              data={docs}
              height={200}
              series={[
                { key: 'received', name: 'Received', color: 'var(--c-primary)' },
                { key: 'pending', name: 'Pending', color: 'var(--c-series-2)' },
                { key: 'missing', name: 'Missing', color: 'var(--c-nav-active)' },
              ]}
            />
          </Card>
        </div>

        <Card title="Chargeback vs. Claim Trend" description="Weekly volume split between the two intake paths." bodyClassName="card__body--chart">
          <LineChart
            data={typeTrend}
            height={200}
            series={[
              { key: 'chargeback', name: brand.terms.chargebacks },
              { key: 'claim', name: brand.terms.claims, color: 'var(--c-series-1)' },
            ]}
          />
        </Card>

        <Card
          title={`Average Handle Time by ${brand.terms.analyst}`}
          description="Mean minutes per case, measured against the team average. Bars left of centre are faster than the team; bars right of centre are slower."
        >
          <DeviationBars
            data={ahtByAnalyst}
            unit=" min"
            betterWhen="low"
            averageLabel="Team average"
            formatDelta={(n) => n.toFixed(1)}
          />
        </Card>

        <Card title="Queue Depth" description="Open cases currently sitting in each queue.">
          <BarRows rows={queueDepth} />
        </Card>

        {/* Row 4 — analyst activity table */}
        <Card title={`${brand.terms.analyst} activity`} bodyClassName="card__body--flush">
          <DataTable
            columns={analystColumns}
            rows={analysts.slice(0, 6)}
            rowKey={(r) => r.email}
            density="comfortable"
          />
        </Card>
      </div>
    </>
  );
}

export default Dashboard;
