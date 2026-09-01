/**
 * DISPUTE PACKET — the model behind the Dispute editor.
 *
 * A representment is not one letter, it is an ordered bundle: a narrative that
 * argues the case, plus the exhibits that prove it. Issuers read them in
 * order and stop early, so ORDER IS PART OF THE ARGUMENT — which is why the
 * editor lets an analyst move blocks and why this file, not the component,
 * owns the default sequence.
 *
 * The starting packet is derived from the case record, so opening the editor
 * on any case gives a genuinely case-specific draft rather than a lorem-ipsum
 * template somebody has to gut before they can use it.
 */

import brand from '@/brand/brand.config';
import { getCaseDocs } from '@/data/work-case';
import { CURRENT_USER } from '@/data/people';
import { formatCurrency, formatDate } from '@/utils/format';

/* ------------------------------------------------------------------ *
 * Block kinds
 * ------------------------------------------------------------------ */

export const BLOCK_KINDS = {
  narrative: { label: 'Narrative', icon: 'file', description: 'Argument text submitted in the body of the response.' },
  evidence: { label: 'Evidence', icon: 'checklist', description: 'A document already attached to the case.' },
  screenshot: { label: 'Screenshot', icon: 'image', description: 'A pasted or uploaded image exhibit.' },
  attachment: { label: 'Attachment', icon: 'file', description: 'A file supplied as-is, such as a PDF the merchant wrote themselves.' },
};

/** Unknown kinds must not take the editor down — see the note in DisputeEditor. */
export const blockKind = (kind) => BLOCK_KINDS[kind] ?? { label: 'Block', icon: 'file', description: '' };

/* ------------------------------------------------------------------ *
 * Redaction reasons
 * ------------------------------------------------------------------ *
 * Every redacted region must carry ONE of these. A black box with no reason
 * is unauditable — six months later nobody can say whether an exhibit was
 * redacted for staff privacy or to hide something material, and that is
 * exactly the question a regulator or an arbitration panel asks.
 *
 * `retention` is the honest bit: it records what the redaction is protecting,
 * so the audit line reads as a decision rather than as a smudge.
 */
export const REDACTION_REASONS = [
  { id: 'employee_name', label: 'Employee name', retention: 'Staff privacy', hint: 'Agent or moderator names visible in an internal tool.' },
  { id: 'employee_id', label: 'Staff ID / agent number', retention: 'Staff privacy', hint: 'Internal identifiers that map back to a named person.' },
  { id: 'internal_email', label: 'Internal email address', retention: 'Staff privacy', hint: `Any @${brand.emailDomain} address.` },
  { id: 'internal_system', label: 'Internal system reference', retention: 'Security', hint: 'Tool names, ticket URLs, queue names, internal case IDs.' },
  { id: 'customer_pii', label: 'Customer personal data', retention: 'Data protection', hint: `${brand.terms.buyer} or ${brand.terms.seller} data not needed to prove the point.` },
  { id: 'payment_data', label: 'Full card / bank detail', retention: 'PCI DSS', hint: 'Never send a full PAN to an issuer — leave the last four only.' },
  { id: 'other', label: 'Other', retention: 'Reviewer judgement', hint: 'Anything else, with a note.' },
];

export const getRedactionReason = (id) => REDACTION_REASONS.find((r) => r.id === id) ?? REDACTION_REASONS[REDACTION_REASONS.length - 1];

/* ------------------------------------------------------------------ *
 * Default packet
 * ------------------------------------------------------------------ */

const narrative = (id, title, body) => ({
  id,
  kind: 'narrative',
  title,
  body,
  included: true,
});

/**
 * The opening argument, written from the case. Two versions, because the two
 * intake paths are argued differently: a card representment cites the scheme
 * reason code and the network deadline, a Buyer Protection claim has no card
 * leg to cite and is resolved on the marketplace's own terms.
 */
function openingFor(c) {
  if (c.caseType === 'claim') {
    return [
      `This ${brand.terms.claimProgramme} ${brand.terms.claim} concerns ${brand.terms.order} ${c.orderId}, placed on ${formatDate(c.orderPlacedAt)} for ${formatCurrency(c.caseAmount, c.currency)}.`,
      ``,
      `The ${brand.terms.buyer} states: "${c.reasonLabel}".`,
      ``,
      `Our records show the ${brand.terms.item} "${c.itemTitle}" was listed in ${c.itemCondition.toLowerCase()} condition and despatched via ${c.carrier} under tracking ${c.tracking}. The evidence attached below addresses the ${brand.terms.buyer}'s stated reason directly.`,
    ].join('\n');
  }

  return [
    `We are responding to the ${brand.terms.chargeback} raised under ${c.networkLabel} reason code ${c.reasonCode} — ${c.reasonLabel} — for ${formatCurrency(c.disputeAmount, c.currency)} presented on ${formatDate(c.transDate)}.`,
    ``,
    `Transaction reference ${c.arn ?? '—'}, merchant ID ${c.mid}, card ending ${c.ccLast4}.`,
    ``,
    `We have reviewed the cardholder's claim against our ${brand.terms.order} and delivery records and submit that the transaction was valid and the goods were supplied as described. The exhibits below are listed in the order they should be read.`,
  ].join('\n');
}

function rebuttalFor(c) {
  const byCategory = {
    fraud: `The cardholder participated in this transaction. The ${brand.terms.order} was placed from an account with prior settled ${brand.terms.order}s, delivered to an address held on that account, and no chargeback was raised on the earlier ${brand.terms.order}s. Device and delivery evidence is attached.`,
    consumer: `The ${brand.terms.item} supplied matches its listing. The listing description, photographs and the ${brand.terms.buyer}'s acceptance of the terms of sale are attached, along with carrier confirmation that the consignment was scanned and delivered.`,
    authorisation: `The transaction was authorised. The authorisation record, including the approval code and the AVS and CVV results returned at the time, is attached.`,
    processing: `The transaction was processed once, for the correct amount, on the date shown. The settlement record and the ${brand.terms.order} total are attached and reconcile exactly.`,
  };

  return byCategory[c.reasonCategory] ?? byCategory.consumer;
}

/**
 * Build the starting packet for a case. Evidence blocks mirror the documents
 * already on the case, so the editor and the Merchant docs tab cannot show
 * two different sets of exhibits.
 */
export function buildDefaultPacket(c) {
  const docs = getCaseDocs(c.id).merchant;

  return {
    caseId: c.id,
    updatedAt: new Date().toISOString(),
    author: CURRENT_USER.email,
    blocks: [
      narrative('nb-opening', 'Opening statement', openingFor(c)),
      narrative('nb-rebuttal', 'Rebuttal', rebuttalFor(c)),
      ...docs.map((d) => ({
        id: `eb-${d.id}`,
        kind: 'evidence',
        title: d.title,
        docId: d.id,
        docKind: d.kind,
        receivedAt: d.receivedAt,
        included: true,
      })),
      narrative(
        'nb-closing',
        'Closing',
        `On the basis of the evidence supplied we ask that the ${brand.terms.chargeback} be reversed in full. Please direct any further request for information to ${brand.supportEmail}.`,
      ),
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Sample screenshot
 * ------------------------------------------------------------------ *
 * A demo cannot depend on somebody having the right thing on their clipboard,
 * and the whole point of the redaction tool is only visible on an image that
 * actually contains staff data. So this draws one: an internal support-tool
 * screenshot for THIS case, carrying an agent name, a staff ID, an internal
 * address and an internal note — precisely the four things that must not
 * reach an issuer.
 *
 * Drawn on a canvas rather than shipped as a PNG so it always matches the
 * case on screen, and so there is no image file in the repo that looks like
 * a real internal system.
 */
export function drawSampleScreenshot(c) {
  const W = 900;
  const H = 520;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const ink = '#111827';
  const muted = '#6B7280';
  const line = '#E5E7EB';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Window chrome
  ctx.fillStyle = '#F3F4F6';
  ctx.fillRect(0, 0, W, 44);
  ctx.fillStyle = line;
  ctx.fillRect(0, 44, W, 1);
  ['#EF4444', '#F59E0B', '#10B981'].forEach((colour, i) => {
    ctx.beginPath();
    ctx.arc(24 + i * 20, 22, 6, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
  });
  ctx.fillStyle = muted;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Internal Support Console — ticket view', 110, 27);

  const label = (text, x, y) => {
    ctx.fillStyle = muted;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(text.toUpperCase(), x, y);
  };
  const value = (text, x, y, weight = '600', size = 14) => {
    ctx.fillStyle = ink;
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
    ctx.fillText(text, x, y);
  };

  value(`Ticket #${c.id.replace(/\D/g, '').slice(0, 6)} · ${brand.terms.buyer} dispute`, 32, 82, '700', 18);

  // Left column — the customer-facing facts, all of which SHOULD be sent.
  label('Order', 32, 118);
  value(c.orderId, 32, 138);
  label('Item', 32, 168);
  value(c.itemTitle.slice(0, 34), 32, 188);
  label('Amount', 32, 218);
  value(formatCurrency(c.disputeAmount, c.currency), 32, 238);
  label('Carrier / tracking', 32, 268);
  value(`${c.carrier} · ${c.tracking}`, 32, 288, '500');

  // Right column — the staff data. THIS is what has to be redacted.
  label('Handled by', 470, 118);
  value(CURRENT_USER.name, 470, 138);
  label('Agent ID', 470, 168);
  value(`AG-${String(CURRENT_USER.id).replace(/\D/g, '').padStart(5, '4')}82`, 470, 188);
  label('Internal contact', 470, 218);
  value(CURRENT_USER.email, 470, 238, '500');
  label('Escalation queue', 470, 268);
  value('ops-escalations-tier2 (internal)', 470, 288, '500');

  // Internal note block
  ctx.fillStyle = '#FEF3C7';
  ctx.fillRect(32, 320, W - 64, 96);
  ctx.fillStyle = '#92400E';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('INTERNAL NOTE — NOT FOR EXTERNAL RELEASE', 48, 344);
  ctx.fillStyle = ink;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`Reviewed by ${CURRENT_USER.name}. ${brand.terms.seller} has two prior claims;`, 48, 368);
  ctx.fillText('flagged to the fraud team. Do not disclose our internal thresholds', 48, 388);
  ctx.fillText('to the issuer.', 48, 408);

  // Footer
  ctx.fillStyle = line;
  ctx.fillRect(0, 452, W, 1);
  ctx.fillStyle = muted;
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`Exported ${formatDate(new Date().toISOString())} · support-console.internal · session ${CURRENT_USER.initials}-4471`, 32, 478);

  return canvas.toDataURL('image/png');
}
