import { useMemo, useState } from 'react';
import { Card, Badge, Button, EmptyState, Kpi, StatusIcon, SubTabs } from '@/components/ui/Surface';
import { BarRows, Donut } from '@/components/charts/Charts';
import { DataTable } from '@/components/ui/DataTable';
import { Tooltip, TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { MERCHANTS } from '@/data/portfolio';
import { CASES } from '@/data/cases';
import { settingsFor } from '@/data/indemnification';
import { STATUSES, markSuggestion } from '@/data/suggestions-store';
import { flagsFor } from '@/data/merchant-flags';
import { hasAlert } from '@/data/notifications-store';
import { markRuleRun, removeStandingRule, toggleStandingRule } from '@/data/standing-rules';
import { BULK_ACTIONS, bulkActionFor, ruleDrift } from '@/domain/bulk-actions';
import { CATEGORIES, SUGGESTIONS, activityByGroup, activityIndex, categoryFor, expectedAnnualLoss, matchMerchants } from '@/domain/revenue';
import { weeklySeries } from '@/domain/metrics';
import { useToast } from '@/context/ToastContext';
import { formatCompactCurrency, formatDate, formatNumber, formatPercent } from '@/utils/format';

/**
 * SUGGESTIONS — what the console thinks is worth looking at, before anyone
 * has asked it anything.
 *
 * Three bands, in the order a reader wants them:
 *   what to do        — the plays, filterable by category
 *   where to look     — the merchants and groups the site has been busiest on
 *   what we decided   — everything saved out of Create, and what happened to it
 *
 * "Busiest" is measured, not asserted: activityIndex() scores each merchant on
 * its last 30 days of case volume, disputed value, overdue count and analyst
 * time, each normalised against the busiest merchant in the book. A large
 * merchant nobody has touched scores zero, which is the point — this ranks
 * attention rather than size.
 */

const FMT = { money: formatCompactCurrency, number: formatNumber };

/** Which category each standing play belongs to, for the filter. */
const PLAY_CATEGORY = {
  'who-to-indemnify': 'indemnification',
  'increase-revenue': 'revenue',
  underpriced: 'indemnification',
  'over-exposed': 'risk',
  'chargebacks-vs-indemnification': 'chargebacks',
  'whole-book': 'revenue',
};

/** The question each category opens on when a play is sent into Create. */
const goalForCategory = (category) => ({
  risk: 'exposure',
  revenue: 'revenue-left',
  chargebacks: 'manage-vs-indemnify',
  operations: 'load',
}[category] ?? 'should-indemnify');

function ActivityBar({ score }) {
  return (
    <span className="activity-bar" aria-hidden>
      <span className="activity-bar__fill" style={{ width: `${Math.min(100, score)}%` }} />
    </span>
  );
}

const SUB_TABS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'suggestions', label: 'Suggestions' },
  { value: 'activity', label: 'Activity' },
  { value: 'current', label: 'Current' },
];

export function SuggestionsTab({ saved, standingRules = [], merchants = MERCHANTS, onOpenInCreate }) {
  const { notify } = useToast();
  const ctx = { settingsFor };
  const [filter, setFilter] = useState('all');
  const [sub, setSub] = useState('dashboard');

  const activity = useMemo(() => activityIndex(merchants, CASES), [merchants]);
  const groups = useMemo(() => activityByGroup(merchants, CASES), [merchants]);

  const plays = useMemo(
    () => SUGGESTIONS
      .map((s) => ({ suggestion: s, result: s.run(merchants, ctx), category: PLAY_CATEGORY[s.id] ?? 'revenue' }))
      .filter((p) => filter === 'all' || p.category === filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, merchants],
  );

  const merchantColumns = [
    {
      key: 'rank', header: '#', fw: 3, align: 'center',
      cell: (r) => <span className="mono micro subtle">{activity.indexOf(r) + 1}</span>,
    },
    {
      key: 'name', header: 'Merchant', fw: 12,
      cell: (r) => (
        <div className="stack stack--xtight">
          <TruncatedText value={r.merchant.name} className="small strong" />
          <span className="micro subtle">{r.merchant.groupLabel}</span>
        </div>
      ),
    },
    {
      key: 'score', header: 'Activity', fw: 9,
      cell: (r) => (
        <div className="row row--xtight row--nowrap">
          <ActivityBar score={r.score} />
          <span className="mono micro subtle">{r.score}</span>
        </div>
      ),
    },
    { key: 'cases', header: 'Cases, 30d', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatNumber(r.cases)}</span> },
    {
      key: 'overdue', header: 'Overdue', fw: 6, align: 'right',
      cell: (r) => (r.overdue ? <Badge tone="danger">{formatNumber(r.overdue)}</Badge> : <span className="mono small subtle">0</span>),
    },
    { key: 'value', header: 'Disputed value', fw: 8, align: 'right', cell: (r) => <span className="mono small">{formatCompactCurrency(r.value)}</span> },
    {
      key: 'indemnified', header: 'Covered', fw: 6, align: 'center',
      cell: (r) => (settingsFor(r.merchant.id).enabled
        ? <StatusIcon icon="check" tone="success" label="Indemnified" />
        : <StatusIcon icon="close" tone="muted" label="Not indemnified" />),
    },
    {
      key: 'actions', header: 'Actions', pinned: true, fw: 6, width: '120px', align: 'center',
      cell: (r) => (
        <Button
          variant="secondary"
          size="sm"
          icon="chart"
          onClick={() => onOpenInCreate({ mode: 'merchant', merchantIds: [r.merchant.id], category: 'indemnification', goalId: 'should-indemnify' })}
        >
          Ask
        </Button>
      ),
    },
  ];

  /* Headline numbers for the Dashboard, all from the scoped selection. */
  const overview = useMemo(() => {
    const covered = merchants.filter((m) => settingsFor(m.id).enabled);
    const uncovered = merchants.filter((m) => !settingsFor(m.id).enabled && m.status === 'Active');
    const atRisk = merchants.filter((m) => (m.chargebackRatio ?? 0) >= 0.65 || m.riskTier === 'High');
    return {
      covered: covered.length,
      uncovered,
      uncapturedRevenue: uncovered.reduce((t, m) => t + (m.projectedVolume ?? 0) * 0.0025, 0),
      carried: covered.reduce((t, m) => t + expectedAnnualLoss(m), 0),
      atRisk,
    };
  }, [merchants]);

  const topThree = plays.slice(0, 3);

  return (
    <div className="stack">
      <Card bodyClassName="card__body--flush">
        <div style={{ padding: '0 var(--s-4)' }}>
          <SubTabs tabs={SUB_TABS} value={sub} onChange={setSub} />
        </div>
      </Card>

      {/* ---------------- Dashboard ---------------- *
          The one-screen picture: where you stand, and the three things most
          worth doing about it. Everything here is a roll-up of the other three
          tabs rather than new information, so it is the right place to land. */}
      {sub === 'dashboard' && (
      <>
        <div className="kpi-row">
          <Kpi
            label="Not covered yet"
            value={formatNumber(overview.uncovered.length)}
            meta={`${formatCompactCurrency(overview.uncapturedRevenue)} a year if we sold them cover`}
            spark={weeklySeries(CASES, 12)}
          />
          <Kpi
            label="Chargebacks we carry"
            value={formatCompactCurrency(overview.carried)}
            meta={`Across the ${formatNumber(overview.covered)} we already cover`}
            invert
            spark={weeklySeries(CASES, 12, (c) => c.disputeAmount)}
          />
          <Kpi
            label="Needing attention"
            value={formatNumber(overview.atRisk.length)}
            meta="High risk, or disputing over 0.65%"
            invert
            spark={weeklySeries(CASES, 12, () => 1, (c) => overview.atRisk.some((m) => m.id === c.merchantId))}
          />
          <Kpi
            label="Merchants in scope"
            value={formatNumber(merchants.length)}
            meta={`${formatNumber(overview.covered)} covered, ${formatNumber(merchants.length - overview.covered)} not`}
            spark={weeklySeries(CASES, 12)}
          />
        </div>

        <div className="grid grid--2">
          <Card title="Who we cover today" description="Merchants whose chargebacks we have taken on, against those we have not." bodyClassName="card__body--chart card__body--pie-row">
            <Donut
              data={[
                { label: 'Covered', value: overview.covered },
                { label: 'Not covered', value: merchants.length - overview.covered, color: 'var(--c-series-1)' },
              ]}
              centerValue={formatNumber(merchants.length)}
              centerLabel="merchants"
              size={150}
            />
          </Card>

          <Card title="Busiest segments, last 30 days" description="Where disputes are actually being raised.">
            <BarRows
              rows={groups.map((g) => ({ label: g.label, value: g.cases, meta: formatCompactCurrency(g.value) }))}
            />
          </Card>
        </div>

        <span className="t-section-label">The three things most worth doing</span>
        <div className="grid grid--3">
          {topThree.map(({ suggestion, result }) => (
            <Card key={suggestion.id} bodyClassName="card__body--tight">
              <div className="stack stack--tight" style={{ height: '100%' }}>
                <span className="small strong">{suggestion.question}</span>
                <span className="ask-headline ask-headline--sm">{result.headline(FMT)}</span>
                {result.plain && <p className="play__plain">{result.plain}</p>}
                <div className="row row--between row--nowrap" style={{ marginTop: 'auto' }}>
                  <span className="micro subtle">
                    {result.rows.length ? `Act now · ${formatNumber(result.rows.length)} merchants` : 'Nothing to do'}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => setSub('suggestions')}>See all</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </>
      )}

      {/* ---------------- What to do ---------------- */}
      {sub === 'suggestions' && (
      <>
      <div className="row row--between row--nowrap" style={{ flexWrap: 'wrap', gap: 'var(--s-3)' }}>
        <span className="t-section-label">What we think is worth doing</span>
        <div className="ask-chips">
          <button type="button" className={`ask-chip ${filter === 'all' ? 'is-active' : ''}`.trim()} onClick={() => setFilter('all')}>
            <span>All</span>
          </button>
          {CATEGORIES.filter((c) => c.id !== 'operations').map((c) => (
            <button key={c.id} type="button" className={`ask-chip ${filter === c.id ? 'is-active' : ''}`.trim()} onClick={() => setFilter(c.id)}>
              <Icon name={c.icon} size={13} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="play-grid">
        {plays.map(({ suggestion, result, category }) => (
          <Card key={suggestion.id} bodyClassName="card__body--tight">
            <div className="stack stack--tight">
              <div className="row row--between row--nowrap" style={{ alignItems: 'flex-start' }}>
                <span className="suggestion__icon"><Icon name={suggestion.icon} size={16} /></span>
                <Badge tone="neutral">{categoryFor(category)?.label}</Badge>
              </div>

              <div className="stack stack--xtight">
                <span className="small strong">{suggestion.question}</span>
                <span className="ask-headline ask-headline--sm">{result.headline(FMT)}</span>
              </div>

              {/* The plain sentence leads. It says what is being suggested and
                  why in words anyone can read; the workings sit underneath for
                  whoever wants them. A card whose only explanation is "at 25 bps
                  each one earns more than we expect to pay out" is unreadable
                  to someone meeting the product for the first time. */}
              {result.plain && <p className="play__plain">{result.plain}</p>}

              <details className="play__why">
                <summary>How we worked that out</summary>
                <p className="micro subtle" style={{ margin: '4px 0 0' }}>{result.because}</p>
              </details>

              <div className="row row--between row--nowrap" style={{ marginTop: 'auto', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
                <span className="micro subtle">{formatNumber(result.rows.length)} merchant{result.rows.length === 1 ? '' : 's'}</span>
                <div className="row row--xtight row--nowrap">
                  {/* Act without leaving the page. The heavier decisions still
                      route through Create, where the rule can be inspected —
                      but adding a set of merchants to a watchlist is not a
                      decision that needs a six-step form. */}
                  {result.rows.length > 0 && (
                    <Tooltip label={`Put all ${result.rows.length} on the watchlist so they are easy to find later. Changes nothing about their pricing or their cases.`} side="top" wide>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="eye"
                        onClick={() => {
                          const msg = bulkActionFor('watchlist').run(result.rows.map((r) => r.merchant), {});
                          notify(msg, 'success');
                        }}
                      >
                        Watch all
                      </Button>
                    </Tooltip>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="edit"
                    onClick={() => onOpenInCreate({
                      mode: 'criteria',
                      criteria: result.criteria.map((c) => ({ ...c, value: String(c.value) })),
                      category,
                      goalId: goalForCategory(category),
                    })}
                  >
                    Open in Create
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      </>
      )}

      {/* ---------------- Where to look ---------------- */}
      {sub === 'activity' && (
      <>
      <span className="t-section-label">Where the activity is, last 30 days</span>

      <div className="grid grid--2">
        <Card title="Busiest merchant groups" bodyClassName="card__body--tight">
          <div className="stack stack--tight">
            {groups.map((g) => (
              <div key={g.groupId} className="group-row">
                <div className="stack stack--xtight" style={{ minWidth: 0 }}>
                  <span className="small strong truncate">{g.label}</span>
                  <span className="micro subtle">{formatNumber(g.merchants)} merchants · {formatNumber(g.cases)} cases</span>
                </div>
                <ActivityBar score={g.score} />
                <span className="mono small strong">{formatCompactCurrency(g.value)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Coverage across your merchants" bodyClassName="card__body--tight">
          <div className="stack stack--tight">
            {CATEGORIES.filter((c) => c.id !== 'operations').map((c) => {
              const covered = MERCHANTS.filter((m) => settingsFor(m.id).enabled);
              const stat = c.id === 'indemnification'
                ? { value: `${covered.length} of ${MERCHANTS.length}`, note: 'merchants indemnified' }
                : c.id === 'revenue'
                  ? { value: formatCompactCurrency(MERCHANTS.reduce((s, m) => s + (m.projectedVolume ?? 0), 0)), note: 'annual volume across all merchants' }
                  : { value: formatPercent(MERCHANTS.filter((m) => m.disputeVolume > 0).reduce((s, m) => s + m.chargebackRatio, 0) / Math.max(MERCHANTS.filter((m) => m.disputeVolume > 0).length, 1), 2), note: 'average chargeback ratio' };
              return (
                <div key={c.id} className="group-row">
                  <div className="stack stack--xtight" style={{ minWidth: 0 }}>
                    <span className="small strong truncate">{c.label}</span>
                    <span className="micro subtle">{stat.note}</span>
                  </div>
                  <span />
                  <span className="mono small strong">{stat.value}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="Top merchants by activity" description="Scored on case volume, disputed value, overdue count and analyst time over the last 30 days." bodyClassName="card__body--flush">
        <DataTable
          columns={merchantColumns}
          rows={activity.slice(0, 5)}
          rowKey={(r) => r.merchant.id}
          density="comfortable"
        />
      </Card>

      </>
      )}

      {/* ---------------- Standing rules and history ---------------- */}
      {sub === 'current' && (
      <>
      <span className="t-section-label">Standing rules</span>

      <Card bodyClassName="card__body--tight">
        {standingRules.length === 0 ? (
          <EmptyState
            icon="rules"
            title="No standing rules"
            hint="Tick “Keep applying” when you apply something in Create and it will be kept here, reporting anything that qualifies later."
          />
        ) : (
          <div className="stack stack--tight">
            <p className="micro subtle" style={{ margin: 0 }}>
              These are re-checked against the portfolio every time this page loads. There is no overnight job —
              what a standing rule gives you is the gap between what it says and what is actually true, and a
              way to close it.
            </p>
            {standingRules.map((rule) => {
              const qualifying = matchMerchants(MERCHANTS, rule.criteria, 'all', ctx);
              const drift = ruleDrift(rule, qualifying, { settingsFor, flagsFor, alreadyAlerted: (ruleId, merchantId) => hasAlert(`${ruleId}:${merchantId}`) });
              const act = bulkActionFor(rule.action);
              return (
                <div key={rule.id} className="standing-row">
                  <div className="stack stack--xtight" style={{ minWidth: 0 }}>
                    <div className="row row--xtight row--nowrap">
                      <Badge tone={rule.enabled ? 'success' : 'muted'} dot>{rule.enabled ? 'On' : 'Paused'}</Badge>
                      <span className="small strong truncate">{rule.name}</span>
                    </div>
                    <span className="micro subtle">
                      {act?.label ?? rule.action} · {formatNumber(drift.qualifying)} qualify · {drift.summary}
                    </span>
                  </div>

                  <div className="standing-row__drift">
                    <span className="mono small strong" style={{ color: drift.pending.length ? 'var(--c-warning)' : 'var(--c-success)' }}>
                      {drift.pending.length ? `${formatNumber(drift.pending.length)} pending` : 'In step'}
                    </span>
                  </div>

                  <div className="row row--xtight row--nowrap">
                    <Tooltip
                      label={drift.pending.length
                        ? `Apply this rule to the ${drift.pending.length} merchant${drift.pending.length === 1 ? '' : 's'} that qualify but have not had it applied yet.`
                        : 'Nothing to do — every merchant that qualifies already matches this rule.'}
                      side="top"
                      wide
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!rule.enabled || !drift.pending.length}
                        onClick={() => {
                          const msg = act.run(drift.pending, rule.config);
                          markRuleRun(rule.id);
                          notify(msg, 'success');
                        }}
                      >
                        Run now
                      </Button>
                    </Tooltip>
                    <Button variant="secondary" size="sm" icon={rule.enabled ? 'pause' : 'play'} onClick={() => toggleStandingRule(rule.id)} aria-label={rule.enabled ? 'Pause' : 'Resume'} />
                    <Button variant="secondary" size="sm" icon="trash" onClick={() => { removeStandingRule(rule.id); notify('Standing rule removed.', 'success'); }} aria-label="Remove" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ---------------- What we decided ---------------- */}
      <span className="t-section-label">Saved suggestions and what happened to them</span>

      <Card bodyClassName="card__body--tight">
        {saved.length === 0 ? (
          <EmptyState
            icon="archive"
            title="Nothing saved yet"
            hint="Anything you build in Create can be saved here, along with whatever you decided to do with it."
          />
        ) : (
          <div className="stack stack--tight">
            {saved.map((s) => (
              <div key={s.id} className="saved-row">
                <div className="stack stack--xtight" style={{ minWidth: 0 }}>
                  <div className="row row--xtight row--nowrap">
                    <Badge tone={STATUSES[s.status].tone} dot>{STATUSES[s.status].label}</Badge>
                    <span className="small strong truncate">{s.title}</span>
                  </div>
                  <span className="micro subtle">{s.summary}</span>
                  <span className="micro subtle">
                    {categoryFor(s.category)?.label ?? s.category} · {s.mode === 'merchant' ? 'per merchant' : 'per criteria'} ·
                    {' '}created {formatDate(s.createdAt)}
                    {s.actionedAt ? ` · ${STATUSES[s.status].label.toLowerCase()} ${formatDate(s.actionedAt)}` : ''}
                    {s.actionNote ? ` — ${s.actionNote}` : ''}
                  </span>
                </div>

                {s.status === 'saved' && (
                  <div className="row row--tight row--nowrap">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { markSuggestion(s.id, 'dismissed', 'Dismissed from Suggestions.'); notify('Suggestion dismissed.', 'success'); }}
                    >
                      Dismiss
                    </Button>
                    <Button variant="secondary" size="sm" icon="edit" onClick={() => onOpenInCreate({ category: s.category, mode: s.mode })}>
                      Reopen
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      </>
      )}
    </div>
  );
}

export default SuggestionsTab;
