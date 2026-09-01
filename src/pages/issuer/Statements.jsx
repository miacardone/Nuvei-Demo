import { useMemo, useState } from 'react';
import { PageHeader, Card, Badge, Kpi } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { SelectField } from '@/components/ui/Form';
import { TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { CARDHOLDERS, casesForCardholder } from '@/data/cardholders';
import { authorizationsFor } from '@/data/authorizations';
import { getStatus } from '@/domain/statuses';
import { formatCompactCurrency, formatCurrency, formatDate, formatDateTime, formatNumber } from '@/utils/format';

/**
 * Statements — one cardholder's monthly activity, built by merging their
 * normal authorization history (data/authorizations.js) with any disputed
 * line item pulled straight from the shared `CASES` book, clearly flagged
 * within the same list rather than shown as a separate table.
 */

const STATEMENT_WINDOW_DAYS = 30;
const DAY = 86_400_000;

const STATUS_TONE = { Active: 'success', 'Under review': 'warning', Blocked: 'danger' };

function buildStatementLines(cardholder) {
  const now = Date.now();
  const windowStart = now - STATEMENT_WINDOW_DAYS * DAY;

  const authLines = authorizationsFor(cardholder.id).map((a) => ({
    key: a.id,
    date: a.date,
    description: a.merchant,
    amount: a.amount,
    currency: a.currency,
    kind: a.result === 'Approved' ? 'posted' : 'declined',
    resultLabel: a.result,
  }));

  const disputeLines = casesForCardholder(cardholder.name).map((c) => ({
    key: c.id,
    date: c.transDate,
    description: `${c.entityLabel} — disputed (${c.reasonLabel})`,
    amount: c.disputeAmount,
    currency: c.currency,
    kind: 'disputed',
    resultLabel: getStatus(c.status).label,
    caseId: c.id,
  }));

  return [...authLines, ...disputeLines]
    .filter((line) => new Date(line.date).getTime() >= windowStart)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function Statements() {
  const sortedCardholders = useMemo(() => [...CARDHOLDERS].sort((a, b) => a.name.localeCompare(b.name)), []);

  // Default to a cardholder whose dispute actually falls inside the
  // statement window, so the "disputed" flag has something to show on
  // first load instead of an empty state.
  const defaultId = useMemo(() => {
    const now = Date.now();
    const windowMs = STATEMENT_WINDOW_DAYS * DAY;
    const withRecentDispute = CARDHOLDERS.find((c) =>
      casesForCardholder(c.name).some((cs) => now - new Date(cs.transDate).getTime() <= windowMs));
    return (withRecentDispute ?? CARDHOLDERS.find((c) => c.disputeCount > 0) ?? CARDHOLDERS[0])?.id ?? '';
  }, []);
  const [cardholderId, setCardholderId] = useState(defaultId);

  const cardholder = CARDHOLDERS.find((c) => c.id === cardholderId) ?? null;
  const lines = useMemo(() => (cardholder ? buildStatementLines(cardholder) : []), [cardholder]);

  const totals = useMemo(() => {
    const posted = lines.filter((l) => l.kind !== 'declined');
    return {
      charges: posted.reduce((s, l) => s + l.amount, 0),
      disputed: lines.filter((l) => l.kind === 'disputed').reduce((s, l) => s + l.amount, 0),
      disputedCount: lines.filter((l) => l.kind === 'disputed').length,
      count: posted.length,
    };
  }, [lines]);

  const columns = [
    { key: 'date', header: 'Date', fw: 8, cell: (r) => <span className="micro subtle nowrap">{formatDateTime(r.date)}</span> },
    {
      key: 'description', header: 'Description', fw: 14,
      cell: (r) => (
        <span className="row row--xtight row--nowrap">
          <TruncatedText value={r.description} className="small" />
          {r.kind === 'disputed' && <Icon name="alert" size={11} style={{ color: 'var(--c-danger)' }} title="Disputed transaction" />}
        </span>
      ),
    },
    { key: 'amount', header: 'Amount', fw: 7, align: 'right', cell: (r) => <span className="mono small strong">{formatCurrency(r.amount, r.currency)}</span> },
    {
      key: 'status', header: 'Status', fw: 7,
      cell: (r) => {
        if (r.kind === 'disputed') return <Badge tone="danger">Disputed · {r.resultLabel}</Badge>;
        if (r.kind === 'declined') return <Badge tone="muted">Declined</Badge>;
        return <Badge tone="success">Posted</Badge>;
      },
    },
  ];

  return (
    <>
      <PageHeader title="Statements" description="One cardholder's monthly activity — authorizations and any disputed line items, in one feed." />

      <div className="stack">
        <Card bodyClassName="card__body--tight">
          <SelectField
            label="Cardholder"
            value={cardholderId}
            onChange={(e) => setCardholderId(e.target.value)}
            options={sortedCardholders.map((c) => ({ value: c.id, label: `${c.name} — •••• ${c.cardLast4}` }))}
          />
        </Card>

        {cardholder && (
          <>
            <div className="grid grid--4" style={{ gap: 'var(--s-3)' }}>
              <Kpi label="Statement period" value={`${STATEMENT_WINDOW_DAYS} days`} meta={`Through ${formatDate(new Date())}`} />
              <Kpi label="Charges this period" value={formatCompactCurrency(totals.charges)} meta={`${formatNumber(totals.count)} line items`} />
              <Kpi label="Disputed this period" value={formatCompactCurrency(totals.disputed)} meta={`${formatNumber(totals.disputedCount)} items flagged`} />
              <Kpi label="Card status" value={cardholder.status} meta={`${cardholder.schemeLabel} · ${cardholder.cardType}`} />
            </div>

            <Card
              title={`${cardholder.name} — •••• ${cardholder.cardLast4}`}
              action={<Badge tone={STATUS_TONE[cardholder.status] ?? 'neutral'} dot>{cardholder.status}</Badge>}
              bodyClassName="card__body--flush"
            >
              <div style={{ padding: 'var(--s-4)', paddingBottom: 0 }}>
                <div className="grid grid--3" style={{ gap: 'var(--s-2)' }}>
                  <div className="detail-row"><span className="detail-row__k">Card</span><span className="detail-row__v mono">{cardholder.pan}</span></div>
                  <div className="detail-row"><span className="detail-row__k">Member since</span><span className="detail-row__v">{formatDate(cardholder.memberSince)}</span></div>
                  <div className="detail-row"><span className="detail-row__k">Market</span><span className="detail-row__v">{cardholder.market}</span></div>
                </div>
              </div>

              <DataTable
                columns={columns}
                rows={lines}
                rowKey={(r) => r.key}
                empty={<div className="empty"><p className="empty__title">No activity in this period</p></div>}
              />
            </Card>
          </>
        )}
      </div>
    </>
  );
}

export default Statements;
