import { useMemo, useState } from 'react';
import { PageHeader, Card, Button, Stepper, EmptyState, StatusIcon } from '@/components/ui/Surface';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { SelectField, TextField } from '@/components/ui/Form';
import Icon from '@/components/ui/Icon';
import { CRITERIA_CATEGORIES, RULE_ACTION_OPTIONS, categoryOptions, describeCriterion, getCategory, getRuleAction, matchCases } from '@/domain/criteria';
import { BULK_ACTION_HISTORY } from '@/data/admin';
import { CASES } from '@/data/cases';
import brand from '@/brand/brand.config';
import { ASSIGN_SKILLS, ASSIGN_USERS } from '@/data/work-case';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format';

/**
 * Bulk actions — the same three-step flow as Add rule, but as a POPOUT MODAL
 * rather than a full page, because a bulk action is a one-off operation rather
 * than a saved object.
 *
 * The live match count runs against the real book at every step, so the number
 * in Review is exactly what will change.
 */

const STEPS = ['Criteria', 'Actions', 'Review'];

export function BulkActions() {
  const { notify } = useToast();

  const [history, setHistory] = useState(BULK_ACTION_HISTORY);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [activeCategory, setActiveCategory] = useState(CRITERIA_CATEGORIES[0].key);
  const [criteria, setCriteria] = useState([]);
  const [actions, setActions] = useState([]);
  const [label, setLabel] = useState('');

  const matched = useMemo(() => matchCases(CASES, criteria, 'all'), [criteria]);
  const exposure = matched.reduce((s, c) => s + c.disputeAmount, 0);

  const category = getCategory(activeCategory);
  const current = criteria.find((c) => c.key === activeCategory);

  const reset = () => { setStep(0); setCriteria([]); setActions([]); setLabel(''); };

  const setChip = (value) => {
    setCriteria((prev) => {
      const existing = prev.find((c) => c.key === activeCategory);
      if (!existing) return [...prev, { key: activeCategory, values: [value] }];
      const values = existing.values.includes(value) ? existing.values.filter((v) => v !== value) : [...existing.values, value];
      return values.length ? prev.map((c) => (c.key === activeCategory ? { ...c, values } : c)) : prev.filter((c) => c.key !== activeCategory);
    });
  };

  const setOperator = (patch) => {
    setCriteria((prev) => {
      const existing = prev.find((c) => c.key === activeCategory);
      const next = { key: activeCategory, operator: category.operators[0], value: '', ...existing, ...patch };
      return existing ? prev.map((c) => (c.key === activeCategory ? next : c)) : [...prev, next];
    });
  };

  const apply = () => {
    const record = {
      id: `ba${Date.now()}`,
      name: label.trim() || `Bulk action on ${matched.length} cases`,
      runAt: new Date().toISOString(),
      runBy: 'you',
      matched: matched.length,
      applied: matched.length,
      status: 'Completed',
    };
    setHistory((p) => [record, ...p]);
    notify(`${formatNumber(matched.length)} cases updated.`, 'success');
    setOpen(false);
    reset();
  };

  const historyColumns = [
    { key: 'name', header: 'Action', fw: 16, cell: (r) => <span className="small strong">{r.name}</span> },
    { key: 'runBy', header: 'Run by', fw: 10, cell: (r) => <span className="small mono">{r.runBy}</span> },
    { key: 'matched', header: 'Matched', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatNumber(r.matched)}</span> },
    { key: 'applied', header: 'Applied', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatNumber(r.applied)}</span> },
    { key: 'status', header: 'Status', fw: 6, align: 'center', cell: (r) => <StatusIcon icon="check" tone="success" label={r.status} /> },
    { key: 'runAt', header: 'When', fw: 9, align: 'right', cell: (r) => <span className="micro subtle nowrap">{formatDateTime(r.runAt)}</span> },
  ];

  const canNext = (step === 0 && criteria.length > 0) || (step === 1 && actions.length > 0) || step === 2;

  return (
    <>
      <PageHeader
        title="Bulk actions"
        description="Build a criteria set, see exactly how many cases it selects, then apply one change to all of them."
        actions={<Button variant="primary" icon="plus" onClick={() => { reset(); setOpen(true); }}>New bulk action</Button>}
      />

      <div className="stack">
        {history.length === 0 ? (
          <Card>
            <EmptyState
              icon="checklist"
              title="No bulk actions yet"
              hint="Bulk actions change many cases at once — routing a whole reason code to a different queue, or reassigning an analyst's book. You always see the match count before anything is applied."
              action={<Button variant="primary" icon="plus" onClick={() => setOpen(true)}>New bulk action</Button>}
            />
          </Card>
        ) : (
          <Card title="Recent bulk actions" bodyClassName="card__body--flush">
            <DataTable columns={historyColumns} rows={history} rowKey={(r) => r.id} />
          </Card>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Bulk action"
        size="xl"
        footer={
          <>
            <span className="small muted" style={{ marginRight: 'auto' }}>
              <strong className="mono">{formatNumber(matched.length)}</strong> case{matched.length === 1 ? '' : 's'} match
            </span>
            <Button variant="secondary" onClick={() => (step === 0 ? setOpen(false) : setStep(step - 1))}>
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step < 2 ? (
              <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Button>
            ) : (
              <Button variant="primary" disabled={!matched.length} onClick={apply}>Apply to {formatNumber(matched.length)} cases</Button>
            )}
          </>
        }
      >
        <div className="stack">
          <Stepper steps={STEPS} current={step} />

          {step === 0 && (
            <div className="grid" style={{ gridTemplateColumns: '190px minmax(0, 1fr)', alignItems: 'start' }}>
              <div className="stack stack--xtight">
                {CRITERIA_CATEGORIES.map((c) => {
                  const count = criteria.find((x) => x.key === c.key)?.values?.length ?? (criteria.some((x) => x.key === c.key) ? 1 : 0);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      className={`popover__item ${activeCategory === c.key ? 'is-active' : ''}`.trim()}
                      style={activeCategory === c.key ? { background: 'var(--c-primary-tint)', color: 'var(--c-primary-deep)', fontWeight: 600 } : undefined}
                      onClick={() => setActiveCategory(c.key)}
                    >
                      {c.label}
                      {count > 0 && <span className="popover__count">{count}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="stack stack--tight">
                <p className="small muted">{category.hint}</p>
                {category.type === 'chips' ? (
                  <div className="row row--tight">
                    {categoryOptions(activeCategory).map((opt) => {
                      const on = current?.values?.map(String).includes(String(opt.value));
                      return (
                        <button key={String(opt.value)} type="button" className={`chip chip--toggle ${on ? 'is-on' : ''}`.trim()} onClick={() => setChip(opt.value)}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="row row--tight">
                    <SelectField label="Operator" value={current?.operator ?? category.operators[0]} onChange={(e) => setOperator({ operator: e.target.value })} options={category.operators.map((o) => ({ value: o, label: o }))} />
                    <TextField label="Value" type={category.valueType === 'number' ? 'number' : 'text'} value={current?.value ?? ''} onChange={(e) => setOperator({ value: e.target.value })} placeholder={category.placeholder} />
                  </div>
                )}

                <div className="chip-area">
                  {criteria.length === 0 ? <span className="small subtle">No criteria yet.</span> : (
                    <div className="row row--tight">
                      {criteria.map((c) => (
                        <span key={c.key} className="chip">
                          {describeCriterion(c)}
                          <button type="button" className="chip__remove" onClick={() => setCriteria((p) => p.filter((x) => x.key !== c.key))} aria-label="Remove"><Icon name="close" size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="stack stack--tight">
              <div className="row row--tight">
                {RULE_ACTION_OPTIONS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className={`chip chip--toggle ${actions.some((x) => x.key === a.key) ? 'is-on' : ''}`.trim()}
                    onClick={() => setActions((p) => (p.some((x) => x.key === a.key) ? p.filter((x) => x.key !== a.key) : [...p, { key: a.key, value: null }]))}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {actions.filter((a) => getRuleAction(a.key)?.valueType !== 'none').map((a) => {
                const spec = getRuleAction(a.key);
                const options = spec.valueType === 'queue' ? brand.queues.map((q) => ({ value: q.id, label: q.label }))
                  : spec.valueType === 'user' ? ASSIGN_USERS.map((u) => ({ value: u, label: u }))
                    : ASSIGN_SKILLS.map((s) => ({ value: s, label: s }));
                return (
                  <SelectField
                    key={a.key}
                    label={spec.label}
                    value={a.value ?? ''}
                    onChange={(e) => setActions((p) => p.map((x) => (x.key === a.key ? { ...x, value: e.target.value } : x)))}
                    placeholder={`Select a ${spec.valueType}…`}
                    options={options}
                  />
                );
              })}

              <TextField label="Label this action" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Shown in the bulk action history" />
            </div>
          )}

          {step === 2 && (
            <div className="stack stack--tight">
              <div className="row row--between" style={{ padding: 'var(--s-3)', background: matched.length ? 'var(--c-primary-wash)' : 'var(--c-warning-tint)', borderRadius: 'var(--r-md)' }}>
                <div><div className="t-section-label">Cases affected</div><div className="kpi__value">{formatNumber(matched.length)}</div></div>
                <div style={{ textAlign: 'right' }}><div className="t-section-label">Total exposure</div><div className="kpi__value">{formatCurrency(exposure)}</div></div>
              </div>

              <div><span className="t-section-label">Criteria</span>
                <ul className="small muted" style={{ margin: '4px 0 0', paddingLeft: 'var(--s-5)' }}>
                  {criteria.map((c) => <li key={c.key}>{describeCriterion(c)}</li>)}
                </ul>
              </div>

              <div><span className="t-section-label">Actions</span>
                <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 'var(--s-5)' }}>
                  {actions.map((a) => <li key={a.key}>{getRuleAction(a.key)?.label}{a.value ? ` → ${a.value}` : ''}</li>)}
                </ul>
              </div>

              {matched.length > 0 && (
                <div>
                  <span className="t-section-label">Sample</span>
                  <DataTable
                    columns={[
                      { key: 'id', header: 'Case #', fw: 8, cell: (r) => <span className="mono small">{r.id}</span> },
                      { key: 'reasonLabel', header: 'Reason', fw: 14, cell: (r) => <span className="small truncate">{r.reasonLabel}</span> },
                      { key: 'disputeAmount', header: 'Amount', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatCurrency(r.disputeAmount, r.currency)}</span> },
                    ]}
                    rows={matched.slice(0, 5)}
                    rowKey={(r) => r.id}
                  />
                  {matched.length > 5 && <span className="micro subtle">…and {formatNumber(matched.length - 5)} more.</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

export default BulkActions;
