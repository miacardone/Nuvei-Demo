import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Badge, Button, Kpi, StatusIcon } from '@/components/ui/Surface';
import { DataTable, Pagination, TableToolbar } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { TruncatedText } from '@/components/ui/Overlay';
import { ISSUING_BANK, CARDHOLDERS, casesForCardholder } from '@/data/cardholders';
import { authorizationsFor } from '@/data/authorizations';
import { getStatus } from '@/domain/statuses';
import { STATUS_ICON } from '@/components/cases/caseColumns';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatCompactCurrency, formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent } from '@/utils/format';

/**
 * Cardholders — the issuer's book of record. Every row is deduped straight off
 * the shared case book (see data/cardholders.js), so the dispute count and
 * value here never disagree with Disputes > Cases or Chargebacks.
 */

const STATUS_TONE = { Active: 'success', 'Under review': 'warning', Blocked: 'danger' };
const CH_STATUS_ICON = { Active: 'check', 'Under review': 'searchCheck', Blocked: 'close' };

export function Cardholders() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { routes } = usePerspective();

  const [search, setSearch] = useState('');

  // Table chrome. Same controls in the same order as every other table.
  const [density, setDensity] = useState('comfortable');
  const [hidden, setHidden] = useState([]);
  const [sort, setSort] = useState({ key: 'lifetimeSpend', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detail, setDetail] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CARDHOLDERS;
    return CARDHOLDERS.filter((c) => `${c.name} ${c.cardLast4} ${c.schemeLabel} ${c.market}`.toLowerCase().includes(q));
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

  const totals = useMemo(() => ({
    count: CARDHOLDERS.length,
    active: CARDHOLDERS.filter((c) => c.status === 'Active').length,
    repeatFilers: CARDHOLDERS.filter((c) => c.disputeCount > 1).length,
    lifetimeSpend: CARDHOLDERS.reduce((s, c) => s + c.lifetimeSpend, 0),
  }), []);

  const columns = [
    {
      key: 'name', header: 'Cardholder', fw: 12, sortable: true,
      cell: (r) => (
        <div className="stack stack--xtight">
          <TruncatedText value={r.name} className="small strong" />
          <span className="micro subtle">Member since {formatDate(r.memberSince)}</span>
        </div>
      ),
    },
    {
      key: 'cardLast4', header: 'Card', fw: 9,
      cell: (r) => (
        <div className="stack stack--xtight">
          <span className="mono small">•••• {r.cardLast4}</span>
          <span className="micro subtle">{r.schemeLabel} · {r.cardType}</span>
        </div>
      ),
    },
    { key: 'market', header: 'Market', fw: 5, sortable: true, cell: (r) => <span className="small">{r.market}</span> },
    { key: 'status', header: 'Status', fw: 7, sortable: true, align: 'center', cell: (r) => <StatusIcon icon={CH_STATUS_ICON[r.status] ?? 'inbox'} tone={STATUS_TONE[r.status] ?? 'neutral'} label={r.status} /> },
    { key: 'disputeCount', header: 'Disputes', fw: 6, align: 'right', sortable: true, cell: (r) => <span className="mono small strong">{formatNumber(r.disputeCount)}</span> },
    { key: 'lifetimeSpend', header: 'Lifetime spend', fw: 8, align: 'right', sortable: true, cell: (r) => <span className="mono small">{formatCurrency(r.lifetimeSpend)}</span> },
  ];

  const visibleColumns = columns.filter((c) => !hidden.includes(c.key));

  const detailCases = detail ? casesForCardholder(detail.name) : [];
  const detailAuths = detail ? authorizationsFor(detail.id).slice(0, 8) : [];

  return (
    <>
      <PageHeader
        title="Cardholders"
        description={`Every cardholder behind a dispute in ${ISSUING_BANK.shortName}'s book — ${formatNumber(ISSUING_BANK.cardsInForce)} cards in force, headquartered in ${ISSUING_BANK.headquarters}.`}
      />

      <div className="stack">
        <div className="grid grid--4" style={{ gap: 'var(--s-3)' }}>
          <Kpi label="Cardholders" value={formatNumber(totals.count)} meta={`${formatNumber(totals.active)} active`} />
          <Kpi label="Repeat filers" value={formatNumber(totals.repeatFilers)} meta={`${formatPercent((totals.repeatFilers / totals.count) * 100, 0)} of the book`} />
          <Kpi label="Lifetime spend" value={formatCompactCurrency(totals.lifetimeSpend)} meta="Across this book" />
          <Kpi label="Issuing bank" value={ISSUING_BANK.shortName} meta={`Founded ${ISSUING_BANK.founded} · ${ISSUING_BANK.headquarters}`} />
        </div>

        <Card bodyClassName="card__body--flush">
          <TableToolbar
            search={search}
            onSearch={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search cardholders, card, market…"
            density={density}
            onDensityChange={setDensity}
            columns={columns}
            hidden={hidden}
            onHiddenChange={setHidden}
            exportColumns={visibleColumns}
            exportRows={sorted}
            exportName="cardholders"
            onCopied={(ok) => notify(ok ? 'Copied to clipboard.' : 'Your browser blocked clipboard access.', ok ? 'success' : 'danger')}
          />

          <DataTable
            columns={visibleColumns}
            density={density}
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
        subtitle={detail ? `${detail.schemeLabel} •••• ${detail.cardLast4} · ${detail.market} · Member since ${formatDate(detail.memberSince)}` : undefined}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>}
      >
        {detail && (
          <div className="stack">
            <div className="row row--tight">
              <Badge tone={STATUS_TONE[detail.status] ?? 'neutral'} dot>{detail.status}</Badge>
              <Badge tone="neutral">{detail.cardType}</Badge>
              {detail.disputeCount > 0 && <Badge tone="warning">{formatNumber(detail.disputeCount)} disputes on file</Badge>}
            </div>

            <div className="grid grid--2" style={{ gap: 'var(--s-2)' }}>
              <div className="detail-row"><span className="detail-row__k">Card</span><span className="detail-row__v mono">{detail.pan}</span></div>
              <div className="detail-row"><span className="detail-row__k">Lifetime spend</span><span className="detail-row__v mono">{formatCurrency(detail.lifetimeSpend)}</span></div>
              <div className="detail-row"><span className="detail-row__k">Dispute value</span><span className="detail-row__v mono">{formatCurrency(detail.disputeValue)}</span></div>
              <div className="detail-row"><span className="detail-row__k">Cardholder ID</span><span className="detail-row__v mono">{detail.id}</span></div>
            </div>

            <div>
              <p className="t-section-label" style={{ marginBottom: 'var(--s-2)' }}>Recent authorizations</p>
              <DataTable
                columns={[
                  { key: 'date', header: 'Date', fw: 8, cell: (r) => <span className="micro subtle nowrap">{formatDateTime(r.date)}</span> },
                  { key: 'merchant', header: 'Merchant', fw: 10, cell: (r) => <TruncatedText value={r.merchant} className="small" /> },
                  { key: 'amount', header: 'Amount', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatCurrency(r.amount, r.currency)}</span> },
                  { key: 'result', header: 'Result', fw: 6, align: 'center', cell: (r) => <StatusIcon icon={r.result === 'Approved' ? 'check' : 'close'} tone={r.result === 'Approved' ? 'success' : 'danger'} label={r.result} /> },
                ]}
                rows={detailAuths}
                rowKey={(r) => r.id}
                density="comfortable"
                empty={<div className="empty"><p className="empty__title">No authorization history</p></div>}
              />
            </div>

            {detailCases.length > 0 && (
              <div>
                <p className="t-section-label" style={{ marginBottom: 'var(--s-2)' }}>Linked disputes</p>
                <DataTable
                  columns={[
                    { key: 'id', header: 'Case #', fw: 6, cell: (r) => <span className="mono small strong">{r.id}</span> },
                    { key: 'reasonLabel', header: 'Reason', fw: 10, cell: (r) => <TruncatedText value={r.reasonLabel} className="small" /> },
                    { key: 'disputeAmount', header: 'Amount', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatCurrency(r.disputeAmount, r.currency)}</span> },
                    { key: 'status', header: 'Status', fw: 6, align: 'center', cell: (r) => <StatusIcon icon={STATUS_ICON[r.status] ?? 'inbox'} tone={getStatus(r.status).tone} label={getStatus(r.status).label} /> },
                    {
                      key: 'actions', header: '', pinned: true, fw: 4, width: '48px', align: 'center',
                      cell: (r) => (
                        <Button variant="ghost" size="sm" icon="wrench" onClick={() => navigate(routes.workCaseDetail(r.id))}>Work</Button>
                      ),
                    },
                  ]}
                  rows={detailCases}
                  rowKey={(r) => r.id}
                  density="comfortable"
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

export default Cardholders;
