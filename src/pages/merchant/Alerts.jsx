import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Kpi, Tabs, SubTabs, Badge, Button, IconButton, EmptyState } from '@/components/ui/Surface';
import PreDisputeAlerts from '@/pages/merchant/PreDisputeAlerts';
import { preDisputeKpis } from '@/data/pre-dispute';
import { Tooltip, TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { DueCell } from '@/components/cases/caseColumns';
import { ALERT_RULES, SEVERITIES, alertSummary, buildAlerts, getSeverity } from '@/domain/alerts';
import { useBrand } from '@/brand/BrandProvider';
import { useToast } from '@/context/ToastContext';
import { ROUTES } from '@/data/navigation';
import { readPref, writePref } from '@/utils/storage';
import { formatCurrency, formatNumber, relativeTime } from '@/utils/format';

/**
 * ALERTS
 *
 * The screen that answers "what should I look at first" without making anyone
 * open four other screens and hold the answer in their head.
 *
 * Every row is derived in domain/alerts.js from the same case book the queues
 * read, so the number here and the number on Case management cannot drift.
 *
 * ACKNOWLEDGEMENT IS PER-USER AND NON-DESTRUCTIVE. Acknowledging moves a row
 * into a collapsed section; it does not resolve the underlying cases and it
 * does not hide them from anyone else. An alert console that lets one person
 * silence a deadline for the whole team is a liability, and the wording on the
 * button says exactly that.
 */

const ACK_KEY = 'ddc.alerts.acknowledged';

const readAck = () => {
  try {
    return new Set(JSON.parse(readPref(ACK_KEY, '[]')));
  } catch {
    return new Set();
  }
};

const SEVERITY_ICON = { critical: 'alert', warning: 'clock', info: 'info' };

/* ------------------------------------------------------------------ *
 * One alert
 * ------------------------------------------------------------------ */

function AlertCard({ alert, acknowledged, onAcknowledge, onRestore }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const severity = getSeverity(alert.severity);

  return (
    <article className={`alert-row alert-row--${alert.severity} ${acknowledged ? 'is-acknowledged' : ''}`.trim()}>
      <span className={`alert-row__icon alert-row__icon--${alert.severity}`}>
        <Icon name={SEVERITY_ICON[alert.severity] ?? 'info'} size={16} />
      </span>

      <div className="alert-row__body">
        <div className="row row--xtight">
          <Badge tone={severity.tone} dot>{severity.label}</Badge>
          <span className="small strong">{alert.title}</span>
        </div>

        <p className="small muted" style={{ margin: 'var(--s-1) 0 0' }}>{alert.why}</p>

        {/* Integration health carries a breakdown instead of a case list. */}
        {alert.meta?.breakdown && (
          <div className="row row--tight" style={{ marginTop: 'var(--s-2)' }}>
            {alert.meta.breakdown.map((b) => (
              <Tooltip key={b.id} label={b.remedy} wide>
                <span className="chip">
                  <span className="mono nano">{b.http}</span> {b.label} · <strong className="mono">{b.count}</strong>
                </span>
              </Tooltip>
            ))}
          </div>
        )}

        {alert.meta?.groups && (
          <div className="row row--tight" style={{ marginTop: 'var(--s-2)' }}>
            {alert.meta.groups.map((g) => (
              <span key={g.id} className="chip">{g.label} · {g.size} {g.size === 1 ? 'case' : 'cases'}</span>
            ))}
          </div>
        )}

        <div className="row row--tight" style={{ marginTop: 'var(--s-3)' }}>
          {alert.action && (
            <Button variant={alert.severity === 'critical' ? 'primary' : 'secondary'} size="sm" iconAfter="chevron" onClick={() => navigate(alert.action.to)}>
              {alert.action.label}
            </Button>
          )}

          {alert.cases.length > 0 && (
            <Button variant="ghost" size="sm" icon={open ? 'chevronDown' : 'chevron'} onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide' : 'Show'} {formatNumber(alert.count)} {alert.count === 1 ? 'case' : 'cases'}
            </Button>
          )}

          {acknowledged ? (
            <Button variant="ghost" size="sm" icon="refresh" onClick={() => onRestore(alert.id)}>Un-acknowledge</Button>
          ) : (
            <Tooltip label="Collapses the row for you only. The cases stay open and everyone else still sees the alert." wide>
              <Button variant="ghost" size="sm" icon="check" onClick={() => onAcknowledge(alert.id)}>Acknowledge</Button>
            </Tooltip>
          )}
        </div>

        {open && alert.cases.length > 0 && (
          <div className="stack stack--xtight" style={{ marginTop: 'var(--s-3)' }}>
            {alert.cases.map((c) => (
              <Link key={c.id} to={ROUTES.workCaseDetail(c.id)} className="alert-case">
                <span className="row row--xtight row--nowrap" style={{ minWidth: 0 }}>
                  <span className="mono small strong">{c.id}</span>
                  <Badge tone={c.caseType === 'claim' ? 'info' : 'primary'}>{c.caseType === 'claim' ? 'BP' : 'CB'}</Badge>
                  <TruncatedText value={c.reasonLabel} className="micro muted" />
                </span>
                <span className="row row--xtight row--nowrap" style={{ flex: 'none' }}>
                  <span className="micro subtle">{c.worker === '—' ? 'Unassigned' : c.worker}</span>
                  <span className="mono micro strong">{formatCurrency(c.disputeAmount, c.currency)}</span>
                  <DueCell dueDate={c.dueDate} />
                </span>
              </Link>
            ))}

            {alert.truncated > 0 && (
              <Link to={ROUTES.caseManagement} className="micro" style={{ color: 'var(--c-primary)', fontWeight: 600 }}>
                + {formatNumber(alert.truncated)} more — open the full list
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="alert-row__meta">
        {alert.value > 0 && <span className="mono small strong">{formatCurrency(alert.value)}</span>}
        <span className="nano subtle nowrap">{alert.count > 0 ? `${formatNumber(alert.count)} affected` : '—'}</span>
        <span className="nano subtle nowrap">{relativeTime(alert.at)}</span>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

export function Alerts() {
  const brand = useBrand();
  const { notify } = useToast();

  const alerts = useMemo(() => buildAlerts(), []);
  const summary = useMemo(() => alertSummary(alerts), [alerts]);

  const [view, setView] = useState('operational');
  const [tab, setTab] = useState('all');
  const [acked, setAcked] = useState(readAck);

  const preKpis = useMemo(() => preDisputeKpis(), []);

  const persist = (next) => {
    setAcked(next);
    writePref(ACK_KEY, JSON.stringify([...next]));
  };

  const acknowledge = (id) => {
    const next = new Set(acked).add(id);
    persist(next);
    notify('Alert acknowledged for you. The cases stay open.', 'success');
  };

  const restore = (id) => {
    const next = new Set(acked);
    next.delete(id);
    persist(next);
  };

  const bySeverity = tab === 'all' ? alerts : alerts.filter((a) => a.severity === tab);
  const live = bySeverity.filter((a) => !acked.has(a.id));
  const quiet = bySeverity.filter((a) => acked.has(a.id));

  const tabs = [
    { value: 'all', label: 'All', badge: alerts.filter((a) => !acked.has(a.id)).length },
    ...SEVERITIES.map((s) => ({
      value: s.id,
      label: s.label,
      badge: alerts.filter((a) => a.severity === s.id && !acked.has(a.id)).length,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Two different things, deliberately kept apart. Operational alerts are about cases already in this console. Pre-dispute alerts arrive from the card networks before a chargeback exists — action one in time and there is no dispute to defend."
        meta={
          view === 'operational' ? (
            <p className="page-head__desc">
              <strong className="mono">{formatNumber(summary.critical)}</strong> critical ·{' '}
              <strong className="mono">{formatNumber(summary.casesAffected)}</strong> {brand.terms.cases} affected ·
              every row links to the {brand.terms.cases} behind it
            </p>
          ) : (
            <p className="page-head__desc">
              <strong className="mono">{formatNumber(preKpis.deflected)}</strong> {brand.terms.chargebacks} prevented ·{' '}
              <strong className="mono">{formatNumber(preKpis.open)}</strong> still inside their window
            </p>
          )
        }
        actions={view !== 'operational' ? null : (
          <Tooltip label={`${ALERT_RULES.length} rules evaluate on every load. Nothing here is scheduled or cached — the numbers are recomputed from the book you are looking at.`} wide side="bottom">
            <span className="chip"><Icon name="info" size={12} /> {ALERT_RULES.length} rules active</span>
          </Tooltip>
        )}
      />

      {/*
        Kept as one screen with two views rather than two nav entries: they are
        both "what needs attention", and an operator should not have to know
        which menu a network alert lives under. The split is explicit because
        the two are genuinely different objects — one is a case, the other is a
        chance to stop a case existing.
      */}
      <SubTabs
        tabs={[
          { value: 'operational', label: 'Operational', badge: summary.total - acked.size },
          { value: 'pre_dispute', label: 'Pre-dispute (RDR, Ethoca, Verifi)', badge: preKpis.open },
        ]}
        value={view}
        onChange={setView}
      />

      {view === 'pre_dispute' && <PreDisputeAlerts />}

      {view === 'operational' && (
      <div className="stack">
        <div className="grid grid--4">
          <Card bodyClassName="card__body--tight">
            <Kpi label="Open alerts" value={formatNumber(summary.total - acked.size)} meta={`${formatNumber(acked.size)} acknowledged`} />
          </Card>
          <Card bodyClassName="card__body--tight">
            <Kpi label={`${brand.terms.cases} affected`} value={formatNumber(summary.casesAffected)} meta="counted once, not per rule" />
          </Card>
          <Card bodyClassName="card__body--tight">
            <Kpi label="Exposure" value={formatCurrency(summary.exposure)} meta="value of the affected cases" />
          </Card>
          <Card bodyClassName="card__body--tight">
            <Kpi label="Critical exposure" value={formatCurrency(summary.criticalExposure)} meta="deadline passed or money leaving" />
          </Card>
        </div>

        <Card bodyClassName="card__body">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />

          <div className="stack stack--tight" style={{ marginTop: 'var(--s-3)' }}>
            {live.length === 0 && quiet.length === 0 && (
              <EmptyState
                icon="check"
                title="Nothing to act on"
                hint={`No ${tab === 'all' ? '' : `${getSeverity(tab).label.toLowerCase()} `}alerts against the current book.`}
              />
            )}

            {live.map((a) => (
              <AlertCard key={a.id} alert={a} acknowledged={false} onAcknowledge={acknowledge} onRestore={restore} />
            ))}

            {quiet.length > 0 && (
              <>
                <div className="row row--between" style={{ marginTop: 'var(--s-3)' }}>
                  <span className="t-section-label">Acknowledged by you ({quiet.length})</span>
                  <IconButton icon="refresh" label="Un-acknowledge all" size={13} onClick={() => persist(new Set())} />
                </div>
                {quiet.map((a) => (
                  <AlertCard key={a.id} alert={a} acknowledged onAcknowledge={acknowledge} onRestore={restore} />
                ))}
              </>
            )}
          </div>
        </Card>

        {/*
          The count leads each row in a fixed right-aligned gutter, so the
          digits stack into a column the eye can run down and every label
          starts on the same left edge. This was previously label-left /
          count-right across a half-page column, which put a foot of empty
          space between a rule and its number — at that distance you stop
          reading and start guessing which number belongs to which row.
        */}
        <Card title="Rules behind these alerts">
          <div className="rule-grid">
            {['Deadlines', 'Money', 'Evidence', 'Risk', 'Platform'].map((category) => {
              const rules = ALERT_RULES.filter((r) => r.category === category);
              if (!rules.length) return null;
              return (
                <div key={category}>
                  <span className="t-section-label">{category}</span>
                  {rules.map((r) => {
                    const firing = alerts.find((a) => a.ruleId === r.id);
                    const tone = firing ? getSeverity(firing.severity).tone : null;
                    return (
                      <div key={r.id} className="rule-row">
                        <span className={`rule-row__count ${tone ? `rule-row__count--${tone}` : ''}`.trim()}>
                          {firing ? formatNumber(firing.count) : '—'}
                        </span>
                        <span className={`rule-row__label ${firing ? '' : 'is-clear'}`.trim()}>{r.label}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      )}
    </>
  );
}

export default Alerts;
