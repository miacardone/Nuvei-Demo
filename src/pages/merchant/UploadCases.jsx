import { useRef, useState } from 'react';
import { PageHeader, Card, Button } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { Tooltip, TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import brand from '@/brand/brand.config';
import { UPLOAD_HISTORY, buildUploadSchema } from '@/data/admin';
import { useToast } from '@/context/ToastContext';
import { formatDateTime, formatNumber } from '@/utils/format';

export function UploadCases() {
  const { notify } = useToast();
  const inputRef = useRef(null);

  const [uploads, setUploads] = useState(UPLOAD_HISTORY);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const schema = buildUploadSchema(brand);

  const handle = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      notify('Only CSV files can be imported.', 'danger');
      return;
    }

    setBusy(true);
    setTimeout(() => {
      const rows = 20 + (file.name.length * 4);
      const rejected = file.name.includes('prearb') ? 2 : 0;
      const record = {
        id: `up${uploads.length + 15}`,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'you',
        rows,
        accepted: rows - rejected,
        rejected,
        status: rejected ? 'Completed' : 'Completed',
        note: rejected ? `${rejected} rows rejected: unrecognized reason code.` : null,
      };
      setUploads((p) => [record, ...p]);
      setBusy(false);
      notify(rejected ? `${formatNumber(record.accepted)} rows imported, ${rejected} rejected.` : `${formatNumber(record.accepted)} rows imported.`, rejected ? 'warning' : 'success');
    }, 700);
  };

  const historyColumns = [
    {
      key: 'filename', header: 'File', fw: 16,
      cell: (r) => (
        <span className="stack stack--xtight" style={{ minWidth: 0 }}>
          <TruncatedText value={r.filename} className="mono small" />
          {r.note && <span className="micro subtle">{r.note}</span>}
        </span>
      ),
    },
    { key: 'uploadedBy', header: 'Uploaded by', fw: 10, cell: (r) => <span className="small mono">{r.uploadedBy}</span> },
    { key: 'rows', header: 'Rows', fw: 5, align: 'right', cell: (r) => <span className="mono small">{formatNumber(r.rows)}</span> },
    { key: 'accepted', header: 'Accepted', fw: 6, align: 'right', cell: (r) => <span className="mono small">{formatNumber(r.accepted)}</span> },
    { key: 'rejected', header: 'Rejected', fw: 6, align: 'right', cell: (r) => <span className="mono small" style={r.rejected ? { color: 'var(--c-danger)' } : undefined}>{formatNumber(r.rejected)}</span> },
    {
      key: 'status', header: 'Status', fw: 7,
      cell: (r) => (
        <Tooltip label={r.status}>
          <span style={{ display: 'inline-flex' }}>
            <Icon name={r.status === 'Failed' ? 'close' : 'check'} size={15} style={{ color: r.status === 'Failed' ? 'var(--c-danger)' : 'var(--c-success)' }} />
          </span>
        </Tooltip>
      ),
    },
    { key: 'uploadedAt', header: 'When', fw: 9, align: 'right', cell: (r) => <span className="micro subtle nowrap">{formatDateTime(r.uploadedAt)}</span> },
  ];

  const schemaColumns = [
    {
      key: 'column', header: 'Column', fw: 12,
      cell: (r) => (
        <span className="stack stack--xtight">
          <span className="mono small">{r.column}</span>
          {r.note && <span className="micro subtle">{r.note}</span>}
        </span>
      ),
    },
    { key: 'example', header: 'Example', fw: 12, cell: (r) => <TruncatedText value={r.example} className="mono micro subtle" /> },
    {
      key: 'required', header: 'Required', fw: 6,
      cell: (r) => (
        <Tooltip label={r.required ? 'Required' : 'Optional'}>
          <span style={{ display: 'inline-flex' }}>
            <Icon name={r.required ? 'check' : 'close'} size={14} style={{ color: r.required ? 'var(--c-primary)' : 'var(--c-ink-subtle)' }} />
          </span>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Upload cases"
        description={`Import chargebacks from an acquirer file, or ${brand.terms.claimProgramme} claims from the ${brand.terms.marketplace} export.`}
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(300px, 1fr)', alignItems: 'start' }}>
        <div className="stack stack--tight">
          <Card>
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
              <span className="small strong">{busy ? 'Importing…' : 'Drop a CSV here, or click to choose'}</span>
              <span className="micro subtle">
                Rows failing validation are rejected individually and reported — the rest of the batch still imports.
              </span>
              <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => handle(e.target.files?.[0])} />
            </div>
          </Card>

          <Card title="Upload history" bodyClassName="card__body--flush">
            <DataTable columns={historyColumns} rows={uploads} rowKey={(r) => r.id} />
          </Card>
        </div>

        <Card title="Expected columns" bodyClassName="card__body--flush">
          <DataTable columns={schemaColumns} rows={schema} rowKey={(r) => r.column} density="fit" />
          <div className="card__foot">
            <Icon name="info" size={13} className="subtle" />
            <span className="micro subtle">The header row must match these names exactly.</span>
          </div>
        </Card>
      </div>
    </>
  );
}

export default UploadCases;
