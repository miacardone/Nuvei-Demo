/**
 * MERCHANT ROSTER — the acquirer's book, and the groups it rolls up into.
 *
 * This file deliberately imports nothing but the tenant config. It sits BELOW
 * both cases.js and portfolio.js in the import graph so that:
 *
 *   · cases.js can stamp a merchantId on every case, and
 *   · portfolio.js can derive each merchant's stats from those cases,
 *
 * without the two importing each other. Put anything that needs the case book
 * in portfolio.js, never here.
 *
 * `disputeWeight` is the merchant's share of inbound disputes, not a count.
 * cases.js draws against these weights, so the book distributes itself and the
 * per-merchant numbers on Portfolio are real counts rather than invented ones.
 * A merchant that is not yet live carries weight 0 and legitimately owns no
 * cases.
 */

import brand from '@/brand/brand.config';

/** Groups exist so the scope picker can offer a roll-up as well as one
 *  merchant. A merchant with no `groupId` is its own scope. */
export const MERCHANT_GROUPS = [
  { id: 'retail', label: 'Retail & Commerce' },
  { id: 'digital', label: 'Digital & Gaming' },
  { id: 'travel', label: 'Travel & Hospitality' },
  { id: 'financial', label: 'Financial Services' },
];

/**
 * The flagship is described by the tenant config so this roster carries no
 * tenant-specific literal. It is the acquirer's largest merchant and the one
 * the demo walks through by default.
 */
const FLAGSHIP_STUB = {
  id: 'flagship',
  name: brand.flagshipMerchant.name,
  vertical: brand.flagshipMerchant.vertical,
  mccCode: brand.flagshipMerchant.mccCode,
  groupId: 'retail',
  status: 'Active',
  riskTier: 'Low',
  onboardedDate: brand.flagshipMerchant.onboardedDate,
  projectedVolume: 4_820_000_000,
  disputeWeight: 46,
  flagship: true,
};

const PEER_STUBS = [
  { id: 'brightwave', name: 'Brightwave Electronics', vertical: 'Consumer electronics retail', mccCode: '5999', groupId: 'retail', status: 'Active', riskTier: 'Low', onboardedDate: '2018-06-11', projectedVolume: 214_500_000, disputeWeight: 9 },
  { id: 'pixelforge', name: 'PixelForge Studios', vertical: 'Games and in-app purchases', mccCode: '5816', groupId: 'digital', status: 'Active', riskTier: 'Medium', onboardedDate: '2020-09-14', projectedVolume: 118_300_000, disputeWeight: 6 },
  { id: 'lattice', name: 'Lattice Software', vertical: 'B2B SaaS subscriptions', mccCode: '7372', groupId: 'digital', status: 'Active', riskTier: 'Low', onboardedDate: '2019-03-19', projectedVolume: 159_400_000, disputeWeight: 5 },
  { id: 'flightpath', name: 'FlightPath Travel', vertical: 'Discount airline OTA', mccCode: '4722', groupId: 'travel', status: 'Suspended', riskTier: 'High', onboardedDate: '2017-08-30', projectedVolume: 92_700_000, disputeWeight: 18 },
  { id: 'harborside', name: 'Harborside Dining Group', vertical: 'Restaurant group', mccCode: '5812', groupId: 'travel', status: 'Active', riskTier: 'Low', onboardedDate: '2021-05-08', projectedVolume: 41_800_000, disputeWeight: 4 },
  // Not live yet — weight 0, so the case book gives them nothing.
  { id: 'freshline', name: 'Freshline Markets', vertical: 'Online grocery', mccCode: '5411', groupId: 'retail', status: 'Onboarding', riskTier: 'Medium', onboardedDate: null, projectedVolume: 55_200_000, disputeWeight: 0 },
  { id: 'goldenspin', name: 'GoldenSpin Gaming', vertical: 'Licensed online gaming', mccCode: '7995', groupId: 'digital', status: 'Under review', riskTier: 'High', onboardedDate: '2019-11-20', projectedVolume: 74_600_000, disputeWeight: 12 },
  { id: 'meridian', name: 'Meridian Digital Bank', vertical: 'Neobank top-ups', mccCode: '6012', groupId: 'financial', status: 'Onboarding', riskTier: 'High', onboardedDate: null, projectedVolume: 63_900_000, disputeWeight: 0 },
];

const MCC_BY_CODE = Object.fromEntries(brand.mccs.map((m) => [m.code, m]));

export const MERCHANT_ROSTER = [FLAGSHIP_STUB, ...PEER_STUBS].map((m) => ({
  ...m,
  flagship: Boolean(m.flagship),
  mccLabel: MCC_BY_CODE[m.mccCode]?.label ?? brand.mccs[0].label,
  groupLabel: MERCHANT_GROUPS.find((g) => g.id === m.groupId)?.label ?? null,
}));

/** [id, weight] pairs for the case book's weighted draw. */
export const MERCHANT_WEIGHTS = MERCHANT_ROSTER
  .filter((m) => m.disputeWeight > 0)
  .map((m) => [m.id, m.disputeWeight]);

export const rosterById = (id) => MERCHANT_ROSTER.find((m) => m.id === id) ?? null;

export default MERCHANT_ROSTER;
