/**
 * PACKET STORE — one live evidence packet per case.
 *
 * WHY THIS EXISTS. The packet was component state inside the editor, which
 * meant the upload control in the Work case toolbar had nowhere to put a file:
 * it listed what you dropped, said "2 documents uploaded", and discarded them.
 * The answer to "can they just drop their own PDF in?" was therefore "the
 * button accepts it and then nothing happens", which is the worst of both —
 * the interface agrees with you and the work is lost.
 *
 * Upload lives in the toolbar and the packet lives in a tab, so the two cannot
 * share React state without hoisting it above both. Keyed by case id here
 * instead, so a file dropped from anywhere on the case lands in the same
 * packet, and switching cases cannot show you another case's evidence.
 *
 * NOT PERSISTED, unlike the rules store. A packet holds uploaded file contents
 * as data URLs; a few screenshots would blow the localStorage quota, and a
 * half-built representment surviving in a browser is a data-retention question
 * nobody asked for — particularly when the whole point of the redaction step is
 * that the unredacted original is never kept.
 */

import { buildDefaultPacket } from '@/data/dispute-packet';

const packets = new Map();
const listeners = new Set();

const notify = () => listeners.forEach((l) => l());

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * The packet for a case, created from the case record on first access.
 * Stable by reference between writes so `useSyncExternalStore` does not loop.
 */
export function getPacket(c) {
  if (!c?.id) return null;
  if (!packets.has(c.id)) packets.set(c.id, buildDefaultPacket(c));
  return packets.get(c.id);
}

export function setPacket(caseId, update) {
  const current = packets.get(caseId);
  if (!current) return;
  const next = typeof update === 'function' ? update(current) : update;
  packets.set(caseId, { ...next, updatedAt: new Date().toISOString() });
  notify();
}

/** Append blocks — used by the toolbar upload and by the editor alike. */
export function addBlocks(caseId, blocks) {
  const current = packets.get(caseId);
  if (!current || !blocks.length) return;
  packets.set(caseId, { ...current, blocks: [...current.blocks, ...blocks], updatedAt: new Date().toISOString() });
  notify();
}

/** Back to the packet the case started with. */
export function resetPacket(c) {
  if (!c?.id) return;
  packets.set(c.id, buildDefaultPacket(c));
  notify();
}

const IMAGE = /^image\//;

/**
 * Turn dropped files into packet blocks.
 *
 * Images become screenshot blocks and go through redaction like anything else
 * pasted — a photographed delivery note carries the same staff data risk as a
 * screenshot of an internal tool. Everything else (a PDF representment the
 * merchant wrote themselves, most often) becomes an attachment block: it
 * counts as evidence and can satisfy a checklist item, but it is not something
 * this build can open and redact, and the UI says so rather than implying it
 * has been reviewed.
 */
export function blocksFromFiles(files, readAsDataUrl) {
  return Promise.all(
    Array.from(files).map(async (file, i) => {
      const id = `up-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
      const isImage = IMAGE.test(file.type);

      return {
        id,
        kind: isImage ? 'screenshot' : 'attachment',
        title: file.name || (isImage ? 'Pasted screenshot' : 'Uploaded document'),
        included: true,
        uploaded: true,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: isImage ? await readAsDataUrl(file) : null,
        redactions: null,
        audit: null,
      };
    }),
  );
}
