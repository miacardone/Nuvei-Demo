/**
 * COLUMN HELP — what each column actually means.
 *
 * These grids are dense and full of card-scheme jargon: ARN, MID, cycle,
 * reason code, four different parties and two different amounts. Somebody
 * seeing the product for the first time cannot tell an ARN from an order
 * reference, or "Doc status" from "Outcome", by looking at the header — and
 * the abbreviated columns have no self-evident meaning at all.
 *
 * Keyed here rather than written onto every column definition, so one entry
 * covers the column everywhere it appears. A page can still declare its own
 * `description` and that wins; this is only the fallback.
 *
 * WRITTEN IN THE TENANT'S OWN NOUNS. Text is built from `brand.terms`, so a
 * tenant whose seller is a "supplier" and whose order is a "booking" gets help
 * that matches the labels beside it rather than marketplace vocabulary it does
 * not use.
 */

import brand from '@/brand/brand.config';

const t = brand.terms;

/** Keyed by column `key`. */
const BY_KEY = {
  /* Identity */
  id: 'This console’s own reference for the dispute',
  caseType: `Which intake path the dispute arrived on — a card ${t.chargeback} (CB) or a ${t.claimProgramme} ${t.claim} (BP)`,
  reference: `The identifier this row actually has — the ARN for a ${t.chargeback}, the ${t.item} for a ${t.claim}`,
  arn: 'Acquirer Reference Number — the card networks’ own identifier for the transaction, used to match it across banks',
  orderId: `The ${t.order} the dispute was raised against`,
  merchantRef: `Our internal reference for the ${t.order}`,

  /* Card detail */
  network: 'Card scheme the transaction ran on — Visa, Mastercard or Amex',
  reasonCode: 'The scheme’s own code for why the cardholder is disputing. It determines what evidence will actually win the case',
  cycle: 'How far through the dispute process this case has travelled. Later cycles have shorter deadlines and fewer options',
  cardholder: 'Name on the card, which is not always the buyer',
  mid: 'Merchant ID — the selling entity’s account number with the acquirer',
  paymentMethod: `How the ${t.buyer} paid`,

  /* Parties */
  buyer: `The ${t.buyer} who raised the dispute`,
  seller: `The ${t.seller} whose ${t.item} is being disputed`,
  entityLabel: 'Which of our legal entities sold the item, and therefore carries the liability',
  itemTitle: `What was sold, as listed at the time of the ${t.order}`,
  claimReason: `Why the ${t.buyer} says the ${t.order} went wrong`,

  /* Money */
  disputeAmount: 'The amount actually being disputed, which can be less than the total paid',
  caseAmount: `Total paid on the ${t.order}, including postage`,
  transactionAmount: 'Amount of the original card transaction',

  /* State */
  status: 'Where the case is in our workflow — not the scheme’s view of it',
  outcome: 'How it finished once closed: won, lost or written off. Pending until then',
  docStatus: 'Whether the supporting evidence has arrived. A representment without documents is almost always rejected',
  queueLabel: `The ${t.queue} the case is waiting in`,
  worker: 'Who is currently responsible for working this case',
  assignmentReason: 'Why the case was routed to this person or queue',

  /* Time */
  dueDate: 'Our internal deadline, set deliberately ahead of the scheme’s so there is room to react',
  networkDueDate: 'The scheme’s deadline. Miss it and the case is lost by default, whatever the evidence says',
  dateCreated: 'When the dispute reached this console',
  transDate: 'When the original card transaction took place',
};

/** Fallback by header text, for columns whose key is not descriptive. */
const BY_HEADER = {
  'Case #': BY_KEY.id,
  Scheme: BY_KEY.network,
  Amount: BY_KEY.disputeAmount,
  Due: BY_KEY.dueDate,
  'Assigned to': BY_KEY.worker,
  Actions: 'What you can do to this case without opening it',
};

/**
 * Help text for a column, or null. Key wins over header, and an explicit
 * `description` on the column wins over both (applied by the caller).
 */
export function columnHelp(column) {
  if (!column) return null;
  if (column.description) return column.description;
  if (BY_KEY[column.key]) return BY_KEY[column.key];
  return typeof column.header === 'string' ? BY_HEADER[column.header] ?? null : null;
}

export default columnHelp;
