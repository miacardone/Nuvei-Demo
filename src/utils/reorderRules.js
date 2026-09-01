/**
 * Rule reordering.
 *
 * Two constraints from the reference, both preserved:
 *   · A parent rule moves with its sub-rules as one block.
 *   · A sub-rule may only be reordered INSIDE its own parent — dropping it
 *     among another parent's children is rejected rather than silently
 *     re-parenting it.
 */

/** Rules of one group in display order: each parent followed by its children. */
export function orderedRules(rules) {
  const parents = rules.filter((r) => !r.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  return parents.flatMap((parent) => [
    parent,
    ...rules.filter((r) => r.parentId === parent.id).sort((a, b) => a.sortOrder - b.sortOrder),
  ]);
}

/** "2" for a parent, "2.1" for its first child. */
export function displayNumbers(rules) {
  const map = new Map();
  const parents = rules.filter((r) => !r.parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  parents.forEach((parent, pIndex) => {
    map.set(parent.id, String(pIndex + 1));
    rules
      .filter((r) => r.parentId === parent.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((child, cIndex) => map.set(child.id, `${pIndex + 1}.${cIndex + 1}`));
  });

  return map;
}

/** The set of rows that move together when `id` is dragged. */
export function blockFor(rules, id) {
  const rule = rules.find((r) => r.id === id);
  if (!rule) return new Set();
  if (rule.parentId) return new Set([id]);
  return new Set([id, ...rules.filter((r) => r.parentId === id).map((r) => r.id)]);
}

/**
 * Where the drop indicator should render, or null if the drop is invalid.
 * Sub-rules indent their indicator to signal they stay at child level.
 */
export function resolveDrop(rules, draggingId, overId, edge) {
  if (!draggingId || draggingId === overId) return null;

  const dragged = rules.find((r) => r.id === draggingId);
  const over = rules.find((r) => r.id === overId);
  if (!dragged || !over) return null;

  if (dragged.parentId) {
    // A sub-rule may only land among its own siblings, or against its parent.
    const sameParent = over.parentId === dragged.parentId || over.id === dragged.parentId;
    if (!sameParent) return null;
    return { anchorId: overId, edge, indent: true };
  }

  // A parent may not be dropped inside another parent's children.
  if (over.parentId) return null;
  return { anchorId: overId, edge, indent: false };
}

/** Applies a drop, returning a new rules array with sortOrder rewritten. */
export function applyDrop(rules, draggingId, overId, edge) {
  const hint = resolveDrop(rules, draggingId, overId, edge);
  if (!hint) return rules;

  const dragged = rules.find((r) => r.id === draggingId);
  const scope = dragged.parentId
    ? rules.filter((r) => r.parentId === dragged.parentId)
    : rules.filter((r) => !r.parentId);

  const ordered = [...scope].sort((a, b) => a.sortOrder - b.sortOrder);
  const from = ordered.findIndex((r) => r.id === draggingId);
  if (from === -1) return rules;

  const [moved] = ordered.splice(from, 1);

  const anchorIndex = ordered.findIndex((r) => r.id === overId);
  const insertAt = anchorIndex === -1
    ? ordered.length
    : edge === 'top' ? anchorIndex : anchorIndex + 1;

  ordered.splice(insertAt, 0, moved);

  const renumbered = new Map(ordered.map((r, i) => [r.id, i + 1]));
  return rules.map((r) => (renumbered.has(r.id) ? { ...r, sortOrder: renumbered.get(r.id) } : r));
}
