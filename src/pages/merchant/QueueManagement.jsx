import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, Button, IconButton } from '@/components/ui/Surface';
import { DataTable, TableToolbar } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { TextAreaField, TextField } from '@/components/ui/Form';
import { TruncatedText } from '@/components/ui/Overlay';
import { QUEUE_META } from '@/data/admin';
import { CASES } from '@/data/cases';
import { totalsByQueue } from '@/domain/metrics';
import { useToast } from '@/context/ToastContext';
import { usePerspective } from '@/hooks/usePerspective';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

export function QueueManagement() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { routes } = usePerspective();

  const depths = useMemo(() => totalsByQueue(CASES), []);
  const [rows, setRows] = useState(QUEUE_META);
  const [search, setSearch] = useState('');
  // Table chrome. Same controls in the same order as every other table.
  const [density, setDensity] = useState('comfortable');
  const [hidden, setHidden] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const joined = rows.map((q) => ({ ...q, ...(depths.find((d) => d.id === q.id) ?? { casesInQueue: 0, overdue: 0, value: 0 }) }));
  const filtered = joined.filter((r) => `${r.label} ${r.description}`.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { key: 'label', header: 'Queue name', fw: 12, cell: (r) => <span className="small strong">{r.label}</span> },
    { key: 'description', header: 'Description', fw: 18, cell: (r) => <TruncatedText value={r.description} className="small muted" /> },
    {
      key: 'casesInQueue', header: 'Cases in queue', fw: 8, align: 'right',
      // A link, because the obvious next question is "which cases?"
      cell: (r) => (
        <button
          type="button"
          className="mono small"
          style={{ border: 0, background: 'transparent', color: 'var(--c-primary)', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => navigate(`${routes.caseManagement}?queue=${r.id}`)}
        >
          {formatNumber(r.casesInQueue)}
        </button>
      ),
    },
    { key: 'overdue', header: 'Overdue', fw: 6, align: 'right', cell: (r) => <span className="mono small" style={r.overdue ? { color: 'var(--c-danger)' } : undefined}>{formatNumber(r.overdue)}</span> },
    { key: 'value', header: 'Exposure', fw: 8, align: 'right', cell: (r) => <span className="mono small">{formatCurrency(r.value)}</span> },
    { key: 'sla', header: 'SLA', fw: 5, align: 'right', cell: (r) => <span className="mono small">{r.sla}h</span> },
    { key: 'createdBy', header: 'Created by', fw: 10, cell: (r) => <span className="small mono">{r.createdBy}</span> },
    { key: 'dateCreated', header: 'Date created', fw: 8, cell: (r) => <span className="small">{formatDate(r.dateCreated)}</span> },
    {
      key: 'actions', header: 'Actions', pinned: true, fw: 6, width: '76px', align: 'center',
      cell: (r) => (
        <div className="row row--xtight row--nowrap row--center">
          <IconButton icon="edit" label="Edit queue" size={13} onClick={() => setEditing(r)} />
          <IconButton icon="trash" label="Delete queue" tone="danger" size={13} onClick={() => setConfirm(r)} />
        </div>
      ),
    },
  ];


  const visibleColumns = columns.filter((c) => !hidden.includes(c.key));

  return (
    <>
      <PageHeader
        title="Queue management"
        description="Queues, their service targets, and how much work is sitting in each right now."
        actions={<Button variant="primary" icon="plus" onClick={() => setEditing({ label: '', description: '', sla: 48 })}>Add queue</Button>}
      />

      <Card bodyClassName="card__body--flush">
        <TableToolbar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search queues…"
          density={density}
          onDensityChange={setDensity}
          columns={columns}
          hidden={hidden}
          onHiddenChange={setHidden}
          exportColumns={visibleColumns}
          exportRows={filtered}
          exportName="queues"
          onCopied={(ok) => notify(ok ? 'Copied.' : 'Clipboard blocked.', ok ? 'success' : 'danger')}
        />
        <DataTable columns={visibleColumns} density={density} rows={filtered} rowKey={(r) => r.id} />
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit queue' : 'Add queue'}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" disabled={!editing?.label?.trim()} onClick={() => { setRows((p) => (p.some((x) => x.id === editing.id) ? p.map((x) => (x.id === editing.id ? editing : x)) : [...p, { ...editing, id: `q${p.length + 1}`, createdBy: 'you', dateCreated: new Date().toISOString().slice(0, 10) }])); notify('Queue saved.', 'success'); setEditing(null); }}>Save queue</Button></>}
      >
        {editing && (
          <div className="stack">
            <TextField label="Queue name" required value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
            <TextAreaField label="Description" rows={2} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <TextField label="Service target (hours)" type="number" min="1" value={editing.sla ?? ''} onChange={(e) => setEditing({ ...editing, sla: Number(e.target.value) })} hint="How long a case may sit here before it is late." />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete queue"
        message={confirm?.casesInQueue > 0
          ? <>“{confirm.label}” still holds <strong>{formatNumber(confirm.casesInQueue)}</strong> open cases. Move them before deleting.</>
          : <>Delete <strong>{confirm?.label}</strong>?</>}
        confirmLabel={confirm?.casesInQueue > 0 ? 'Cannot delete' : 'Delete'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm.casesInQueue > 0) { notify('Move the cases out of that queue first.', 'warning'); setConfirm(null); return; }
          setRows((p) => p.filter((x) => x.id !== confirm.id)); notify('Queue deleted.', 'success'); setConfirm(null);
        }}
      />
    </>
  );
}

export default QueueManagement;
