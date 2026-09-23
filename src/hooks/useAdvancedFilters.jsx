import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Surface';
import { SelectField, TextField } from '@/components/ui/Form';

/**
 * Per-column advanced search, available to any table.
 *
 * The plain search box matches anywhere in a row; this narrows column by
 * column, which is what people reach for once a table is long enough that a
 * single box returns fifty rows.
 *
 * A column controls its own control by declaring `filter`:
 *
 *   filter: false                        not offered at all
 *   filter: { kind: 'select', options }  a dropdown of the real values
 *   filter: { kind: 'number' }           an operator plus an amount
 *   (omitted)                            a contains-match text box
 *
 * Numeric columns deliberately offer no "equals". Asking whether an exposure
 * is exactly $200,375.21 is never the question — the question is whether it is
 * above or below a line.
 */
const NUMBER_OPS = [
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal to' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal to' },
];

const isOffered = (c) => c.filter !== false && c.key !== 'actions' && !c.pinned && c.header;

/** Strips currency symbols, separators and suffixes so "$200,375.21" compares. */
const toNumber = (v) => {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const hasValue = (v) =>
  v && typeof v === 'object' ? String(v.value ?? '').trim() !== '' : String(v ?? '').trim() !== '';

export function useAdvancedFilters(columns = []) {
  const [filters, setFilters] = useState({});
  const [open, setOpen] = useState(false);

  const fields = useMemo(() => columns.filter(isOffered), [columns]);
  const count = Object.values(filters).filter(hasValue).length;

  const apply = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => hasValue(v));
    if (!active.length) return (rows) => rows;

    const colOf = (key) => columns.find((c) => c.key === key);
    const kindOf = (key) => colOf(key)?.filter?.kind ?? 'text';

    /**
     * A column whose displayed value is DERIVED rather than a field on the row
     * — "Marks", say, which is computed from a separate flags store — has
     * nothing at row[key] to match against. `filterValue` lets such a column
     * say what it should be filtered on; everything else reads the field, as
     * before.
     */
    const valueOf = (key, row) => {
      const col = colOf(key);
      return col?.filterValue ? col.filterValue(row) : row?.[key];
    };

    return (rows) =>
      rows.filter((row) =>
        active.every(([key, cond]) => {
          const raw = valueOf(key, row);
          const kind = kindOf(key);

          if (kind === 'number') {
            const left = toNumber(raw);
            const right = toNumber(cond.value);
            if (left == null || right == null) return false;
            if (cond.op === 'gte') return left >= right;
            if (cond.op === 'lt') return left < right;
            if (cond.op === 'lte') return left <= right;
            return left > right;
          }

          const hay = raw == null ? '' : String(raw);
          // A dropdown picks a real value, so it matches exactly; free text is
          // a contains-match because people type fragments.
          return kind === 'select'
            ? hay.toLowerCase() === String(cond).toLowerCase()
            : hay.toLowerCase().includes(String(cond).toLowerCase());
        }),
      );
  }, [filters, columns]);

  const clear = () => setFilters({});

  const control = (c) => {
    const kind = c.filter?.kind ?? 'text';

    if (kind === 'select') {
      return (
        <SelectField
          key={c.key}
          label={c.header}
          placeholder="Any"
          value={filters[c.key] ?? ''}
          onChange={(e) => setFilters((p) => ({ ...p, [c.key]: e.target.value }))}
          options={(c.filter.options ?? []).map((o) =>
            typeof o === 'string' ? { value: o, label: o } : o,
          )}
        />
      );
    }

    if (kind === 'number') {
      const cond = filters[c.key] ?? { op: 'gt', value: '' };
      const set = (patch) => setFilters((p) => ({ ...p, [c.key]: { ...cond, ...patch } }));
      return (
        <div key={c.key} className="stack stack--xtight">
          <SelectField label={c.header} value={cond.op} onChange={(e) => set({ op: e.target.value })} options={NUMBER_OPS} />
          <TextField
            type="number"
            aria-label={`${c.header} amount`}
            placeholder="Amount"
            value={cond.value}
            onChange={(e) => set({ value: e.target.value })}
          />
        </div>
      );
    }

    return (
      <TextField
        key={c.key}
        label={c.header}
        value={filters[c.key] ?? ''}
        onChange={(e) => setFilters((p) => ({ ...p, [c.key]: e.target.value }))}
      />
    );
  };

  const modal = (
    <Modal open={open} onClose={() => setOpen(false)} title="Advanced search" size="md">
      <div className="stack">
        <p className="small subtle">
          Narrow by individual column. Conditions combine with AND.
        </p>
        <div className="grid grid--2" style={{ gap: 'var(--s-3)' }}>
          {fields.map(control)}
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
