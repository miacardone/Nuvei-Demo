import { useMemo, useState } from 'react';
import useMerchantScope from '@/hooks/useMerchantScope';
import { anyWithinScope } from '@/data/merchant-scope';
import useTableSort from '@/hooks/useTableSort';
import { PageHeader, Card, Badge, Kpi } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { TextField } from '@/components/ui/Form';
import { TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { CARDHOLDERS, casesForCardholder } from '@/data/cardholders';
import { authorizationsFor } from '@/data/authorizations';
import { getStatus } from '@/domain/statuses';
import { weeklySeries } from '@/domain/metrics';
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
  // A cardholder can dispute against several merchants, so they stay in
  // view when ANY of those merchants is in scope.
  const scope = useMerchantScope();
  const BOOK = CARDHOLDERS.filter((c) => anyWithinScope(c.merchantIds, scope));

  const sortedCardholders = useMemo(() => [...BOOK].sort((a, b) => a.name.localeCompare(b.name)), [BOOK]);

  // Default to a cardholder whose dispute actually falls inside the
  // statement window, so the "disputed" flag has something to show on
  // first load instead of an empty state.
  const defaultId = useMemo(() => {
    const now = Date.now();
    const windowMs = STATEMENT_WINDOW_DAYS * DAY;
    const withRecentDispute = BOOK.find((c) =>
      casesForCardholder(c.name).some((cs) => now - new Date(cs.transDate).getTime() <= windowMs));
    return (withRecentDispute ?? BOOK.find((c) => c.disputeCount > 0) ?? BOOK[0])?.id ?? '';
  }, [BOOK]);
  const [cardholderId, setCardholderId] = useState(defaultId);
  const [query, setQuery] = useState('');

  /* Digits-only comparison, so "4458 8331" and "445883••••3257" both find the
     same card — people read the number off the card with its spacing. */
  const digits = (v) => String(v ?? '').replace(/\D/g, '');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const qDigits = digits(q);
    return sortedCardholders.filter((c) => {
      const byName = c.name.toLowerCase().includes(q);
      const card = digits(c.cardMasked ?? '') + digits(c.cardLast4 ?? '');
      return byName || (qDigits.length >= 2 && card.includes(qDigits));
    });
  }, [query, sortedCardholders]);

  const cardholder = BOOK.find((c) => c.id === cardholderId) ?? null;
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

  /* Every card in the strip carries a trend line, drawn from the statement
     lines themselves. The period and card-status cards used to carry a figure
     that never moves, which is why they sat oddly next to the two that do —
     they now report the activity behind them instead. */
  const sparks = useMemo(() => {
    const at = (l) => l.date;
    return {
      lines: weeklySeries(lines, 12, () => 1, (l) => l.kind !== 'declined', at),
      charges: weeklySeries(lines, 12, (l) => l.amount, (l) => l.kind !== 'declined', at),
      disputed: weeklySeries(lines, 12, (l) => l.amount, (l) => l.kind === 'disputed', at),
      declined: weeklySeries(lines, 12, () => 1, (l) => l.kind === 'declined', at),
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


  // Every column sorts, using the shared comparator.

  const { sort, onSort, sorted: sortedRows } = useTableSort(lines);


  return (
    <>
      <PageHeader title="Statements" description="One cardholder's monthly activity — authorizations and any disputed line items, in one feed." />

      <div className="stack">
        <Card bodyClassName="card__body--tight">
          {/* Free text, not a dropdown: a book of several hundred cardholders is
              not something anyone scrolls, and the number on the card in front
              of you is what you actually have to search by. Name still matches,
              because sometimes the card is not in front of you. */}
          <TextField
            label="Find a cardholder"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Card number, last 4, or name"
            hint={
              query.trim()
                ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`
                : `${sortedCardholders.length} cardholders in scope`
            }
          />

          {query.trim() !== '' && (
            <ul className="hairlines" style={{ marginTop: 'var(--s-2)' }}>
              {matches.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`row row--between statement-hit ${c.id === cardholderId ? 'is-active' : ''}`.trim()}
                    onClick={() => { setCardholderId(c.id); setQuery(''); }}
                  >
                    <span className="small strong">{c.name}</span>
                    <span className="mono micro subtle">{c.cardMasked ?? `•••• ${c.cardLast4}`}</span>
                  </button>
                </li>
              ))}
              {!matches.length && <li className="small subtle" style={{ padding: 'var(--s-2) 0' }}>No cardholder matches that number.</li>}
            </ul>
          )}
        </Card>

        {cardholder && (
          <>
            <div className="kpi-row" style={{ gap: 'var(--s-3)' }}>
              <Kpi label="Posted line items" value={formatNumber(totals.count)} meta={`Last ${STATEMENT_WINDOW_DAYS} days, through ${formatDate(new Date())}`} spark={sparks.lines} />
              <Kpi label="Charges this period" value={formatCompactCurrency(totals.charges)} meta={`${formatNumber(totals.count)} line items`} spark={sparks.charges} />
              <Kpi label="Disputed this period" value={formatCompactCurrency(totals.disputed)} meta={`${formatNumber(totals.disputedCount)} items flagged`} invert spark={sparks.disputed} />
              <Kpi label="Declined attempts" value={formatNumber(lines.filter((l) => l.kind === 'declined').length)} meta={`${cardholder.status} · ${cardholder.schemeLabel} ${cardholder.cardType}`} invert spark={sparks.declined} />
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
                rows={sortedRows} sort={sort} onSort={onSort}
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
