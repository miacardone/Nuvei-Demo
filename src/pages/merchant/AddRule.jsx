import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Surface';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Form';
import Icon from '@/components/ui/Icon';
import { CRITERIA_CATEGORIES, RULE_ACTION_OPTIONS, RULE_STATUS_OPTIONS, categoryOptions, describeCriterion, getCategory, getRuleAction, matchCases, optionLabel } from '@/domain/criteria';
import { RULES, RULE_GROUPS } from '@/data/rules';
import { CASES } from '@/data/cases';
import brand from '@/brand/brand.config';
import { ASSIGN_SKILLS, ASSIGN_USERS } from '@/data/work-case';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatNumber } from '@/utils/format';

/**
 * Add rule — a FULL PAGE, not a modal, because three steps of criteria and
 * actions do not fit a dialog. Dark left rail carries the numbered steps and a
 * context list that changes per step, with count badges.
 */

const STEPS = ['Criteria', 'Actions', 'Details'];
const DEFAULT_STATUSES = ['open', 'ready', 'assigned'];

function ChipArea({ title, empty, children, count }) {
  return (
    <div className="stack stack--tight">
      <div className="row row--between">
        <span className="t-section-label">{title}</span>
        {count > 0 && <span className="micro subtle">{count} selected</span>}
      </div>
      <div className="chip-area">
        {count === 0 ? <span className="small subtle">{empty}</span> : <div className="row row--tight">{children}</div>}
      </div>
    </div>
  );
}

/**
 * Diffs two label lists (original vs. current) by their rendered text, since
 * criteria/actions/statuses each have their own shape — comparing the
 * describe-string sidesteps needing a per-field equality check.
 */
function diffLabels(originalLabels, currentLabels) {
  const originalSet = new Set(originalLabels);
  const currentSet = new Set(currentLabels);
  return [
    ...originalLabels.filter((l) => !currentSet.has(l)).map((label) => ({ label, kind: 'removed' })),
    ...currentLabels.map((label) => ({ label, kind: originalSet.has(label) ? 'unchanged' : 'added' })),
  ];
}

function DiffChips({ title, diff }) {
  return (
    <div>
      <span className="t-section-label">{title}</span>
      <div className="row row--tight" style={{ marginTop: 4 }}>
        {diff.length === 0 && <span className="micro subtle">None</span>}
        {diff.map((d, i) => (
          <span key={`${d.label}-${i}`} className={`chip chip--${d.kind}`}>
            {d.kind === 'added' && <Icon name="plus" size={10} />}
            {d.kind === 'removed' && <Icon name="close" size={10} />}
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ActionValue({ actionKey, value, onChange }) {
  const spec = getRuleAction(actionKey);
  if (!spec || spec.valueType === 'none') return null;

  const options = spec.valueType === 'queue' ? brand.queues.map((q) => ({ value: q.id, label: q.label }))
    : spec.valueType === 'user' ? ASSIGN_USERS.map((u) => ({ value: u, label: u }))
      : ASSIGN_SKILLS.map((s) => ({ value: s, label: s }));

  return (
    <SelectField
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Select a ${spec.valueType}…`}
      options={options}
    />
  );
}

export function AddRule() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { routes } = usePerspective();
  const [searchParams] = useSearchParams();

  const editId = searchParams.get('edit');
  const parentId = searchParams.get('parentId');
  const editingRule = editId ? RULES.find((r) => r.id === editId) : null;
  const parentRule = parentId ? RULES.find((r) => r.id === parentId) : null;
  const isSubRule = Boolean(parentRule);

  const [step, setStep] = useState(0);
  const [activeCategory, setActiveCategory] = useState(CRITERIA_CATEGORIES[0].key);
  const [criteria, setCriteria] = useState(editingRule?.criteria ?? []);
  const [actions, setActions] = useState(editingRule?.actions ?? []);
  const [statuses, setStatuses] = useState(editingRule?.statuses ?? DEFAULT_STATUSES);
  const [name, setName] = useState(editingRule?.name ?? '');
  const [description, setDescription] = useState(editingRule?.description ?? '');
  const [groupId, setGroupId] = useState(editingRule?.groupId ?? parentRule?.groupId ?? searchParams.get('groupId') ?? RULE_GROUPS[1].id);
  const [testRun, setTestRun] = useState(null);

  // A rule id is stable across the visit, but `editId` never changes once the
  // page is mounted, so this only ever runs once per navigation — not on
  // every keystroke, which would stomp on what the user just typed.
  useEffect(() => {
    if (!editingRule) return;
    setCriteria(editingRule.criteria ?? []);
    setActions(editingRule.actions ?? []);
    setStatuses(editingRule.statuses ?? DEFAULT_STATUSES);
    setName(editingRule.name ?? '');
    setDescription(editingRule.description ?? '');
    setGroupId(editingRule.groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  /** Live impact against the real book — recomputed on every edit. */
  const matched = useMemo(() => matchCases(CASES, criteria, 'all'), [criteria]);

  const describeAction = (a) => `${getRuleAction(a.key)?.label}${a.value ? ` → ${a.value}` : ''}`;

  const criteriaDiff = useMemo(
    () => (editingRule ? diffLabels((editingRule.criteria ?? []).map(describeCriterion), criteria.map(describeCriterion)) : null),
    [editingRule, criteria],
  );
  const actionsDiff = useMemo(
    () => (editingRule ? diffLabels((editingRule.actions ?? []).map(describeAction), actions.map(describeAction)) : null),
    [editingRule, actions],
  );
  const statusesDiff = useMemo(
    () => (editingRule ? diffLabels(editingRule.statuses ?? DEFAULT_STATUSES, statuses) : null),
    [editingRule, statuses],
  );

  const category = getCategory(activeCategory);
  const current = criteria.find((c) => c.key === activeCategory);

  const setChipValue = (value) => {
    setCriteria((prev) => {
      const existing = prev.find((c) => c.key === activeCategory);
      if (!existing) return [...prev, { key: activeCategory, values: [value] }];
      const values = existing.values.includes(value)
        ? existing.values.filter((v) => v !== value)
        : [...existing.values, value];
      return values.length
        ? prev.map((c) => (c.key === activeCategory ? { ...c, values } : c))
        : prev.filter((c) => c.key !== activeCategory);
    });
  };

  const setOperator = (patch) => {
    setCriteria((prev) => {
      const existing = prev.find((c) => c.key === activeCategory);
      const next = { key: activeCategory, operator: category.operators[0], value: '', ...existing, ...patch };
      return existing ? prev.map((c) => (c.key === activeCategory ? next : c)) : [...prev, next];
    });
  };

  const toggleAction = (key) => {
    setActions((prev) => (prev.some((a) => a.key === key) ? prev.filter((a) => a.key !== key) : [...prev, { key, value: null }]));
  };

  const canComplete = name.trim() && criteria.length > 0 && actions.length > 0;

  const railItems = step === 0
    ? CRITERIA_CATEGORIES.map((c) => ({
        key: c.key,
        label: c.label,
        count: criteria.find((x) => x.key === c.key)?.values?.length ?? (criteria.some((x) => x.key === c.key) ? 1 : 0),
      }))
    : step === 1
      ? RULE_ACTION_OPTIONS.map((a) => ({ key: a.key, label: a.label, selected: actions.some((x) => x.key === a.key) }))
      : [];

  return (
    <div className="builder">
      <aside className="builder__rail">
        <div className="builder__steps">
          {STEPS.map((label, i) => (
            <div key={label} className={`builder__step ${i === step ? 'is-active' : i < step ? 'is-done' : ''}`.trim()}>
              <span className="builder__step-dot">{i < step ? <Icon name="check" size={11} strokeWidth={2.6} /> : i + 1}</span>
              {label}
            </div>
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="t-section-label" style={{ color: 'rgba(255,255,255,0.5)', padding: '0 var(--s-2) var(--s-2)' }}>Criteria</div>
            {railItems.map((item) => (
              <button key={item.key} type="button" className={`builder__ctx-item ${activeCategory === item.key ? 'is-active' : ''}`.trim()} onClick={() => setActiveCategory(item.key)}>
                {item.label}
                {item.count > 0 && <span className="builder__ctx-count">{item.count}</span>}
              </button>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <div className="t-section-label" style={{ color: 'rgba(255,255,255,0.5)', padding: '0 var(--s-2) var(--s-2)' }}>Case actions</div>
            {railItems.map((item) => (
              <button key={item.key} type="button" className={`builder__ctx-item ${item.selected ? 'is-active' : ''}`.trim()} onClick={() => toggleAction(item.key)}>
                {item.label}
                {item.selected && <Icon name="check" size={13} style={{ marginLeft: 'auto', color: 'var(--c-nav-active)' }} />}
              </button>
            ))}
          </>
        )}

        {step === 2 && (
          <div className="stack stack--tight">
            <div className="t-section-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Summary</div>
            <span className="micro" style={{ color: 'rgba(255,255,255,0.7)' }}>{criteria.length} criteria · {actions.length} actions</span>
            <span className="micro" style={{ color: 'rgba(255,255,255,0.7)' }}>{formatNumber(matched.length)} cases match</span>
          </div>
        )}
      </aside>

      <main className="builder__main">
        <div className="stack">
          <div className="row row--between">
            <h1>{editingRule ? 'Edit rule' : isSubRule ? `Add sub-rule — under “${parentRule.name}”` : 'Add rule'}</h1>
            <Button variant="ghost" icon="close" onClick={() => navigate(routes.ruleGroups)}>Cancel</Button>
          </div>

          {step === 0 && (
            <div className="stack">
              <div className="card">
                <div className="card__head"><h2 className="card__title">{category.label}</h2></div>
                <div className="card__body stack stack--tight">
                  <p className="small muted">{category.hint}</p>

                  {category.type === 'chips' ? (
                    <div className="row row--tight">
                      {categoryOptions(activeCategory).map((opt) => {
                        const on = current?.values?.includes(String(opt.value)) || current?.values?.includes(opt.value);
                        return (
                          <button key={String(opt.value)} type="button" className={`chip chip--toggle ${on ? 'is-on' : ''}`.trim()} onClick={() => setChipValue(opt.value)}>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="row row--tight">
                      <SelectField
                        label="Operator"
                        value={current?.operator ?? category.operators[0]}
                        onChange={(e) => setOperator({ operator: e.target.value })}
                        options={category.operators.map((o) => ({ value: o, label: o }))}
                      />
                      <TextField
                        label="Value"
                        type={category.valueType === 'number' ? 'number' : 'text'}
                        value={current?.value ?? ''}
                        onChange={(e) => setOperator({ value: e.target.value })}
                        placeholder={category.placeholder}
                      />
                    </div>
                  )}
                </div>
              </div>

              <ChipArea title="1. Rule criteria" empty="No criteria yet — a rule with no criteria matches nothing." count={criteria.length}>
                {criteria.map((c) => (
                  <span key={c.key} className="chip">
                    {describeCriterion(c)}
                    <button type="button" className="chip__remove" onClick={() => setCriteria((p) => p.filter((x) => x.key !== c.key))} aria-label="Remove criterion">
                      <Icon name="close" size={11} />
                    </button>
                  </span>
                ))}
              </ChipArea>

              {testRun && (
                <div className="card"><div className="card__body small">{testRun}</div></div>
              )}

              <div className="builder__foot">
                <Button variant="secondary" onClick={() => setTestRun(`Test run: ${formatNumber(matched.length)} of ${formatNumber(CASES.length)} cases match these criteria right now.`)}>
                  Test Run
                </Button>
                <span className="spacer" />
                <Button variant="primary" iconAfter="chevron" disabled={!criteria.length} onClick={() => setStep(1)}>Choose Case Action</Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="stack">
              <ChipArea title="2. Rule actions" empty="No actions yet — pick at least one from the rail." count={actions.length}>
                {actions.map((a) => (
                  <span key={a.key} className="chip">
                    {getRuleAction(a.key)?.label}
                    <button type="button" className="chip__remove" onClick={() => toggleAction(a.key)} aria-label="Remove action">
                      <Icon name="close" size={11} />
                    </button>
                  </span>
                ))}
              </ChipArea>

              {actions.filter((a) => getRuleAction(a.key)?.valueType !== 'none').length > 0 && (
                <div className="card">
                  <div className="card__head"><h2 className="card__title">Action settings</h2></div>
                  <div className="card__body stack stack--tight">
                    {actions.filter((a) => getRuleAction(a.key)?.valueType !== 'none').map((a) => (
                      <div key={a.key} className="stack stack--xtight">
                        <span className="field__label">{getRuleAction(a.key)?.label}</span>
                        <ActionValue actionKey={a.key} value={a.value} onChange={(v) => setActions((p) => p.map((x) => (x.key === a.key ? { ...x, value: v } : x)))} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="builder__foot">
                <Button variant="secondary" icon="arrowLeft" onClick={() => setStep(0)}>Back</Button>
                <Button variant="secondary" onClick={() => setTestRun(`Test run: ${formatNumber(matched.length)} cases would receive ${actions.length} action(s).`)}>Test Run</Button>
                <span className="spacer" />
                <Button variant="primary" iconAfter="chevron" disabled={!actions.length} onClick={() => setStep(2)}>Continue to Details</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="stack">
              <div className="card">
                <div className="card__body stack stack--tight">
                  <span className="field__label">Case statuses to apply rule to</span>
                  <div className="row row--tight">
                    {RULE_STATUS_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        className={`chip chip--toggle ${statuses.includes(s.value) ? 'is-on' : ''}`.trim()}
                        onClick={() => setStatuses((p) => (p.includes(s.value) ? p.filter((x) => x !== s.value) : [...p, s.value]))}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  <TextField label="Rule name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. High-value fraud routing" />
                  <TextAreaField label="Rule description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
                  <SelectField
                    label="Rule group"
                    required
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    options={RULE_GROUPS.map((g) => ({ value: g.id, label: g.name }))}
                    disabled={isSubRule}
                    hint={isSubRule ? `Sub-rules stay in their parent's group — ${RULE_GROUPS.find((g) => g.id === groupId)?.name}.` : undefined}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card__head">
                  <h2 className="card__title">Summary</h2>
                  {editingRule && <span className="micro subtle">Changes vs. the saved rule</span>}
                </div>
                <div className="card__body stack stack--tight">
                  {editingRule ? (
                    <>
                      <DiffChips title="Criteria" diff={criteriaDiff} />
                      <DiffChips title="Actions" diff={actionsDiff} />
                      <DiffChips title="Statuses" diff={statusesDiff} />
                    </>
                  ) : (
                    <>
                      <div><span className="t-section-label">Criteria</span><div className="row row--tight" style={{ marginTop: 4 }}>{criteria.map((c) => <span key={c.key} className="chip">{describeCriterion(c)}</span>)}</div></div>
                      <div><span className="t-section-label">Actions</span><div className="row row--tight" style={{ marginTop: 4 }}>{actions.map((a) => <span key={a.key} className="chip">{getRuleAction(a.key)?.label}{a.value ? ` → ${optionLabel('merchantLabel', a.value) === a.value ? a.value : a.value}` : ''}</span>)}</div></div>
                      <div><span className="t-section-label">Statuses</span><div className="row row--tight" style={{ marginTop: 4 }}>{statuses.map((s) => <span key={s} className="chip">{s}</span>)}</div></div>
                    </>
                  )}
                  <div
                    className="row row--between"
                    style={{ marginTop: 'var(--s-2)', padding: 'var(--s-3)', background: 'var(--c-primary-wash)', borderRadius: 'var(--r-md)' }}
                  >
                    <span className="small strong">Estimated impact</span>
                    <span className="mono strong">{formatNumber(matched.length)} cases</span>
                  </div>
                </div>
              </div>

              <div className="builder__foot">
                <Button variant="secondary" icon="arrowLeft" onClick={() => setStep(1)}>Back</Button>
                <span className="spacer" />
                <Button
                  variant="primary"
                  disabled={!canComplete}
                  onClick={() => {
                    const rule = {
                      id: editingRule?.id ?? `r${Date.now()}`,
                      groupId,
                      parentId: editingRule?.parentId ?? parentId ?? null,
                      name: name.trim(),
                      description: description.trim(),
                      criteria,
                      actions,
                      statuses,
                      enabled: editingRule?.enabled ?? true,
                    };
                    notify(
                      editingRule
                        ? `Rule "${name}" updated — ${formatNumber(matched.length)} cases match.`
                        : `Rule "${name}" ${isSubRule ? 'added as a sub-rule' : 'created'} — ${formatNumber(matched.length)} cases match.`,
                      'success',
                    );
                    navigate(routes.ruleGroups, { state: { rule, isEdit: Boolean(editingRule) } });
                  }}
                >
                  {editingRule ? 'Save Rule' : 'Complete Rule'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default AddRule;
