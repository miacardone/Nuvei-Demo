import { useState } from 'react';
import { PageHeader, Card, Toolbar, Tabs, Button, IconButton, Badge } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { SearchInput, SelectField, TextField, ToggleField } from '@/components/ui/Form';
import { Tooltip } from '@/components/ui/Overlay';
import { ALERTS, ALERT_SOURCES, CONTACT_EMAILS, IDENTIFIERS, SELF_SERVICE } from '@/data/alerts';
import brand from '@/brand/brand.config';
import { useToast } from '@/context/ToastContext';

/**
 * Alert settings.
 *
 * Three things a network alert needs before it can route itself: somewhere
 * to notify (recipients), something to match on (identifiers — the
 * descriptor the network hands back), and how much of the response should
 * happen without a human (self-service). One tab each, all editable inline.
 */

const TABS = [
  { value: 'recipients', label: 'Notification recipients' },
  { value: 'identifiers', label: 'Identifiers' },
  { value: 'selfService', label: 'Self-service' },
];

const entityLabel = (id) => brand.entities.find((e) => e.id === id)?.label ?? id;

function RecipientsTab() {
  const { notify } = useToast();
  const [rows, setRows] = useState(CONTACT_EMAILS);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const filtered = rows.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { key: 'entityId', header: 'Entity', fw: 8, cell: (r) => <span className="small strong">{entityLabel(r.entityId)}</span> },
    { key: 'name', header: 'Name', fw: 10 },
    { key: 'email', header: 'Email', fw: 14, cell: (r) => <span className="mono small">{r.email}</span> },
    {
      key: 'actions', header: 'Actions', fw: 6, width: '76px',
      cell: (r) => (
        <div className="row row--xtight row--nowrap">
          <IconButton icon="edit" label="Edit recipient" size={13} onClick={() => setEditing(r)} />
          <IconButton icon="trash" label="Delete recipient" tone="danger" size={13} onClick={() => setConfirm(r)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search recipients…" />
        <span className="spacer" />
        <Button variant="primary" icon="plus" onClick={() => setEditing({ entityId: brand.entities[0].id, name: '', email: '' })}>Add recipient</Button>
      </Toolbar>
      <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit recipient' : 'Add recipient'}
        footer={<>
          <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!editing?.name?.trim() || !editing?.email?.trim()}
            onClick={() => {
              setRows((p) => (p.some((x) => x.id === editing.id)
                ? p.map((x) => (x.id === editing.id ? editing : x))
                : [...p, { ...editing, id: `ce${p.length + 1}` }]));
              notify('Recipient saved.', 'success');
              setEditing(null);
            }}
          >
            Save recipient
          </Button>
        </>}
      >
        {editing && (
          <div className="stack">
            <SelectField label="Entity" required value={editing.entityId} onChange={(e) => setEditing({ ...editing, entityId: e.target.value })} options={brand.entities.map((en) => ({ value: en.id, label: en.label }))} />
            <TextField label="Name" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <TextField label="Email" type="email" required value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} placeholder={`name@${brand.emailDomain}`} />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete recipient"
        message={<>Delete <strong>{confirm?.name}</strong> ({confirm?.email})?</>}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { setRows((p) => p.filter((x) => x.id !== confirm.id)); notify('Recipient deleted.', 'success'); setConfirm(null); }}
      />
    </>
  );
}

function IdentifiersTab() {
  const { notify } = useToast();
  const [rows, setRows] = useState(IDENTIFIERS);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const matchedCount = (identifier) => ALERTS.filter((a) => a.identifier === identifier).length;
  const filtered = rows.filter((r) => `${r.identifier} ${entityLabel(r.entityId)}`.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { key: 'identifier', header: 'Identifier', fw: 12, cell: (r) => <span className="mono small strong">{r.identifier}</span> },
    { key: 'entityId', header: 'Entity', fw: 9, cell: (r) => <span className="small">{entityLabel(r.entityId)}</span> },
    { key: 'mid', header: 'MID', fw: 8, cell: (r) => <span className="mono small">{r.mid}</span> },
    { key: 'matched', header: 'Matched alerts', fw: 7, align: 'right', cell: (r) => <span className="mono small">{matchedCount(r.identifier)}</span> },
    { key: 'active', header: 'Active', fw: 5, cell: (r) => <Badge tone={r.active ? 'success' : 'muted'} dot>{r.active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', header: 'Actions', fw: 6, width: '76px',
      cell: (r) => (
        <div className="row row--xtight row--nowrap">
          <IconButton icon="edit" label="Edit identifier" size={13} onClick={() => setEditing(r)} />
          <IconButton icon="trash" label="Delete identifier" tone="danger" size={13} onClick={() => setConfirm(r)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search identifiers…" />
        <span className="spacer" />
        <Button variant="secondary" icon="link" onClick={() => notify('Checked unmatched alerts against active identifiers — no new matches right now.', 'success')}>Match unmatched alerts</Button>
        <Button variant="primary" icon="plus" onClick={() => setEditing({ entityId: brand.entities[0].id, mid: brand.entities[0].mid, identifier: '', active: true })}>Add identifier</Button>
      </Toolbar>
      <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit identifier' : 'Add identifier'}
        footer={<>
          <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!editing?.identifier?.trim()}
            onClick={() => {
              setRows((p) => (p.some((x) => x.id === editing.id)
                ? p.map((x) => (x.id === editing.id ? editing : x))
                : [...p, { ...editing, id: `id${p.length + 1}` }]));
              notify('Identifier saved.', 'success');
              setEditing(null);
            }}
          >
            Save identifier
          </Button>
        </>}
      >
        {editing && (
          <div className="stack">
            <SelectField
              label="Entity" required value={editing.entityId}
              onChange={(e) => setEditing({ ...editing, entityId: e.target.value, mid: brand.entities.find((en) => en.id === e.target.value)?.mid })}
              options={brand.entities.map((en) => ({ value: en.id, label: en.label }))}
            />
            <TextField label="Identifier" required value={editing.identifier} onChange={(e) => setEditing({ ...editing, identifier: e.target.value.toUpperCase() })} hint="The statement descriptor the network alert carries." />
            <TextField label="MID" value={editing.mid} disabled />
            <ToggleField label="Active" description="Inactive identifiers stop matching new alerts." checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete identifier"
        message={<>Delete <strong>{confirm?.identifier}</strong>? New alerts carrying it will arrive unmatched.</>}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { setRows((p) => p.filter((x) => x.id !== confirm.id)); notify('Identifier deleted.', 'success'); setConfirm(null); }}
      />
    </>
  );
}

function SelfServiceTab() {
  const { notify } = useToast();
  const [rows, setRows] = useState(SELF_SERVICE);

  const setLevel = (entityId, serviceLevel) => {
    setRows((p) => p.map((r) => (r.entityId === entityId ? { ...r, serviceLevel } : r)));
    notify('Service level updated.', 'success');
  };

  const toggleAuto = (entityId, sourceId) => {
    setRows((p) => p.map((r) => (r.entityId === entityId ? { ...r, autoComplete: { ...r.autoComplete, [sourceId]: !r.autoComplete[sourceId] } } : r)));
  };

  return (
    <div className="stack stack--tight" style={{ padding: 'var(--s-1) 0' }}>
      <p className="small muted">
        Self Service means your team decides every outcome by hand. Full Service lets the source below auto-refund
        eligible alerts under the risk threshold before a human ever sees them.
      </p>
      {rows.map((r) => (
        <Card key={r.entityId} title={entityLabel(r.entityId)}>
          <div className="grid grid--2">
            <SelectField
              label="Service level"
              value={r.serviceLevel}
              onChange={(e) => setLevel(r.entityId, e.target.value)}
              options={['Self Service', 'Full Service'].map((v) => ({ value: v, label: v }))}
            />
            <div className="field">
              <span className="field__label">Auto-complete by source</span>
              <div className="row row--loose" style={{ marginTop: 6 }}>
                {ALERT_SOURCES.map((s) => (
                  <Tooltip key={s.id} label={`${r.autoComplete[s.id] ? 'Disable' : 'Enable'} auto-refund for ${s.label} alerts.`}>
                    <label className="row row--xtight" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" className="toggle" checked={r.autoComplete[s.id]} onChange={() => toggleAuto(r.entityId, s.id)} />
                      <span className="small">{s.label}</span>
                    </label>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function AlertSettings() {
  const [tab, setTab] = useState('recipients');

  return (
    <>
      <PageHeader
        title="Alert settings"
        description="Who gets notified, what descriptors route an alert to an entity, and how much of the response happens automatically."
      />

      <Card bodyClassName="card__body--flush">
        <div style={{ padding: '0 var(--s-4)' }}>
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
        </div>
        <div style={{ padding: 'var(--s-4)' }}>
          {tab === 'recipients' && <RecipientsTab />}
          {tab === 'identifiers' && <IdentifiersTab />}
          {tab === 'selfService' && <SelfServiceTab />}
        </div>
      </Card>
    </>
  );
}

export default AlertSettings;
