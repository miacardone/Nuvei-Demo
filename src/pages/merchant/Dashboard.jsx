import { useMemo, useState } from 'react';
import { PageHeader, Card, Badge, Kpi } from '@/components/ui/Surface';
import { BarChart, AreaChart, Donut, BarRows, LineChart, DotPlot } from '@/components/charts/Charts';
import { DataTable } from '@/components/ui/DataTable';
import { TruncatedText } from '@/components/ui/Overlay';
import { CASES } from '@/data/cases';
import { useBrand } from '@/brand/BrandProvider';
import { isClosed } from '@/domain/statuses';
import {
  analystActivity, caseActivityPerWeek, caseKpis, caseTypeTrend, countTrend, disputeOutcomes,
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
  const brand = useBrand();
  const [range, setRange] = useState(RANGES[1]);

  const weeks = range === 'Last 7 days' ? 2 : range === 'Last 90 days' ? 12 : 6;
  const days = range === 'Last 7 days' ? 7 : range === 'Last 90 days' ? 90 : 28;

  const kpis = useMemo(() => caseKpis(CASES), []);
  const openTrend = useMemo(() => volumeTrend(CASES), []);
  const overdueTrend = useMemo(() => countTrend(CASES, (c) => !isClosed(c.status) && c.dueDate < new Date().toISOString().slice(0, 10)), []);
  const unassignedTrend = useMemo(() => countTrend(CASES, (c) => !isClosed(c.status) && c.worker === '—'), []);
  const exposureTrend = useMemo(() => sumTrend(CASES.filter((c) => !isClosed(c.status)), (c) => c.disputeAmount), []);
  const winRateTrend = useMemo(() => rateTrend(CASES, (c) => isClosed(c.status), (c) => c.outcome === 'won'), []);
  const mixTrend = useMemo(() => countTrend(CASES, (c) => c.caseType === 'claim'), []);
  const openSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, (c) => !isClosed(c.status)), []);
  const overdueSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, (c) => !isClosed(c.status) && c.dueDate < new Date().toISOString().slice(0, 10)), []);
  const unassignedSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, (c) => !isClosed(c.status) && c.worker === '—'), []);
  const exposureSpark = useMemo(() => weeklySeries(CASES.filter((c) => !isClosed(c.status)), 6, (c) => c.disputeAmount), []);
  const winRateSpark = useMemo(() => weeklyRate(CASES, 6, (c) => isClosed(c.status), (c) => c.outcome === 'won'), []);
  const mixSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, (c) => c.caseType === 'claim'), []);

  const activity = useMemo(() => caseActivityPerWeek(CASES, weeks), [weeks]);
  const daily = useMemo(() => newCasesPerDay(CASES, days), [days]);
  const analysts = useMemo(() => analystActivity(CASES), []);
  const donuts = useMemo(
    () => brand.schemes.slice(0, 2).map((s) => ({ scheme: s, ...reasonCodeDonut(CASES, s.id) })),
    [brand.schemes],
  );
  const queueDepth = useMemo(
    () => [...totalsByQueue(CASES)].sort((a, b) => b.casesInQueue - a.casesInQueue).map((q) => ({ label: q.label, value: q.casesInQueue, meta: formatCompactCurrency(q.value) })),
    [],
  );
  const outcomes = useMemo(() => disputeOutcomes(CASES), []);
  const docs = useMemo(() => documentProcessing(CASES), []);

  const typeTrend = useMemo(() => caseTypeTrend(CASES, weeks), [weeks]);

  const typeSplit = useMemo(() => {
    const chargebacks = CASES.filter((c) => c.caseType === 'chargeback').length;
    const claims = CASES.length - chargebacks;
    return [
      { label: brand.terms.chargebacks, value: chargebacks },
      { label: brand.terms.claims, value: claims, color: 'var(--c-series-1)' },
    ];
  }, [brand.terms]);

  const ahtByAnalyst = useMemo(
    () => [...analysts].sort((a, b) => b.aht - a.aht).slice(0, 8).map((a) => ({ label: a.email.split('@')[0], value: Math.round(a.aht * 100) / 100 })),
    [analysts],
  );

  const analystColumns = [
    { key: 'email', header: 'Email', fw: 14, cell: (r) => <TruncatedText value={r.email} className="mono" /> },
    { key: 'aht', header: 'AHT (minutes)', fw: 7, align: 'right', cell: (r) => <span className="mono">{r.aht.toFixed(2)}</span> },
    { key: 'casesPerUser', header: 'Cases per user', fw: 7, align: 'right', cell: (r) => <span className="mono">{formatNumber(r.casesPerUser)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live position across both intake paths — volumes, reason-code mix and analyst throughput."
      />

      <div className="stack">
        <div className="grid grid--auto" style={{ gap: 'var(--s-3)' }}>
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
          <Card title="Intake Mix" description="Share of all cases coming in as chargebacks vs. booking claims." bodyClassName="card__body--chart card__body--pie-row">
            <Donut data={typeSplit} variant="pie" size={150} />
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

        <Card title={`Average Handle Time by ${brand.terms.analyst}`} description="Mean minutes spent per case, by analyst. Dashed line marks the team average." bodyClassName="card__body--chart">
          <DotPlot data={ahtByAnalyst} yLabel="Minutes" />
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
