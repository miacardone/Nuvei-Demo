import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Toolbar, Badge, Button, Kpi, StatusIcon } from '@/components/ui/Surface';
import { DataTable, ExportButtons, Pagination } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/Form';
import { TruncatedText } from '@/components/ui/Overlay';
import { ACQUIRER_NAME, MERCHANTS } from '@/data/portfolio';
import IndemnificationPanel from '@/components/portfolio/IndemnificationPanel';
import useIndemnification from '@/hooks/useIndemnification';
import { annualCharge, describe, settingsFor } from '@/data/indemnification';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatCompactCurrency, formatCurrency, formatDate, formatNumber, formatPercent } from '@/utils/format';

/**
 * Portfolio — Merchants. The tenant is the flagship (real numbers, derived from
 * the shared case book); the rest are fictional peers with simulated aggregate
 * stats. See src/data/portfolio.js for how each is built.
 *
 * Indemnification is a service-level term the acquirer sets per merchant, so it
 * is both a column here and an editable panel on the merchant record.
 */

const STATUS_TONE = { Active: 'success', Onboarding: 'info', 'Under review': 'warning', Suspended: 'danger' };
const STATUS_ICON = { Active: 'check', Onboarding: 'clock', 'Under review': 'searchCheck', Suspended: 'close' };
const RISK_TONE = { Low: 'success', Medium: 'warning', High: 'danger' };
const RISK_ICON = { Low: 'activity', Medium: 'activity', High: 'alert' };

export function PortfolioMerchants() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { routes } = usePerspective();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'exposure', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detail, setDetail] = useState(null);

  // Subscribing here keeps the column in step with edits made in the panel
  // below without either one owning the other's state.
  const indemnity = useIndemnification();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MERCHANTS;
    return MERCHANTS.filter((m) => `${m.name} ${m.vertical} ${m.mccLabel}`.toLowerCase().includes(q));
  }, [search]);

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

  const totals = useMemo(() => {
    const withVolume = MERCHANTS.filter((m) => m.disputeVolume > 0);
    return {
      count: MERCHANTS.length,
      active: MERCHANTS.filter((m) => m.status === 'Active').length,
      exposure: MERCHANTS.reduce((s, m) => s + m.exposure, 0),
      flagged: MERCHANTS.filter((m) => m.status === 'Under review' || m.status === 'Suspended').length,
      indemnified: MERCHANTS.filter((m) => settingsFor(m.id).enabled).length,
      indemnifiedExposure: MERCHANTS.filter((m) => settingsFor(m.id).enabled).reduce((s2, m) => s2 + m.exposure, 0),
      avgRatio: withVolume.length ? withVolume.reduce((s, m) => s + m.chargebackRatio, 0) / withVolume.length : 0,
    };
  }, [indemnity]);

  const columns = [
    {
      key: 'name', header: 'Merchant', fw: 15, sortable: true,
      cell: (r) => (
        <div className="stack stack--xtight">
          <span className="row row--xtight row--nowrap">
            <span className="small strong">{r.name}</span>
            {r.flagship && <Badge tone="primary">Flagship</Badge>}
          </span>
          <TruncatedText value={r.vertical} className="micro subtle" />
        </div>
      ),
    },
    { key: 'mccLabel', header: 'MCC', fw: 10, cell: (r) => <TruncatedText value={`${r.mccCode} · ${r.mccLabel}`} tooltip={r.mccLabel} /> },
    { key: 'status', header: 'Status', align: 'center', fw: 7, sortable: true, cell: (r) => <StatusIcon icon={STATUS_ICON[r.status] ?? 'inbox'} tone={STATUS_TONE[r.status] ?? 'neutral'} label={r.status} /> },
    { key: 'riskTier', header: 'Risk tier', align: 'center', fw: 6, sortable: true, cell: (r) => <StatusIcon icon={RISK_ICON[r.riskTier] ?? 'activity'} tone={RISK_TONE[r.riskTier] ?? 'neutral'} label={`${r.riskTier} risk`} /> },
    { key: 'disputeVolume', header: 'Dispute volume', fw: 7, align: 'right', sortable: true, cell: (r) => <span className="mono small">{formatNumber(r.disputeVolume)}</span> },
    { key: 'chargebackRatio', header: 'Chargeback ratio', fw: 7, align: 'right', sortable: true, cell: (r) => <span className="mono small">{r.disputeVolume ? formatPercent(r.chargebackRatio, 2) : '—'}</span> },
    { key: 'exposure', header: 'Exposure', fw: 8, align: 'right', sortable: true, cell: (r) => <span className="mono small strong">{formatCurrency(r.exposure)}</span> },
    {
      key: 'indemnification',
      header: 'Indemnification',
      fw: 8,
      align: 'right',
      cell: (r) => {
        const entry = indemnity[r.id] ?? settingsFor(r.id);
        return entry.enabled
          ? (
            <span className="stack stack--xtight" style={{ alignItems: 'flex-end' }}>
              <span className="mono small strong">{describe(entry, formatCurrency)}</span>
              <span className="micro subtle">{formatCompactCurrency(annualCharge(r, entry))} / yr</span>
            </span>
          )
          : <span className="micro subtle">Not indemnified</span>;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Portfolio — Merchants"
        description={`Every merchant ${ACQUIRER_NAME} processes for. Indemnification is set per merchant on the record.`}
      />

      <div className="stack">
        <div className="grid grid--5" style={{ gap: 'var(--s-3)' }}>
          <Kpi label="Merchants" value={formatNumber(totals.count)} meta={`${formatNumber(totals.active)} active`} />
          <Kpi label="Portfolio exposure" value={formatCompactCurrency(totals.exposure)} />
          <Kpi label="Flagged for review" value={formatNumber(totals.flagged)} meta="Under review or suspended" />
          <Kpi label="Avg. chargeback ratio" value={formatPercent(totals.avgRatio, 2)} meta="Across processing merchants" />
          <Kpi
            label="Indemnified"
            value={`${formatNumber(totals.indemnified)} of ${formatNumber(totals.count)}`}
            meta={`${formatCompactCurrency(totals.indemnifiedExposure)} exposure we carry`}
          />
        </div>

        <Card bodyClassName="card__body--flush">
          <Toolbar>
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search merchants…" />
            <ExportButtons
              columns={columns}
              rows={sorted}
              name="portfolio-merchants"
              onCopied={(ok) => notify(ok ? 'Copied to clipboard.' : 'Your browser blocked clipboard access.', ok ? 'success' : 'danger')}
            />
          </Toolbar>

          <DataTable
            columns={columns}
            rows={pageRows}
            rowKey={(r) => r.id}
            sort={sort}
            onSort={(key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))}
            onRowClick={(row) => setDetail(row)}
          />

          <Pagination total={sorted.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </Card>
      </div>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name}
        subtitle={detail ? `${detail.vertical} · ${detail.mccCode} — ${detail.mccLabel}` : undefined}
        footer={<Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>}
      >
        {detail && (
          <div className="stack">
            <div className="row row--tight">
              <Badge tone={STATUS_TONE[detail.status] ?? 'neutral'} dot>{detail.status}</Badge>
              <Badge tone={RISK_TONE[detail.riskTier] ?? 'neutral'}>{detail.riskTier} risk</Badge>
              {detail.flagship && <Badge tone="primary">Flagship</Badge>}
            </div>

            <div className="grid grid--2" style={{ gap: 'var(--s-2)' }}>
              <div className="detail-row"><span className="detail-row__k">Onboarded</span><span className="detail-row__v">{detail.onboardedDate ? formatDate(detail.onboardedDate) : 'In progress'}</span></div>
              <div className="detail-row"><span className="detail-row__k">Projected volume</span><span className="detail-row__v mono">{formatCompactCurrency(detail.projectedVolume)} / yr</span></div>
              <div className="detail-row"><span className="detail-row__k">Dispute volume</span><span className="detail-row__v mono">{formatNumber(detail.disputeVolume)}</span></div>
              <div className="detail-row"><span className="detail-row__k">Chargeback ratio</span><span className="detail-row__v mono">{detail.disputeVolume ? formatPercent(detail.chargebackRatio, 2) : '—'}</span></div>
              <div className="detail-row"><span className="detail-row__k">Exposure</span><span className="detail-row__v mono">{formatCurrency(detail.exposure)}</span></div>
              {detail.winRate != null && <div className="detail-row"><span className="detail-row__k">Win rate</span><span className="detail-row__v mono">{formatPercent(detail.winRate, 0)}</span></div>}
            </div>

            <IndemnificationPanel merchant={detail} />

            <div className="row row--tight">
              {detail.status === 'Onboarding' && (
                <Button variant="secondary" icon="upload" onClick={() => { setDetail(null); navigate(`${routes.onboarding}?merchant=${detail.id}`); }}>View onboarding</Button>
              )}
              <Button variant="secondary" icon="searchCheck" onClick={() => { setDetail(null); navigate(`${routes.underwriting}?merchant=${detail.id}`); }}>View underwriting</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default PortfolioMerchants;
