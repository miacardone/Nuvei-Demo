import { useState } from 'react';
import { PageHeader, Card, Button, IconButton, Badge, EmptyState, StatusIcon } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { SelectField, TextField } from '@/components/ui/Form';
import { TruncatedText } from '@/components/ui/Overlay';
import { WEBHOOKS, WEBHOOK_TOPICS } from '@/data/admin';
import { useToast } from '@/context/ToastContext';
import { formatDate } from '@/utils/format';

export function Webhooks() {
  const { notify } = useToast();
  const [hooks, setHooks] = useState(WEBHOOKS);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [confirm, setConfirm] = useState(null);

  const httpsOk = endpoint.startsWith('https://');
  const valid = topic && httpsOk;

  const columns = [
    { key: 'topic', header: 'Topic', fw: 10, cell: (r) => <span className="mono small">{r.topic}</span> },
    { key: 'protocol', header: 'Protocol', fw: 5, align: 'center', cell: () => <Badge tone="neutral">HTTPS</Badge> },
    { key: 'endpoint', header: 'Endpoint', fw: 18, cell: (r) => <TruncatedText value={r.endpoint} className="mono micro" /> },
    { key: 'createdBy', header: 'Created by', fw: 9, cell: (r) => <span className="small mono">{r.createdBy}</span> },
    { key: 'dateCreated', header: 'Date created', fw: 7, cell: (r) => <span className="small">{formatDate(r.dateCreated)}</span> },
    { key: 'status', header: 'Status', fw: 6, align: 'center', cell: (r) => <StatusIcon icon={r.status === 'Active' ? 'check' : 'close'} tone={r.status === 'Active' ? 'success' : 'muted'} label={r.status} /> },
    { key: 'actions', header: 'Actions', pinned: true, fw: 5, width: '52px', align: 'center', cell: (r) => <IconButton icon="trash" label="Delete webhook" tone="danger" size={13} onClick={() => setConfirm(r)} /> },
  ];

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Send case events to your own systems. Deliveries retry with backoff."
        actions={<Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Create webhook</Button>}
      />

      <Card bodyClassName="card__body--flush">
        {hooks.length === 0 ? (
          <EmptyState
            icon="webhook"
            title="No webhooks yet"
            hint="Create a webhook to receive case events at an endpoint you control — new cases, status changes, overdue warnings and consolidation alerts."
            action={<Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Create webhook</Button>}
          />
        ) : (
          <DataTable columns={columns} rows={hooks} rowKey={(r) => r.id} />
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create webhook"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => { setHooks((p) => [...p, { id: `wh${p.length + 1}`, topic, protocol: 'HTTPS', endpoint, createdBy: 'you', dateCreated: new Date().toISOString().slice(0, 10), status: 'Active' }]); notify('Webhook created.', 'success'); setOpen(false); setTopic(''); setEndpoint(''); }}>Create webhook</Button></>}
      >
        <div className="stack">
          <SelectField
            label="Topic"
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Select an event…"
            options={WEBHOOK_TOPICS.map((t) => ({ value: t.id, label: t.label }))}
            hint={topic ? WEBHOOK_TOPICS.find((t) => t.id === topic)?.description : undefined}
          />
          <TextField
            label="Endpoint URL"
            required
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://hooks.example.com/disputes"
            error={endpoint && !httpsOk ? 'The endpoint must use HTTPS.' : undefined}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete webhook"
        message={<>Stop delivering <strong>{confirm?.topic}</strong> to this endpoint?</>}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { setHooks((p) => p.filter((x) => x.id !== confirm.id)); notify('Webhook deleted.', 'success'); setConfirm(null); }}
      />
    </>
  );
}

export default Webhooks;
