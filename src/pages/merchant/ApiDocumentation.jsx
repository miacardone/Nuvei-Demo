import { useState } from 'react';
import { PageHeader, Card, Button, Badge, StatusIcon } from '@/components/ui/Surface';
import { DataTable } from '@/components/ui/DataTable';
import { TruncatedText } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { API_BASE, API_ENDPOINTS, API_GROUPS, AUTH_NOTE } from '@/data/content';
import { useToast } from '@/context/ToastContext';

function CopyButton({ value, label = 'Copy' }) {
  const { notify } = useToast();
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={done ? 'check' : 'copy'}
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }
        catch { notify('Your browser blocked clipboard access.', 'danger'); }
      }}
    >
      {done ? 'Copied' : label}
    </Button>
  );
}

function ParamTable({ title, rows }) {
  if (!rows?.length) return null;
  const columns = [
    { key: 'name', header: 'Name', fw: 8, cell: (r) => <span className="mono small">{r.name}</span> },
    { key: 'type', header: 'Type', fw: 6, cell: (r) => <span className="mono micro subtle">{r.type}</span> },
    { key: 'required', header: 'Required', fw: 5, align: 'center', cell: (r) => <StatusIcon icon={r.required ? 'check' : 'close'} tone={r.required ? 'primary' : 'muted'} label={r.required ? 'Required' : 'Optional'} /> },
    { key: 'description', header: 'Description', fw: 16, cell: (r) => <TruncatedText value={r.description ?? '—'} className="small muted" /> },
  ];
  return (
    <div className="stack stack--tight">
      <span className="t-section-label">{title}</span>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.name} density="fit" />
    </div>
  );
}

export function ApiDocumentation() {
  const [activeId, setActiveId] = useState(API_ENDPOINTS[0].id);
  const endpoint = API_ENDPOINTS.find((e) => e.id === activeId) ?? API_ENDPOINTS[0];

  const sample = JSON.stringify(endpoint.response, null, 2);
  const curl = `curl -X ${endpoint.method} '${API_BASE}${endpoint.path}' \\\n  -H 'Authorization: Bearer <token>' \\\n  -H 'Content-Type: application/json'`;

  return (
    <>
      <PageHeader title="API documentation" description="The endpoints behind this console — request and response schemas, error codes and samples." />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', alignItems: 'start' }}>
        <Card title="Endpoints" bodyClassName="card__body--tight">
          {API_GROUPS.map((group) => {
            const items = API_ENDPOINTS.filter((e) => e.group === group);
            if (!items.length) return null;
            return (
              <div key={group} style={{ marginBottom: 'var(--s-3)' }}>
                <div className="t-section-label" style={{ padding: '0 var(--s-2) var(--s-1)' }}>{group}</div>
                {items.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="popover__item"
                    style={e.id === activeId ? { background: 'var(--c-primary-tint)', color: 'var(--c-primary-deep)', fontWeight: 600 } : undefined}
                    onClick={() => setActiveId(e.id)}
                  >
                    <span className={`method method--${e.method.toLowerCase()}`}>{e.method}</span>
                    <span className="mono micro truncate">{e.path}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </Card>

        <div className="stack stack--tight">
          <Card>
            <div className="stack stack--tight">
              <div className="row row--xtight">
                <span className={`method method--${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
                <span className="mono strong">{endpoint.path}</span>
              </div>
              <h2>{endpoint.summary}</h2>
              {endpoint.description && <p className="small muted">{endpoint.description}</p>}
              <div className="row row--tight">
                <code className="code-inline">{API_BASE}{endpoint.path}</code>
                <CopyButton value={`${API_BASE}${endpoint.path}`} label="Copy URL" />
              </div>
            </div>
          </Card>

          <Card title="Request schema">
            <div className="stack stack--tight">
              <ParamTable title="Path parameters" rows={endpoint.params} />
              <ParamTable title="Query parameters" rows={endpoint.query} />
              <ParamTable title="Body" rows={endpoint.body} />
              {!endpoint.params && !endpoint.query && !endpoint.body && <p className="small muted">This endpoint takes no parameters.</p>}
            </div>
          </Card>

          <Card title="Request" action={<CopyButton value={curl} label="Copy cURL" />}>
            <pre className="code">{curl}</pre>
          </Card>

          <Card title="Response schema" action={<CopyButton value={sample} label="Copy JSON" />}>
            <div className="stack stack--tight">
              <Badge tone="success">200 OK</Badge>
              <pre className="code">{sample}</pre>
            </div>
          </Card>

          {endpoint.errors?.length > 0 && (
            <Card title="Error codes" bodyClassName="card__body--flush">
              <DataTable
                columns={[
                  {
                    key: 'code', header: 'Code', fw: 4,
                    cell: (r) => (
                      <span className="row row--xtight row--nowrap">
                        <Icon name="alert" size={12} style={{ color: r.code >= 500 ? 'var(--c-danger)' : 'var(--c-warning)' }} />
                        <span className="mono small">{r.code}</span>
                      </span>
                    ),
                  },
                  { key: 'meaning', header: 'Meaning', fw: 20, cell: (r) => <span className="small muted">{r.meaning}</span> },
                ]}
                rows={endpoint.errors}
                rowKey={(r) => String(r.code)}
              />
            </Card>
          )}

          <Card title={AUTH_NOTE.title}>
            <div className="stack stack--tight">
              <p className="small muted">{AUTH_NOTE.body}</p>
              <pre className="code">{AUTH_NOTE.sample}</pre>
              <span className="row row--xtight micro subtle"><Icon name="lock" size={12} />Tokens are tenant-scoped.</span>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

export default ApiDocumentation;
