import { useMemo, useState } from 'react';
import { PageHeader, Card, Badge, Button, Kpi } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { ALERTS, WORKABLE_ENTITIES, agentRollup, unassignedOpenAlerts } from '@/data/alerts';
import brand from '@/brand/brand.config';
import { useToast } from '@/context/ToastContext';
import { formatCompactCurrency, formatNumber } from '@/utils/format';

/**
 * Alert assignments.
 *
 * A rollup, not a queue — same shape as the reference's Agent/Assigned
 * clients/Assigned alerts/Total open load table, but it can actually DO
 * something: Balance workload round-robins every unassigned open alert to
 * an agent who's allowed to work that entity, instead of just reporting
 * that a backlog exists.
 */

export function AlertAssignments() {
  const { notify } = useToast();
  const [alerts, setAlerts] = useState(ALERTS);

  const rollup = useMemo(() => agentRollup(alerts), [alerts]);
  const backlog = useMemo(() => unassignedOpenAlerts(alerts), [alerts]);

  const balanceWorkload = () => {
    let placed = 0;
    setAlerts((prev) => {
      const next = [...prev];
      const cursor = {};
      brand.entities.forEach((entity) => {
        const agents = WORKABLE_ENTITIES[entity.id] ?? [];
        if (!agents.length) return;
        cursor[entity.id] = 0;
        next.forEach((a, idx) => {
          if (a.entityId !== entity.id || a.outcome !== 'open' || a.assignedTo) return;
          next[idx] = { ...a, assignedTo: agents[cursor[entity.id] % agents.length] };
          cursor[entity.id] += 1;
          placed += 1;
        });
      });
      return next;
    });
    // placed is computed synchronously above but reported after the state update settles.
    setTimeout(() => notify(placed ? `${placed} alert${placed === 1 ? '' : 's'} assigned.` : 'Nothing to balance — every open alert already has an owner.', placed ? 'success' : 'warning'), 0);
  };

  const columns = [
    { key: 'name', header: 'Agent', fw: 10, cell: (r) => <span className="small strong">{r.name}</span> },
    { key: 'alertsRole', header: 'Role', fw: 8, cell: (r) => <Badge tone={r.alertsRole === 'Alerts Manager' ? 'primary' : 'info'}>{r.alertsRole}</Badge> },
    {
      key: 'entities', header: 'Assigned entities', fw: 14,
      cell: (r) => (r.entities.length
        ? <div className="row row--tight" style={{ flexWrap: 'wrap' }}>{r.entities.map((e) => <Badge key={e.id} tone="neutral">{e.label}</Badge>)}</div>
        : <span className="small subtle">None</span>),
    },
    { key: 'assignedAlerts', header: 'Assigned alerts', fw: 7, align: 'right', cell: (r) => <span className="mono small">{formatNumber(r.assignedAlerts)}</span> },
    { key: 'openLoad', header: 'Open load', fw: 6, align: 'right', cell: (r) => <span className="mono small" style={r.openLoad ? { color: 'var(--c-warning)' } : undefined}>{formatNumber(r.openLoad)}</span> },
    { key: 'openValue', header: 'Open value', fw: 8, align: 'right', cell: (r) => <span className="mono small">{formatCompactCurrency(r.openValue)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Alert assignments"
        description="Who's carrying the open alert load, and what's still sitting unassigned."
        actions={<Button variant="primary" icon="refresh" disabled={!backlog.length} onClick={balanceWorkload}>Balance workload ({backlog.length})</Button>}
      />

      <div className="stack stack--tight">
        <div className="grid grid--3">
          <Kpi label="Agents with access" value={formatNumber(rollup.length)} />
          <Kpi label="Total assigned load" value={formatNumber(rollup.reduce((s, r) => s + r.openLoad, 0))} meta="open alerts with an owner" />
          <Kpi label="Unassigned backlog" value={formatNumber(backlog.length)} meta="open, nobody's working it yet" />
        </div>

        <Card bodyClassName="card__body--flush">
          <DataTable columns={columns} rows={rollup} rowKey={(r) => r.email} />
        </Card>
      </div>
    </>
  );
}

export default AlertAssignments;
