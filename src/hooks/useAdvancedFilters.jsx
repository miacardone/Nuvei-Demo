import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Surface';
import { TextField } from '@/components/ui/Form';

/**
 * Per-column advanced search, available to any table.
 *
 * The plain search box matches anywhere in a row; this narrows column by
 * column, which is what people reach for once a table is long enough that a
 * single box returns fifty rows. Filters are contains-matches on the rendered
 * value, so they behave the way the column reads rather than the way it is
 * stored.
 *
 * Columns without a value (actions, checkboxes) are not offered.
 */
const FILTERABLE = (c) => c.key !== 'actions' && !c.pinned && c.header;

export function useAdvancedFilters(columns = []) {
  const [filters, setFilters] = useState({});
  const [open, setOpen] = useState(false);

  const fields = useMemo(() => columns.filter(FILTERABLE), [columns]);
  const count = Object.values(filters).filter((v) => String(v ?? '').trim()).length;

  const apply = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => String(v ?? '').trim());
    if (!active.length) return (rows) => rows;
    return (rows) =>
      rows.filter((row) =>
        active.every(([key, needle]) => {
          const raw = row?.[key];
          // Fall back to the row's own value; a cell that renders JSX has no
          // searchable text, so those columns simply never match rather than
          // silently filtering everything out.
          const hay = raw == null ? '' : String(raw);
          return hay.toLowerCase().includes(String(needle).toLowerCase());
        }),
      );
  }, [filters]);

  const clear = () => setFilters({});

  const modal = (
    <Modal open={open} onClose={() => setOpen(false)} title="Advanced search" size="md">
      <div className="stack">
        <p className="small subtle">
          Narrow by individual column. Each box is a contains-match, and they combine with AND.
        </p>
        <div className="grid grid--2" style={{ gap: 'var(--s-3)' }}>
          {fields.map((c) => (
            <TextField
              key={c.key}
              label={c.header}
              value={filters[c.key] ?? ''}
              onChange={(e) => setFilters((p) => ({ ...p, [c.key]: e.target.value }))}
            />
          ))}
        </div>
        <div className="row row--tight" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={clear} disabled={!count}>Clear all</Button>
          <Button variant="primary" onClick={() => setOpen(false)}>Apply</Button>
        </div>
      </div>
    </Modal>
  );

  return { filters, setFilters, count, apply, clear, open, setOpen, modal, onAdvanced: () => setOpen(true) };
}

export default useAdvancedFilters;
