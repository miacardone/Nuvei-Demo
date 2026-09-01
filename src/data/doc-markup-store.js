/**
 * MARKED-UP DOCUMENTS — what the viewer shows after Apply.
 *
 * WHY THIS EXISTS. Apply was already burning marks into the pixels correctly,
 * but the result only went into the evidence packet, which lives behind a
 * different toggle. So an analyst blacked out a cardholder name, pressed Apply,
 * and the document in front of them was unchanged. The work was real and
 * completely invisible, which is indistinguishable from a broken button — and
 * the sensible reaction is to press it again, producing a second exhibit.
 *
 * The marked-up copy is now the version the viewer renders for that document,
 * so applying does something you can see, immediately, where you were looking.
 *
 * THE ORIGINAL DOCUMENT IS NOT DESTROYED HERE, deliberately. Pixels inside a
 * redaction are gone from the COPY — that is what makes the copy safe to send —
 * but the source document is generated from the case record on demand, so the
 * viewer can always show it again. What must never leak is a marked-up exhibit
 * that still carries its original underneath, and it does not: the copy is flat.
 *
 * Not persisted. These are image data belonging to a working session, and a
 * half-redacted exhibit surviving in a browser is a retention question nobody
 * asked for.
 */

const marked = new Map();
const listeners = new Set();

/**
 * A monotonic counter is the snapshot. `useSyncExternalStore` compares
 * snapshots by identity, so returning the Map (mutated in place) would never
 * signal a change, and rebuilding an object each call would loop forever.
 */
let version = 0;

const keyOf = (caseId, docId) => `${caseId}:${docId}`;

const notify = () => {
  version += 1;
  listeners.forEach((l) => l());
};

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getVersion = () => version;

/** `{ dataUrl, redactions, audit, at }` for a document, or null. */
export const getMarkup = (caseId, docId) => marked.get(keyOf(caseId, docId)) ?? null;

export function setMarkup(caseId, docId, entry) {
  marked.set(keyOf(caseId, docId), entry);
  notify();
}

/** Drops the marked-up copy so the viewer falls back to the generated original. */
export function clearMarkup(caseId, docId) {
  marked.delete(keyOf(caseId, docId));
  notify();
}
