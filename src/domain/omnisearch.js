/**
 * SITE SEARCH
 * ===========
 * One box that finds anything and, when what you typed is a question rather
 * than a name, offers to go and answer it.
 *
 * Two jobs, and keeping them apart is what stops the box feeling vague:
 *
 *   A NAME goes somewhere.  "flightpath", "webhooks", "queue" — you meant a
 *   thing that already exists, so the answer is a list of things and a jump.
 *
 *   A SENTENCE gets answered. "which merchants should we indemnify" is not the
 *   name of anything; it is a question. That goes to Revenue rules with the
 *   sentence already typed into Describe it, so the screen that can answer it
 *   opens with the question in it.
 *
 * The sentence test is not a guess about grammar — it asks the command parser
 * whether it can actually make a rule out of what you typed. If it can, the
 * question is answerable and the offer is real; if it cannot, no offer is
 * made rather than one that leads somewhere useless.
 *
 * Results are capped per group and every group reports its true total, for
 * the same reason the merchant picker does: a reader must never mistake the
 * first five for all of them.
 */

import { MERCHANTS } from '@/data/portfolio';
import { CASES } from '@/data/cases';
import { USERS } from '@/data/people';
import { ROUTES as acquirerRoutes, navFor } from '@/data/navigation';
import brand from '@/brand/brand.config';
import { parseCommand } from '@/domain/command-parser';

const PER_GROUP = 5;

/** Nav is a tree; search wants a flat list of destinations. */
function flattenNav() {
  const out = [];
  navFor().forEach((item) => {
    if (item.children?.length) {
      item.children.forEach((child) => out.push({
        label: child.label,
        path: child.path,
        parent: item.label,
        keywords: `${item.label} ${child.label} ${child.area ?? ''}`,
      }));
    } else {
      out.push({ label: item.label, path: item.path, parent: null, keywords: `${item.label} ${item.area ?? ''}` });
    }
  });
  return out;
}

const PAGES = flattenNav();

/**
 * Words people reach for that are not the name of anything on screen.
 * Without these, "chargeback" finds no page at all, which makes the box feel
 * broken on the most obvious term in the product.
 */
const PAGE_SYNONYMS = {
  [acquirerRoutes.caseManagement]: 'disputes cases chargebacks claims queue work',
  [acquirerRoutes.representment]: 'fight defend evidence packet respond',
  [acquirerRoutes.revenueRules]: 'indemnification indemnify pricing bps suggestions rules revenue chargeback management manage',
  [acquirerRoutes.portfolioMerchants]: 'clients accounts merchants book portfolio',
  [acquirerRoutes.risk]: 'exposure ratio threshold risky',
  [acquirerRoutes.settlement]: 'money payout deductions batches funding',
  [acquirerRoutes.alerts]: 'rdr ethoca verifi pre-dispute deflection',
  [acquirerRoutes.users]: 'people staff team roles permissions analysts',
  [acquirerRoutes.webhooks]: 'integration events api callbacks',
  [acquirerRoutes.systemPreferences]: 'settings configuration numbering thresholds',
  [acquirerRoutes.queueManagement]: 'queues sla routing',
  [acquirerRoutes.onboarding]: 'applications kyc go-live pipeline prospects',
  [acquirerRoutes.underwriting]: 'risk review approve decline findings',
};

/** Prefix hits rank above loose contains, so "fli" puts FlightPath first. */
function score(haystack, needle) {
  const h = haystack.toLowerCase();
  if (h === needle) return 100;
  if (h.startsWith(needle)) return 80;
  const words = h.split(/\s+/);
  if (words.some((w) => w.startsWith(needle))) return 60;
  if (h.includes(needle)) return 40;
  return 0;
}

function take(list, q, project) {
  const scored = list
    .map((item) => {
      const { text, ...rest } = project(item);
      return { ...rest, item, score: score(text, q) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  return { rows: scored.slice(0, PER_GROUP), total: scored.length };
}

/**
 * @returns {{ groups: Array, ask: object|null, total: number }}
 */
export function searchEverything(query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (q.length < 2) return { groups: [], ask: null, total: 0 };

  const groups = [];

  const pages = take(PAGES, q, (p) => ({
    text: `${p.label} ${p.parent ?? ''} ${p.keywords} ${PAGE_SYNONYMS[p.path] ?? ''}`,
    title: p.label,
    meta: p.parent ? `${p.parent}` : 'Section',
    path: p.path,
  }));
  if (pages.rows.length) groups.push({ id: 'pages', label: 'Go to', icon: 'grid', ...pages });

  const merchants = take(MERCHANTS, q, (m) => ({
    text: `${m.name} ${m.vertical} ${m.mccLabel} ${m.mccCode} ${m.groupLabel} ${m.riskTier} ${m.status}`,
    title: m.name,
    meta: `${m.groupLabel} · ${m.riskTier} risk · ${m.status}`,
    path: `${acquirerRoutes.portfolioMerchants}?merchant=${m.id}`,
  }));
  if (merchants.rows.length) groups.push({ id: 'merchants', label: 'Merchants', icon: 'briefcase', ...merchants });

  const people = take(USERS, q, (u) => ({
    text: `${u.name} ${u.email} ${u.title ?? ''} ${u.role} ${u.group ?? ''}`,
    title: u.name,
    meta: u.title ?? u.role,
    path: acquirerRoutes.users,
  }));
  if (people.rows.length) groups.push({ id: 'people', label: 'People', icon: 'user', ...people });

  /* Cases are the big list, so they are searched on the identifiers someone
     would actually have in front of them — a case number, an ARN, a card
     holder's name — rather than on every field. */
  const cases = take(CASES, q, (c) => ({
    text: `${c.id} ${c.arn ?? ''} ${c.cardholder ?? ''} ${c.seller ?? ''} ${c.entityLabel ?? ''} ${c.reasonDescription ?? ''}`,
    title: c.id,
    meta: `${c.cardholder ?? 'No cardholder'} · ${c.status}`,
    path: `${acquirerRoutes.workCase}?case=${c.id}`,
  }));
  if (cases.rows.length) groups.push({ id: 'cases', label: brand.terms.cases, icon: 'inbox', ...cases });

  const queues = take(brand.queues, q, (qu) => ({
    text: `${qu.label} queue`,
    title: qu.label,
    meta: 'Queue',
    path: acquirerRoutes.queueManagement,
  }));
  if (queues.rows.length) groups.push({ id: 'queues', label: 'Queues', icon: 'layers', ...queues });

  /* Is this a question rather than a name? Ask the parser, not a word count —
     it is the thing that would have to answer it. */
  const parsed = parseCommand(query);
  const looksLikeSentence = q.split(/\s+/).length >= 3;
  const ask = parsed && looksLikeSentence
    ? { query, understood: parsed.understood, path: `${acquirerRoutes.revenueRules}?ask=${encodeURIComponent(query)}` }
    : null;

  return { groups, ask, total: groups.reduce((s, g) => s + g.total, 0) };
}

/** Offered under an empty box — the things worth trying first. */
export const SEARCH_HINTS = [
  { label: 'FlightPath', kind: 'a merchant' },
  { label: 'webhooks', kind: 'a page' },
  { label: 'chargeback management vs indemnification', kind: 'a comparison' },
];
