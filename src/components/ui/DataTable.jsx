import { Fragment, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button, IconButton } from '@/components/ui/Surface';
import { Popover, Tooltip, TruncatedText } from '@/components/ui/Overlay';
import { copyToClipboard, downloadCsv, downloadExcel } from '@/utils/export';
import { formatNumber } from '@/utils/format';

/**
 * The one data table. Every list screen passes `columns` + `rows`; no screen
 * hand-writes a <tr>.
 *
 * Density is the interesting part. "Fit to width" uses table-fixed with
 * proportional widths so nothing scrolls horizontally and headers truncate;
 * "Comfortable" uses natural widths, shows headers in full and scrolls. Both
 * modes tooltip anything that truncates.
 *
 * Optional, opt-in: selection, expansion, drag-to-reorder.
 */

export const PAGE_SIZES = [10, 25, 50, 100];

/* ---------- Density ---------- */

export function DensityToggle({ value, onChange }) {
  return (
    <div className="seg" role="group" aria-label="Table density">
      <Tooltip label="Fit to width — every column compressed to fit, no horizontal scroll">
        <button type="button" className={`seg__btn ${value === 'fit' ? 'is-active' : ''}`.trim()} onClick={() => onChange('fit')}>
          <Icon name="columns" size={12} /> Fit to width
        </button>
      </Tooltip>
      <Tooltip label="Comfortable — natural widths and full headers, scrolls horizontally">
        <button type="button" className={`seg__btn ${value === 'comfortable' ? 'is-active' : ''}`.trim()} onClick={() => onChange('comfortable')}>
          Comfortable
        </button>
      </Tooltip>
    </div>
  );
}

/* ---------- Column toggle ---------- */

export function ColumnToggle({ columns, hidden, onChange }) {
  const allVisible = hidden.size === 0;

  return (
    <Popover
      width={230}
      align="right"
      trigger={({ toggle }) => (
        <Button variant="secondary" size="sm" icon="columns" onClick={toggle}>Column Toggle</Button>
      )}
    >
      {() => (
        <>
          <div className="popover__label t-section-label">Columns</div>
          <label className="popover__item" style={{ borderBottom: '1px solid var(--c-line)' }}>
            <input type="checkbox" className="checkbox" checked={allVisible} onChange={() => onChange(new Set())} />
            <span className="strong">All columns</span>
          </label>
          {columns.map((c) => (
            <label key={c.key} className="popover__item">
              <input
                type="checkbox"
                className="checkbox"
                checked={!hidden.has(c.key)}
                disabled={c.locked}
                onChange={() => {
                  const next = new Set(hidden);
                  if (next.has(c.key)) next.delete(c.key); else next.add(c.key);
                  onChange(next);
                }}
              />
              {c.header}
            </label>
          ))}
        </>
      )}
    </Popover>
  );
}

/* ---------- Export ---------- */

export function ExportButtons({ columns, rows, name = 'export', onCopied }) {
  return (
    <div className="row row--xtight row--nowrap">
      <IconButton icon="copy" label="Copy to clipboard" onClick={async () => { const ok = await copyToClipboard(columns, rows); onCopied?.(ok); }} />
      <IconButton icon="excel" label="Download as Excel" onClick={() => downloadExcel(columns, rows, name)} />
      <IconButton icon="csv" label="Download as CSV" onClick={() => downloadCsv(columns, rows, name)} />
    </div>
  );
}

/* ---------- Pagination ---------- */

export function Pagination({ total, page, pageSize, onPageChange, onPageSizeChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="pagination">
      <label className="row row--tight row--nowrap">
        <span>Rows per page</span>
        <select className="select" style={{ width: 72, height: 28 }} value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <div className="pagination__nav">
        <span className="mono">{formatNumber(start)}–{formatNumber(end)} of {formatNumber(total)}</span>
        <div className="row row--xtight row--nowrap">
          <IconButton icon="chevronsLeft" label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
          <IconButton icon="chevronsRight" label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Table ---------- */

/**
 * Column order: pinned columns (`c.pinned`) always render first, in the
 * order given, and are not draggable — that's what "pinned" means here.
 * Everything else is user-reorderable by dragging its header; order is kept
 * in component state, keyed by column `key`, so a tab/filter change that
 * swaps in a different column set doesn't carry over a stale order.
 */
function useColumnOrder(columns) {
  const pinned = columns.filter((c) => c.pinned);
  const reorderable = columns.filter((c) => !c.pinned);
  const [order, setOrder] = useState(() => reorderable.map((c) => c.key));

  const knownKeys = reorderable.map((c) => c.key).join('|');
  const [lastKnownKeys, setLastKnownKeys] = useState(knownKeys);
  if (knownKeys !== lastKnownKeys) {
    setLastKnownKeys(knownKeys);
    setOrder(reorderable.map((c) => c.key));
  }

  const byKey = Object.fromEntries(reorderable.map((c) => [c.key, c]));
  const ordered = order.map((k) => byKey[k]).filter(Boolean);

  const reorder = (dragKey, overKey, edge = 'left') => {
    if (dragKey === overKey) return;
    setOrder((prev) => {
      const next = prev.filter((k) => k !== dragKey);
      const overIdx = next.indexOf(overKey);
      const at = edge === 'right' ? overIdx + 1 : overIdx;
      next.splice(at, 0, dragKey);
      return next;
    });
  };

  return [...pinned, ...ordered].length ? { columns: [...pinned, ...ordered], pinnedCount: pinned.length, reorder } : { columns, pinnedCount: 0, reorder };
}

export function DataTable({
  columns: columnsProp,
  rows,
  rowKey,
  density = 'comfortable',
  sort,
  onSort,
  selection,
  expansion,
  rowDrag,
  onRowClick,
  empty,
}) {
  const [hint, setHint] = useState(null);
  const [invalidId, setInvalidId] = useState(null);
  const [dragColKey, setDragColKey] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const fit = density === 'fit';

  const { columns, pinnedCount, reorder } = useColumnOrder(columnsProp);

  const clearDrag = () => { setHint(null); setInvalidId(null); };
  const clearColDrag = () => { setDragColKey(null); setDragOverCol(null); };

  const edgeOf = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY - r.top < r.height / 2 ? 'top' : 'bottom';
  };

  const colEdgeOf = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientX - r.left < r.width / 2 ? 'left' : 'right';
  };

  if (!rows.length && empty) return <div className="dt__empty">{empty}</div>;

  const lead = (selection ? 1 : 0) + (expansion ? 1 : 0) + (rowDrag ? 1 : 0);
  const colSpan = columns.length + lead;

  // Fit mode spreads the remaining width by each column's weight.
  const totalWeight = columns.reduce((s, c) => s + (c.fw ?? 8), 0);
  const widthFor = (c) => (fit ? `${((c.fw ?? 8) / totalWeight) * 100}%` : c.width);

  const allSelected = rows.length > 0 && rows.every((r) => selection?.selected.has(rowKey(r)));
  const someSelected = rows.some((r) => selection?.selected.has(rowKey(r)));

  const dropLine = (indent) => (
    <tr className="drop-line" aria-hidden>
      <td colSpan={colSpan}><div className={`drop-line__bar ${indent ? 'drop-line__bar--indent' : ''}`.trim()} /></td>
    </tr>
  );

  return (
    <div className={fit ? 'dt-wrap dt-wrap--fit' : 'dt-wrap dt-wrap--scroll'}>
      <table className={`dt ${fit ? 'dt--fit' : ''}`.trim()}>
        <thead>
          <tr>
            {rowDrag && <th className="dt__lead" />}
            {selection && (
              <th className="dt__lead">
                <span className="dt__lead-fill">
                  <input
                    type="checkbox"
                    className="checkbox"
                    aria-label="Select all rows"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={() => selection.onToggleAll(rows.map(rowKey), !allSelected)}
                  />
                </span>
              </th>
            )}
            {expansion && <th className="dt__lead" />}

            {columns.map((c, i) => {
              const active = sort?.key === c.key;
              const draggableCol = i >= pinnedCount;
              const header = c.sortable && onSort ? (
                <button type="button" className="dt__sort-btn" onClick={() => onSort(c.key)}>
                  <span className="truncate">{c.header}</span>
                  <Icon
                    name={active ? (sort.dir === 'asc' ? 'arrowUp' : 'arrowDown') : 'chevronsUpDown'}
                    size={fit ? 9 : 11}
                    className={active ? 'dt__caret' : 'dt__caret dt__caret--idle'}
                  />
                </button>
              ) : (
                <span className="truncate">{c.header}</span>
              );

              // Fit mode truncates headers, so they always get a tooltip; a
              // column with a `description` gets one in comfortable mode too.
              const headerTooltip = c.description
                ? (fit ? `${c.header} — ${c.description}` : c.description)
                : (fit ? c.header : null);

              return (
                <th
                  key={c.key}
                  style={{ width: widthFor(c), textAlign: c.align ?? 'left' }}
                  className={[
                    draggableCol ? 'dt__th--draggable' : 'dt__th--pinned',
                    dragColKey === c.key ? 'is-dragging' : '',
                    dragOverCol?.key === c.key ? `dt__th--drop-${dragOverCol.edge}` : '',
                  ].filter(Boolean).join(' ')}
                  draggable={draggableCol}
                  onDragStart={draggableCol ? (e) => { e.dataTransfer.effectAllowed = 'move'; setDragColKey(c.key); } : undefined}
                  onDragOver={draggableCol ? (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragColKey && dragColKey !== c.key) setDragOverCol({ key: c.key, edge: colEdgeOf(e) });
                  } : undefined}
                  onDrop={draggableCol ? (e) => {
                    e.preventDefault();
                    if (dragColKey) reorder(dragColKey, c.key, dragOverCol?.key === c.key ? dragOverCol.edge : colEdgeOf(e));
                    clearColDrag();
                  } : undefined}
                  onDragLeave={draggableCol ? () => setDragOverCol((p) => (p?.key === c.key ? null : p)) : undefined}
                  onDragEnd={draggableCol ? clearColDrag : undefined}
                >
                  {draggableCol && <Icon name="drag" size={11} className="dt__th-handle" aria-hidden />}
                  {headerTooltip ? <Tooltip label={headerTooltip}>{header}</Tooltip> : header}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const id = rowKey(row);
            const expanded = expansion?.expanded.has(id) ?? false;
            const dragging = rowDrag?.draggingId === id;
            const inBlock = rowDrag?.blockIds?.has(id) ?? false;
            const invalid = invalidId === id;
            const showTop = hint?.anchorId === id && hint.edge === 'top';
            const showBottom = hint?.anchorId === id && hint.edge === 'bottom';

            const cls = [
              dragging ? 'is-dragging' : '',
              inBlock && !dragging ? 'in-block' : '',
              invalid ? 'is-invalid' : '',
              selection?.selected.has(id) ? 'is-selected' : '',
              onRowClick ? 'is-clickable' : '',
            ].filter(Boolean).join(' ');

            return (
              <Fragment key={id}>
                {showTop && dropLine(hint.indent)}
                <tr
                  className={cls}
                  draggable={Boolean(rowDrag)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onDragStart={rowDrag ? (e) => { e.dataTransfer.effectAllowed = 'move'; rowDrag.onDragStart(id); } : undefined}
                  onDragOver={rowDrag ? (e) => {
                    e.preventDefault();
                    if (!rowDrag.draggingId) return;
                    const h = rowDrag.resolveDrop(id, edgeOf(e));
                    if (h) { setHint(h); setInvalidId(null); e.dataTransfer.dropEffect = 'move'; }
                    else { setHint(null); setInvalidId(id); e.dataTransfer.dropEffect = 'none'; }
                  } : undefined}
                  onDrop={rowDrag ? (e) => { e.preventDefault(); rowDrag.onDrop(id, edgeOf(e)); clearDrag(); } : undefined}
                  onDragEnd={rowDrag ? clearDrag : undefined}
                >
                  {rowDrag && (
                    <td className="dt__lead">
                      <span className="drag-handle" aria-hidden><Icon name="drag" size={13} /></span>
                    </td>
                  )}

                  {selection && (
                    <td className="dt__lead" onClick={(e) => e.stopPropagation()}>
                      <span className="dt__lead-fill">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selection.selected.has(id)}
                          onChange={() => selection.onToggle(id)}
                          aria-label={`Select ${id}`}
                        />
                      </span>
                    </td>
                  )}

                  {expansion && (
                    <td className="dt__lead" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => expansion.onToggle(id)}
                        aria-label={expanded ? 'Collapse row' : 'Expand row'}
                        aria-expanded={expanded}
                      >
                        <Icon name="chevron" size={13} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur) var(--ease)' }} />
                      </button>
                    </td>
                  )}

                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align ?? 'left' }} className={c.mono ? 'mono' : undefined}>
                      {c.cell ? c.cell(row) : <TruncatedText value={String(row[c.key] ?? '—')} />}
                    </td>
                  ))}
                </tr>

                {expanded && (
                  <tr className="dt__detail">
                    <td colSpan={colSpan}>{expansion.render(row)}</td>
                  </tr>
                )}

                {showBottom && dropLine(hint.indent)}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
