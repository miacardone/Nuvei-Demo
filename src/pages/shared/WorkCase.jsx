import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Card, Tabs, Button, IconButton, Badge, EmptyState } from '@/components/ui/Surface';
import { DataTable, Pagination, TableToolbar } from '@/components/ui/DataTable';
import { Tooltip, TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { buildCaseColumns, DueCell } from '@/components/cases/caseColumns';
import { AdvancedFiltersModal, EMPTY_FILTERS, applyFilters, countActive } from '@/components/cases/CaseFilters';
import DocViewer from '@/components/workcase/DocViewer';
import ActionsCard from '@/components/workcase/ActionsCard';
import { NotesModal, PendModal, ReferralModal, ResubmitModal, RouteModal, UploadModal } from '@/components/workcase/CaseModals';
import { CASES, getCase, getWorkableCases } from '@/data/cases';
import { getCaseDocs, getCaseFlags, getCaseHistory, getCaseNotes, getCardTransactions, getSpecialInstructions } from '@/data/work-case';
import { buildConsolidationGroups, explainGroup, indexGroupsByCase } from '@/domain/consolidation';
import { caseSectionFields, entitySectionFields, marketplaceSectionFields, transactionSectionFields } from '@/domain/caseTypes';
import { STATUSES, getStatus } from '@/domain/statuses';
import { useBrand } from '@/brand/BrandProvider';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { readPref, writePref } from '@/utils/storage';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/utils/format';

const DENSITY_KEY = 'edc.workcase.density';

const TONE_LEGEND = [
  { tone: 'danger', label: 'Blocks or needs urgent attention' },
  { tone: 'warning', label: 'Review recommended' },
  { tone: 'info', label: 'For awareness' },
  { tone: 'success', label: 'Resolved favorably' },
  { tone: 'muted', label: 'No action needed' },
];

function ColorLegend() {
  return (
    <Tooltip
      wide
      label={
        <span className="stack stack--xtight" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="micro strong" style={{ marginBottom: 2 }}>What the colors mean</span>
          {TONE_LEGEND.map((t) => (
            <span key={t.tone} className="row row--xtight" style={{ gap: 6 }}>
              <span className={`dot dot--${t.tone}`} />
              <span className="micro">{t.label}</span>
            </span>
          ))}
        </span>
      }
    >
      <IconButton icon="help" label="What the colors mean" size={13} />
    </Tooltip>
  );
}

/* ================================================================== *
 * Records view — the workable list
 * ================================================================== */

function RecordsView() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { routes } = usePerspective();

  const rows = useMemo(() => getWorkableCases(), []);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [advanced, setAdvanced] = useState(false);
  const [density, setDensity] = useState(() => readPref(DENSITY_KEY, 'fit'));
  const [hidden, setHidden] = useState(new Set());
  const [sort, setSort] = useState({ key: 'dueDate', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => applyFilters(rows, filters, search), [rows, filters, search]);
  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      const av = a[sort.key]; const bv = b[sort.key];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [filtered, sort]);

  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const allColumns = useMemo(() => buildCaseColumns(filters.caseType), [filters.caseType]);
  const columns = useMemo(() => [
    ...allColumns.filter((c) => !hidden.has(c.key)),
    {
      key: 'actions', header: 'Actions', pinned: true, fw: 5, width: '68px', align: 'center',
      cell: (row) => (
        <IconButton icon="wrench" label="Work this case" size={13} onClick={(e) => { e.stopPropagation(); navigate(routes.workCaseDetail(row.id)); }} />
      ),
    },
  ], [allColumns, hidden, navigate]);

  const setDensityPref = (d) => {
    setDensity(d);
    writePref(DENSITY_KEY, d);
  };

  return (
    <>
      <PageHeader
        title="Work case"
        description="Cases available to work. Open one to work its documents and notes."
        meta={<p className="page-head__desc"><strong className="mono">{formatNumber(filtered.length)}</strong> workable case(s) · open one to work its documents and notes</p>}
      />

      <Card bodyClassName="card__body--flush">
        <TableToolbar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Case #, ARN, order, item…"
          density={density}
          onDensityChange={setDensityPref}
          columns={allColumns}
          hidden={hidden}
          onHiddenChange={setHidden}
          exportColumns={columns.filter((c) => c.key !== 'actions')}
          exportRows={sorted}
          exportName="workable-cases"
          onCopied={(ok) => notify(ok ? 'Copied.' : 'Clipboard blocked.', ok ? 'success' : 'danger')}
        />

        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(r) => r.id}
          density={density}
          sort={sort}
          onSort={(key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}
          onRowClick={(row) => navigate(routes.workCaseDetail(row.id))}
          empty={<EmptyState icon="briefcase" title="Nothing to work" hint="No cases match this view." />}
        />

        <Pagination total={sorted.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </Card>

      <AdvancedFiltersModal open={advanced} onClose={() => setAdvanced(false)} filters={filters} onApply={(f) => { setFilters(f); setPage(1); }} />
    </>
  );
}

/* ================================================================== *
 * Left column
 * ================================================================== */

function DetailRows({ fields }) {
  return (
    <div>
      {fields.filter((f) => f.v != null && f.v !== '').map((f) => (
        <div key={f.k} className={`detail-row ${f.wide ? 'detail-row--wide' : ''}`.trim()}>
          <span className="detail-row__k">{f.k}</span>
          <span className={`detail-row__v ${f.mono ? 'mono' : ''}`.trim()}>
            {f.format === 'money' ? formatCurrency(f.v)
              : f.format === 'date' ? formatDate(f.v)
                : f.format === 'rating' ? `${f.v} / 5.0`
                  : f.v}
          </span>
        </div>
      ))}
    </div>
  );
}

function Accordion({ title, open, onToggle, children }) {
  return (
    <>
      <button type="button" className="accordion__head" onClick={onToggle} aria-expanded={open}>
        {title}
        <Icon name="chevron" size={12} className={`accordion__chevron ${open ? 'is-open' : ''}`.trim()} />
      </button>
      {open && <div className="accordion__panel">{children}</div>}
    </>
  );
}

function LeftColumn({ c }) {
  const brand = useBrand();
  const [open, setOpen] = useState({ case: true, transaction: false, history: false, entity: false, marketplace: false });
  const toggle = (k) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  const instructions = useMemo(() => getSpecialInstructions(c.id), [c.id]);
  const events = useMemo(() => getCaseHistory(c.id), [c.id]);
  const txns = useMemo(() => getCardTransactions(c.id), [c.id]);
  const [ruleHistory, setRuleHistory] = useState(true);

  const shown = ruleHistory ? events : events.filter((e) => e.kind !== 'rule');

  return (
    <div className="stack stack--tight">
      <Card title="Case details" bodyClassName="card__body--flush">
        <div className="accordion__panel" style={{ paddingTop: 'var(--s-2)' }}>
          <DetailRows fields={caseSectionFields(c)} />
        </div>
        <Accordion title="TRANSACTION" open={open.transaction} onToggle={() => toggle('transaction')}>
          <DetailRows fields={transactionSectionFields(c)} />
        </Accordion>
        <Accordion title="TRANSACTION HISTORY" open={open.history} onToggle={() => toggle('history')}>
          {txns.length ? (
            <div className="hairlines">
              {txns.map((t) => (
                <div key={t.id} className="row row--between" style={{ padding: '5px 0' }}>
                  <span className="micro truncate">{formatDate(t.date)} · {t.description}</span>
                  <span className="micro mono nowrap">{formatCurrency(t.amount, t.currency)}</span>
                </div>
              ))}
            </div>
          ) : <p className="micro subtle">No card transaction history on this case.</p>}
        </Accordion>
        <Accordion title={`${brand.terms.marketplace.toUpperCase()} CONTEXT`} open={open.marketplace} onToggle={() => toggle('marketplace')}>
          <DetailRows fields={marketplaceSectionFields(c)} />
        </Accordion>
        <Accordion title="ENTITY" open={open.entity} onToggle={() => toggle('entity')}>
          <DetailRows fields={entitySectionFields(c)} />
        </Accordion>
      </Card>

      <Card
        title="Special instructions"
        action={
          <span className="row row--xtight" style={{ gap: 6 }}>
            {instructions.length > 0 && <Badge tone="neutral">{instructions.length}</Badge>}
            <ColorLegend />
          </span>
        }
        bodyClassName="card__body--tight"
      >
        {instructions.length ? (
          <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {instructions.map((si) => (
              <li key={si.id} className={`instruction instruction--${si.tone}`}>
                <Tooltip label={TONE_LEGEND.find((t) => t.tone === si.tone)?.label ?? si.tone}>
                  <span className={`dot dot--${si.tone}`} style={{ marginTop: 5 }} />
                </Tooltip>
                <span>
                  <span className="instruction__title">{si.title}.</span>{' '}
                  <span className="muted">{si.text}</span>
                  {si.blocks?.length > 0 && (
                    <Badge tone="danger" className="nano" >Blocks {si.blocks.length === 1 ? 'an action' : `${si.blocks.length} actions`}</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="micro subtle center">No special instructions</p>
        )}
      </Card>

      <Card
        title="History"
        action={
          <label className="row row--xtight micro" style={{ cursor: 'pointer' }}>
            <input type="checkbox" className="toggle" checked={ruleHistory} onChange={(e) => setRuleHistory(e.target.checked)} />
            Rule history
          </label>
        }
        bodyClassName="card__body--tight"
      >
        <div className="hairlines" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {shown.map((e) => (
            <div key={e.id} style={{ padding: '5px 0' }}>
              <div className="micro subtle">{formatDateTime(e.at)}</div>
              <div className="micro">{e.action}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ================================================================== *
 * Related cases (consolidation)
 * ================================================================== */

function RelatedCases({ c, groups }) {
  const brand = useBrand();
  const { routes } = usePerspective();

  if (!groups.length) {
    return (
      <div className="empty" style={{ padding: 'var(--s-8)' }}>
        <span className="empty__glyph"><Icon name="check" size={18} /></span>
        <p className="empty__title">No linked cases</p>
        <p className="empty__hint">This case stands alone — no shared card, order or {brand.terms.seller}.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      {groups.map((g) => (
        <div
          key={g.id}
          style={{
            border: `1px solid ${g.duplicateRefundRisk ? 'var(--c-danger)' : 'var(--c-primary)'}`,
            background: g.duplicateRefundRisk ? 'var(--c-danger-tint)' : 'var(--c-primary-wash)',
            borderRadius: 'var(--r-md)',
            padding: 'var(--s-3)',
          }}
          className="stack stack--tight"
        >
          <div className="row row--between">
            <span className="row row--xtight">
              <Icon name={g.duplicateRefundRisk ? 'alert' : 'link'} size={15} style={{ color: g.duplicateRefundRisk ? 'var(--c-danger)' : 'var(--c-primary)' }} />
              <span className="small strong">{g.duplicateRefundRisk ? 'Disputed through two channels' : g.ruleLabel}</span>
            </span>
            {g.duplicateRefundRisk && <Badge tone="danger">Double refund risk</Badge>}
          </div>

          <p className="small muted">{explainGroup(g)}</p>

          <div className="grid grid--2" style={{ gap: 'var(--s-2)' }}>
            <div><div className="nano subtle">LINKED BY</div><div className="small strong">{g.label}</div></div>
            <div><div className="nano subtle">GROUP SIZE</div><div className="small strong mono">{g.size}</div></div>
            <div><div className="nano subtle">TOTAL EXPOSURE</div><div className="small strong mono">{formatCurrency(g.totalExposure, g.currency)}</div></div>
            <div><div className="nano subtle">STILL OPEN</div><div className="small strong mono">{g.openCount}</div></div>
          </div>

          <div className="stack stack--xtight">
            {g.cases.map((lc) => (
              <Link
                key={lc.id}
                to={routes.workCaseDetail(lc.id)}
                className="row row--between row--nowrap"
                style={{ padding: 'var(--s-2)', background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 'var(--r-sm)', textDecoration: 'none', color: 'inherit' }}
              >
                <span className="row row--xtight row--nowrap" style={{ minWidth: 0 }}>
                  <span className="mono small strong">{lc.id}</span>
                  <Badge tone={lc.caseType === 'claim' ? 'primary' : 'info'}>{lc.caseType === 'claim' ? 'BP' : 'CB'}</Badge>
                  <TruncatedText value={lc.reasonLabel} className="micro muted" />
                </span>
                <span className="row row--xtight row--nowrap" style={{ flex: 'none' }}>
                  <span className="mono micro">{formatCurrency(lc.disputeAmount, lc.currency)}</span>
                  {lc.id === c.id ? <span className="nano subtle">This case</span> : <Icon name="chevron" size={11} className="subtle" />}
                </span>
              </Link>
            ))}
          </div>

          <Button variant={g.duplicateRefundRisk ? 'danger' : 'subtle'} size="sm" icon="layers">
            Work all {g.size} together
          </Button>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== *
 * Work view
 * ================================================================== */

const CENTRE_TABS = (docs) => [
  { value: 'merchant', label: `Merchant docs (${docs.merchant})` },
  { value: 'issuer', label: `Issuer docs (${docs.issuer})` },
  { value: 'related', label: 'Related cases' },
];

function WorkView({ c }) {
  const brand = useBrand();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { routes, id: perspectiveId } = usePerspective();

  const [tab, setTab] = useState('merchant');
  const [modal, setModal] = useState(null);
  const [status, setStatus] = useState(c.status);
  const [notes, setNotes] = useState(() => getCaseNotes(c.id));

  const groups = useMemo(() => {
    const index = indexGroupsByCase(buildConsolidationGroups(CASES));
    return index.get(c.id) ?? [];
  }, [c.id]);

  const flags = useMemo(() => getCaseFlags(c.id, groups), [c.id, groups]);
  const docCounts = useMemo(() => {
    const d = getCaseDocs(c.id);
    return { merchant: d.merchant.length, issuer: d.issuer.length };
  }, [c.id]);

  const close = () => setModal(null);
  const done = (msg) => { close(); notify(msg, 'success'); };

  return (
    <>
      <div className="breadcrumb">
        <IconButton icon="arrowLeft" label="Back to records" onClick={() => navigate(routes.workCase)} />
        <Link to={routes.workCase}>Records</Link>
        <span className="breadcrumb__sep">/</span>
        <span>Work case</span>
        <span className="breadcrumb__sep">/</span>
        <span className="mono strong">Case: {c.id}</span>

        <select
          className="select"
          style={{ width: 'auto', height: 26, fontSize: 'var(--fs-micro)' }}
          value={status}
          onChange={(e) => { setStatus(e.target.value); notify(`Status set to ${getStatus(e.target.value).label}.`, 'success'); }}
          aria-label="Case status"
        >
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        <span className="breadcrumb__sep">·</span>
        <span className="micro subtle">{c.assignmentReason}</span>

        <span className="spacer" />

        <div className="row row--xtight row--nowrap">
          <Tooltip label="Upload documents"><button type="button" className="round-btn" onClick={() => setModal('upload')}><Icon name="upload" size={15} /></button></Tooltip>
          <Tooltip label="Pend case"><button type="button" className="round-btn" onClick={() => setModal('pend')}><Icon name="pause" size={15} /></button></Tooltip>
          <Tooltip label="Route to queue"><button type="button" className="round-btn" onClick={() => setModal('route')}><Icon name="route" size={15} /></button></Tooltip>
          <Tooltip label="Referral"><button type="button" className="round-btn" onClick={() => setModal('referral')}><Icon name="referral" size={15} /></button></Tooltip>
          <Tooltip label="Resubmit case"><button type="button" className="round-btn" onClick={() => setModal('resubmit')}><Icon name="resubmit" size={15} /></button></Tooltip>
        </div>
      </div>

      <div className="workcase">
        <LeftColumn c={c} />

        <Card bodyClassName="card__body--flush">
          <div style={{ padding: '0 var(--s-3)' }}>
            <Tabs tabs={CENTRE_TABS(docCounts)} value={tab} onChange={setTab} />
          </div>
          {tab === 'related'
            ? <div className="card__body"><RelatedCases c={c} groups={groups} /></div>
            : <DocViewer c={c} side={tab} />}
        </Card>

        <div className="stack stack--tight workcase__right">
          <Card title="Actions">
            <ActionsCard c={c} perspective={perspectiveId} onSubmit={(_, msg) => notify(msg, 'success')} />
          </Card>

          <Card title="Case flags" action={flags.length ? <ColorLegend /> : undefined} bodyClassName="card__body--tight">
            {flags.length ? (
              <ul className="stack stack--xtight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {flags.map((f) => (
                  <li key={f.id}>
                    <Tooltip label={f.description} wide>
                      <span className="row row--xtight">
                        <span className={`dot dot--${f.tone}`} />
                        <span className="micro">{f.label}</span>
                      </span>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            ) : <p className="micro subtle">No flags on this case.</p>}
          </Card>

          <Card
            title="Notes"
            action={<Button variant="ghost" size="sm" icon="plus" onClick={() => setModal('notes')}>Add note</Button>}
            bodyClassName="card__body--tight"
          >
            <div className="stack stack--xtight" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {notes.map((n) => (
                <article key={n.id} className="note-card">
                  <div className="small strong">{n.title}</div>
                  <p className="micro muted">{n.text}</p>
                  <div className="nano subtle">{n.author} · {formatDateTime(n.timestamp)}</div>
                </article>
              ))}
            </div>
          </Card>

          <Card title="Deadlines" bodyClassName="card__body--tight">
            <div className="stack stack--xtight">
              <div className="row row--between"><span className="micro muted">Internal due</span><DueCell dueDate={c.dueDate} /></div>
              <div className="row row--between"><span className="micro muted">Network due</span><span className="micro mono">{formatDate(c.networkDueDate)}</span></div>
              <div className="row row--between"><span className="micro muted">Amount</span><span className="micro mono strong">{formatCurrency(c.disputeAmount, c.currency)}</span></div>
              <div className="row row--between"><span className="micro muted">{brand.terms.queue}</span><span className="micro">{c.queueLabel}</span></div>
            </div>
          </Card>
        </div>
      </div>

      <NotesModal open={modal === 'notes'} onClose={close} notes={notes} onAdd={(n) => { setNotes((p) => [{ ...n, id: `${c.id}-n-${p.length + 1}`, author: 'you', timestamp: new Date().toISOString() }, ...p]); done('Note added.'); }} />
      <UploadModal open={modal === 'upload'} onClose={close} onDone={done} />
      <PendModal open={modal === 'pend'} onClose={close} onDone={done} />
      <RouteModal open={modal === 'route'} onClose={close} onDone={(_, msg) => done(msg)} />
      <ReferralModal open={modal === 'referral'} onClose={close} onDone={done} />
      <ResubmitModal open={modal === 'resubmit'} onClose={close} onDone={done} c={c} />
    </>
  );
}

/* ================================================================== */

export function WorkCase() {
  const { caseId } = useParams();
  const c = caseId ? getCase(caseId) : null;

  if (!caseId) return <RecordsView />;

  if (!c) {
    return (
      <Card>
        <EmptyState icon="search" title={`No case with ID ${caseId}`} hint="It may have been merged, or the ID mistyped." />
      </Card>
    );
  }

  return <WorkView c={c} />;
}

export default WorkCase;
