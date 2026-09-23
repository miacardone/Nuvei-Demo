import { useMemo, useState } from 'react';
import { Card, Badge, Button, EmptyState } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { SelectField, TextField } from '@/components/ui/Form';
import { TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { MERCHANTS } from '@/data/portfolio';
import { applyIndemnification, settingsFor } from '@/data/indemnification';
import { saveSuggestion } from '@/data/suggestions-store';
import {
  CATEGORIES, CRITERIA_FIELDS, categoryFor, fieldFor, goalFor, goalsFor,
  matchMerchants, operatorsFor,
} from '@/domain/revenue';
import { useToast } from '@/context/ToastContext';
import { formatCompactCurrency, formatNumber, formatPercent } from '@/utils/format';

/**
 * CREATE — a questionnaire on the left, a live answer on the right.
 *
 * The questions reveal one at a time: you cannot be asked what you want to
 * know before you have said what you are trying to do, and showing all of it
 * at once is what makes a form like this feel like paperwork. Nothing has to
 * be saved or submitted — the panel on the right recomputes on every change,
 * so the answer is visible while the question is still being asked.
 *
 * Two subjects, chosen at the top: PER MERCHANT picks named merchants, PER
 * CRITERIA describes them by their properties. Everything downstream is
 * identical, which is why the mode is a toggle rather than two screens.
 */

const MODES = [
  { id: 'merchant', label: 'Per merchant', icon: 'briefcase', hint: 'Pick the merchants by name.' },
  { id: 'criteria', label: 'Per criteria', icon: 'sliders', hint: 'Describe them by their properties.' },
];

const blankCriterion = () => ({ field: 'chargebackRatio', operator: 'lt', value: '0.65' });

/** A numbered step in the questionnaire. Dimmed until it is reachable. */
function Step({ index, title, hint, children, done, active }) {
  return (
    <div className={`ask-step ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`.trim()}>
      <div className="ask-step__marker">{done ? <Icon name="check" size={12} /> : index}</div>
      <div className="ask-step__body">
        <div className="ask-step__head">
          <span className="ask-step__title">{title}</span>
          {hint && <span className="ask-step__hint">{hint}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

function CriterionRow({ criterion, onChange, onRemove, canRemove }) {
  const field = fieldFor(criterion.field);
  const operators = operatorsFor(field?.kind);

  return (
    <div className="rule-criterion">
      <SelectField
        aria-label="Field"
        value={criterion.field}
        onChange={(e) => {
          const next = fieldFor(e.target.value);
          onChange({
            field: e.target.value,
            operator: operatorsFor(next?.kind)[0].value,
            value: next?.kind === 'select' ? next.options[0] : '',
          });
        }}
        options={CRITERIA_FIELDS.map((f) => ({ value: f.key, label: f.label }))}
      />
      <SelectField
        aria-label="Operator"
        value={criterion.operator}
        onChange={(e) => onChange({ ...criterion, operator: e.target.value })}
        options={operators.map((o) => ({ value: o.value, label: o.label }))}
      />
      {field?.kind === 'select' ? (
        <SelectField
          aria-label="Value"
          value={criterion.value}
          onChange={(e) => onChange({ ...criterion, value: e.target.value })}
          options={field.options.map((o) => ({ value: o, label: field.optionLabel ? field.optionLabel(o) : o }))}
        />
      ) : (
        <TextField
          aria-label="Value"
          type="number"
          step={field?.step}
          value={criterion.value}
          onChange={(e) => onChange({ ...criterion, value: e.target.value })}
        />
      )}
      <Button variant="secondary" size="sm" icon="trash" disabled={!canRemove} onClick={onRemove} aria-label="Remove" />
    </div>
  );
}

export function CreateTab({ prefill, onSaved }) {
  const { notify } = useToast();
  const ctx = prefill.ctx;

  const [mode, setMode] = useState(prefill.mode ?? 'merchant');
  const [category, setCategory] = useState(prefill.category ?? '');
  const [goalId, setGoalId] = useState(prefill.goalId ?? '');
  const [picked, setPicked] = useState(prefill.merchantIds ?? []);
  const [criteria, setCriteria] = useState(prefill.criteria ?? [blankCriterion()]);
  const [values, setValues] = useState({});
  const [selected, setSelected] = useState(new Set());

  const goal = goalFor(goalId);
  const goals = category ? goalsFor(category) : [];

  const subjects = useMemo(() => (mode === 'merchant'
    ? MERCHANTS.filter((m) => picked.includes(m.id))
    : matchMerchants(MERCHANTS, criteria, 'all', ctx)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [mode, picked, criteria]);

  // Goal inputs carry their own defaults, so the answer is complete the moment
  // a goal is chosen rather than waiting for the user to fill in a rate.
  const effective = useMemo(() => {
    const out = { ...values };
    (goal?.inputs ?? []).forEach((i) => { if (out[i.key] === undefined || out[i.key] === '') out[i.key] = i.default; });
    return out;
  }, [values, goal]);

  const answer = useMemo(() => {
    if (!goal || !subjects.length) return null;
    try {
      return goal.answer({ subjects, values: effective, ctx });
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, subjects, effective]);

  const chosen = useMemo(
    () => (selected.size ? (answer?.rows ?? []).filter((r) => selected.has(r.merchant.id)) : (answer?.rows ?? [])),
    [answer, selected],
  );

  const resultColumns = [
    {
      key: 'name', header: 'Merchant', fw: 13,
      cell: (r) => (
        <div className="stack stack--xtight">
          <TruncatedText value={r.merchant.name} className="small strong" />
          <span className="micro subtle">{r.merchant.groupLabel} · {r.merchant.riskTier} risk</span>
        </div>
      ),
    },
    { key: 'volume', header: 'Volume', fw: 7, align: 'right', cell: (r) => <span className="mono small">{formatCompactCurrency(r.merchant.projectedVolume)}</span> },
    { key: 'ratio', header: 'CB ratio', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatPercent(r.merchant.chargebackRatio, 2)}</span> },
    { key: 'revenue', header: 'Revenue', fw: 7, align: 'right', cell: (r) => <span className="mono small strong">{formatCompactCurrency(r.revenue)}</span> },
    { key: 'loss', header: 'Expected loss', fw: 7, align: 'right', cell: (r) => <span className="mono small">{formatCompactCurrency(r.loss)}</span> },
    {
      key: 'net', header: 'Net', fw: 7, align: 'right',
      cell: (r) => (
        <span className="mono small strong" style={{ color: r.net >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
          {r.net >= 0 ? '+' : '−'}{formatCompactCurrency(Math.abs(r.net))}
        </span>
      ),
    },
  ];

  const title = goal && subjects.length
    ? `${goal.label} — ${mode === 'merchant' && subjects.length === 1 ? subjects[0].name : `${subjects.length} merchants`}`
    : 'Untitled suggestion';

  const save = () => {
    saveSuggestion({
      title,
      category,
      mode,
      summary: answer ? `${answer.headline} · ${answer.headlineNote}` : '',
      merchantCount: chosen.length,
    });
    notify('Saved to suggestions.', 'success');
    onSaved?.();
  };

  const applyNow = () => {
    if (!answer?.apply || !chosen.length) return;
    chosen.forEach((r) => applyIndemnification(r.merchant.id, answer.apply));
    saveSuggestion({
      title,
      category,
      mode,
      summary: answer ? `${answer.headline} · applied to ${chosen.length}` : '',
      merchantCount: chosen.length,
      status: 'applied',
      actionedAt: new Date().toISOString(),
      actionNote: 'Applied from Create.',
    });
    notify(`Applied to ${formatNumber(chosen.length)} merchant${chosen.length === 1 ? '' : 's'}.`, 'success');
    onSaved?.();
  };

  return (
    <div className="ask">
      {/* ---------------- Questionnaire ---------------- */}
      <div className="ask__form">
        <Card bodyClassName="card__body--tight">
          <div className="stack stack--tight">
            <span className="t-section-label">Ask about</span>
            <div className="ask-modes">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`ask-mode ${mode === m.id ? 'is-active' : ''}`.trim()}
                  onClick={() => { setMode(m.id); setSelected(new Set()); }}
                >
                  <Icon name={m.icon} size={15} />
                  <span className="ask-mode__label">{m.label}</span>
                  <span className="ask-mode__hint">{m.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card bodyClassName="card__body--tight">
          <div className="ask-steps">
            <Step index={1} title="What are you trying to do?" done={Boolean(category)} active>
              <div className="ask-chips">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`ask-chip ${category === c.id ? 'is-active' : ''}`.trim()}
                    onClick={() => { setCategory(c.id); setGoalId(''); setValues({}); }}
                  >
                    <Icon name={c.icon} size={13} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
              {category && <p className="micro subtle" style={{ margin: '4px 0 0' }}>{categoryFor(category)?.hint}</p>}
            </Step>

            <Step
              index={2}
              title={mode === 'merchant' ? 'Which merchants?' : 'Which merchants match?'}
              hint={mode === 'merchant' ? 'Pick one or several' : 'Describe them'}
              done={subjects.length > 0}
              active={Boolean(category)}
            >
              {mode === 'merchant' ? (
                <div className="ask-picker">
                  {MERCHANTS.map((m) => {
                    const on = picked.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`ask-pick ${on ? 'is-active' : ''}`.trim()}
                        onClick={() => setPicked((p) => (on ? p.filter((x) => x !== m.id) : [...p, m.id]))}
                      >
                        <span className="ask-pick__check">{on && <Icon name="check" size={11} />}</span>
                        <span className="ask-pick__name">{m.name}</span>
                        <span className="ask-pick__meta">{formatPercent(m.chargebackRatio, 2)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="stack stack--tight">
                  {criteria.map((c, i) => (
                    <CriterionRow
                      key={i}
                      criterion={c}
                      canRemove={criteria.length > 1}
                      onChange={(next) => setCriteria((p) => p.map((x, j) => (j === i ? next : x)))}
                      onRemove={() => setCriteria((p) => p.filter((_, j) => j !== i))}
                    />
                  ))}
                  <Button variant="secondary" size="sm" icon="plus" onClick={() => setCriteria((p) => [...p, blankCriterion()])}>
                    Add criterion
                  </Button>
                </div>
              )}
              {subjects.length > 0 && (
                <p className="micro subtle" style={{ margin: '6px 0 0' }}>
                  {formatNumber(subjects.length)} merchant{subjects.length === 1 ? '' : 's'} selected.
                </p>
              )}
            </Step>

            <Step
              index={3}
              title="What do you want to know?"
              done={Boolean(goal)}
              active={Boolean(category) && subjects.length > 0}
            >
              {category ? (
                <div className="stack stack--xtight">
                  {goals.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className={`ask-goal ${goalId === g.id ? 'is-active' : ''}`.trim()}
                      onClick={() => { setGoalId(g.id); setValues({}); }}
                    >
                      <span className="ask-goal__label">{g.label}</span>
                      <span className="ask-goal__blurb">{g.blurb}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="micro subtle" style={{ margin: 0 }}>Choose what you are trying to do first.</p>
              )}
            </Step>

            {Boolean(goal?.inputs?.length) && (
              <Step index={4} title="Set the numbers" done active>
                <div className="stack stack--tight">
                  {goal.inputs.map((input) => (
                    <TextField
                      key={input.key}
                      label={input.label}
                      type={input.type}
                      step={input.step}
                      value={values[input.key] ?? input.default}
                      onChange={(e) => setValues((v) => ({ ...v, [input.key]: e.target.value }))}
                      hint={input.suffix ? `In ${input.suffix}` : undefined}
                    />
                  ))}
                </div>
              </Step>
            )}
          </div>
        </Card>
      </div>

      {/* ---------------- Live answer ---------------- */}
      <div className="ask__answer">
        {!answer ? (
          <Card>
            <EmptyState
              icon="chart"
              title="The answer builds as you ask"
              hint="Choose what you are trying to do, who it is about, and what you want to know. Nothing needs saving — the impact appears here as you go."
            />
          </Card>
        ) : (
          <div className="stack">
            <Card bodyClassName="card__body--tight">
              <div className="stack stack--tight">
                <div className="row row--between row--nowrap" style={{ alignItems: 'flex-start' }}>
                  <div className="stack stack--xtight">
                    <span className="t-section-label">{goal.label}</span>
                    <span className="ask-headline">{answer.headline}</span>
                    <span className="micro subtle">{answer.headlineNote}</span>
                  </div>
                  <Badge tone="primary">{formatNumber(subjects.length)} in scope</Badge>
                </div>

                <p className="small" style={{ margin: 0 }}>{answer.narrative}</p>

                <div className="projection">
                  {answer.stats.map((s) => (
                    <div key={s.label} className="projection__cell">
                      <span className="projection__label">{s.label}</span>
                      <span
                        className="projection__value"
                        style={s.tone ? { color: s.tone === 'good' ? 'var(--c-success)' : 'var(--c-danger)' } : undefined}
                      >
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card
              title="Who this affects"
              action={
                <span className="micro subtle">
                  {selected.size ? `${formatNumber(selected.size)} selected` : 'All rows — tick to narrow'}
                </span>
              }
              bodyClassName="card__body--flush"
            >
              <DataTable
                columns={resultColumns}
                rows={answer.rows}
                rowKey={(r) => r.merchant.id}
                density="comfortable"
                selection={{
                  selected,
                  onToggle: (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }),
                  onToggleAll: (ids, check) => setSelected((p) => {
                    const n = new Set(p);
                    ids.forEach((id) => (check ? n.add(id) : n.delete(id)));
                    return n;
                  }),
                }}
              />
            </Card>

            <Card bodyClassName="card__body--tight">
              <div className="row row--between row--nowrap" style={{ flexWrap: 'wrap', gap: 'var(--s-3)' }}>
                <span className="micro subtle">
                  Nothing is saved until you choose. Applying writes to the merchant records this affects.
                </span>
                <div className="row row--tight row--nowrap">
                  <Button variant="secondary" icon="archive" onClick={save}>Save as suggestion</Button>
                  {answer.apply && (
                    <Button variant="primary" icon="check" disabled={!chosen.length} onClick={applyNow}>
                      {answer.applyLabel} to {formatNumber(chosen.length)}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateTab;
