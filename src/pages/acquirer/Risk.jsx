import { useMemo } from 'react';
import { PageHeader, Card, Badge, Kpi, StatusIcon } from '@/components/ui/Surface';
import { AreaChart, BarRows } from '@/components/charts/Charts';
import { DataTable } from '@/components/ui/DataTable';
import { TruncatedText } from '@/components/ui/Overlay';
import useScopedCases from '@/hooks/useScopedCases';
import { MERCHANTS } from '@/data/portfolio';
import { caseKpis, rateTrend, weeklyRate } from '@/domain/metrics';
import { isClosed } from '@/domain/statuses';
import { usePerspective } from '@/hooks/usePerspective';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent, formatShortDate } from '@/utils/format';

/** The acquirer's flagship merchant — read from the portfolio, never named. */
const flagshipName = MERCHANTS.find((m) => m.flagship)?.name ?? '';

/**
 * Risk — portfolio-wide dispute ratios and exposure. Expedia's own numbers
 * (chargeback ratio, exposure trend) are derived straight from the shared
 * case book, same as Overview.jsx; the peer merchants use the simulated
 * stats built in src/data/portfolio.js. One book, one set of ratios — the
 * table here never disagrees with Portfolio > Merchants.
 */

const RISK_THRESHOLD = 0.65; // industry-typical early-warning chargeback ratio, in percent
const STATUS_TONE = { Active: 'success', Onboarding: 'info', 'Under review': 'warning', Suspended: 'danger' };
const STATUS_ICON = { Active: 'check', Onboarding: 'clock', 'Under review': 'searchCheck', Suspended: 'close' };
const RISK_TONE = { Low: 'success', Medium: 'warning', High: 'danger' };
const RISK_ICON = { Low: 'activity', Medium: 'activity', High: 'alert' };

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** New dispute value created per week, from the real case book — a local
 * derivation kept in this page rather than in domain/metrics.js, which this
 * build does not touch. */
function weeklyDisputeValue(cases, weeks = 8) {
  const now = Date.now();
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * WEEK;
    return { start: end - WEEK, end, value: 0 };
  });

  cases.forEach((c) => {
    const at = new Date(c.dateCreated).getTime();
    const b = buckets.find((x) => at > x.start && at <= x.end);
    if (b) b.value += c.disputeAmount;
  });

  return buckets.map((b) => ({ period: formatShortDate(b.end), value: Math.round(b.value * 100) / 100 }));
}

export function Risk() {
  // Scoped to the merchant picker in the rail. Every figure on this page
  // therefore describes the selected merchant or group, not the whole book.
  const CASES = useScopedCases();
  const { terms } = usePerspective();

  const flagshipKpis = useMemo(() => caseKpis(CASES), [CASES]);
  const trend = useMemo(() => weeklyDisputeValue(CASES, 8), [CASES]);

  const ratioRows = useMemo(
    () => MERCHANTS.filter((m) => m.disputeVolume > 0)
      .map((m) => ({ label: m.name, value: m.chargebackRatio, meta: m.riskTier }))
      .sort((a, b) => b.value - a.value),
    [],
  );

  const flagged = useMemo(
    () => MERCHANTS.filter((m) => m.status !== 'Onboarding' && (m.riskTier === 'High' || m.chargebackRatio >= RISK_THRESHOLD || m.status === 'Under review' || m.status === 'Suspended'))
      .sort((a, b) => b.chargebackRatio - a.chargebackRatio),
    [],
  );

  const portfolioExposure = useMemo(() => MERCHANTS.reduce((s, m) => s + m.exposure, 0), []);
  const exposureSpark = useMemo(() => trend.map((t) => t.value), [trend]);
  const winRateSpark = useMemo(() => weeklyRate(CASES, 6, (c) => isClosed(c.status), (c) => c.outcome === 'won'), [CASES]);
  const winRateTrend = useMemo(() => rateTrend(CASES, (c) => isClosed(c.status), (c) => c.outcome === 'won'), [CASES]);

  const columns = [
    { key: 'name', header: 'Merchant', fw: 12, cell: (r) => <TruncatedText value={r.name} className="small strong" /> },
    { key: 'status', header: 'Status', fw: 7, align: 'center', cell: (r) => <StatusIcon icon={STATUS_ICON[r.status] ?? 'inbox'} tone={STATUS_TONE[r.status] ?? 'neutral'} label={r.status} /> },
    { key: 'riskTier', header: 'Risk tier', fw: 6, align: 'center', cell: (r) => <StatusIcon icon={RISK_ICON[r.riskTier] ?? 'activity'} tone={RISK_TONE[r.riskTier] ?? 'neutral'} label={`${r.riskTier} risk`} /> },
    { key: 'chargebackRatio', header: 'Chargeback ratio', fw: 8, align: 'right', cell: (r) => <span className="mono small strong" style={{ color: 'var(--c-danger)' }}>{formatPercent(r.chargebackRatio, 2)}</span> },
    { key: 'exposure', header: 'Exposure', fw: 8, align: 'right', cell: (r) => <span className="mono small">{formatCurrency(r.exposure)}</span> },
  ];

  return (
    <>
      <PageHeader title="Risk" description="Portfolio-wide dispute ratios and exposure, across every merchant this acquirer processes for." />

      <div className="stack">
        <div className="grid grid--4" style={{ gap: 'var(--s-3)' }}>
          <Kpi label="Portfolio exposure" value={formatCompactCurrency(portfolioExposure)} spark={exposureSpark} />
          <Kpi label={`${flagshipName} chargeback ratio`} value={formatPercent(MERCHANTS.find((m) => m.flagship)?.chargebackRatio ?? 0, 2)} meta="Flagship, derived from the live book" />
          <Kpi label="Merchants flagged" value={formatNumber(flagged.length)} meta={`At or above ${formatPercent(RISK_THRESHOLD, 2)}`} />
          <Kpi label={`${flagshipName} win rate`} value={formatPercent(flagshipKpis.winRate, 0)} meta={`${formatNumber(flagshipKpis.overdueCases)} overdue cases`} trend={winRateTrend} spark={winRateSpark} />
        </div>

        <div className="grid grid--2">
          <Card title="Chargeback ratio by merchant" bodyClassName="card__body--tight">
            <BarRows rows={ratioRows} formatValue={(v) => formatPercent(v, 2)} />
          </Card>

          <Card title={`New Dispute Value Per Week — ${flagshipName}`} bodyClassName="card__body--chart">
            <AreaChart data={trend} height={220} formatValue={(v) => formatCompactCurrency(v)} />
          </Card>
        </div>

        <Card title={`Merchants above the risk threshold`} action={<Badge tone="danger">{flagged.length} flagged</Badge>} bodyClassName="card__body--flush">
          <DataTable
            columns={columns}
            rows={flagged}
            rowKey={(r) => r.id}
            empty={<div className="empty"><p className="empty__title">No merchants above the threshold</p></div>}
          />
        </Card>

        <p className="micro subtle">
          Threshold set at {formatPercent(RISK_THRESHOLD, 2)}, the typical card-network early-warning level. Reviewed
          by the {terms.analyst.toLowerCase()} team during underwriting.
        </p>
      </div>
    </>
  );
}

export default Risk;
