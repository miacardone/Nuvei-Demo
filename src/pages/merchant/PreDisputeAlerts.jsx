import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Kpi, Badge, Button, Toolbar, EmptyState, IconButton } from '@/components/ui/Surface';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { SearchInput, SelectField, TextField, ToggleField } from '@/components/ui/Form';
import { Tooltip, TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import {
  ALERT_OUTCOMES, ALERT_SOURCES, ALERT_STATUSES, AUTO_RULES, PRE_DISPUTE_ALERTS, RULE_ACTIONS,
  bySource, getAlertStatus, getOutcome, getSource, preDisputeKpis,
} from '@/data/pre-dispute';
import { sortRows } from '@/utils/sortRows';
import { useToast } from '@/context/ToastContext';
import { useBrand } from '@/brand/BrandProvider';
import { ROUTES } from '@/data/navigation';
import { formatCurrency, formatDate, formatNumber, formatPercent, relativeTime } from '@/utils/format';

/**
 * PRE-DISPUTE ALERTS
 *
 * Chargebacks that never happen. An alert from RDR, Ethoca or Verifi arrives
 * before the chargeback is raised; refund inside the window and there is no
 * dispute to defend, no scheme fee, and nothing counted against the ratio.
 *
 * TWO NUMBERS CARRY THIS SCREEN, and they are deliberately shown together:
 * the deflection rate, and the count of alerts that arrived AFTER the
 * chargeback was already raised. The second is the one nobody volunteers —
 * those alerts were paid for and could not be used, and it is the honest
 * measure of whether a network's coverage is worth its per-alert price.
 */

const TIME_WINDOWS = [
  { value: 'all', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
];

function RulesModal({ open, onClose, rules, onToggle, onAdd }) {
  const brand = useBrand();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [action, setAction] = useState(RULE_ACTIONS[0]);

  const valid = name.trim() && value.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Auto-resolve rules"
      subtitle="Alerts matching a rule are actioned without an analyst touching them."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => { onAdd({ name: name.trim(), value: value.trim(), action }); setName(''); setValue(''); }}
          >
            Add rule
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="small muted">
          Windows run as short as 24 hours and alerts arrive around the clock, so anything that waits
          for an analyst to be awake expires. These are what keep the overnight volume from ageing out.
        </p>

        <div className="stack stack--tight">
          {rules.map((r) => (
            <div key={r.id} className="row row--between row--nowrap packet__evidence">
              <span style={{ minWidth: 0 }}>
                <span className="small strong" style={{ display: 'block' }}>{r.name}</span>
                <span className="nano subtle">{r.criteria} → {r.action}</span>
              </span>
              <span className="row row--xtight row--nowrap" style={{ flex: 'none' }}>
                <Tooltip label={`${formatNumber(r.matched30)} alerts matched in the last 30 days`}>
                  <Badge tone={r.enabled ? 'success' : 'muted'}>{formatNumber(r.matched30)}</Badge>
                </Tooltip>
                <input type="checkbox" className="toggle" checked={r.enabled} onChange={() => onToggle(r.id)} aria-label={`Enable ${r.name}`} />
              </span>
            </div>
          ))}
        </div>

        <div className="divider" />
        <span className="t-section-label">New rule</span>
        <TextField label="Rule name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Overnight low value" />
        <TextField label="Criteria" required value={value} onChange={(e) => setValue(e.target.value)} placeholder={`e.g. Amount under ${brand.currency} 50 · Ethoca`} />
        <SelectField label="Action" value={action} onChange={(e) => setAction(e.target.value)} options={RULE_ACTIONS.map((a) => ({ value: a, label: a }))} />
      </div>
    </Modal>
  );
}

export function PreDisputeAlerts() {
  const brand = useBrand();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [status, setStatus] = useState('all');
  const [window, setWindow] = useState('all');
  const [sort, setSort] = useState({ key: 'alertedAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rules, setRules] = useState(AUTO_RULES);

  const filtered = useMemo(() => {
    const cutoff = window === 'all' ? 0 : Date.now() - Number(window) * 86_400_000;
    const q = search.trim().toLowerCase();
    return PRE_DISPUTE_ALERTS.filter((a) => {
      if (source !== 'all' && a.source !== source) return false;
      if (outcome !== 'all' && a.outcome !== outcome) return false;
      if (status !== 'all' && a.status !== status) return false;
      if (cutoff && new Date(a.alertedAt).getTime() < cutoff) return false;
      if (q && !`${a.id} ${a.orderId} ${a.last4} ${a.caseId ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, source, outcome, status, window]);

  const kpis = useMemo(() => preDisputeKpis(filtered), [filtered]);
  const sources = useMemo(() => bySource(filtered), [filtered]);

  const columns = useMemo(() => [
    {
      key: 'actions', header: 'Actions', fw: 4, width: '56px', pinned: true,
      cell: (row) => (row.caseId
        ? <IconButton icon="wrench" label={`Open case ${row.caseId}`} size={13} onClick={(e) => { e.stopPropagation(); navigate(ROUTES.workCaseDetail(row.caseId)); }} />
        : <Tooltip label="Deflected — there is no case, which is the point"><span className="nano subtle">—</span></Tooltip>),
    },
    { key: 'status', header: 'Status', fw: 6, sortable: true, minWidth: 'calc(6ch + 41px)', cell: (r) => <Badge tone={getAlertStatus(r.status).tone} dot>{getAlertStatus(r.status).label}</Badge> },
    { key: 'id', header: 'Alert ID', fw: 8, sortable: true, cell: (r) => <span className="mono small">{r.id}</span> },
    {
      key: 'source', header: 'Source', fw: 8, sortable: true,
      cell: (r) => <Tooltip label={getSource(r.source).description} wide><span className="small">{r.sourceLabel}</span></Tooltip>,
    },
    { key: 'orderId', header: 'Order', fw: 8, sortable: true, cell: (r) => <span className="mono small">{r.orderId}</span> },
    { key: 'amount', header: 'Amount', fw: 7, align: 'right', sortable: true, minWidth: 'calc(8ch + 20px)', totalCell: (s) => formatCurrency(s), cell: (r) => <span className="mono small">{formatCurrency(r.amount, r.currency)}</span> },
    { key: 'cardBrand', header: 'Scheme', fw: 6, sortable: true, cell: (r) => <span className="small">{r.cardBrand}</span> },
    { key: 'last4', header: 'Card', fw: 5, cell: (r) => <span className="mono small">•••• {r.last4}</span> },
    {
      key: 'outcome', header: 'Outcome', fw: 9, sortable: true, minWidth: 'calc(15ch + 27px)',
      cell: (r) => (r.outcome
        ? <Tooltip label={getOutcome(r.outcome).description} wide><Badge tone={getOutcome(r.outcome).tone}>{getOutcome(r.outcome).label}</Badge></Tooltip>
        : <span className="nano subtle">Awaiting action</span>),
    },
    {
      key: 'expiresAt', header: 'Window', fw: 7, sortable: true,
      cell: (r) => (r.autoResolved
        ? <Tooltip label="RDR resolves to your standing rule the moment it arrives — there is no window to miss."><span className="nano subtle">Automatic</span></Tooltip>
        : r.status === 'open'
          ? <span className={`due due--${r.hoursLeft < 6 ? 'critical' : r.hoursLeft < 24 ? 'soon' : 'ok'}`}>{r.hoursLeft}h left</span>
          : <span className="micro subtle">{relativeTime(r.expiresAt)}</span>),
    },
    { key: 'alertDate', header: 'Alerted', fw: 7, sortable: true, cell: (r) => <span className="micro">{formatDate(r.alertDate)}</span> },
    { key: 'resolvedBy', header: 'Resolved by', fw: 10, sortable: true, cell: (r) => <TruncatedText value={r.resolvedBy} className="micro mono" /> },
  ], [navigate]);

  const sorted = useMemo(() => sortRows(filtered, sort, columns), [filtered, sort, columns]);
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const reset = () => { setSearch(''); setSource('all'); setOutcome('all'); setStatus('all'); setWindow('all'); setPage(1); };

  return (
    <div className="stack">
      <div className="grid grid--4">
        <Card bodyClassName="card__body--tight">
          <Kpi
            label="Deflection rate"
            value={formatPercent(kpis.deflectionRate, 1)}
            meta={`${formatNumber(kpis.deflected)} of ${formatNumber(kpis.total)} stopped a ${brand.terms.chargeback}`}
          />
        </Card>
        <Card bodyClassName="card__body--tight">
          <Kpi label="Refunded" value={formatCurrency(kpis.refundValue)} meta={`${formatNumber(kpis.autoResolved)} resolved by rule, no analyst`} />
        </Card>
        <Card bodyClassName="card__body--tight">
          <Kpi label="Open now" value={formatNumber(kpis.open)} meta={`${formatNumber(kpis.expired)} expired unactioned`} />
        </Card>
        <Card bodyClassName="card__body--tight">
          <Kpi
            label="Arrived too late"
            value={formatNumber(kpis.tooLate)}
            meta={`${formatCurrency(kpis.tooLateValue)} — paid for, already a ${brand.terms.chargeback}`}
          />
        </Card>
      </div>

      <Card
        title="By network"
        action={<Button variant="secondary" size="sm" icon="cog" onClick={() => setRulesOpen(true)}>Auto-resolve rules</Button>}
      >
        <div className="rule-grid">
          {sources.map((s) => (
            <div key={s.id}>
              <div className="row row--between row--nowrap">
                <Tooltip label={s.description} wide>
                  <span className="small strong">{s.label}</span>
                </Tooltip>
                <span className="mono small">{formatPercent(s.rate, 0)}</span>
              </div>
              <div className="meter" style={{ marginTop: 4 }}>
                <div className="meter__fill" style={{ width: `${s.rate}%` }} />
              </div>
              <div className="row row--between" style={{ marginTop: 3 }}>
                <span className="nano subtle">{s.network} · {formatNumber(s.count)} alerts</span>
                <span className="nano subtle">{formatCurrency(s.value)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card bodyClassName="card__body--flush">
        <Toolbar>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Alert ID, order, card…" />
          <div className="row row--tight">
            <SelectField value={window} onChange={(e) => { setWindow(e.target.value); setPage(1); }} options={TIME_WINDOWS} />
            <SelectField value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} options={[{ value: 'all', label: 'All sources' }, ...ALERT_SOURCES.map((s) => ({ value: s.id, label: s.label }))]} />
            <SelectField value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }} options={[{ value: 'all', label: 'All outcomes' }, ...ALERT_OUTCOMES.map((o) => ({ value: o.id, label: o.label }))]} />
            <SelectField value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: 'all', label: 'All statuses' }, ...ALERT_STATUSES.map((s) => ({ value: s.id, label: s.label }))]} />
            {(search || source !== 'all' || outcome !== 'all' || status !== 'all' || window !== 'all') && (
              <Button variant="ghost" size="sm" icon="close" onClick={reset}>Clear</Button>
            )}
          </div>
        </Toolbar>

        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(r) => r.id}
          density="fit"
          sort={sort}
          onSort={(key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}
          totals={{ keys: ['amount'], rows: sorted, label: `Total · ${formatNumber(sorted.length)} alert${sorted.length === 1 ? '' : 's'}` }}
          empty={<EmptyState icon="bell" title="No alerts match" hint="Widen the filters to see more." />}
        />

        <Pagination total={sorted.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </Card>

      <RulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        rules={rules}
        onToggle={(id) => setRules((p) => p.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))}
        onAdd={(draft) => {
          setRules((p) => [...p, { id: `par-${p.length + 1}`, name: draft.name, criteria: draft.value, action: draft.action, enabled: true, matched30: 0 }]);
          notify(`Rule “${draft.name}” is live — matching alerts are actioned automatically.`, 'success');
        }}
      />
    </div>
  );
}

export default PreDisputeAlerts;
