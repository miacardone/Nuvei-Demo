import { useMemo, useState } from 'react';
import { Card, Badge, Button, EmptyState } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { SelectField, TextField } from '@/components/ui/Form';
import { TruncatedText } from '@/components/ui/Overlay';
import MerchantSearch from '@/components/ui/MerchantSearch';
import { Modal } from '@/components/ui/Modal';
import Icon from '@/components/ui/Icon';
import CommandBar from '@/components/revenue/CommandBar';
import { MERCHANTS } from '@/data/portfolio';
import { MERCHANT_GROUPS } from '@/data/merchants';
import { CASES } from '@/data/cases';
import { flagsFor } from '@/data/merchant-flags';
import { saveSuggestion } from '@/data/suggestions-store';
import { addStandingRule } from '@/data/standing-rules';
import { ASSIGNABLE } from '@/data/people';
import { BULK_ACTIONS, bulkActionFor } from '@/domain/bulk-actions';
import {
  CATEGORIES, CRITERIA_FIELDS, CRITERIA_TYPES, SOLUTION_TYPES, activityIndex,
  categoryFor, criteriaTypeFor, fieldFor, fieldsForType, goalFor, goalsFor,
  matchMerchants, operatorsFor, shapeAnswer,
} from '@/domain/revenue';
import { useToast } from '@/context/ToastContext';
import { formatCompactCurrency, formatNumber, formatPercent } from '@/utils/format';

/**
 * CREATE — three ways in, one workspace.
 *
 *   Type it   — the command bar parses a sentence and fills the form in.
 *   Start it  — a preset fills every step in one click.
 *   Build it  — the questionnaire, for when you want to say it exactly.
 *
 * All three write to the same state, so they are entry points rather than
 * modes, and the answer on the right recomputes on every change. Nothing has
 * to be saved before you can see what a rule would do.
 *
 * The action taken at the end is no longer only pricing: the bar at the foot
 * carries the whole bulk-action set, and a rule can be applied once or left
 * standing. That is what the screen needed in order to be a single place to
 * work from, rather than a calculator that sends you elsewhere to act.
 */

const MODES = [
  { id: 'merchant', label: 'Per merchant', icon: 'briefcase', hint: 'Pick specific merchants or merchant types.' },
  { id: 'criteria', label: 'Per criteria', icon: 'sliders', hint: 'Describe them — works at any size.' },
];

/**
 * Three ways to begin, offered as a choice rather than all at once. Only one
 * of them is ever needed, so showing all three expanded made the screen look
 * like a form with three sections to complete.
 */
const STARTERS = [
  { id: 'describe', label: 'Describe it', icon: 'search', hint: 'Type what you want in plain English.' },
  { id: 'quick', label: 'Quick start', icon: 'layers', hint: 'Pick a common starting point.' },
  { id: 'manual', label: 'Build it myself', icon: 'sliders', hint: 'Work down the questions below.' },
];

/** One click fills every step. The fastest route for the things people do most. */
const QUICK_STARTS = [
  {
    id: 'qs-cover',
    label: 'Find who to cover',
    hint: 'No arrangement today',
    icon: 'shield',
    fill: {
      mode: 'criteria', category: 'indemnification', goalId: 'should-indemnify', solution: 'recommend',
      criteriaType: 'coverage', action: 'indemnify',
      criteria: [{ field: 'indemnified', operator: 'is', value: 'no' }],
    },
  },
  {
    id: 'qs-price',
    label: 'Work out a price',
    hint: 'Recommend a rate',
    icon: 'chart',
    fill: {
      mode: 'criteria', category: 'revenue', goalId: 'what-to-charge', solution: 'recommend',
      criteriaType: 'risk', action: 'indemnify',
      criteria: [{ field: 'riskTier', operator: 'is', value: 'Low' }],
    },
  },
  {
    id: 'qs-exposure',
    label: 'Check our exposure',
    hint: 'Where the liability sits',
    icon: 'alert',
    fill: {
      mode: 'criteria', category: 'risk', goalId: 'exposure', solution: 'recommend',
      criteriaType: 'risk', action: 'watchlist',
      criteria: [{ field: 'chargebackRatio', operator: 'gte', value: '0.2' }],
    },
  },
  {
    id: 'qs-underpriced',
    label: 'Find the underpriced',
    hint: 'Covered, but not covering',
    icon: 'searchCheck',
    fill: {
      mode: 'criteria', category: 'indemnification', goalId: 'underpriced', solution: 'recommend',
      criteriaType: 'coverage', action: 'indemnify',
      criteria: [{ field: 'indemnified', operator: 'is', value: 'yes' }],
    },
  },
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

function CriterionRow({ criterion, onChange, onRemove, canRemove, fields = CRITERIA_FIELDS }) {
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
        options={fields.map((f) => ({ value: f.key, label: f.label }))}
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
  const [criteriaType, setCriteriaType] = useState(prefill.criteriaType ?? 'risk');
  const [criteria, setCriteria] = useState(prefill.criteria ?? [blankCriterion()]);
  const [filters, setFilters] = useState(prefill.filters ?? []);
  const [solution, setSolution] = useState(prefill.solution ?? 'recommend');
  const [values, setValues] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [confirming, setConfirming] = useState(false);
  const [starter, setStarter] = useState(null);

  // What happens at the end, and whether it happens once or keeps happening.
  const [actionId, setActionId] = useState(prefill.action ?? 'indemnify');
  const [owner, setOwner] = useState(ASSIGNABLE[0]?.email ?? '');
  const [standing, setStanding] = useState(false);

  const goal = goalFor(goalId);
  const goals = category ? goalsFor(category) : [];
  const action = bulkActionFor(actionId) ?? BULK_ACTIONS[0];

  /* What the search offers before anyone types. On a real portfolio this would
     be the accounts you touched most recently; here it is the busiest by case
     activity, which is the same idea and computed rather than hardcoded. */
  const mostActive = useMemo(
    () => activityIndex(MERCHANTS, CASES).slice(0, 6).map((a) => a.merchant),
    [],
  );

  /**
   * One entry point for the command bar and the quick starts alike. Both are
   * only ways of filling this form in, so both go through the same setter and
   * leave the reader looking at an editable rule rather than a result they
   * cannot inspect.
   */
  const fillFrom = (parsed) => {
    if (parsed.mode) setMode(parsed.mode);
    if (parsed.merchantIds?.length) setPicked(parsed.merchantIds);
    if (parsed.criteria?.length) {
      setCriteria(parsed.criteria.map((c) => ({ ...c, value: String(c.value) })));
      // Show the criteria type that actually owns the parsed fields.
      const owning = CRITERIA_TYPES.find((t) => parsed.criteria.some((c) => t.fields.includes(c.field)));
      if (owning) setCriteriaType(owning.id);
    }
    if (parsed.criteriaType) setCriteriaType(parsed.criteriaType);
    if (parsed.category) setCategory(parsed.category);
    if (parsed.goalId) setGoalId(parsed.goalId);
    if (parsed.solution) setSolution(parsed.solution);
    if (parsed.action && bulkActionFor(parsed.action)) setActionId(parsed.action);
    if (parsed.pricing?.basis === 'bps') {
      setValues((v) => ({ ...v, rate: String(parsed.pricing.bps) }));
    }
    setSelected(new Set());
  };

  /* Step 2 names the merchants you care about; the filters in step 3 trim
     them. Kept as two passes so the form can report how much the filters
     actually removed — "412 matched, filters removed 88" is information, a
     single final count is not. */
  const preFiltered = useMemo(() => (mode === 'merchant'
    ? MERCHANTS.filter((m) => picked.includes(m.id))
    : matchMerchants(MERCHANTS, criteria, 'all', ctx)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [mode, picked, criteria]);

  const subjects = useMemo(
    () => (filters.length ? matchMerchants(preFiltered, filters, 'all', ctx) : preFiltered),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preFiltered, filters],
  );

  const preFilterCount = preFiltered.length;

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
      return shapeAnswer(goal.answer({ subjects, values: effective, ctx }), solution);
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, subjects, effective, solution]);

  const chosen = useMemo(
    () => (selected.size ? (answer?.rows ?? []).filter((r) => selected.has(r.merchant.id)) : (answer?.rows ?? [])),
    [answer, selected],
  );

  /* A segment can name more merchants than anyone will ever scroll, so the
     table shows a sample and says so. The figures above it are computed over
     the whole match, never over the sample. */
  const ROW_SAMPLE = 50;
  const rows = answer?.rows ?? [];
  const sampled = rows.slice(0, ROW_SAMPLE);
  const truncated = rows.length > ROW_SAMPLE;

  /* A question about risk prices nothing, so its revenue and net columns are
     a wall of $0 — three columns of noise. They appear only when the answer
     actually carries a price. */
  const priced = Boolean(answer?.apply);

  /** The config the chosen action will run with. */
  const actionConfig = useMemo(() => {
    if (actionId === 'indemnify') return answer?.apply ?? { basis: 'bps', bps: 25, fee: 0.04 };
    if (actionId === 'assign') return { owner };
    return {};
  }, [actionId, answer, owner]);

  const resultColumns = [
    {
      key: 'name', header: 'Merchant', fw: 13,
      cell: (r) => (
        <div className="stack stack--xtight">
          <span className="row row--xtight row--nowrap" style={{ minWidth: 0 }}>
            <TruncatedText value={r.merchant.name} className="small strong" />
            {flagsFor(r.merchant.id).watchlist && <Icon name="eye" size={11} className="subtle" />}
            {flagsFor(r.merchant.id).review && <Icon name="searchCheck" size={11} style={{ color: 'var(--c-warning)' }} />}
          </span>
          <span className="micro subtle">{r.merchant.groupLabel} · {r.merchant.riskTier} risk</span>
        </div>
      ),
    },
    { key: 'volume', header: 'Volume', fw: 7, align: 'right', cell: (r) => <span className="mono small">{formatCompactCurrency(r.merchant.projectedVolume)}</span> },
    { key: 'ratio', header: 'CB ratio', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatPercent(r.merchant.chargebackRatio, 2)}</span> },
    ...(priced
      ? [{ key: 'revenue', header: 'Revenue', fw: 7, align: 'right', cell: (r) => <span className="mono small strong">{formatCompactCurrency(r.revenue)}</span> }]
      : []),
    { key: 'loss', header: 'Expected loss', fw: 7, align: 'right', cell: (r) => <span className="mono small">{formatCompactCurrency(r.loss)}</span> },
    ...(priced
      ? [{
        key: 'net', header: 'Net', fw: 7, align: 'right',
        cell: (r) => (
          <span className="mono small strong" style={{ color: r.net >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
            {r.net >= 0 ? '+' : '−'}{formatCompactCurrency(Math.abs(r.net))}
          </span>
        ),
      }]
      : [{ key: 'exposure', header: 'Open exposure', fw: 7, align: 'right', cell: (r) => <span className="mono small">{formatCompactCurrency(r.merchant.exposure ?? 0)}</span> }]),
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

  const commit = () => {
    setConfirming(false);
    if (!chosen.length) return;

    if (standing && !action.readOnly) {
      addStandingRule({
        name: title,
        action: actionId,
        config: actionConfig,
        criteria: mode === 'criteria' ? [...criteria, ...filters] : [...filters],
      });
    }

    const message = action.run(chosen.map((r) => r.merchant), actionConfig);

    // Read-only actions change nothing, so they do not belong in the record of
    // decisions taken — an export is not a decision.
    if (!action.readOnly) {
      saveSuggestion({
        title,
        category,
        mode,
        summary: `${action.label} · ${chosen.length} merchant${chosen.length === 1 ? '' : 's'}${standing ? ' · left standing' : ''}`,
        merchantCount: chosen.length,
        status: 'applied',
        actionedAt: new Date().toISOString(),
        actionNote: standing ? 'Applied, and left as a standing rule.' : 'Applied from Create.',
      });
    }

    notify(standing && !action.readOnly ? `${message} Rule left standing.` : message, 'success');
    if (!action.readOnly) onSaved?.();
  };

  return (
    <div className="stack">
      {/* ---------------- Entry points ---------------- *
          One choice, then one control. Showing the command bar, its six
          examples and four quick-start buttons all at once read as a list of
          things you had to do rather than three alternatives, only one of
          which anyone needs. Nothing is revealed until a route is picked. */}
      <Card bodyClassName="card__body--tight">
        <div className="stack stack--tight">
          <span className="t-section-label">How do you want to start?</span>

          <div className="starters">
            {STARTERS.map((st) => (
              <button
                key={st.id}
                type="button"
                className={`ask-mode ${starter === st.id ? 'is-active' : ''}`.trim()}
                onClick={() => setStarter(starter === st.id ? null : st.id)}
              >
                <Icon name={st.icon} size={15} />
                <span className="ask-mode__label">{st.label}</span>
                <span className="ask-mode__hint">{st.hint}</span>
              </button>
            ))}
          </div>

          {starter === 'describe' && <CommandBar onParsed={fillFrom} />}

          {starter === 'quick' && (
            <div className="quickstarts">
              {QUICK_STARTS.map((qs) => (
                <button key={qs.id} type="button" className="quickstart" onClick={() => fillFrom(qs.fill)}>
                  <Icon name={qs.icon} size={14} />
                  <span className="stack stack--xtight" style={{ minWidth: 0 }}>
                    <span className="quickstart__label">{qs.label}</span>
                    <span className="quickstart__hint">{qs.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {starter === 'manual' && (
            <p className="micro subtle" style={{ margin: 0 }}>
              Work down the questions below — the answer appears on the right as you go.
            </p>
          )}
        </div>
      </Card>

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
                title={mode === 'merchant' ? 'Which merchants or merchant types?' : 'Criteria type'}
                hint={mode === 'merchant' ? 'Search by name or take a whole type' : 'What kind of criteria?'}
                done={subjects.length > 0}
                active={Boolean(category)}
              >
                {mode === 'merchant' ? (
                  <MerchantSearch
                    merchants={MERCHANTS}
                    groups={MERCHANT_GROUPS}
                    selected={picked}
                    onChange={setPicked}
                    suggestions={mostActive}
                  />
                ) : (
                  <div className="stack stack--tight">
                    <div className="ask-chips">
                      {CRITERIA_TYPES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`ask-chip ${criteriaType === t.id ? 'is-active' : ''}`.trim()}
                          onClick={() => {
                            setCriteriaType(t.id);
                            const first = fieldsForType(t.id)[0];
                            setCriteria([{
                              field: first.key,
                              operator: operatorsFor(first.kind)[0].value,
                              value: first.kind === 'select' ? first.options[0] : '',
                            }]);
                          }}
                        >
                          <Icon name={t.icon} size={13} />
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="micro subtle" style={{ margin: 0 }}>{criteriaTypeFor(criteriaType)?.hint}</p>

                    {criteria.map((c, i) => (
                      <CriterionRow
                        key={i}
                        criterion={c}
                        fields={fieldsForType(criteriaType)}
                        canRemove={criteria.length > 1}
                        onChange={(next) => setCriteria((p) => p.map((x, j) => (j === i ? next : x)))}
                        onRemove={() => setCriteria((p) => p.filter((_, j) => j !== i))}
                      />
                    ))}
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="plus"
                      onClick={() => {
                        const first = fieldsForType(criteriaType)[0];
                        setCriteria((p) => [...p, {
                          field: first.key,
                          operator: operatorsFor(first.kind)[0].value,
                          value: first.kind === 'select' ? first.options[0] : '',
                        }]);
                      }}
                    >
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
                title="Narrow it down"
                hint="Optional"
                done={filters.length > 0}
                active={subjects.length > 0 || filters.length > 0}
              >
                <div className="stack stack--tight">
                  {filters.map((c, i) => (
                    <CriterionRow
                      key={i}
                      criterion={c}
                      fields={CRITERIA_FIELDS}
                      canRemove
                      onChange={(next) => setFilters((p) => p.map((x, j) => (j === i ? next : x)))}
                      onRemove={() => setFilters((p) => p.filter((_, j) => j !== i))}
                    />
                  ))}
                  <Button variant="secondary" size="sm" icon="filter" onClick={() => setFilters((p) => [...p, blankCriterion()])}>
                    Add a filter
                  </Button>
                  {filters.length > 0 && preFilterCount !== subjects.length && (
                    <p className="micro subtle" style={{ margin: 0 }}>
                      Filters removed {formatNumber(preFilterCount - subjects.length)} of {formatNumber(preFilterCount)}.
                    </p>
                  )}
                </div>
              </Step>

              <Step
                index={4}
                title="What do you want to know?"
                hint="Your question"
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

              <Step
                index={5}
                title="What kind of answer?"
                hint="Solution type"
                done={Boolean(goal)}
                active={Boolean(goal)}
              >
                <div className="stack stack--xtight">
                  {SOLUTION_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`ask-goal ${solution === t.id ? 'is-active' : ''}`.trim()}
                      onClick={() => setSolution(t.id)}
                    >
                      <span className="ask-goal__label">{t.label}</span>
                      <span className="ask-goal__blurb">{t.hint}</span>
                    </button>
                  ))}
                </div>
              </Step>

              {Boolean(goal?.inputs?.length) && (
                <Step index={6} title="Set the numbers" done active>
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
                hint="Type what you want at the top, pick a start, or work down the questions. Nothing needs saving — the impact appears here as you go."
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
                title={`Who this affects — ${formatNumber(rows.length)} merchant${rows.length === 1 ? '' : 's'}`}
                action={
                  <span className="micro subtle">
                    {selected.size ? `${formatNumber(selected.size)} picked out` : 'Everything matched — tick rows to narrow'}
                  </span>
                }
                bodyClassName="card__body--flush"
              >
                <DataTable
                  columns={resultColumns}
                  rows={sampled}
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
                {truncated && (
                  <p className="msearch__note" style={{ borderTop: '1px solid var(--c-line)' }}>
                    Showing the first {ROW_SAMPLE} of {formatNumber(rows.length)}. The figures above are calculated
                    across all {formatNumber(rows.length)}, not this sample — narrow the segment to see fewer.
                  </p>
                )}
              </Card>

              {/* Pinned to the bottom of the answer column: what to do, whether
                  it keeps happening, and the two commits. */}
              <Card bodyClassName="card__body--tight" className="ask__actions">
                <div className="actionbar">
                  <div className="actionbar__what">
                    <SelectField
                      aria-label="What to do"
                      value={actionId}
                      onChange={(e) => setActionId(e.target.value)}
                      options={BULK_ACTIONS.map((a) => ({ value: a.id, label: a.label }))}
                    />
                    {action.needsOwner && (
                      <SelectField
                        aria-label="Owner"
                        value={owner}
                        onChange={(e) => setOwner(e.target.value)}
                        options={ASSIGNABLE.map((u) => ({ value: u.email, label: u.name }))}
                      />
                    )}
                  </div>

                  {!action.readOnly && (
                    <label className="actionbar__standing">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={standing}
                        onChange={(e) => setStanding(e.target.checked)}
                      />
                      <span className="stack stack--xtight">
                        <span className="small">Keep applying</span>
                        <span className="micro subtle">Leave it standing for anything that qualifies later</span>
                      </span>
                    </label>
                  )}

                  <div className="actionbar__go">
                    <Button variant="secondary" icon="archive" onClick={save}>Save</Button>
                    <Button
                      variant="primary"
                      icon={action.readOnly ? 'download' : 'check'}
                      disabled={!chosen.length}
                      onClick={() => (action.readOnly ? commit() : setConfirming(true))}
                    >
                      {action.verb} {formatNumber(chosen.length)}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* A rule can rewrite a commercial term on more merchants than anyone can
          check by eye, and there is no undo. The confirmation states the blast
          radius in the units that matter before anything is written. */}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={action.label}
        subtitle={standing ? 'Applied now, and left standing' : 'Applied once'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={commit}>
              {action.verb} {formatNumber(chosen.length)} merchant{chosen.length === 1 ? '' : 's'}
            </Button>
          </>
        )}
      >
        <div className="stack">
          <p className="small" style={{ margin: 0 }}>
            {action.describe(chosen.length, actionConfig)} It takes effect immediately across the console and
            there is no undo.
            {standing && ' The rule is also left standing, and will report anything that qualifies later.'}
          </p>

          <div className="projection">
            <div className="projection__cell">
              <span className="projection__label">Merchants</span>
              <span className="projection__value">{formatNumber(chosen.length)}</span>
              <span className="projection__note">
                {selected.size ? 'the rows you picked out' : 'everything matched'}
              </span>
            </div>
            <div className="projection__cell">
              <span className="projection__label">Volume affected</span>
              <span className="projection__value">
                {formatCompactCurrency(chosen.reduce((t, r) => t + (r.merchant.projectedVolume ?? 0), 0))}
              </span>
              <span className="projection__note">annual processed value</span>
            </div>
            <div className="projection__cell">
              <span className="projection__label">Revenue</span>
              <span className="projection__value">
                {actionId === 'indemnify' ? formatCompactCurrency(chosen.reduce((t, r) => t + r.revenue, 0)) : '—'}
              </span>
              <span className="projection__note">
                {actionId === 'indemnify' ? 'per year, at this rate' : 'unchanged by this action'}
              </span>
            </div>
            <div className="projection__cell projection__cell--result">
              <span className="projection__label">Liability taken on</span>
              <span className="projection__value" style={{ color: actionId === 'indemnify' ? 'var(--c-danger)' : undefined }}>
                {actionId === 'indemnify' ? formatCompactCurrency(chosen.reduce((t, r) => t + r.loss, 0)) : '—'}
              </span>
              <span className="projection__note">
                {actionId === 'indemnify' ? 'expected annual loss' : 'unchanged by this action'}
              </span>
            </div>
          </div>

          <div className="stack stack--xtight" style={{ maxHeight: 180, overflowY: 'auto' }}>
            {chosen.slice(0, 12).map((r) => (
              <div key={r.merchant.id} className="row row--between row--nowrap">
                <span className="small truncate">{r.merchant.name}</span>
                <span className="mono micro subtle">{formatCompactCurrency(r.merchant.projectedVolume)}</span>
              </div>
            ))}
            {chosen.length > 12 && (
              <span className="micro subtle">and {formatNumber(chosen.length - 12)} more.</span>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default CreateTab;
