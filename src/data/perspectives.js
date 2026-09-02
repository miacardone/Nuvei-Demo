/**
 * PERSPECTIVE — the seat this console is operated from.
 *
 * Nuvei is the acquirer, so there is exactly one seat and no persona switch.
 * What the operator chooses instead is SCOPE — which merchant, or group of
 * merchants, they are looking at. See data/merchant-scope.js.
 *
 * The `/:perspective/` URL segment is kept so every route keeps its shape and
 * a bookmarked link still resolves; it simply only ever holds one value.
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
    id: 'acquirer',
    label: 'Acquirer',
    subtitle: brand.name,
    tagline: `Manage the ${brand.terms.seller} portfolio, representment and settlement risk.`,
    icon: 'layers',
    terms: {
      analyst: 'Risk Analyst',
      analysts: 'Risk Analysts',
    },
  },
];

export const DEFAULT_PERSPECTIVE = 'acquirer';

const BY_ID = Object.fromEntries(PERSPECTIVES.map((p) => [p.id, p]));

export const getPerspective = (id) => BY_ID[id] ?? BY_ID[DEFAULT_PERSPECTIVE];
export const isValidPerspective = (id) => Boolean(BY_ID[id]);
