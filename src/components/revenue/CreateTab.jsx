import { useMemo, useState } from 'react';
import { Card, Badge, Button, EmptyState } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { SelectField, TextField } from '@/components/ui/Form';
import { TruncatedText } from '@/components/ui/Overlay';
import MerchantSearch from '@/components/ui/MerchantSearch';
import { Modal } from '@/components/ui/Modal';
import Icon from '@/components/ui/Icon';
import { MERCHANTS } from '@/data/portfolio';
import { MERCHANT_GROUPS } from '@/data/merchants';
import { CASES } from '@/data/cases';
import { applyIndemnification, settingsFor } from '@/data/indemnification';
import { saveSuggestion } from '@/data/suggestions-store';
import {
  CATEGORIES, CRITERIA_FIELDS, CRITERIA_TYPES, SOLUTION_TYPES, activityIndex,
  categoryFor, criteriaTypeFor, fieldFor, fieldsForType, goalFor, goalsFor,
  matchMerchants, operatorsFor, shapeAnswer,
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

/**
 * Two ways to name a subject, and at real portfolio size they are not equal.
 * Picking merchants by name is for named accounts — a handful you already have
 * in mind. Describing them by their properties is how you address a book you
 * could never scroll, which is why it carries the segment framing.
 */
const MODES = [
  { id: 'merchant', label: 'Per merchant', icon: 'briefcase', hint: 'Pick specific merchants or merchant types.' },
  { id: 'criteria', label: 'Per criteria', icon: 'sliders', hint: 'Describe them — works at any size.' },
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

  const goal = goalFor(goalId);
  const goals = category ? goalsFor(category) : [];

  /* What the search offers before anyone types. On a real book this would be
     the accounts you touched most recently; here it is the busiest by case
     activity, which is the same idea and computed rather than hardcoded. */
  const mostActive = useMemo(
    () => activityIndex(MERCHANTS, CASES).slice(0, 6).map((a) => a.merchant),
    [],
  );

  /* Step 2 names the book you care about; the filters in step 3 trim it. Kept
     as two passes so the form can report how much the filters actually removed
     — "412 matched, filters removed 88" is information, a single final count
     is not. */
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
     the whole match, never over the sample — the two must not be confused,
     which is why the count is stated on the card rather than left implied. */
  const ROW_SAMPLE = 50;
  const rows = answer?.rows ?? [];
  const sampled = rows.slice(0, ROW_SAMPLE);
  const truncated = rows.length > ROW_SAMPLE;

  /* A question about risk prices nothing, so its revenue and net columns are
     a wall of $0 — three columns of noise that invite the reader to wonder
     what they did wrong. They appear only when the answer actually carries a
     price. */
  const priced = Boolean(answer?.apply);

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

  const applyNow = () => {
    setConfirming(false);
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

            {/* Filters narrow whatever step 2 produced. They are the same
                machinery as criteria but a separate question: step 2 names the
                book you care about, this trims it. Optional, and skipped
                entirely if nothing is added. */}
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

            {/* Pinned to the bottom of the answer column. It was the last card
                under a table that can run to fifty rows, which put the only
                two actions on the screen below the fold — the reader had to
                scroll past everything to find out they could do anything. */}
            <Card bodyClassName="card__body--tight" className="ask__actions">
              <div className="row row--between row--nowrap" style={{ flexWrap: 'wrap', gap: 'var(--s-3)' }}>
                <span className="micro subtle">
                  {formatNumber(chosen.length)} merchant{chosen.length === 1 ? '' : 's'} selected ·
                  {' '}nothing is saved until you choose
                </span>
                <div className="row row--tight row--nowrap">
                  <Button variant="secondary" icon="archive" onClick={save}>Save as suggestion</Button>
                  {answer.apply && (
                    <Button variant="primary" icon="check" disabled={!chosen.length} onClick={() => setConfirming(true)}>
                      {answer.applyLabel} to {formatNumber(chosen.length)}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* A segment rule can rewrite a commercial term on more merchants than
          anyone can check by eye, and there is no undo. The confirmation
          states the blast radius in the units that matter — how many accounts,
          how much volume, and what is being written — before it happens. */}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Apply to merchant records"
        subtitle={answer?.applyLabel ?? undefined}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={applyNow}>
              Apply to {formatNumber(chosen.length)} merchant{chosen.length === 1 ? '' : 's'}
            </Button>
          </>
        )}
      >
        <div className="stack">
          <p className="small" style={{ margin: 0 }}>
            This writes the arrangement to every merchant listed below. It takes effect immediately across the
            console and there is no undo.
          </p>

          <div className="projection">
            <div className="projection__cell">
              <span className="projection__label">Merchants</span>
              <span className="projection__value">{formatNumber(chosen.length)}</span>
              <span className="projection__note">
                {selected.size ? 'the rows you picked out' : 'everything the segment matched'}
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
                {formatCompactCurrency(chosen.reduce((t, r) => t + r.revenue, 0))}
              </span>
              <span className="projection__note">per year, at this rate</span>
            </div>
            <div className="projection__cell projection__cell--result">
              <span className="projection__label">Liability taken on</span>
              <span className="projection__value" style={{ color: 'var(--c-danger)' }}>
                {formatCompactCurrency(chosen.reduce((t, r) => t + r.loss, 0))}
              </span>
              <span className="projection__note">expected annual loss</span>
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
