import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, Card, Badge, Button, EmptyState, Stepper } from '@/components/ui/Surface';
import { Icon } from '@/components/ui/Icon';
import { ONBOARDING_APPLICATIONS } from '@/data/portfolio';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatDate } from '@/utils/format';

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

        <div className="grid grid--3" style={{ gap: 'var(--s-2)' }}>
          <div className="detail-row"><span className="detail-row__k">Submitted</span><span className="detail-row__v">{formatDate(app.submittedDate)}</span></div>
          <div className="detail-row"><span className="detail-row__k">Target go-live</span><span className="detail-row__v">{formatDate(app.targetGoLive)}</span></div>
          <div className="detail-row"><span className="detail-row__k">Assigned to</span><span className="detail-row__v mono">{app.assignedAnalyst}</span></div>
        </div>

        <div className="stack stack--xtight">
          {app.steps.map((s) => (
            <div key={s.id} className="row row--between row--nowrap" style={{ padding: 'var(--s-1) 0' }}>
              <span className="small">{s.label}</span>
              <Badge tone={STEP_TONE[s.status]} dot>{STEP_LABEL[s.status]}</Badge>
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

export function Onboarding() {
  const { notify } = useToast();
  const { terms } = usePerspective();
  const [searchParams] = useSearchParams();
  const merchantFilter = searchParams.get('merchant');

  const [apps, setApps] = useState(ONBOARDING_APPLICATIONS);

  const rows = useMemo(
    () => (merchantFilter ? apps.filter((a) => a.merchantId === merchantFilter) : apps),
    [apps, merchantFilter],
  );

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

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon="upload" title="No applications in onboarding" hint="Every merchant in the portfolio is either active, under review or suspended." />
        </Card>
      ) : (
        <div className="stack">
          {rows.map((app) => <ApplicationCard key={app.id} app={app} onAdvance={advance} />)}
        </div>
      )}
    </>
  );
}

export default Onboarding;
