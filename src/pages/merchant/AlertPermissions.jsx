import { useState } from 'react';
import { PageHeader, Card, Badge, Button } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { SearchInput, SelectField } from '@/components/ui/Form';
import { ALERTS_ROLES, AGENT_ROLES, WORKABLE_ENTITIES } from '@/data/alerts';
import brand from '@/brand/brand.config';
import { useToast } from '@/context/ToastContext';

/**
 * Alert permissions.
 *
 * Two questions, two tables: what can this person do with alerts at all
 * (role), and which entity's queue are they actually allowed to touch
 * (workable entities). The reference conflates a giant per-client toggle
 * grid into one screen; at three entities that grid is just three rows, so
 * it gets its own small, editable table instead of a lock icon nobody can
 * read the state of.
 */

const roleTone = (role) => (role === 'Alerts Manager' ? 'primary' : role === 'Alerts User' ? 'info' : 'muted');

function WorkableModal({ entity, agents, workable, onSave, onClose }) {
  const [selected, setSelected] = useState(new Set(workable));
  if (!entity) return null;

  return (
    <Modal
      open={Boolean(entity)}
      onClose={onClose}
      title={`Workable by — ${entity.label}`}
      subtitle="Agents who can pick up and act on this entity's alerts."
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => onSave([...selected])}>Save</Button>
      </>}
    >
      <div className="stack stack--xtight">
        {agents.map((a) => (
          <label key={a.email} className="row row--xtight" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              className="checkbox"
              checked={selected.has(a.email)}
              onChange={() => setSelected((p) => { const n = new Set(p); n.has(a.email) ? n.delete(a.email) : n.add(a.email); return n; })}
            />
            <span className="small">{a.name}</span>
            <span className="micro subtle">{a.email}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

export function AlertPermissions() {
  const { notify } = useToast();
  const [agents, setAgents] = useState(AGENT_ROLES);
  const [workable, setWorkable] = useState(WORKABLE_ENTITIES);
  const [search, setSearch] = useState('');
  const [editingEntity, setEditingEntity] = useState(null);

  const eligibleAgents = agents.filter((a) => a.alertsRole !== 'No access');
  const filtered = agents.filter((a) => `${a.name} ${a.email}`.toLowerCase().includes(search.toLowerCase()));

  const setRole = (email, alertsRole) => {
    setAgents((p) => p.map((a) => (a.email === email ? { ...a, alertsRole } : a)));
    // Losing alerts access drops them from every entity's workable list too.
    if (alertsRole === 'No access') {
      setWorkable((p) => Object.fromEntries(Object.entries(p).map(([id, list]) => [id, list.filter((e) => e !== email)])));
    }
    notify('Role updated.', 'success');
  };

  const columns = [
    { key: 'name', header: 'Name', fw: 10 },
    { key: 'email', header: 'Email', fw: 14, cell: (r) => <span className="mono small">{r.email}</span> },
    {
      key: 'alertsRole', header: 'Alerts role', fw: 10,
      cell: (r) => (
        <SelectField
          value={r.alertsRole}
          onChange={(e) => setRole(r.email, e.target.value)}
          options={ALERTS_ROLES.map((role) => ({ value: role, label: role }))}
        />
      ),
    },
  ];

  const entityColumns = [
    { key: 'label', header: 'Entity', fw: 10, cell: (e) => <span className="small strong">{e.label}</span> },
    {
      key: 'workable', header: 'Workable by', fw: 20,
      cell: (e) => {
        const list = workable[e.id] ?? [];
        if (!list.length) return <span className="small subtle">Nobody assigned</span>;
        return (
          <div className="row row--tight" style={{ flexWrap: 'wrap' }}>
            {list.map((email) => <Badge key={email} tone="neutral">{agents.find((a) => a.email === email)?.name ?? email}</Badge>)}
          </div>
        );
      },
    },
    {
      key: 'actions', header: 'Actions', fw: 5, width: '76px',
      cell: (e) => <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditingEntity(e)}>Edit</Button>,
    },
  ];

  return (
    <>
      <PageHeader title="Alert permissions" description="Who can work alerts, and which entity's queue they're allowed to touch." />

      <div className="stack stack--tight">
        <Card title="Agent permissions" bodyClassName="card__body--flush">
          <div style={{ padding: 'var(--s-3) var(--s-4) 0' }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search agents…" />
          </div>
          <DataTable columns={columns} rows={filtered} rowKey={(r) => r.email} />
        </Card>

        <Card title="Workable entities" bodyClassName="card__body--flush">
          <DataTable columns={entityColumns} rows={brand.entities} rowKey={(e) => e.id} />
        </Card>
      </div>

      <WorkableModal
        key={editingEntity?.id ?? 'none'}
        entity={editingEntity}
        agents={eligibleAgents}
        workable={editingEntity ? (workable[editingEntity.id] ?? []) : []}
        onClose={() => setEditingEntity(null)}
        onSave={(list) => {
          setWorkable((p) => ({ ...p, [editingEntity.id]: list }));
          notify(`Workable agents for ${editingEntity.label} updated.`, 'success');
          setEditingEntity(null);
        }}
      />
    </>
  );
}

export default AlertPermissions;
