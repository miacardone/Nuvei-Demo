import { useMemo, useState } from 'react';
import { Card, Badge, Button, EmptyState, StatusIcon } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { MERCHANTS } from '@/data/portfolio';
import { CASES } from '@/data/cases';
import { settingsFor } from '@/data/indemnification';
import { STATUSES, markSuggestion } from '@/data/suggestions-store';
import { CATEGORIES, SUGGESTIONS, activityByGroup, activityIndex, categoryFor } from '@/domain/revenue';
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
  'whole-book': 'revenue',
};

function ActivityBar({ score }) {
  return (
    <span className="activity-bar" aria-hidden>
      <span className="activity-bar__fill" style={{ width: `${Math.min(100, score)}%` }} />
    </span>
  );
}

export function SuggestionsTab({ saved, onOpenInCreate }) {
  const { notify } = useToast();
  const ctx = { settingsFor };
  const [filter, setFilter] = useState('all');

  const activity = useMemo(() => activityIndex(MERCHANTS, CASES), []);
  const groups = useMemo(() => activityByGroup(MERCHANTS, CASES), []);

  const plays = useMemo(
    () => SUGGESTIONS
      .map((s) => ({ suggestion: s, result: s.run(MERCHANTS, ctx), category: PLAY_CATEGORY[s.id] ?? 'revenue' }))
      .filter((p) => filter === 'all' || p.category === filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter],
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

  return (
    <div className="stack">
      {/* ---------------- What to do ---------------- */}
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

              <p className="micro subtle" style={{ margin: 0 }}>{result.because}</p>

              <div className="row row--between row--nowrap" style={{ marginTop: 'auto' }}>
                <span className="micro subtle">{formatNumber(result.rows.length)} merchant{result.rows.length === 1 ? '' : 's'}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="edit"
                  onClick={() => onOpenInCreate({
                    mode: 'criteria',
                    criteria: result.criteria.map((c) => ({ ...c, value: String(c.value) })),
                    category,
                    goalId: category === 'risk' ? 'exposure' : category === 'revenue' ? 'revenue-left' : 'should-indemnify',
                  })}
                >
                  Open in Create
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ---------------- Where to look ---------------- */}
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

        <Card title="Coverage across the book" bodyClassName="card__body--tight">
          <div className="stack stack--tight">
            {CATEGORIES.filter((c) => c.id !== 'operations').map((c) => {
              const covered = MERCHANTS.filter((m) => settingsFor(m.id).enabled);
              const stat = c.id === 'indemnification'
                ? { value: `${covered.length} of ${MERCHANTS.length}`, note: 'merchants indemnified' }
                : c.id === 'revenue'
                  ? { value: formatCompactCurrency(MERCHANTS.reduce((s, m) => s + (m.projectedVolume ?? 0), 0)), note: 'annual volume in the book' }
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
    </div>
  );
}

export default SuggestionsTab;
