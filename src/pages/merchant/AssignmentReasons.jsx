import { useState } from 'react';
import { PageHeader, Card, Toolbar, Button, IconButton } from '@/components/ui/Surface';
import { DataTable, ExportButtons } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { SearchInput, TextAreaField, TextField } from '@/components/ui/Form';
import { TruncatedText } from '@/components/ui/Overlay';
import { ASSIGNMENT_REASON_META } from '@/data/admin';
import { useToast } from '@/context/ToastContext';
import { formatDate } from '@/utils/format';

export function AssignmentReasons() {
  const { notify } = useToast();
  const [rows, setRows] = useState(ASSIGNMENT_REASON_META);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const filtered = rows.filter((r) => `${r.label} ${r.description}`.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { key: 'label', header: 'Assignment reason', fw: 12, cell: (r) => <span className="small strong">{r.label}</span> },
    { key: 'description', header: 'Description', fw: 20, cell: (r) => <TruncatedText value={r.description} className="small muted" /> },
    { key: 'createdBy', header: 'Created by', fw: 10, cell: (r) => <span className="small mono">{r.createdBy}</span> },
    { key: 'dateCreated', header: 'Date created', fw: 8, cell: (r) => <span className="small">{formatDate(r.dateCreated)}</span> },
    {
      key: 'actions', header: 'Actions', pinned: true, fw: 6, width: '76px', align: 'center',
      cell: (r) => (
        <div className="row row--xtight row--nowrap row--center">
          <IconButton icon="edit" label="Edit reason" size={13} onClick={() => setEditing(r)} />
          <IconButton icon="trash" label="Delete reason" tone="danger" size={13} onClick={() => setConfirm(r)} />
        </div>
      ),
    },
  ];

  const save = () => {
    setRows((p) => (p.some((x) => x.id === editing.id)
      ? p.map((x) => (x.id === editing.id ? editing : x))
      : [...p, { ...editing, id: `ar${p.length + 1}`, createdBy: 'you', dateCreated: new Date().toISOString().slice(0, 10) }]));
    notify(`Assignment reason saved.`, 'success');
    setEditing(null);
  };

  return (
    <>
      <PageHeader
        title="Assignment reasons"
        description="The reasons an analyst picks when a case changes hands. Recorded against every assignment so routing stays auditable."
        actions={<Button variant="primary" icon="plus" onClick={() => setEditing({ label: '', description: '' })}>Add reason</Button>}
      />

      <Card bodyClassName="card__body--flush">
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search reasons…" />
          <ExportButtons columns={columns.filter((c) => c.key !== 'actions')} rows={filtered} name="assignment-reasons" onCopied={(ok) => notify(ok ? 'Copied.' : 'Clipboard blocked.', ok ? 'success' : 'danger')} />
        </Toolbar>
        <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} />
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit assignment reason' : 'Add assignment reason'}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" disabled={!editing?.label?.trim()} onClick={save}>Save reason</Button></>}
      >
        {editing && (
          <div className="stack">
            <TextField label="Assignment reason" required value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
            <TextAreaField label="Description" rows={3} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete assignment reason"
        message={<>Delete <strong>{confirm?.label}</strong>? Cases already using it keep the recorded reason.</>}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { setRows((p) => p.filter((x) => x.id !== confirm.id)); notify('Assignment reason deleted.', 'success'); setConfirm(null); }}
      />
    </>
  );
}

export default AssignmentReasons;
