/**
 * PERSPECTIVES — the three parties to a dispute.
 *
 * Vinted's build of this console only ever modeled the merchant side (a
 * marketplace defending chargebacks against its own sales). This build adds
 * the other two parties in the same lifecycle: the acquirer that processes
 * for the merchant, and the issuer whose cardholder raised the dispute.
 *
 * One thing makes this possible without three separate datasets: the case
 * record already carries all three parties' fields (see domain/caseTypes.js
 * and data/work-case.js, which already splits documents into `merchant` and
 * `issuer` sequences). A perspective is a different NAV, vocabulary and
 * column set over the SAME book — not a different book.
 *
 * `id` doubles as the URL's role segment (`/:perspective/...`), so it must
 * stay a clean path segment.
 */

import brand from '@/brand/brand.config';

export const PERSPECTIVES = [
  {
    id: 'merchant',
    label: 'Merchant',
    subtitle: brand.flagshipMerchant.name,
    tagline: `Defend chargebacks and ${brand.terms.claimProgramme} claims against your own ${brand.terms.order}s.`,
    icon: 'briefcase',
    /** Vocabulary layered on top of brand.terms while this perspective is active. */
    terms: {},
  },
  {
    id: 'acquirer',
    label: 'Acquirer',
    subtitle: brand.name,
    tagline: `Manage the ${brand.terms.seller} portfolio, representment and settlement risk.`,
    icon: 'layers',
    terms: {
      analyst: 'Risk Analyst',
      analysts: 'Risk Analysts',
      seller: brand.terms.seller,
    },
  },
  {
    id: 'issuer',
    label: 'Issuer',
    subtitle: 'Card issuer',
    tagline: 'Review cardholder authorizations, fraud and chargebacks.',
    icon: 'card',
    terms: {
      analyst: 'Fraud Analyst',
      analysts: 'Fraud Analysts',
      buyer: 'cardholder',
    },
  },
];

export const DEFAULT_PERSPECTIVE = 'merchant';

const BY_ID = Object.fromEntries(PERSPECTIVES.map((p) => [p.id, p]));

export const getPerspective = (id) => BY_ID[id] ?? BY_ID[DEFAULT_PERSPECTIVE];
export const isValidPerspective = (id) => Boolean(BY_ID[id]);
