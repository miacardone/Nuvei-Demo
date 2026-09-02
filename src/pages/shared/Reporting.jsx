import { useMemo } from 'react';
import { PageHeader, Card, Kpi } from '@/components/ui/Surface';
import { BarChart, AreaChart, BarRows, WorldBubbleMap } from '@/components/charts/Charts';
import { DataTable } from '@/components/ui/DataTable';
import useScopedCases from '@/hooks/useScopedCases';
import { MERCHANTS } from '@/data/portfolio';
import { SETTLEMENT_BATCHES, settlementKpis } from '@/data/settlement';
import { CARDHOLDERS } from '@/data/cardholders';
import { AUTHORIZATIONS } from '@/data/authorizations';
import { DUE_BUCKETS, casesByDueDatePerWeek, countTrend, entityTotalsByDueDate, newCasesPerDay, reasonCategoryByDueDate, totalsByMarket, weeklySeries } from '@/domain/metrics';
import { useBrand } from '@/brand/BrandProvider';
import { usePerspective } from '@/hooks/usePerspective';
import { formatCompactCurrency, formatNumber, formatPercent } from '@/utils/format';

/** The acquirer's and issuer's single Reporting leaf — the same base analytics as the merchant Reports center, plus one section specific to each perspective's own data. */
export function Reporting() {
  // Scoped to the merchant picker in the rail. Every figure on this page
  // therefore describes the selected merchant or group, not the whole book.
  const CASES = useScopedCases();
  const brand = useBrand();
  const { id } = usePerspective();

  const byWeek = useMemo(() => casesByDueDatePerWeek(CASES), [CASES]);
  const daily = useMemo(() => newCasesPerDay(CASES, 28), [CASES]);
  const byEntity = useMemo(() => entityTotalsByDueDate(CASES), [CASES]);
  const byCategory = useMemo(() => reasonCategoryByDueDate(CASES), [CASES]);

  const topMerchants = useMemo(
    () => [...MERCHANTS].sort((a, b) => b.disputeVolume - a.disputeVolume).slice(0, 8)
      .map((m) => ({ label: m.name, value: m.disputeVolume, meta: `${m.chargebackRatio}% CB ratio` })),
    [],
  );
  const settlement = useMemo(() => settlementKpis(SETTLEMENT_BATCHES), []);
  const heldTrend = useMemo(() => countTrend(CASES, (c) => c.status === 'represented'), [CASES]);
  const heldSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, (c) => c.status === 'represented'), [CASES]);
  const settledSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, (c) => c.outcome === 'won'), [CASES]);
  const settledTrend = useMemo(() => countTrend(CASES, (c) => c.outcome === 'won'), [CASES]);
  const byMarket = useMemo(() => totalsByMarket(CASES), [CASES]);

  const topCardholders = useMemo(
    () => [...CARDHOLDERS].sort((a, b) => b.disputeCount - a.disputeCount).slice(0, 8)
      .map((c) => ({ label: c.name, value: c.disputeCount, meta: c.status })),
    [],
  );
  const approvalRate = useMemo(() => {
    const approved = AUTHORIZATIONS.filter((a) => a.result === 'Approved').length;
    return AUTHORIZATIONS.length ? (approved / AUTHORIZATIONS.length) * 100 : 0;
  }, []);
  const disputedSpark = useMemo(() => weeklySeries(CASES, 6, () => 1, () => true), [CASES]);
  const disputedTrend = useMemo(() => countTrend(CASES, () => true), [CASES]);

  const columns = [
    { key: 'description', header: 'Description', fw: 14, cell: (r) => <span className="small strong">{r.description}</span> },
    ...DUE_BUCKETS.map((b) => ({
      key: b.id,
      header: b.label,
      fw: 7,
      align: 'right',
      cell: (r) => (
        <span className="mono small" style={b.id === 'pastDue' && r[b.id] > 0 ? { color: 'var(--c-danger)' } : undefined}>
          {formatNumber(r[b.id])}
        </span>
      ),
    })),
    { key: 'total', header: 'Total', fw: 7, align: 'right', cell: (r) => <span className="mono small strong">{formatNumber(r.total)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Reporting"
        description={id === 'issuer'
          ? 'Where deadline pressure sits across your cardholder disputes, and why they were raised.'
          : 'Where deadline pressure sits across the portfolio, and why the disputes were raised.'}
      />

      <div className="stack">
        <div className="grid grid--3" style={{ gap: 'var(--s-3)' }}>
          <Kpi label="Total cases" value={formatNumber(CASES.length)} trend={disputedTrend} spark={disputedSpark} tooltip="New cases opened in the last 30 days vs. the 30 days before that." />
          {id === 'acquirer' ? (
            <>
              <Kpi label="Settled (net)" value={formatCompactCurrency(settlement.totalNetSettled)} meta={`${settlement.batchCount} batches`} trend={settledTrend} spark={settledSpark} tooltip="Cases won in the last 30 days vs. the 30 days before that." />
              <Kpi label="Held for disputes" value={formatCompactCurrency(settlement.totalHeldForDisputes)} trend={heldTrend} invert spark={heldSpark} tooltip="Represented cases opened in the last 30 days vs. the 30 days before that." />
            </>
          ) : (
            <>
              <Kpi label="Approval rate" value={formatPercent(approvalRate, 1)} meta={`${formatNumber(AUTHORIZATIONS.length)} authorizations`} trend={settledTrend} spark={settledSpark} tooltip="Cases won in the last 30 days vs. the 30 days before that." />
              <Kpi label="Cardholders with a dispute" value={formatNumber(CARDHOLDERS.filter((c) => c.disputeCount > 0).length)} trend={heldTrend} invert spark={heldSpark} tooltip="Represented cases opened in the last 30 days vs. the 30 days before that." />
            </>
          )}
        </div>

        <div className="grid grid--2">
          <Card title="Cases by Due Date Per Week" description="Open chargebacks vs. claims, grouped by the week they're due." bodyClassName="card__body--chart">
            <BarChart
              data={byWeek}
              xLabel="Week due"
              yLabel="Open cases"
              series={[{ key: 'chargeback', name: brand.terms.chargebacks }, { key: 'claim', name: brand.terms.claims }]}
              height={220}
            />
          </Card>

          <Card title="New Cases Per Day" description="New cases created each day over the last 28 days." bodyClassName="card__body--chart">
            <AreaChart data={daily} xLabel="Day" yLabel="New cases" height={220} />
          </Card>
        </div>

        <Card title="Entity Case Totals by Due Date" description="Open cases per entity, broken out by how close each is to its due date." bodyClassName="card__body--chart">
          <BarChart
            data={byEntity}
            xLabel="Entity"
            yLabel="Open cases"
            series={DUE_BUCKETS.map((b, i) => ({
              key: b.id,
              name: b.label,
              color: b.id === 'pastDue' ? 'var(--c-nav-active)'
                : b.id === 'd5plus' ? 'var(--c-series-neutral)'
                  : `var(--c-series-${i - 1})`,
            }))}
            height={220}
          />
        </Card>

        <Card title="Case Totals by Reason Category & Due Date" description="Open cases grouped by why they were raised, broken out by due-date pressure." bodyClassName="card__body--flush">
          <DataTable columns={columns} rows={byCategory} rowKey={(r) => r.id} />
        </Card>

        <Card title="Cases by Market" description="Case volume and disputed value by market." bodyClassName="card__body--chart">
          <WorldBubbleMap data={byMarket} height={240} formatValue={formatCompactCurrency} />
        </Card>

        {id === 'acquirer' && (
          <Card title="Top Merchants by Dispute Volume" description="The merchants in your portfolio with the most disputes.">
            <BarRows rows={topMerchants} />
          </Card>
        )}

        {id === 'issuer' && (
          <Card title="Top Cardholders by Dispute Count" description="The cardholders raising the most disputes.">
            <BarRows rows={topCardholders} />
          </Card>
        )}
      </div>
    </>
  );
}

export default Reporting;
