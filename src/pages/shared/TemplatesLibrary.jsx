import { useMemo, useRef, useState } from 'react';
import { PageHeader, Card, Toolbar, Button, IconButton } from '@/components/ui/Surface';
import { DataTable, ColumnToggle, ExportButtons } from '@/components/ui/DataTable';
import { SearchBar } from '@/components/ui/Form';
import { ConfirmDialog } from '@/components/ui/Modal';
import { TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { TEMPLATE_LIBRARY } from '@/data/admin';
import { CURRENT_USER } from '@/data/people';
import { useToast } from '@/context/ToastContext';
import { formatDateTime, formatFileSize } from '@/utils/format';

const ACCEPTED = ['.pdf', '.jpg', '.jpeg', '.png'];

function typeOf(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  return ext === 'jpeg' ? 'jpg' : ext;
}

export function TemplatesLibrary() {
  const { notify } = useToast();
  const inputRef = useRef(null);

  const [templates, setTemplates] = useState(TEMPLATE_LIBRARY);
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(new Set());
  const [confirm, setConfirm] = useState(null);

  const handle = (file) => {
    if (!file) return;
    const type = typeOf(file.name);
    if (!ACCEPTED.includes(`.${type}`)) {
      notify('Only PDF and image files can be uploaded.', 'danger');
      return;
    }

    setBusy(true);
    setTimeout(() => {
      setTemplates((p) => [
        { id: `tpl-new-${p.length + 1}`, name: file.name, type, size: file.size, modifiedBy: CURRENT_USER.email, lastModified: new Date().toISOString() },
        ...p,
      ]);
      setBusy(false);
      notify(`${file.name} uploaded.`, 'success');
    }, 500);
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const scoped = q ? templates.filter((t) => t.name.toLowerCase().includes(q)) : templates;
    return [...scoped].sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  }, [templates, search]);

  const allColumns = [
    {
      key: 'name', header: 'Name', fw: 16, sortable: true, description: 'The template file name.',
      cell: (r) => (
        <span className="row row--tight row--nowrap">
          <Icon name={r.type === 'pdf' ? 'file' : 'image'} size={14} style={{ color: 'var(--c-ink-subtle)', flex: 'none' }} />
          <TruncatedText value={r.name} />
        </span>
      ),
    },
    { key: 'size', header: 'Size', fw: 6, align: 'right', sortable: true, description: 'File size.', cell: (r) => <span className="mono small">{formatFileSize(r.size)}</span> },
    { key: 'modifiedBy', header: 'Modified by', fw: 10, description: 'Who last uploaded or replaced this file.', cell: (r) => <span className="small mono">{r.modifiedBy}</span> },
    { key: 'lastModified', header: 'Last modified', fw: 9, align: 'right', sortable: true, description: 'When this file was last uploaded or replaced.', cell: (r) => <span className="small subtle nowrap">{formatDateTime(r.lastModified)}</span> },
    {
      key: 'actions', header: 'Actions', pinned: true, fw: 6, width: '76px', align: 'center', description: 'Download or remove this template.',
      cell: (r) => (
        <span className="row row--xtight row--nowrap">
          <IconButton icon="download" label="Download" onClick={() => notify(`Downloading ${r.name}…`)} />
          <IconButton icon="trash" label="Delete template" tone="danger" size={13} onClick={() => setConfirm(r)} />
        </span>
      ),
    },
  ];
  const columns = allColumns.filter((c) => !hidden.has(c.key));

  return (
    <>
      <PageHeader
        title="Templates library"
        description="Representment letters and evidence documents your team can attach to a case from Work case."
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 1.7fr)', alignItems: 'start' }}>
        <Card title="Upload template">
          <div
            className={`dropzone ${dragging ? 'is-dragging' : ''}`.trim()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <span className="empty__glyph"><Icon name={busy ? 'refresh' : 'upload'} size={20} /></span>
            <span className="small strong">{busy ? 'Uploading…' : 'Drop a PDF or image here, or click to choose'}</span>
            <span className="micro subtle">PDF, JPG or PNG. Uploading a file with the same name replaces it.</span>
            <input ref={inputRef} type="file" accept={ACCEPTED.join(',')} className="sr-only" onChange={(e) => handle(e.target.files?.[0])} />
          </div>
        </Card>

        <Card title="Templates" bodyClassName="card__body--flush">
          <Toolbar>
            <SearchBar value={search} onChange={setSearch} placeholder="Search templates…" />
            <div className="row row--tight">
              <ColumnToggle columns={allColumns} hidden={hidden} onChange={setHidden} />
              <ExportButtons
                columns={columns.filter((c) => c.key !== 'actions')}
                rows={rows}
                name="templates"
                onCopied={(ok) => notify(ok ? 'Copied to clipboard.' : 'Your browser blocked clipboard access.', ok ? 'success' : 'danger')}
              />
            </div>
          </Toolbar>

          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} density="comfortable" />
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete template"
        message={<>Remove <strong>{confirm?.name}</strong> from the library? Cases that already attached it keep their copy.</>}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { setTemplates((p) => p.filter((t) => t.id !== confirm.id)); notify('Template deleted.', 'success'); setConfirm(null); }}
      />
    </>
  );
}

export default TemplatesLibrary;
