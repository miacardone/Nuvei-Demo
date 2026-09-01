/**
 * Fixture vocabulary — the raw material the generator draws from.
 *
 * Deliberately plausible rather than random: real-shaped booking titles, a
 * market spread matching brand.markets, and travel price bands that make the
 * amounts believable. Nothing here names a tenant, so the same catalogue
 * would serve a second tenant if one were ever added.
 */

/**
 * Traveler first/last names, weighted toward Expedia's actual served markets
 * (brand.markets: US, CA, GB, DE, FR, ES, IT, AU, JP, MX) rather than the
 * Vinted reference's pan-European (heavily Lithuanian) resale-marketplace
 * pool this list originally carried over from.
 */
export const FIRST_NAMES = [
  'Michael', 'Jennifer', 'David', 'Ashley', 'James', 'Sarah', 'Robert', 'Emily',
  'Christopher', 'Jessica', 'Matthew', 'Amanda', 'Daniel', 'Megan', 'Andrew', 'Rachel',
  'Ryan', 'Lauren', 'Brandon', 'Nicole', 'Kevin', 'Stephanie', 'Justin', 'Samantha',
  'Olivia', 'Ethan', 'Sophia', 'Liam', 'Ava', 'Noah',
  'Oliver', 'Harry', 'Charlotte', 'George', 'Amelia', 'Jack',
  'Liam', 'Isla', 'Lucas', 'Chloe', 'Mia', 'Jacob',
  'Lukas', 'Sophie', 'Maximilian', 'Anna', 'Felix', 'Laura',
  'Louis', 'Camille', 'Chloé', 'Théo', 'Léa', 'Hugo',
  'Carlos', 'Maria', 'Javier', 'Lucia', 'Diego', 'Valentina',
  'Marco', 'Giulia', 'Matteo', 'Sofia', 'Alessandro', 'Chiara',
  'Hiroshi', 'Yuki', 'Kenji', 'Aiko', 'Takashi', 'Emi',
  'Priya', 'Arjun',
];

export const LAST_NAMES = [
  'Johnson', 'Williams', 'Anderson', 'Thompson', 'Martinez', 'Hernandez',
  'Miller', 'Davis', 'White', 'Wilson', 'Moore', 'Taylor',
  'Brown', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young',
  'Smith', 'Jones', 'Harris', 'Scott', 'Evans', 'Roberts',
  'Fischer', 'Weber', 'Schmitt', 'Braun', 'Meyer', 'Klein',
  'Dubois', 'Moreau', 'Lefevre', 'Girard', 'Laurent', 'Simon',
  'Garcia', 'Fernandez', 'Ruiz', 'Ortega', 'Serrano', 'Blanco',
  'Rossi', 'Ferrari', 'Marino', 'Greco', 'Conti', 'Romano',
  'Suzuki', 'Tanaka', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi',
  'Sharma', 'Patel', 'Nguyen',
];

/** Fictional travel suppliers — hotel chains, airlines, tour operators, car-hire brands. */
export const SELLER_HANDLES = [
  'skyline_airways', 'harborview_hotels', 'coastal_car_hire', 'meridian_cruises',
  'summit_tours', 'blue_horizon_resorts', 'pacific_rail_journeys', 'northwind_air',
  'lakeside_lodges', 'desert_bloom_resorts', 'evergreen_getaways', 'city_pulse_hotels',
  'sunrise_charters', 'alpine_transfers', 'seaside_villas_co', 'metro_stay_group',
  'wanderlux_travel', 'goldencoast_cruises', 'trailhead_adventures', 'harbor_ferry_lines',
  'reef_and_ridge_tours', 'grandview_suites', 'windward_air', 'oasis_car_rentals',
  'roamfree_vacations', 'highline_resorts', 'coral_bay_hotels', 'redrock_expeditions',
];

/** Titles are grouped so a booking lines up with a sensible category and price. */
export const ITEMS = [
  { title: 'Round-trip flight, JFK–LHR, economy', category: 'Flights', low: 380, high: 920 },
  { title: 'Beachfront resort, 5 nights, all-inclusive', category: 'Hotels', low: 650, high: 2200 },
  { title: 'Flight + hotel package, Cancun, 7 nights', category: 'Vacation Packages', low: 900, high: 2600 },
  { title: 'Compact car rental, 5 days, LAX', category: 'Car Rentals', low: 140, high: 420 },
  { title: '7-night Caribbean cruise, balcony cabin', category: 'Cruises', low: 1100, high: 3400 },
  { title: 'Boutique hotel, 3 nights, city center', category: 'Hotels', low: 380, high: 940 },
  { title: 'Domestic flight, ORD–DEN, economy', category: 'Flights', low: 120, high: 340 },
  { title: 'Guided day tour, historic old town', category: 'Activities & Tours', low: 45, high: 180 },
  { title: 'Ski resort package, 4 nights, lift pass', category: 'Vacation Packages', low: 780, high: 2100 },
  { title: 'SUV rental, 7 days, airport pickup', category: 'Car Rentals', low: 260, high: 640 },
  { title: 'International flight, SFO–NRT, premium economy', category: 'Flights', low: 980, high: 2400 },
  { title: 'All-suite hotel, 4 nights, breakfast included', category: 'Hotels', low: 520, high: 1380 },
  { title: 'Mediterranean cruise, 10 nights, ocean view', category: 'Cruises', low: 1600, high: 4200 },
  { title: 'Snorkeling excursion, half-day, small group', category: 'Activities & Tours', low: 60, high: 165 },
  { title: 'Luxury villa, 6 nights, private pool', category: 'Hotels', low: 1400, high: 3800 },
  { title: 'Economy flight, MIA–BOG, one-way', category: 'Flights', low: 160, high: 410 },
  { title: 'Theme park + hotel package, 5 nights', category: 'Vacation Packages', low: 1100, high: 2900 },
  { title: 'Convertible rental, 3 days, resort pickup', category: 'Car Rentals', low: 210, high: 560 },
  { title: 'City pass + walking tour bundle', category: 'Activities & Tours', low: 35, high: 120 },
  { title: 'Kids club resort, 5 nights, family suite', category: 'Hotels', low: 900, high: 2400 },
  { title: 'Business-class flight, LHR–SIN', category: 'Flights', low: 2100, high: 5200 },
  { title: 'River cruise, 8 nights, cabin with balcony', category: 'Cruises', low: 1900, high: 4600 },
  { title: 'Minivan rental, 6 days, one-way drop-off', category: 'Car Rentals', low: 320, high: 780 },
  { title: 'Safari lodge package, 6 nights, full board', category: 'Vacation Packages', low: 2200, high: 5400 },
  { title: 'Cooking class + market tour', category: 'Activities & Tours', low: 70, high: 210 },
  { title: 'Ski chalet, 5 nights, ski-in ski-out', category: 'Hotels', low: 1200, high: 3100 },
  { title: 'Regional flight, DEN–SLC, economy', category: 'Flights', low: 95, high: 260 },
  { title: 'Helicopter tour, coastline, 45 minutes', category: 'Activities & Tours', low: 180, high: 420 },
  { title: 'Economy hatchback rental, 4 days, downtown', category: 'Car Rentals', low: 110, high: 300 },
];

export const CONDITIONS = ['Confirmed', 'Confirmed — non-refundable', 'Confirmed — flexible rate', 'Pending supplier confirmation', 'Confirmed — package rate'];

export const MARKET_CITIES = {
  US: ['New York', 'Chicago', 'Austin', 'Denver', 'Seattle', 'Miami'],
  CA: ['Toronto', 'Montreal', 'Vancouver'],
  GB: ['London', 'Manchester', 'Bristol', 'Leeds'],
  DE: ['Berlin', 'Hamburg', 'Munich', 'Cologne'],
  FR: ['Paris', 'Lyon', 'Marseille', 'Bordeaux'],
  ES: ['Madrid', 'Barcelona', 'Valencia', 'Seville'],
  IT: ['Milan', 'Rome', 'Turin', 'Bologna'],
  AU: ['Sydney', 'Melbourne', 'Brisbane'],
  JP: ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama'],
  MX: ['Mexico City', 'Cancun', 'Guadalajara'],
};

/** Airlines, cruise and rail lines, and coach operators — the booking's "carrier". */
export const CARRIERS = ['Skyline Airways', 'Northwind Air', 'Meridian Cruises', 'Pacific Rail Journeys', 'Continental Coach', 'Harborline Ferries', 'Windward Air'];

export const LAST_NOTES = [
  'Awaiting supplier documents',
  'Represented — pending scheme response',
  'Escalated to supervisor',
  'Docs received, in review',
  'Cardholder contacted issuer directly',
  'Partial refund applied',
  'Supplier confirms booking was honoured',
  'Cancellation request logged with supplier',
  'Authenticity report requested',
  'Below write-off threshold',
  '—',
];

export const TRANSACTION_TYPES = ['Sale', 'Refund', 'Authorization', 'Recurring'];
export const SALES_METHODS = ['Ecommerce', 'Mobile App', 'MOTO', 'Recurring Billing'];
export const FRAUD_MARKERS = ['Confirmed Fraud', 'Suspected Fraud', 'No Fraud Marker', 'Fraud Reported by Issuer'];
