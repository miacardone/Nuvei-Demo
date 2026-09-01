/**
 * One comparator for every table.
 *
 * Work case and Case management each carried their own copy, and both read
 * `row[sort.key]` directly. That is wrong for any column whose key is not a
 * field on the row — `reference` shows the ARN for a chargeback and the item
 * title for a claim, so sorting it compared `undefined` against `undefined`
 * and quietly did nothing. A column can now declare `sortValue(row)` and the
 * comparator uses it.
 *
 * Nulls and blanks sort LAST in both directions. An unassigned case is not
 * "before A" — it has no value, and burying the gaps at the end keeps the top
 * of the table useful whichever way the arrow points.
 */

const valueFor = (row, key, column) => {
  if (column?.sortValue) return column.sortValue(row);
  return row[key];
};

const isBlank = (v) => v == null || v === '' || v === '—';

export function sortRows(rows, sort, columns = []) {
  if (!sort?.key) return rows;

  const column = columns.find((c) => c.key === sort.key);
  const dir = sort.dir === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const av = valueFor(a, sort.key, column);
    const bv = valueFor(b, sort.key, column);

    const aBlank = isBlank(av);
    const bBlank = isBlank(bv);
    if (aBlank && bBlank) return 0;
    if (aBlank) return 1;   // blanks last, regardless of direction
    if (bBlank) return -1;

    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;

    // `numeric` keeps VIN-720175 next to VIN-72018 instead of lexicographic
    // order splitting a run of ids on their digit count.
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
  });
}

export default sortRows;
