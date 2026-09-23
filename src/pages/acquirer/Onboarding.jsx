import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, Card, Badge, Button, EmptyState, Kpi, Stepper } from '@/components/ui/Surface';
import { Icon } from '@/components/ui/Icon';
import { TruncatedText } from '@/components/ui/Overlay';
import { ONBOARDING_APPLICATIONS } from '@/data/portfolio';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { weeklySeries } from '@/domain/metrics';
import { formatCompactCurrency, formatDate, formatNumber } from '@/utils/format';

/**
 * Onboarding — merchant applications moving through KYC and setup. One card
 * per application; the checklist reuses the Stepper component from Surface.jsx
 * (the same primitive Work case uses for its own progress rail).
 */

const STEP_TONE = { completed: 'success', in_progress: 'primary', blocked: 'danger', pending: 'muted' };
const STEP_LABEL = { completed: 'Completed', in_progress: 'In progress', blocked: 'Blocked', pending: 'Pending' };

function ApplicationCard({ app, onAdvance }) {
  const currentIndex = app.steps.findIndex((s) => s.status !== 'completed');
  const done = currentIndex === -1;

  return (
    <Card
      title={app.merchantName}
      action={<Badge tone={done ? 'success' : 'info'}>{done ? 'Ready for go-live' : `${app.steps.filter((s) => s.status === 'completed').length} / ${app.steps.length} steps`}</Badge>}
    >
      <div className="stack">
        <div className="row row--between row--nowrap">
          <span className="small subtle">{app.vertical} · {app.mccLabel}</span>
          <span className="micro subtle">{app.id}</span>
        </div>

        <Stepper steps={app.steps.map((s) => s.label)} current={currentIndex === -1 ? app.steps.length : currentIndex} />

        {/* Label above value rather than beside it: at two cards to a row a
            42%/58% split wrapped both halves of every line. */}
        <div className="onb-meta">
          <div><span className="onb-meta__k">Submitted</span><span className="onb-meta__v">{formatDate(app.submittedDate)}</span><span className="onb-meta__sub">{app.daysOpen}d ago</span></div>
          <div><span className="onb-meta__k">Target go-live</span><span className="onb-meta__v">{formatDate(app.targetGoLive)}</span><span className="onb-meta__sub">{app.daysToGoLive < 0 ? `${-app.daysToGoLive}d overdue` : `in ${app.daysToGoLive}d`}</span></div>
          <div><span className="onb-meta__k">Projected volume</span><span className="onb-meta__v">{formatCompactCurrency(app.projectedVolume)}</span><span className="onb-meta__sub">a year, once live</span></div>
          <div style={{ minWidth: 0 }}><span className="onb-meta__k">Assigned to</span><span className="onb-meta__v mono"><TruncatedText value={app.assignedAnalyst} /></span><span className="onb-meta__sub">{done ? 'ready for go-live' : `with ${app.steps[currentIndex].team}`}</span></div>
        </div>

        {/* Each row carries what was actually done, who holds it and when it
            last moved — a status pill on its own leaves the reader with no
            way to tell a step that finished yesterday from one sitting for
            three weeks. */}
        <div className="stack stack--xtight">
          {app.steps.map((s) => (
            <div key={s.id} className="onb-step">
              <div className="row row--between row--nowrap">
                <span className="small strong">{s.label}</span>
                <Badge tone={STEP_TONE[s.status]} dot>{STEP_LABEL[s.status]}</Badge>
              </div>
              <div className="micro subtle">{s.detail}</div>
              <div className="micro subtle onb-step__who">
                <span>{s.team}</span>
                {s.owner && <><span aria-hidden="true">·</span><span className="mono" style={{ minWidth: 0 }}><TruncatedText value={s.owner} /></span></>}
                {s.date && <><span aria-hidden="true">·</span><span>{s.status === 'completed' ? 'done' : 'since'} {formatDate(s.date)} ({s.days}d)</span></>}
              </div>
            </div>
          ))}
        </div>

        <div className="row row--between row--nowrap" style={{ paddingTop: 'var(--s-1)' }}>
          <span className="micro subtle row row--xtight row--nowrap">
            <Icon name={app.note.startsWith('Blocked') ? 'alert' : 'info'} size={12} />
            {app.note}
          </span>
          {!done && <Button variant="secondary" size="sm" icon="check" onClick={() => onAdvance(app.id)}>Mark step complete</Button>}
        </div>
      </div>
    </Card>
  );
}

const STAGE_FILTERS = [
  { value: 'all', label: 'All applications' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'ready', label: 'Ready for go-live' },
];

const stageOf = (app) => {
  if (app.steps.every((s) => s.status === 'completed')) return 'ready';
  if (app.steps.some((s) => s.status === 'blocked')) return 'blocked';
  return 'in_progress';
};

export function Onboarding() {
  const { notify } = useToast();
  const { terms } = usePerspective();
  const [searchParams] = useSearchParams();
  const merchantFilter = searchParams.get('merchant');

  const [apps, setApps] = useState(ONBOARDING_APPLICATIONS);
  const [stage, setStage] = useState('all');

  const scoped = useMemo(
    () => (merchantFilter ? apps.filter((a) => a.merchantId === merchantFilter) : apps),
    [apps, merchantFilter],
  );

  const rows = useMemo(
    () => (stage === 'all' ? scoped : scoped.filter((a) => stageOf(a) === stage)),
    [scoped, stage],
  );

  const totals = useMemo(() => ({
    count: scoped.length,
    blocked: scoped.filter((a) => stageOf(a) === 'blocked').length,
    ready: scoped.filter((a) => stageOf(a) === 'ready').length,
    volume: scoped.reduce((s, a) => s + (a.projectedVolume ?? 0), 0),
  }), [scoped]);

  /* Progress through the checklist is the only thing an application really
     has to report, so each card's line is the pipeline's completed-step count
     by submission week — the same shape the KPI above it counts. */
  const sparks = useMemo(() => {
    const at = (a) => a.submittedDate;
    return {
      count: weeklySeries(scoped, 12, () => 1, () => true, at),
      blocked: weeklySeries(scoped, 12, () => 1, (a) => stageOf(a) === 'blocked', at),
      ready: weeklySeries(scoped, 12, () => 1, (a) => stageOf(a) === 'ready', at),
      volume: weeklySeries(scoped, 12, (a) => a.projectedVolume ?? 0, () => true, at),
    };
  }, [scoped]);

  const advance = (appId) => {
    setApps((prev) => prev.map((app) => {
      if (app.id !== appId) return app;
      const idx = app.steps.findIndex((s) => s.status !== 'completed');
      if (idx === -1) return app;
      const steps = app.steps.map((s, i) => (i === idx ? { ...s, status: 'completed' } : s));
      const nextIdx = steps.findIndex((s) => s.status !== 'completed');
      const advanced = nextIdx === -1 ? steps : steps.map((s, i) => (i === nextIdx ? { ...s, status: 'in_progress' } : s));
      return { ...app, steps: advanced, note: nextIdx === -1 ? 'All steps complete — ready to move to Active.' : 'On track for the target go-live date.' };
    }));
    notify('Step marked complete.', 'success');
  };

  return (
    <>
      <PageHeader
        title="Onboarding"
        description={`Merchant applications moving through KYC and setup, tracked by ${terms.analyst.toLowerCase()}.`}
      />

      <div className="stack">
        <div className="kpi-row">
          <Kpi label="In pipeline" value={formatNumber(totals.count)} meta="Applications not yet live" spark={sparks.count} />
          <Kpi label="Blocked" value={formatNumber(totals.blocked)} meta="Waiting on the merchant" invert spark={sparks.blocked} />
          <Kpi label="Ready for go-live" value={formatNumber(totals.ready)} meta="Every step complete" spark={sparks.ready} />
          <Kpi label="Projected volume" value={formatCompactCurrency(totals.volume)} meta="Annual, once live" spark={sparks.volume} />
        </div>

        {/* Twelve full-width cards is a very long page, so the pipeline reads
            two-up with a stage filter rather than as one endless column. */}
        <Card bodyClassName="card__body--tight">
          <div className="row row--tight" style={{ flexWrap: 'wrap' }}>
            {STAGE_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={stage === f.value ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setStage(f.value)}
              >
                {f.label}
                {f.value !== 'all' && ` (${scoped.filter((a) => stageOf(a) === f.value).length})`}
              </Button>
            ))}
          </div>
        </Card>

        {rows.length === 0 ? (
          <Card>
            <EmptyState icon="upload" title="No applications at this stage" hint="Choose another stage to see the rest of the pipeline." />
          </Card>
        ) : (
          <div className="grid grid--2">
            {rows.map((app) => <ApplicationCard key={app.id} app={app} onAdvance={advance} />)}
          </div>
        )}
      </div>
    </>
  );
}

export default Onboarding;
