import { useMemo, useState } from 'react';

/**
 * Generic column sorting for any table.
 *
 * Most screens hand-rolled this or went without, which is why half the console
 * had sortable headers and half did not. One comparator here means every table
 * sorts the same way and a new table gets it for free.
 *
 * Values are read straight off the row by column key. Numbers and dates
 * compare naturally; everything else compares as a locale-aware string, so
 * "Ålesund" lands where a reader expects rather than after "Zurich".
 */
const valueOf = (row, key) => row?.[key];

function compare(a, b) {
  if (a == null && b == null) return 0;
  // Blanks sort last in either direction — an empty cell is not "smallest".
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a - b;

  const as = String(a);
  const bs = String(b);

  // Numeric strings ("1,290.00", "45") compare as numbers, not text, so 9
  // does not sort after 10.
  const an = Number(as.replace(/[^0-9.-]/g, ''));
  const bn = Number(bs.replace(/[^0-9.-]/g, ''));
  if (as.trim() && bs.trim() && Number.isFinite(an) && Number.isFinite(bn)
      && /^[^A-Za-z]*$/.test(as) && /^[^A-Za-z]*$/.test(bs)) {
    return an - bn;
  }

  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
}

export function useTableSort(rows, initial = null) {
  const [sort, setSort] = useState(initial);

  const onSort = (key) =>
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );

  const sorted = useMemo(() => {
    if (!sort?.key) return rows;
    const out = [...rows].sort((x, y) => compare(valueOf(x, sort.key), valueOf(y, sort.key)));
    return sort.dir === 'desc' ? out.reverse() : out;
  }, [rows, sort]);

  return { sort, onSort, sorted };
}

export default useTableSort;
