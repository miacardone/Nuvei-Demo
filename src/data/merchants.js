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
/* This branch of Nuvei processes travel and hospitality only, so the groups
   are segments WITHIN travel rather than whole industries. That distinction
   matters for disputes: an airline seat, a hotel night and a car-hire deposit
   fail in genuinely different ways and at different rates, so segmenting by
   "retail vs digital" would tell an operator here nothing at all. */
export const MERCHANT_GROUPS = [
  { id: 'air', label: 'Air & OTA' },
  { id: 'lodging', label: 'Hotels & Lodging' },
  { id: 'dining', label: 'Dining & Venues' },
  { id: 'ground', label: 'Ground & Car Hire' },
  { id: 'experiences', label: 'Cruise & Experiences' },
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
  groupId: 'air',
  status: 'Active',
  riskTier: 'Low',
  onboardedDate: brand.flagshipMerchant.onboardedDate,
  projectedVolume: 4_820_000_000,
  disputeWeight: 25,
  flagship: true,
};

const PEER_STUBS = [
  /* --- Air & OTA --- */
  { id: 'flightpath', name: 'FlightPath Travel', vertical: 'Discount airline OTA', mccCode: '4722', groupId: 'air', status: 'Suspended', riskTier: 'High', onboardedDate: '2017-08-30', projectedVolume: 92_700_000, disputeWeight: 11 },
  { id: 'skyline', name: 'Skyline Connect', vertical: 'Regional short-haul carrier', mccCode: '4511', groupId: 'air', status: 'Active', riskTier: 'Medium', onboardedDate: '2019-02-14', projectedVolume: 128_400_000, disputeWeight: 5 },
  { id: 'aerobridge', name: 'Aerobridge Holidays', vertical: 'Package holiday operator', mccCode: '4722', groupId: 'air', status: 'Active', riskTier: 'Medium', onboardedDate: '2020-01-22', projectedVolume: 76_300_000, disputeWeight: 4 },
  { id: 'jetstream', name: 'Jetstream Charter', vertical: 'Private charter booking', mccCode: '4511', groupId: 'air', status: 'Active', riskTier: 'Low', onboardedDate: '2021-07-05', projectedVolume: 34_900_000, disputeWeight: 2 },
  { id: 'voyagerfares', name: 'Voyager Fares', vertical: 'Flight comparison and booking', mccCode: '4722', groupId: 'air', status: 'Active', riskTier: 'High', onboardedDate: '2018-11-03', projectedVolume: 61_500_000, disputeWeight: 7 },

  /* --- Hotels & Lodging --- */
  { id: 'brightwave', name: 'Brightwave Hotels', vertical: 'City hotel group', mccCode: '7011', groupId: 'lodging', status: 'Active', riskTier: 'Low', onboardedDate: '2018-06-11', projectedVolume: 214_500_000, disputeWeight: 6 },
  { id: 'stonegate', name: 'Stonegate Inns', vertical: 'Roadside and budget hotels', mccCode: '7011', groupId: 'lodging', status: 'Active', riskTier: 'Low', onboardedDate: '2019-09-30', projectedVolume: 88_200_000, disputeWeight: 3 },
  { id: 'azurebay', name: 'Azure Bay Resorts', vertical: 'Beach resort group', mccCode: '7011', groupId: 'lodging', status: 'Active', riskTier: 'Medium', onboardedDate: '2020-04-18', projectedVolume: 143_700_000, disputeWeight: 5 },
  { id: 'hearthstay', name: 'HearthStay Apartments', vertical: 'Extended-stay serviced apartments', mccCode: '7011', groupId: 'lodging', status: 'Active', riskTier: 'Low', onboardedDate: '2021-02-09', projectedVolume: 47_600_000, disputeWeight: 2 },
  { id: 'summit', name: 'Summit Lodges', vertical: 'Ski and mountain resorts', mccCode: '7011', groupId: 'lodging', status: 'Onboarding', riskTier: 'Medium', onboardedDate: null, projectedVolume: 55_200_000, disputeWeight: 0 },
  { id: 'lanterncourt', name: 'Lantern Court Hotels', vertical: 'Boutique hotel collection', mccCode: '7011', groupId: 'lodging', status: 'Under review', riskTier: 'High', onboardedDate: '2019-05-27', projectedVolume: 39_800_000, disputeWeight: 5 },

  /* --- Dining & Venues --- */
  { id: 'harborside', name: 'Harborside Dining Group', vertical: 'Restaurant and venue group', mccCode: '5812', groupId: 'dining', status: 'Active', riskTier: 'Low', onboardedDate: '2021-05-08', projectedVolume: 41_800_000, disputeWeight: 3 },
  { id: 'emberroom', name: 'The Ember Room', vertical: 'Fine dining group', mccCode: '5812', groupId: 'dining', status: 'Active', riskTier: 'Low', onboardedDate: '2020-10-12', projectedVolume: 22_400_000, disputeWeight: 1 },
  { id: 'grainhouse', name: 'Grainhouse Kitchens', vertical: 'Casual dining chain', mccCode: '5812', groupId: 'dining', status: 'Active', riskTier: 'Medium', onboardedDate: '2019-08-01', projectedVolume: 66_900_000, disputeWeight: 3 },
  { id: 'nightfall', name: 'Nightfall Venues', vertical: 'Late-night bars and events', mccCode: '5812', groupId: 'dining', status: 'Under review', riskTier: 'High', onboardedDate: '2021-11-16', projectedVolume: 18_700_000, disputeWeight: 4 },

  /* --- Ground & Car Hire --- */
  { id: 'goldenspin', name: 'Driveline Car Hire', vertical: 'Airport car rental', mccCode: '7512', groupId: 'ground', status: 'Under review', riskTier: 'High', onboardedDate: '2019-11-20', projectedVolume: 74_600_000, disputeWeight: 8 },
  { id: 'lattice', name: 'Lattice Rail', vertical: 'Intercity rail ticketing', mccCode: '4112', groupId: 'ground', status: 'Active', riskTier: 'Low', onboardedDate: '2019-03-19', projectedVolume: 159_400_000, disputeWeight: 3 },
  { id: 'redline', name: 'Redline Coaches', vertical: 'Long-distance coach travel', mccCode: '4112', groupId: 'ground', status: 'Active', riskTier: 'Medium', onboardedDate: '2020-06-24', projectedVolume: 43_100_000, disputeWeight: 3 },
  { id: 'citycab', name: 'CityCab Group', vertical: 'Airport transfers and taxis', mccCode: '7512', groupId: 'ground', status: 'Active', riskTier: 'Medium', onboardedDate: '2021-03-11', projectedVolume: 29_500_000, disputeWeight: 2 },
  { id: 'freewheel', name: 'Freewheel Rentals', vertical: 'City car and van hire', mccCode: '7512', groupId: 'ground', status: 'Active', riskTier: 'Low', onboardedDate: '2018-09-19', projectedVolume: 51_200_000, disputeWeight: 2 },

  /* --- Cruise & Experiences --- */
  { id: 'pixelforge', name: 'Coastline Cruises', vertical: 'Ocean cruise operator', mccCode: '4411', groupId: 'experiences', status: 'Active', riskTier: 'Medium', onboardedDate: '2020-09-14', projectedVolume: 118_300_000, disputeWeight: 4 },
  { id: 'meridianexp', name: 'Wanderlust Experiences', vertical: 'Tours, attractions and activities', mccCode: '7996', groupId: 'experiences', status: 'Onboarding', riskTier: 'High', onboardedDate: null, projectedVolume: 63_900_000, disputeWeight: 0 },
  { id: 'polarstar', name: 'Polarstar Expeditions', vertical: 'Expedition and adventure cruise', mccCode: '4411', groupId: 'experiences', status: 'Active', riskTier: 'High', onboardedDate: '2019-12-08', projectedVolume: 37_400_000, disputeWeight: 5 },
  { id: 'gatewaypark', name: 'Gateway Attractions', vertical: 'Theme parks and ticketing', mccCode: '7996', groupId: 'experiences', status: 'Active', riskTier: 'Low', onboardedDate: '2018-04-26', projectedVolume: 94_800_000, disputeWeight: 3 },
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

/**
 * How many merchants this branch actually processes for.
 *
 * The console works the merchants that have had dispute activity — that is
 * what there is anything to DO about, and it is the set every table, filter
 * and report here operates on. The portfolio behind it is far larger, and
 * almost all of it is quiet: small hotels and restaurants that process
 * steadily and are never disputed.
 *
 * So counts on this site mean one of two things and each says which: the
 * number of merchants we hold, or the number with something happening. Never
 * a blend of the two, and never a total that no table could reproduce.
 */
export const PORTFOLIO_TOTAL = 658;
export const ACTIVE_MERCHANTS = MERCHANT_ROSTER.length;

export const rosterById = (id) => MERCHANT_ROSTER.find((m) => m.id === id) ?? null;

export default MERCHANT_ROSTER;
