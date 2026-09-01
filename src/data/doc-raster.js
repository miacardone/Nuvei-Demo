/**
 * DOCUMENT RASTERISER
 * ===================
 * Draws a case document to a canvas so it can go through the same destructive
 * redaction path as a pasted screenshot.
 *
 * WHY RASTERISE AT ALL. The documents in the viewer are React components, not
 * images. Drawing black boxes over rendered HTML would be the exact failure the
 * redaction studio exists to avoid: the text stays in the DOM, in the copy
 * buffer and in anything that re-renders it, so the "redacted" exhibit still
 * carries every word underneath. Redaction has to happen on pixels, which means
 * there have to be pixels first.
 *
 * NO html2canvas. Screen-scraping the DOM would pull in a dependency, and it
 * gets fonts, shadows and clipping subtly wrong in ways you only notice after
 * the packet has gone. These documents are GENERATED from the case record in
 * the first place, so the honest move is to render the same fields again
 * through a second output path — the canvas draws from `c`, exactly as the JSX
 * does, and cannot show anything the component would not.
 *
 * The layout is deliberately plain. This is evidence, not design work, and an
 * issuer reads it as a fax.
 */

import brand from '@/brand/brand.config';
import { formatCurrency, formatDate } from '@/utils/format';

const W = 900;
const MARGIN = 56;
const INK = '#111827';
const MUTED = '#6B7280';
const LINE = '#D1D5DB';

/** Field rows per document kind — mirrors what the JSX renders for each. */
function fieldsFor(kind, c) {
  const common = [
    ['Case reference', c.id],
    ['Order reference', c.orderId],
    ['Item', c.itemTitle],
  ];

  switch (kind) {
    case 'representment_letter':
      return [
        ['Transaction amount', formatCurrency(c.transactionAmount, c.currency)],
        ['Disputed amount', formatCurrency(c.disputeAmount, c.currency)],
        ['Transaction date', formatDate(c.transDate)],
        ['Card number', c.pan ?? `•••• ${c.ccLast4}`],
        ['Cardholder', c.cardholder ?? c.buyer],
        ['Merchant ID', c.mid],
        ['Order reference', c.orderId],
        ['Item', c.itemTitle],
        ['Despatched via', `${c.carrier} · ${c.tracking}`],
      ];
    case 'sales_receipt':
      return [
        ['Order placed', formatDate(c.orderPlacedAt)],
        [brand.terms.buyer, c.buyer],
        [brand.terms.seller, c.seller],
        ['Item', c.itemTitle],
        ['Condition', c.itemCondition],
        ['Item price', formatCurrency(c.itemPrice, c.currency)],
        ['Postage', formatCurrency(c.shipping, c.currency)],
        ['Total paid', formatCurrency(c.caseAmount, c.currency)],
        ['Payment method', c.paymentMethod],
        ['Entity', c.entityLabel],
      ];
    case 'issuer_memo':
    case 'cardholder_statement':
      return [
        ['Acquirer case', c.acquirerCaseNumber ?? '—'],
        ['Dispute cycle', c.cycleLabel ?? '—'],
        ['Response due', formatDate(c.networkDueDate)],
        ['Cardholder', c.cardholder ?? c.buyer],
        ['Card number', c.pan ?? `•••• ${c.ccLast4}`],
      ];
    default:
      return [
        ...common,
        [brand.terms.buyer, c.buyer],
        [brand.terms.seller, c.seller],
        ['Carrier', c.carrier],
        ['Tracking', c.tracking],
        ['Amount', formatCurrency(c.disputeAmount, c.currency)],
      ];
  }
}

function bodyFor(kind, c) {
  switch (kind) {
    case 'representment_letter':
      return [
        `We are responding to the dispute raised under reason code ${c.reasonCode} — ${c.reasonLabel} — for the`,
        'transaction detailed above. We have reviewed the cardholder’s claim against our order and delivery',
        'records and submit that the transaction was valid and the goods were supplied as described.',
        '',
        `The item was listed as "${String(c.itemTitle).slice(0, 46)}" in ${c.itemCategory},`,
        `described in ${String(c.itemCondition).toLowerCase()} condition, and despatched to the address on file.`,
        'Carrier records confirm the consignment was scanned and delivered.',
      ];
    case 'sales_receipt':
      return ['Payment captured in full. No refund has been issued against this order.'];
    case 'issuer_memo':
    case 'cardholder_statement':
      return [
        `The cardholder contacted us on ${formatDate(c.dateCreated)} regarding a charge of`,
        `${formatCurrency(c.disputeAmount, c.currency)} dated ${formatDate(c.transDate)}.`,
        '',
        `They state: "${c.reasonLabel}". The cardholder confirms the card ending ${c.ccLast4} was in`,
        'their possession at the time of the transaction.',
      ];
    default:
      return [
        `This document was supplied in support of case ${c.id} and forms part of the`,
        `evidence package for reason code ${c.reasonCode}.`,
      ];
  }
}

/**
 * Draw a document and return a PNG data URL.
 * Height is measured from the content so a long letter is not clipped.
 */
export function renderDocToCanvas(doc, c) {
  const fields = fieldsFor(doc.kind, c);
  const body = bodyFor(doc.kind, c);

  const headerH = 150;
  const fieldsH = fields.length * 26 + 20;
  const bodyH = body.length * 22 + 40;
  const H = headerH + fieldsH + bodyH + 120;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // --- letterhead --------------------------------------------------------
  ctx.fillStyle = INK;
  ctx.font = '700 20px Inter, system-ui, sans-serif';
  ctx.fillText(brand.name, MARGIN, 56);

  ctx.fillStyle = MUTED;
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(String(doc.title).toUpperCase(), W - MARGIN, 46);
  ctx.fillText(brand.legalName, W - MARGIN, 62);
  ctx.textAlign = 'left';

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, 78);
  ctx.lineTo(W - MARGIN, 78);
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.font = '600 13px Inter, system-ui, sans-serif';
  ctx.fillText(
    `RE: Case ${c.id} · ARN ${c.arn ?? '—'} · ${c.networkLabel ?? brand.terms.claimProgramme} ${c.reasonCode}`,
    MARGIN,
    108,
  );

  ctx.fillStyle = MUTED;
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillText(formatDate(new Date().toISOString()), MARGIN, 128);

  // --- field table -------------------------------------------------------
  let y = headerH + 10;
  fields.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      ctx.fillStyle = '#F9FAFB';
      ctx.fillRect(MARGIN, y - 15, W - MARGIN * 2, 24);
    }
    ctx.fillStyle = MUTED;
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillText(String(label), MARGIN + 8, y);

    ctx.fillStyle = INK;
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.fillText(String(value ?? '—'), MARGIN + 240, y);
    y += 26;
  });

  // --- body --------------------------------------------------------------
  y += 26;
  ctx.fillStyle = INK;
  ctx.font = '12px Inter, system-ui, sans-serif';
  body.forEach((line) => {
    if (line) ctx.fillText(line, MARGIN, y);
    y += 22;
  });

  // --- footer ------------------------------------------------------------
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(MARGIN, H - 56);
  ctx.lineTo(W - MARGIN, H - 56);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillText(`${brand.legalName} · ${brand.supportEmail} · generated for case ${c.id}`, MARGIN, H - 34);

  return canvas.toDataURL('image/png');
}

export default renderDocToCanvas;
