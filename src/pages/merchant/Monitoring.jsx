import { useMemo, useState } from 'react';
import { PageHeader, Card, Badge, Kpi } from '@/components/ui/Surface';
import { BarChart, LineChart, DotPlot, WorldBubbleMap } from '@/components/charts/Charts';
import { DataTable } from '@/components/ui/DataTable';
import { SelectField } from '@/components/ui/Form';
import { CASES } from '@/data/cases';
import { ERROR_TYPES, disputeOutcomes, documentProcessing, errorHandling, missingDocsByMarket } from '@/domain/metrics';
import { formatNumber, formatPercent } from '@/utils/format';

/** Chart plus the numbers behind it — a stacked bar alone is not auditable. */
function Section({ title, data, series, totalsLabel, children, xLabel, yLabel }) {
  const totals = series.map((s) => ({ ...s, total: data.reduce((sum, row) => sum + (row[s.key] ?? 0), 0) }));
  const grand = totals.reduce((sum, s) => sum + s.total, 0);

  const columns = [
    { key: 'label', header: totalsLabel, fw: 12, cell: (r) => <span className="row row--xtight"><span className="legend__swatch" style={{ background: r.color }} /><span className="small strong">{r.name}</span></span> },
    ...data.map((row) => ({ key: row.period, header: row.period, fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatNumber(row[r.key] ?? 0)}</span> })),
    { key: 'total', header: 'Total', fw: 6, align: 'right', cell: (r) => <span className="mono small strong">{formatNumber(r.total)}</span> },
    { key: 'share', header: 'Share', fw: 6, align: 'right', cell: (r) => <span className="mono small subtle">{formatPercent(grand ? (r.total / grand) * 100 : 0, 1)}</span> },
  ];

  return (
    <Card title={title} bodyClassName="card__body--chart">
      <BarChart data={data} series={series} xLabel={xLabel} yLabel={yLabel} height={200} />
      <div style={{ marginTop: 'var(--s-3)' }}>
        <DataTable columns={columns} rows={totals} rowKey={(r) => r.key} density="fit" />
      </div>
      {children}
    </Card>
  );
}

export function Monitoring() {
  const [weeks, setWeeks] = useState(8);

  const docs = useMemo(() => documentProcessing(CASES, weeks), [weeks]);
  const outcomes = useMemo(() => disputeOutcomes(CASES, weeks), [weeks]);
  const errors = useMemo(() => errorHandling(CASES, weeks), [weeks]);
  const missingByMarket = useMemo(() => missingDocsByMarket(CASES), []);

  const completionTrend = useMemo(() => docs.map((d) => {
    const total = d.received + d.pending + d.missing;
    return { period: d.period, rate: total ? Math.round((d.received / total) * 1000) / 10 : 0 };
  }), [docs]);

  const errorAverages = useMemo(() => ERROR_TYPES.map((t) => ({
    label: t.label,
    value: Math.round((errors.reduce((s, w) => s + (w[t.id] ?? 0), 0) / (errors.length || 1)) * 10) / 10,
  })), [errors]);

  const docTotals = useMemo(() => docs.reduce((s, d) => ({ received: s.received + d.received, pending: s.pending + d.pending, missing: s.missing + d.missing }), { received: 0, pending: 0, missing: 0 }), [docs]);
  const errorTotal = useMemo(() => errors.reduce((s, w) => s + ERROR_TYPES.reduce((x, t) => x + (w[t.id] ?? 0), 0), 0), [errors]);

  // These KPIs summarize an already-weekly-bucketed series (not raw cases),
  // so the trend compares the recent half of the range against the earlier
  // half rather than reusing the case-level countTrend/weeklySeries helpers.
  const trendFromSeries = (arr) => {
    const mid = Math.ceil(arr.length / 2);
    const prior = arr.slice(0, mid).reduce((s, v) => s + v, 0);
    const recent = arr.slice(mid).reduce((s, v) => s + v, 0);
    if (!prior) return { direction: 'up', label: recent ? 'new' : '—' };
    const pct = Math.max(-75, Math.min(75, Math.round(((recent - prior) / prior) * 100)));
    return { direction: pct >= 0 ? 'up' : 'down', label: `${pct >= 0 ? '+' : ''}${pct}% recent vs earlier` };
  };

  const receivedSpark = useMemo(() => docs.map((d) => d.received), [docs]);
  const pendingSpark = useMemo(() => docs.map((d) => d.pending), [docs]);
  const missingSpark = useMemo(() => docs.map((d) => d.missing), [docs]);
  const errorsSpark = useMemo(() => errors.map((w) => ERROR_TYPES.reduce((s, t) => s + (w[t.id] ?? 0), 0)), [errors]);
  const receivedTrend = useMemo(() => trendFromSeries(receivedSpark), [receivedSpark]);
  const pendingTrend = useMemo(() => trendFromSeries(pendingSpark), [pendingSpark]);
  const missingTrend = useMemo(() => trendFromSeries(missingSpark), [missingSpark]);
  const errorsTrend = useMemo(() => trendFromSeries(errorsSpark), [errorsSpark]);

  return (
    <>
      <PageHeader
        title="Monitoring"
        description="Document processing, dispute outcomes and integration errors."
        actions={
          <SelectField
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            options={[{ value: 4, label: 'Last 4 weeks' }, { value: 8, label: 'Last 8 weeks' }, { value: 12, label: 'Last 12 weeks' }]}
          />
        }
      />

      <div className="stack">
        <div className="grid grid--4" style={{ gap: 'var(--s-3)' }}>
          <Kpi label="Docs received" value={formatNumber(docTotals.received)} meta={`Last ${weeks} weeks`} trend={receivedTrend} spark={receivedSpark} />
          <Kpi label="Docs pending" value={formatNumber(docTotals.pending)} trend={pendingTrend} invert spark={pendingSpark} />
          <Kpi label="Docs missing" value={formatNumber(docTotals.missing)} trend={missingTrend} invert spark={missingSpark} />
          <Kpi label="Integration errors" value={formatNumber(errorTotal)} meta={`Last ${weeks} weeks`} trend={errorsTrend} invert spark={errorsSpark} />
        </div>

        <Section
          title="Case and document processing"
          data={docs}
          xLabel="Week"
          yLabel="Documents"
          totalsLabel="Processing state"
          series={[
            { key: 'received', name: 'Received', color: 'var(--c-primary)' },
            { key: 'pending', name: 'Pending', color: 'var(--c-series-2)' },
            { key: 'missing', name: 'Missing', color: 'var(--c-nav-active)' },
          ]}
        />

        <Section
          title="Dispute outcomes"
          data={outcomes}
          xLabel="Week"
          yLabel="Cases"
          totalsLabel="Outcome"
          series={[
            { key: 'won', name: 'Won', color: 'var(--c-primary)' },
            { key: 'lost', name: 'Lost', color: 'var(--c-nav-active)' },
            { key: 'written_off', name: 'Written off', color: 'var(--c-series-neutral)' },
          ]}
        />

        <Section
          title="Error handling by response type"
          data={errors}
          xLabel="Week"
          yLabel="Errors"
          totalsLabel="Error type"
          series={ERROR_TYPES.map((t, i) => ({ key: t.id, name: t.label, color: `var(--c-series-${i})` }))}
        >
          <div className="stack stack--xtight" style={{ marginTop: 'var(--s-4)' }}>
            <span className="t-section-label">How each error is handled</span>
            {ERROR_TYPES.map((t) => (
              <div key={t.id} className="row row--xtight">
                <Badge tone="neutral">{t.http}</Badge>
                <span className="small strong">{t.label}</span>
                <span className="small muted">— {t.remedy}</span>
              </div>
            ))}
          </div>
        </Section>

        <div className="grid grid--2">
          <Card title="Document Completion Rate Trend" bodyClassName="card__body--chart">
            <LineChart data={completionTrend} height={220} xLabel="Week" yLabel="% received" series={[{ key: 'rate', name: 'Completion rate' }]} formatValue={(v) => `${v}%`} />
          </Card>
          <Card title="Average Errors per Week by Type" bodyClassName="card__body--chart">
            <DotPlot data={errorAverages} yLabel="Avg. errors / week" />
          </Card>
        </div>

        <Card title="Missing Documents by Market" bodyClassName="card__body--chart">
          {missingByMarket.length ? (
            <WorldBubbleMap data={missingByMarket} height={260} />
          ) : (
            <p className="micro subtle">No missing documents right now.</p>
          )}
        </Card>
      </div>
    </>
  );
}

export default Monitoring;
