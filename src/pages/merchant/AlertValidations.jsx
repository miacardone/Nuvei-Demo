import { useMemo, useState } from 'react';
import { PageHeader, Card, Toolbar, Badge } from '@/components/ui/Surface';
import { DataTable, ExportButtons } from '@/components/ui/DataTable';
import { SearchBar, SelectField } from '@/components/ui/Form';
import { VALIDATIONS } from '@/data/alerts';
import brand from '@/brand/brand.config';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDateTime } from '@/utils/format';

/**
 * Alert validations.
 *
 * A read-only log of Order Insight-style transaction checks that run
 * before an alert or dispute exists — confirming the transaction data an
 * issuer sees actually matches Nutrameg's own record of it. Nothing here
 * is a decision an agent makes, so there's no action column: it's a
 * reference feed, not a queue.
 */

export function AlertValidations() {
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const filtered = useMemo(() => VALIDATIONS.filter((v) => {
    if (entityFilter && v.entityId !== entityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${v.id} ${v.descriptor} ${v.arn} ${v.mid}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [search, entityFilter]);

  const columns = [
    { key: 'id', header: 'Validation ID', fw: 8, cell: (r) => <span className="mono strong nowrap">{r.id}</span> },
    { key: 'entityLabel', header: 'Entity', fw: 9 },
    { key: 'source', header: 'Source', fw: 7, cell: (r) => <Badge tone="neutral">{r.source}</Badge> },
    { key: 'amount', header: 'Amount', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatCurrency(r.amount, r.currency)}</span> },
    { key: 'panMasked', header: 'Card number', fw: 9, cell: (r) => <span className="mono small">{r.panMasked}</span> },
    { key: 'ccType', header: 'Card type', fw: 6, cell: (r) => <Badge tone={r.ccType === 'Visa' ? 'info' : 'warning'}>{r.ccType}</Badge> },
    { key: 'descriptor', header: 'Descriptor', fw: 10, cell: (r) => <span className="mono small">{r.descriptor}</span> },
    { key: 'mid', header: 'MID', fw: 8, cell: (r) => <span className="mono small">{r.mid}</span> },
    { key: 'validatedAt', header: 'Validated at', fw: 9, cell: (r) => <span className="small">{formatDateTime(r.validatedAt)}</span> },
    { key: 'arn', header: 'ARN', fw: 10, cell: (r) => <span className="mono small">{r.arn}</span> },
    { key: 'outcome', header: 'Outcome', fw: 6, cell: (r) => <Badge tone="success" dot>{r.outcome}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Alert validations" description="Transaction checks run before an alert or dispute exists — a reference feed, not a queue." />

      <Card bodyClassName="card__body--flush">
        <Toolbar>
          <SearchBar value={search} onChange={setSearch} placeholder="Search validation ID, descriptor, ARN, MID…" />
          <SelectField value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} placeholder="All entities" options={brand.entities.map((e) => ({ value: e.id, label: e.label }))} />
          <span className="spacer" />
          <ExportButtons columns={columns} rows={filtered} name="validations" onCopied={(ok) => notify(ok ? 'Copied.' : 'Clipboard blocked.', ok ? 'success' : 'danger')} />
        </Toolbar>
        <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} />
      </Card>
    </>
  );
}

export default AlertValidations;
