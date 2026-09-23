import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Badge, Button, IconButton, Tabs, EmptyState } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { SelectField, TextField } from '@/components/ui/Form';
import { Tooltip, TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { MERCHANTS } from '@/data/portfolio';
import { BASES, DEFAULT_BPS, DEFAULT_FEE, applyIndemnification, settingsFor } from '@/data/indemnification';
import useIndemnification from '@/hooks/useIndemnification';
import {
  CRITERIA_FIELDS, SUGGESTIONS, breakEvenBps, fieldFor, matchMerchants,
  operatorsFor, projectPortfolio,
} from '@/domain/revenue';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from '@/utils/format';

/**
 * REVENUE RULES
 *
 * "Show me every merchant that looks like this, and tell me what indemnifying
 * them would be worth." Two ways in:
 *
 *   Suggestions — five questions an account owner actually asks, each answered
 *   from the live portfolio with the merchants behind the answer attached.
 *   Any of them can be opened in the builder to be adjusted.
 *
 *   Rule builder — criteria, a price, and a live valuation of whatever matches.
 *   Apply writes the arrangement to every matching merchant at once, through
 *   the same store the merchant record edits, so the two can never disagree.
 *
 * Every figure here is computed in domain/revenue.js from the same portfolio
 * the rest of the console reads. The valuation is explained on the page rather
 * than presented as an oracle — see the method note at the foot.
 */

const TABS = [
  { value: 'suggestions', label: 'Suggestions' },
  { value: 'builder', label: 'Rule builder' },
];

const blankCriterion = () => ({ field: 'chargebackRatio', operator: 'lt', value: '0.65' });

/** Shared money/number formatters handed to the suggestion headlines. */
const FMT = { money: formatCompactCurrency, number: formatNumber };

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
          placeholder={field?.unit === '$' ? 'e.g. 20000000' : 'e.g. 0.65'}
          onChange={(e) => onChange({ ...criterion, value: e.target.value })}
        />
      )}

      <IconButton
        icon="trash"
        label="Remove criterion"
        tone="danger"
        size={13}
        disabled={!canRemove}
        onClick={onRemove}
      />
    </div>
  );
}

/** The results table, shared by both tabs. */
function ResultTable({ rows, showCurrentPrice }) {
  const columns = [
    {
      key: 'name', header: 'Merchant', fw: 14,
      cell: (r) => (
        <div className="stack stack--xtight">
          <TruncatedText value={r.merchant.name} className="small strong" />
          <span className="micro subtle">{r.merchant.groupLabel} · {r.merchant.riskTier} risk</span>
        </div>
      ),
    },
    { key: 'volume', header: 'Annual volume', fw: 8, align: 'right', cell: (r) => <span className="mono small">{formatCompactCurrency(r.merchant.projectedVolume)}</span> },
    { key: 'ratio', header: 'CB ratio', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatPercent(r.merchant.chargebackRatio, 2)}</span> },
    ...(showCurrentPrice
      ? [{ key: 'current', header: 'Priced at', fw: 6, align: 'right', cell: (r) => <span className="mono small">{settingsFor(r.merchant.id).basis === 'bps' ? `${settingsFor(r.merchant.id).bps} bps` : `${formatCurrency(settingsFor(r.merchant.id).fee)} / txn`}</span> }]
      : []),
    { key: 'revenue', header: 'Revenue', fw: 8, align: 'right', cell: (r) => <span className="mono small strong">{formatCompactCurrency(r.revenue)}</span> },
    { key: 'loss', header: 'Expected loss', fw: 8, align: 'right', cell: (r) => <span className="mono small">{formatCompactCurrency(r.loss)}</span> },
    {
      key: 'net', header: 'Net', fw: 8, align: 'right',
      cell: (r) => (
        <span className="mono small strong" style={{ color: r.net >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
          {r.net >= 0 ? '+' : '−'}{formatCompactCurrency(Math.abs(r.net))}
        </span>
      ),
    },
  ];

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.merchant.id} density="comfortable" />;
}

function MethodNote() {
  return (
    <Card bodyClassName="card__body--tight">
      <div className="row row--xtight row--nowrap" style={{ alignItems: 'flex-start' }}>
        <Icon name="info" size={13} style={{ marginTop: 2, color: 'var(--c-ink-subtle)', flex: 'none' }} />
        <p className="micro subtle" style={{ margin: 0 }}>
          <strong>How these are worked out.</strong> Expected loss is the disputed value we do not win back:
          annual volume × chargeback ratio × (1 − win rate). Revenue uses the same calculation as the
          merchant record — basis points of volume, or a flat fee on every transaction. Net is revenue
          minus expected loss. These are estimates from the current book, not a forecast.
        </p>
      </div>
    </Card>
  );
}

export function RevenueRules() {
  const { notify } = useToast();
  const { routes } = usePerspective();
  const navigate = useNavigate();

  // Subscribing keeps every figure in step with edits made on a merchant
  // record, and makes Apply below re-run the maths immediately.
  useIndemnification();
  const ctx = { settingsFor };

  const [tab, setTab] = useState('suggestions');
  const [criteria, setCriteria] = useState([blankCriterion()]);
  const [mode, setMode] = useState('all');
  const [basis, setBasis] = useState('bps');
  const [bps, setBps] = useState(String(DEFAULT_BPS));
  const [fee, setFee] = useState(String(DEFAULT_FEE));

  const pricing = {
    basis,
    bps: Number(bps) || 0,
    fee: Number(fee) || 0,
  };

  const matched = useMemo(
    () => matchMerchants(MERCHANTS, criteria, mode, ctx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [criteria, mode],
  );

  const projection = useMemo(() => projectPortfolio(matched, pricing), [matched, basis, bps, fee]);
  const breakEven = useMemo(() => breakEvenBps(matched), [matched]);

  const answers = useMemo(
    () => SUGGESTIONS.map((s) => ({ suggestion: s, result: s.run(MERCHANTS, ctx) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const openInBuilder = (result) => {
    setCriteria(result.criteria.map((c) => ({ ...c, value: String(c.value) })));
    setMode(result.mode ?? 'all');
    if (result.pricing) {
      setBasis(result.pricing.basis);
      if (result.pricing.bps != null) setBps(String(result.pricing.bps));
      if (result.pricing.fee != null) setFee(String(result.pricing.fee));
    }
    setTab('builder');
  };

  const applyToMatched = () => {
    if (!matched.length) return;
    matched.forEach((m) => applyIndemnification(m.id, { enabled: true, ...pricing }));
    notify(
      `Indemnification applied to ${formatNumber(matched.length)} merchant${matched.length === 1 ? '' : 's'}.`,
      'success',
    );
  };

  return (
    <>
      <PageHeader
        title="Revenue rules"
        description="Ask what the book could be worth, or build the rule yourself — then apply it to every merchant that matches."
      />

      <div className="stack">
        <Card bodyClassName="card__body--flush">
          <div style={{ padding: '0 var(--s-4)' }}>
            <Tabs tabs={TABS} value={tab} onChange={setTab} />
          </div>
        </Card>

        {tab === 'suggestions' && (
          <div className="stack">
            {answers.map(({ suggestion, result }) => (
              <Card
                key={suggestion.id}
                title={suggestion.question}
                action={
                  <Button variant="secondary" size="sm" icon="edit" onClick={() => openInBuilder(result)}>
                    Open in builder
                  </Button>
                }
              >
                <div className="stack">
                  <div className="row row--between row--nowrap" style={{ alignItems: 'flex-start', gap: 'var(--s-4)' }}>
                    <div className="row row--tight row--nowrap" style={{ alignItems: 'center' }}>
                      <span className="suggestion__icon"><Icon name={suggestion.icon} size={17} /></span>
                      <div className="stack stack--xtight">
                        <span className="suggestion__headline">{result.headline(FMT)}</span>
                        <span className="micro subtle">{suggestion.intent}</span>
                      </div>
                    </div>
                    <Badge tone={result.rows.length ? 'primary' : 'muted'}>
                      {formatNumber(result.rows.length)} merchant{result.rows.length === 1 ? '' : 's'}
                    </Badge>
                  </div>

                  <p className="small muted" style={{ margin: 0 }}>{result.because}</p>

                  {result.rows.length ? (
                    <ResultTable rows={result.rows.slice(0, 5)} showCurrentPrice={!result.pricing} />
                  ) : (
                    <EmptyState
                      icon="check"
                      title="Nothing matches right now"
                      hint="Good news — there is no action to take on this one against the current book."
                    />
                  )}

                  {result.rows.length > 5 && (
                    <span className="micro subtle">
                      Showing the top 5 of {formatNumber(result.rows.length)}. Open in builder for the full list.
                    </span>
                  )}
                </div>
              </Card>
            ))}

            <MethodNote />
          </div>
        )}

        {tab === 'builder' && (
          <div className="stack">
            <Card
              title="Match merchants where"
              action={
                <SelectField
                  aria-label="Match mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  options={[
                    { value: 'all', label: 'All criteria match' },
                    { value: 'any', label: 'Any criterion matches' },
                  ]}
                />
              }
            >
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

                <div className="row row--tight">
                  <Button variant="secondary" size="sm" icon="plus" onClick={() => setCriteria((p) => [...p, blankCriterion()])}>
                    Add criterion
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setCriteria([blankCriterion()])}>
                    Reset
                  </Button>
                </div>
              </div>
            </Card>

            <Card title="Price it">
              <div className="stack">
                <div className="grid grid--2">
                  <SelectField
                    label="Charge basis"
                    value={basis}
                    onChange={(e) => setBasis(e.target.value)}
                    options={BASES.map((b) => ({ value: b.id, label: b.label }))}
                  />
                  {basis === 'bps' ? (
                    <TextField
                      label="Basis points"
                      type="number"
                      step="1"
                      value={bps}
                      onChange={(e) => setBps(e.target.value)}
                      hint={`Break-even on this selection is ${breakEven.toFixed(1)} bps.`}
                    />
                  ) : (
                    <TextField
                      label="Fee per transaction"
                      type="number"
                      step="0.01"
                      value={fee}
                      onChange={(e) => setFee(e.target.value)}
                      hint="Charged on every transaction processed, not per dispute."
                    />
                  )}
                </div>

                {basis === 'bps' && Number(bps) < breakEven && matched.length > 0 && (
                  <div className="row row--xtight row--nowrap" style={{ color: 'var(--c-danger)' }}>
                    <Icon name="alert" size={13} />
                    <span className="small">
                      {bps} bps is below the {breakEven.toFixed(1)} bps needed to cover expected losses on this selection.
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Deliberately NOT the KPI strip. These four numbers are the
                output of the calculation above them, not a measure with a
                history — there is no trend line to draw under a scenario, and
                a KPI card with an empty chart band would be the only bare one
                on the site. They get their own presentation instead. */}
            <Card title="If you applied this rule" bodyClassName="card__body--tight">
              <div className="projection">
                <div className="projection__cell">
                  <span className="projection__label">Merchants matched</span>
                  <span className="projection__value">{formatNumber(projection.count)}</span>
                  <span className="projection__note">of {formatNumber(MERCHANTS.length)} in the portfolio</span>
                </div>
                <div className="projection__cell">
                  <span className="projection__label">Annual revenue</span>
                  <span className="projection__value">{formatCompactCurrency(projection.revenue)}</span>
                  <span className="projection__note">on {formatCompactCurrency(projection.volume)} of volume</span>
                </div>
                <div className="projection__cell">
                  <span className="projection__label">Expected loss</span>
                  <span className="projection__value">{formatCompactCurrency(projection.loss)}</span>
                  <span className="projection__note">chargebacks we would absorb</span>
                </div>
                <div className="projection__cell projection__cell--result">
                  <span className="projection__label">Net</span>
                  <span
                    className="projection__value"
                    style={{ color: projection.net >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}
                  >
                    {projection.net >= 0 ? '+' : '−'}{formatCompactCurrency(Math.abs(projection.net))}
                  </span>
                  <span className="projection__note">
                    {projection.net >= 0 ? 'revenue exceeds expected loss' : 'expected loss exceeds revenue'}
                  </span>
                </div>
              </div>
            </Card>

            <Card
              title={`${formatNumber(projection.count)} merchant${projection.count === 1 ? '' : 's'} match`}
              action={
                <div className="row row--tight row--nowrap">
                  <Button variant="secondary" size="sm" icon="briefcase" onClick={() => navigate(routes.portfolioMerchants)}>
                    Open portfolio
                  </Button>
                  <Tooltip label="Switches indemnification on for every matching merchant at this price. Nothing is saved to a server — it is a demo.">
                    <Button variant="primary" size="sm" icon="check" disabled={!projection.count} onClick={applyToMatched}>
                      Apply to {formatNumber(projection.count)}
                    </Button>
                  </Tooltip>
                </div>
              }
              bodyClassName="card__body--flush"
            >
              {projection.count ? (
                <ResultTable rows={[...projection.rows].sort((a, b) => b.net - a.net)} />
              ) : (
                <EmptyState
                  icon="search"
                  title="Nothing matches"
                  hint="Loosen a criterion, or switch the match mode to 'any'."
                />
              )}
            </Card>

            <MethodNote />
          </div>
        )}
      </div>
    </>
  );
}

export default RevenueRules;
