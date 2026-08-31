import type { ReactNode } from "react";

/**
 * A column definition drives both renderings below, so the table and the
 * mobile card list can never fall out of sync as columns are added.
 *
 * Role flags shape the card layout only; the table ignores them and renders
 * every column as an ordinary cell.
 */
export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Card heading. */
  primary?: boolean;
  /** Muted line directly under the heading. */
  secondary?: boolean;
  /** Right-aligned on the heading row — status pills and the like. */
  trailing?: boolean;
  /** Extra classes for the table cell. */
  className?: string;
};

/**
 * Renders a real table from `md` up, and a stacked card per row below it.
 *
 * A seven-column table cannot be made legible at 375px by scrolling alone —
 * the columns that identify the row scroll out of view, leaving figures with
 * nothing to attach them to. Below `md` each row becomes a self-contained card
 * with its labels alongside the values.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  const primary = columns.find((c) => c.primary);
  const secondary = columns.find((c) => c.secondary);
  const trailing = columns.find((c) => c.trailing);
  const rest = columns.filter(
    (c) => !c.primary && !c.secondary && !c.trailing,
  );

  return (
    <>
      {/* Table — md and up */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="px-5 py-2.5 font-medium">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={rowKey(row)} className={i > 0 ? "border-t border-line" : ""}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-5 py-3 ${c.className ?? ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked cards — below md */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {primary && (
                  <p className="truncate font-medium">{primary.cell(row)}</p>
                )}
                {secondary && (
                  <p className="mt-0.5 truncate code text-xs text-ink-muted">
                    {secondary.cell(row)}
                  </p>
                )}
              </div>
              {trailing && <div className="shrink-0">{trailing.cell(row)}</div>}
            </div>

            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {rest.map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-ink-muted">{c.header}</dt>
                  <dd className="text-right">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
