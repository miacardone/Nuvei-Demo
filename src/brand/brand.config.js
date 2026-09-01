/**
 * WHITE-LABEL CONTROL FILE
 * ========================
 * Everything tenant-specific lives here: palette, wordmark, logo path,
 * currency, locale, timezone, vocabulary, reason codes, entities, queues,
 * due-date offsets and feature flags.
 *
 * THE RULE: no component may hard-code a color, a brand name, or any
 * tenant-specific value. Colors reach the DOM as CSS custom properties written
 * by BrandProvider; nouns reach the JSX through `terms`; the logo reaches the
 * DOM as a *path*, never an import.
 *
 * Cloned from the Vinted build of this console. That build carried a second
 * tenant (PriceLine) to prove the white-label mechanism was real; this one
 * ships a single tenant, so the tenant-registry indirection is gone — `brand`
 * is exported directly. If a second tenant is ever needed, reintroduce a
 * `TENANTS` map keyed the same way rather than hard-coding a second value
 * into this file.
 */

/* ------------------------------------------------------------------ *
 * Scheme reason codes — card-network constants, not tenant vocabulary.
 * ------------------------------------------------------------------ *
 * `category` drives the reason-category rollups on Reports center, so every
 * code carries one of: fraud | authorization | processing | consumer.
 */

const VISA_REASON_CODES = [
  { code: '10.4', label: 'Other Fraud — Card Absent Environment', category: 'fraud' },
  { code: '11.2', label: 'Declined Authorization', category: 'authorization' },
  { code: '11.3', label: 'No Authorization', category: 'authorization' },
  { code: '12.5', label: 'Incorrect Amount', category: 'processing' },
  { code: '12.6.2', label: 'Duplicate Processing', category: 'processing' },
  { code: '13.1', label: 'Merchandise/Services Not Received', category: 'consumer' },
  { code: '13.3', label: 'Not as Described or Defective Merchandise', category: 'consumer' },
  { code: '13.6', label: 'Credit Not Processed', category: 'consumer' },
  { code: '13.7', label: 'Canceled Merchandise/Services', category: 'consumer' },
];

const MASTERCARD_REASON_CODES = [
  { code: '4837', label: 'No Cardholder Authorization', category: 'fraud' },
  { code: '4840', label: 'Fraudulent Processing of Transactions', category: 'fraud' },
  { code: '4834', label: 'Point-of-Interaction Error', category: 'processing' },
  { code: '4842', label: 'Late Presentment', category: 'processing' },
  { code: '4853', label: 'Cardholder Dispute — Goods Not as Described', category: 'consumer' },
  { code: '4855', label: 'Goods or Services Not Provided', category: 'consumer' },
  { code: '4860', label: 'Credit Not Processed', category: 'consumer' },
];

const AMEX_REASON_CODES = [
  { code: 'C08', label: 'Goods/Services Not Received or Only Partially Received', category: 'consumer' },
  { code: 'C31', label: 'Goods/Services Not as Described', category: 'consumer' },
  { code: 'F29', label: 'Card Not Present', category: 'fraud' },
];

export const REASON_CATEGORIES = [
  { id: 'fraud', label: 'Fraud' },
  { id: 'authorization', label: 'Authorization' },
  { id: 'processing', label: 'Processing error' },
  { id: 'consumer', label: 'Consumer dispute' },
];

/* ------------------------------------------------------------------ *
 * Tenant: Expedia
 * ------------------------------------------------------------------ */

export const nuveiBrand = {
  id: 'nuvei',
  name: 'Nuvei',
  productName: 'Dispute Console',
  legalName: 'Nuvei Corporation',
  shortName: 'NUV',
  tagline: 'Chargebacks and cardholder claims in one operational queue — across merchant, acquirer and issuer.',
  supportEmail: 'disputes@nuvei.example',
  emailDomain: 'nuvei.example',

  /** Paths only — never imported into a component. Served from /public.
   *  `logo` is the full mark+wordmark lockup for a light background;
   *  `logoInverse` is the same lockup in white, for a dark background.
   *  The lockup already spells out "nuvei" — no text renders beside it.
   *  Both variants are the supplied wordmark with the artboard and container
   *  stripped; only the glyph fill differs, and the dot over the "i" keeps
   *  the mark's own blue in both. */
  logo: '/tenant-nuvei-navy.svg',
  logoInverse: '/tenant-nuvei-white.svg',
  logoAspectRatio: 506 / 177,

  wordmark: { text: '', accent: '', weight: 700 },

  /* --- Palette ---------------------------------------------------------- *
   * Taken from the Nuvei 2026 design system — the `--_2026-color---swatches--*`
   * custom properties published on nuvei.com — rather than approximated:
   * core navy #160850, signal blue #0C98D4, warm white #FAF9F8, sand grey
   * #F1EFED, support grey #CFC9C2. Semantic and scheme colors stay the shared
   * cross-tenant constants; only the brand-identity slots change. */
  colors: {
    primary: '#160850',
    primaryDeep: '#0F0538',
    primaryTint: '#EDF6FD',
    primaryWash: '#F7FBFE',

    navRail: '#160850',
    navRailDeep: '#0F0538',
    navActive: '#FFB81C',
    navInk: '#D9E3F5',
    navInkMuted: '#7A8FB5',

    ink: '#0B1B33',
    inkMuted: '#51637F',
    inkSubtle: '#8394AC',
    canvas: '#F2F5FA',
    surface: '#FFFFFF',
    surfaceSunken: '#F7F9FC',
    line: '#DEE5F0',
    lineStrong: '#C2CEE0',

    success: '#0F7B4F',
    successTint: '#E4F4EC',
    warning: '#9A5B00',
    warningTint: '#FBF0DD',
    danger: '#B3261E',
    dangerTint: '#FBE9E7',
    info: '#3F51B5',
    infoTint: '#ECEEFB',

    schemeVisa: '#1A1F71',
    schemeMastercard: '#C8102E',
    schemeAmex: '#016FD0',
  },

  /* --- Chart ramp ------------------------------------------------------- *
   * ONE HUE PLUS TINTS: five steps of the brand blue from the deep rail
   * color to a pale tint, plus one contrast color reserved for "other" and
   * negative series. Separation comes from lightness, so the ramp survives
   * color-vision deficiency and grayscale printing. Assign in fixed order,
   * never cycle — a sixth category folds into "Other" and takes chartContrast. */
  chartSeries: ['#0C98D4', '#4DB0DF', '#8BBAE4', '#C3E0F5', '#160850'],
  chartContrast: '#B3261E',
  chartNeutral: '#66768F',

  /* --- Money, locale, markets ------------------------------------------- */
  currency: 'USD',
  locale: 'en-US',
  timezone: 'America/Toronto',
  markets: ['US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'AU', 'JP', 'MX'],

  /* --- Vocabulary -------------------------------------------------------- */
  terms: {
    case: 'case',
    cases: 'cases',
    chargeback: 'chargeback',
    chargebacks: 'chargebacks',
    claim: 'cardholder claim',
    claims: 'cardholder claims',
    claimProgramme: 'Cardholder Protection',
    buyer: 'cardholder',
    seller: 'merchant',
    order: 'transaction',
    item: 'line item',
    entity: 'entity',
    analyst: 'Dispute Specialist',
    analysts: 'Dispute Specialists',
    queue: 'queue',
    marketplace: 'portfolio',
  },

  /** Case-ID numbering, editable from System preferences. */
  numbering: { prefix: 'NUV', separator: '-', digits: 6, nextSequence: 810000 },

  /**
   * The merchant whose book the merchant perspective works.
   *
   * For a PROCESSOR tenant this is a customer, not the tenant — Nuvei is the
   * acquirer, so listing Nuvei in its own merchant portfolio produced "Every
   * merchant Nuvei processes for, Nuvei included". The console still wears the
   * tenant's brand in every perspective, which is the point of white-labelling
   * it; only the book has a different owner.
   */
  flagshipMerchant: {
    name: 'Northgate Retail Group',
    vertical: 'Omnichannel retail',
    mccCode: '5999',
    onboardedDate: '2018-02-02',
  },

  /* --- Entities ----------------------------------------------------------- */
  entities: [
    { id: 'nuvei_ecom', label: 'Nuvei eCommerce', descriptor: 'Card-not-present acquiring', mid: '5999100211' },
    { id: 'nuvei_pos', label: 'Nuvei In-Store', descriptor: 'Card-present and unattended', mid: '5999100254' },
    { id: 'nuvei_paylink', label: 'Nuvei Pay-by-Link', descriptor: 'Invoice and remote payments', mid: '5999100037' },
  ],

  /* --- Card schemes -------------------------------------------------------- */
  schemes: [
    { id: 'visa', label: 'Visa', short: 'VI', colorKey: 'schemeVisa', binPrefix: '4', reasonCodes: VISA_REASON_CODES },
    { id: 'mastercard', label: 'Mastercard', short: 'MC', colorKey: 'schemeMastercard', binPrefix: '5', reasonCodes: MASTERCARD_REASON_CODES },
    { id: 'amex', label: 'Amex', short: 'AX', colorKey: 'schemeAmex', binPrefix: '3', reasonCodes: AMEX_REASON_CODES },
  ],

  cardTypes: ['Credit', 'Debit', 'Prepaid', 'Corporate'],

  cycles: [
    { id: 'first_cb', label: '1st Chargeback', short: '1st CB' },
    { id: 'second_cb', label: '2nd Chargeback', short: '2nd CB' },
    { id: 'pre_arb', label: 'Pre-Arbitration', short: 'Pre-Arb' },
    { id: 'retrieval', label: 'Retrieval', short: 'Retr' },
    { id: 'rfi', label: 'RFI', short: 'RFI' },
  ],

  /** Traveler Protection claim reasons — the non-card intake path. */
  claimReasons: [
    { id: 'not_as_described', label: 'Property not as described', category: 'consumer' },
    { id: 'never_arrived', label: 'Booking not honoured', category: 'consumer' },
    { id: 'counterfeit', label: 'Fraudulent listing', category: 'fraud' },
    { id: 'damaged', label: 'Service failure', category: 'consumer' },
    { id: 'wrong_item', label: 'Wrong reservation supplied', category: 'consumer' },
  ],

  paymentMethods: ['Card', 'Wallet balance', 'PayPal', 'Apple Pay', 'Google Pay', 'Affirm'],

  /** A processor's book spans verticals rather than sitting in one, so these
   *  are the categories the portfolio screens actually draw from. */
  mccs: [
    { code: '5999', label: 'Miscellaneous and Specialty Retail' },
    { code: '5816', label: 'Digital Goods — Games' },
    { code: '7372', label: 'Computer Software and SaaS' },
    { code: '4722', label: 'Travel Agencies and Tour Operators' },
    { code: '5812', label: 'Eating Places and Restaurants' },
    { code: '5411', label: 'Grocery Stores and Supermarkets' },
    { code: '7995', label: 'Betting and Gaming' },
    { code: '6012', label: 'Financial Institutions — Merchandise' },
  ],

  acquirers: ['Nuvei', 'Chase', 'WorldPay', 'Adyen', 'Checkout', 'DLocal'],

  /* --- Queues -------------------------------------------------------------- */
  queues: [
    { id: 'all_chargebacks', label: 'All Chargebacks', description: 'Landing queue for every inbound chargeback.', sla: 24 },
    { id: 'arbitration_chargebacks', label: 'Arbitration Chargebacks', description: 'Second presentments and pre-arbitration.', sla: 16 },
    { id: 'high_value_chargebacks', label: 'High Value Chargebacks', description: 'Cases above the configured risk amount.', sla: 24 },
    { id: 'bank_fraud_code', label: 'Bank Fraud Code', description: 'The issuer’s own reason code flags fraud.', sla: 24 },
    { id: 'bank_non_fraud_code', label: 'Bank Non-Fraud Code', description: 'The issuer’s own reason code is not fraud-related.', sla: 36 },
    { id: 'analyst_confirmed_fraud', label: 'Analyst Confirmed Fraud', description: 'An analyst has confirmed this case as fraud.', sla: 24 },
    { id: 'analyst_non_fraud', label: 'Analyst Non-Fraud', description: 'An analyst has reviewed and ruled out fraud.', sla: 36 },
    { id: 'below_minimum_value', label: 'Below Minimum Value', description: 'Below the configured processing minimum.', sla: 48 },
    { id: 'supervisor', label: 'Supervisor', description: 'Cases escalated to a supervisor.', sla: 12 },
  ],

  assignmentReasons: [
    { id: 'review_resolve', label: 'Review and Resolve Dispute', description: 'Standard review of an inbound dispute.' },
    { id: 'merchant_docs', label: 'Supplier Docs Received', description: 'Supplier evidence has arrived and needs assessment.' },
    { id: 'timeframe', label: 'Potential Timeframe Breach', description: 'Approaching or past the scheme deadline.' },
    { id: 'inbound', label: 'Inbound Correspondence', description: 'New correspondence attached to the case.' },
    { id: 'zero_doc', label: '1st CB with 0 Doc Indicator', description: 'First chargeback arrived with no documents.' },
    { id: 'high_value', label: 'High Value — Manual Review', description: 'Above the risk amount, needs a senior decision.' },
    { id: 'consolidation', label: 'Consolidation', description: 'Grouped with linked cases for one decision.' },
    { id: 'duplicate', label: 'Duplicate Booking — Existing in Open', description: 'A matching case already exists.' },
  ],

  /* --- Due-date offsets ---------------------------------------------------- *
   * Network windows are fixed by the schemes; the internal buffer is ours and
   * is what analysts actually work to. Editable from System preferences. */
  dueDateOffsets: {
    schemeDays: { visa: 30, mastercard: 45, amex: 20 },
    cycleDays: { first_cb: 0, second_cb: -8, pre_arb: -14, retrieval: -10, rfi: -18 },
    claimDays: 21,
    internalBufferDays: 4,
  },

  thresholds: {
    minimumProcessingAmount: 10,
    riskAmount: 500,
    autoAssign: true,
    routingHighValue: 900,
    defaultReviewer: 'priya.shah',
  },

  /* --- Consolidation ------------------------------------------------------- *
   * Minimums are deliberately asymmetric. Two disputes on one card is already
   * a signal; two against one supplier is just a supplier with volume — hence
   * three, open-only, inside 30 days. Target 10-15%. */
  consolidation: {
    rules: [
      { id: 'same_card', label: 'Same card', minSize: 2, windowDays: 90, openOnly: false, description: 'Multiple disputes presented on one PAN.' },
      { id: 'same_order', label: 'Same transaction', minSize: 2, windowDays: 120, openOnly: false, description: 'One transaction disputed more than once, including across intake paths.' },
      { id: 'same_seller', label: 'Same supplier', minSize: 3, windowDays: 30, openOnly: true, description: 'A cluster of open disputes against one supplier inside 30 days.' },
    ],
  },

  features: {
    bulkActions: true,
    ruleCheck: true,
    consolidation: true,
    customReports: true,
    monitoring: true,
    uploadCases: true,
    webhooks: true,
    apiDocs: true,
    help: true,
  },

  /**
   * Demo gate credentials.
   *
   * READ THIS BEFORE TREATING IT AS SECURITY. This console is a static SPA with
   * no server, so whatever value ends up here is compiled into the JavaScript
   * bundle and is readable by anyone who opens devtools on the deployed site.
   * The gate keeps a demo link from being wandered into; it does not protect
   * anything, and no real credential should ever be put here.
   *
   * Sourced from the environment so the value is at least not committed to a
   * public repository. Set VITE_DEMO_USERNAME / VITE_DEMO_PASSWORD in
   * .env.local locally and in the host's environment for a deployment.
   */
  demoCredentials: {
    username: import.meta.env?.VITE_DEMO_USERNAME || 'NuveiDemo',
    password: import.meta.env?.VITE_DEMO_PASSWORD || '',
  },
};

/* ------------------------------------------------------------------ *
 * Single-tenant export — no registry, no env-var switch. See the file
 * header for how to reintroduce a second tenant if one is ever needed.
 * ------------------------------------------------------------------ */

export const brand = nuveiBrand;

export const allReasonCodes = (b = brand) =>
  b.schemes.flatMap((s) => s.reasonCodes.map((rc) => ({ ...rc, schemeId: s.id, schemeLabel: s.label })));

export const findReasonCode = (code, b = brand) =>
  allReasonCodes(b).find((rc) => rc.code === code) ?? null;

export const findScheme = (id, b = brand) => b.schemes.find((s) => s.id === id) ?? null;
export const findQueue = (id, b = brand) => b.queues.find((q) => q.id === id) ?? null;
export const findEntity = (id, b = brand) => b.entities.find((e) => e.id === id) ?? null;
export const findCycle = (id, b = brand) => b.cycles.find((c) => c.id === id) ?? null;
export const findClaimReason = (id, b = brand) => b.claimReasons.find((r) => r.id === id) ?? null;
export const categoryLabel = (id) => REASON_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/** Reason label for either intake path — claims have no scheme code. */
export const reasonLabelFor = (code, b = brand) =>
  findReasonCode(code, b)?.label ?? findClaimReason(code, b)?.label ?? code;

export default brand;
