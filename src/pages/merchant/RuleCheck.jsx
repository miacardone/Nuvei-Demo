import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, Button, Badge, EmptyState } from '@/components/ui/Surface';
import { SelectField, TextField } from '@/components/ui/Form';
import { Donut } from '@/components/charts/Charts';
import Icon from '@/components/ui/Icon';
import { RULES } from '@/data/rules';
import { CASES } from '@/data/cases';
import { CRITERIA_CATEGORIES, checkCase, describeCriterion, getCategory, getRuleAction, optionLabel } from '@/domain/criteria';
import { usePerspective } from '@/hooks/usePerspective';
import { formatCurrency } from '@/utils/format';

/**
 * Rule check — renamed from the reference's "Criteria check", because it
 * checks a RULE, not a criterion. The old name sent people looking for a
 * criteria editor.
 *
 * The value is entirely in the per-criterion breakdown: "5 of 6 matched" plus
 * which one failed turns "why didn't my rule fire?" into a one-line answer.
 */

const VERDICT = {
  full: { label: 'Full', tone: 'success', copy: 'Every criterion matched — this rule would fire on this case.' },
  partial: { label: 'Partial', tone: 'warning', copy: 'Some criteria matched, so the rule did not fire.' },
  none: { label: 'No match', tone: 'danger', copy: 'None of the criteria matched this case.' },
};

export function RuleCheck() {
  const { routes } = usePerspective();
  const [ruleId, setRuleId] = useState('');
  const [caseRef, setCaseRef] = useState('');
  const [extraKey, setExtraKey] = useState('');
  const [extraOperator, setExtraOperator] = useState('');
  const [extraValue, setExtraValue] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const rule = RULES.find((r) => r.id === ruleId);
  const extraCategory = extraKey ? getCategory(extraKey) : null;

  const run = () => {
    setError(null);
    setResult(null);

    const ref = caseRef.trim().toUpperCase();
    const found = CASES.find((c) => c.id.toUpperCase() === ref || c.arn === caseRef.trim());
    if (!found) { setError(`No case found for “${caseRef.trim()}”.`); return; }
    if (!rule) { setError('Select a rule first.'); return; }

    const criteria = [...rule.criteria];
    if (extraKey && extraValue) {
      criteria.push(
        extraCategory.type === 'chips'
          ? { key: extraKey, values: [extraValue] }
          : { key: extraKey, operator: extraOperator || extraCategory.operators[0], value: extraValue },
      );
    }

    setResult({ rule, caseRecord: found, ...checkCase(found, criteria, 'all') });
  };

  const reset = () => { setRuleId(''); setCaseRef(''); setExtraKey(''); setExtraValue(''); setResult(null); setError(null); };

  const verdict = result ? VERDICT[result.verdict] : null;

  return (
    <>
      <PageHeader
        title="Rule check"
        description="Test one rule against one case and see which criteria passed. Use it when a rule did not fire and you need to know why."
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="stack stack--tight">
          <Card title="Rules" bodyClassName="card__body--flush">
            <div className="hairlines" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {RULES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="row row--between row--nowrap"
                  style={{
                    width: '100%', border: 0, textAlign: 'left', cursor: 'pointer',
                    padding: 'var(--s-2) var(--s-3)',
                    background: r.id === ruleId ? 'var(--c-primary-wash)' : 'transparent',
                  }}
                  onClick={() => { setRuleId(r.id); setResult(null); }}
                >
                  <span className="stack stack--xtight" style={{ minWidth: 0 }}>
                    <span className="small strong truncate">{r.name}</span>
                    <span className="micro subtle">{r.criteria.length} criteria</span>
                  </span>
                  {!r.enabled && <Badge tone="muted">Off</Badge>}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {!ruleId ? (
          <Card>
            <EmptyState icon="searchCheck" title="No rule selected" hint="Choose a rule from the list to test it against a case." />
          </Card>
        ) : (
          <div className="stack stack--tight">
            <Card title={rule.name}>
              <div className="stack stack--tight">
                <p className="small muted">{rule.description}</p>

                <div className="grid grid--2">
                  <SelectField
                    label="Additional criterion (optional)"
                    value={extraKey}
                    onChange={(e) => { setExtraKey(e.target.value); setExtraValue(''); }}
                    placeholder="None"
                    options={CRITERIA_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
                  />

                  {extraCategory?.type === 'operator' && (
                    <SelectField
                      label="Operator"
                      value={extraOperator || extraCategory.operators[0]}
                      onChange={(e) => setExtraOperator(e.target.value)}
                      options={extraCategory.operators.map((o) => ({ value: o, label: o }))}
                    />
                  )}

                  {extraCategory && (
                    extraCategory.type === 'chips' ? (
                      <SelectField
                        label="Value"
                        value={extraValue}
                        onChange={(e) => setExtraValue(e.target.value)}
                        placeholder="Select…"
                        options={extraCategory.options().map((o) => ({ value: o.value, label: o.label }))}
                      />
                    ) : (
                      <TextField label="Value" value={extraValue} onChange={(e) => setExtraValue(e.target.value)} placeholder={extraCategory.placeholder} />
                    )
                  )}

                  <TextField
                    label="Case (ARN or Case ID)"
                    required
                    value={caseRef}
                    onChange={(e) => setCaseRef(e.target.value)}
                    placeholder={CASES[7].id}
                    error={error ?? undefined}
                  />
                </div>

                <div className="row row--tight">
                  <Button variant="primary" icon="play" disabled={!caseRef.trim()} onClick={run}>Run</Button>
                  <Button variant="secondary" onClick={reset}>Reset</Button>
                </div>
              </div>
            </Card>

            {result && (
              <Card
                title="Result"
                action={<Badge tone={verdict.tone}>{verdict.label}</Badge>}
              >
                <div className="stack">
                  <div className="row" style={{ gap: 'var(--s-6)', alignItems: 'center' }}>
                    <Donut
                      size={150}
                      thickness={20}
                      legend={false}
                      centerValue={`${result.passedCount}/${result.total}`}
                      centerLabel="criteria"
                      data={[
                        { label: 'Matched', value: result.passedCount, color: 'var(--c-success)' },
                        { label: 'Not matched', value: result.total - result.passedCount, color: 'var(--c-danger)' },
                      ]}
                    />
                    <div className="stack stack--tight" style={{ flex: 1, minWidth: 200 }}>
                      <span className="strong">
                        {result.passedCount} of {result.total} criteria matched — case {result.caseRecord.id}
                      </span>
                      <span className="small muted">{verdict.copy}</span>
                      <span className="micro subtle">
                        {result.caseRecord.reasonCode} · {result.caseRecord.reasonLabel} ·{' '}
                        {formatCurrency(result.caseRecord.disputeAmount, result.caseRecord.currency)}
                      </span>
                      {!rule.enabled && <Badge tone="warning">This rule is disabled — it would not run in production.</Badge>}
                      <Link to={routes.workCaseDetail(result.caseRecord.id)} className="small">Open case →</Link>
                    </div>
                  </div>

                  <div className="stack stack--tight">
                    <span className="t-section-label">Match breakdown</span>
                    {result.results.map((r, i) => (
                      <div
                        key={i}
                        className="row row--top row--nowrap"
                        style={{
                          gap: 'var(--s-2)', padding: 'var(--s-2) var(--s-3)',
                          border: '1px solid var(--c-line)', borderRadius: 'var(--r-md)',
                          borderLeft: `3px solid ${r.passed ? 'var(--c-success)' : 'var(--c-danger)'}`,
                        }}
                      >
                        <Icon name={r.passed ? 'check' : 'close'} size={14} style={{ color: r.passed ? 'var(--c-success)' : 'var(--c-danger)', marginTop: 2 }} />
                        <span style={{ minWidth: 0 }}>
                          <span className="small strong" style={{ display: 'block' }}>{r.description}</span>
                          <span className="micro subtle">
                            {r.label} on this case is <strong className="mono">{String(r.actual ?? '—')}</strong>
                          </span>
                        </span>
                        <span className="spacer" />
                        <Badge tone={r.passed ? 'success' : 'danger'}>{r.passed ? 'Pass' : 'Fail'}</Badge>
                      </div>
                    ))}
                  </div>

                  <div>
                    <span className="t-section-label">Action if matched</span>
                    <div className="row row--tight" style={{ marginTop: 4 }}>
                      {rule.actions.map((a) => (
                        <span key={a.key} className="chip">{getRuleAction(a.key)?.label}{a.value ? ` → ${a.value}` : ''}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default RuleCheck;
