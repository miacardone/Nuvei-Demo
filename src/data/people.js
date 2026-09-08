/**
 * People, roles, groups and skills.
 *
 * Every address is built from `brand.emailDomain` and the analyst role label
 * comes from `brand.terms.analyst`, so a tenant swap renames the whole
 * directory without touching this file.
 */

import brand from '@/brand/brand.config';

const email = (name) => `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${brand.emailDomain}`;
const initialsOf = (name) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const ROLES = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrator role with full access and elevated capabilities.',
    dateCreated: '2023-04-11',
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Manage users, queues and reporting across the team.',
    dateCreated: '2023-01-15',
  },
  {
    id: 'analyst',
    name: brand.terms.analyst,
    description: `Work and respond to disputes assigned by skill.`,
    dateCreated: '2023-06-30',
  },
];

export const GROUPS = [
  { id: 'g1', name: 'Main Group', description: 'Primary dispute operations team.', dateCreated: '2023-03-30' },
  { id: 'g2', name: 'Escalations', description: 'Handles supervisor and high-value escalations.', dateCreated: '2023-07-06' },
  { id: 'g3', name: 'Authenticity', description: 'Fraudulent listing escalations and supplier referrals.', dateCreated: '2024-02-15' },
  { id: 'g4', name: 'Weekend Cover', description: 'Analysts covering weekend reply-by deadlines.', dateCreated: '2024-05-02' },
];

export const SKILLS = [
  {
    id: 's1',
    name: 'All Dispute Response',
    criteria: 'Card Scheme is not [blank]',
    description: 'Allows all analysts to respond to disputes in due-date order.',
  },
  {
    id: 's2',
    name: 'Cardholder Protection Response',
    criteria: 'Queue is Cardholder Protection',
    description: 'Booking claims with no card leg.',
  },
  {
    id: 's3',
    name: 'High Value Access',
    criteria: 'Queue is High Value Disputes',
    description: 'For analysts allowed to work disputes above the risk amount.',
  },
  {
    id: 's4',
    name: 'Pre-Arbitration',
    criteria: 'Dispute Cycle is Pre-Arbitration or 2nd Chargeback',
    description: 'Authorized to file second presentments and pre-arb responses.',
  },
  {
    id: 's5',
    name: 'Authenticity Review',
    criteria: 'Reason Code is Fraudulent Listing',
    description: 'Trained to assess supplier authenticity reports.',
  },
];

export const SKILL_OPTIONS = SKILLS.map((s) => s.name);

/**
 * The directory IS Nuvei's own people — their published leadership and
 * regional GMs, used throughout the demo instead of invented names.
 *
 * They therefore appear as case owners, reviewers and note authors, which is
 * a deliberate choice: this demo is shown to Nuvei, and generic names read as
 * filler. Roles are assigned so the app's own logic still holds — admins for
 * the corporate officers, managers for the GMs and regional leads, analysts
 * for the people who work the queue — because ASSIGNABLE excludes admins and
 * a book with no analysts would have nobody to assign to.
 */
const SEED = [
  // Corporate officers — admin tier, elevated access, not in the assignment pool.
  { id: 'u1', name: 'Philip Fayer', title: 'Chair and Chief Executive Officer', roleId: 'admin', group: '-', status: 'Active', confirmation: 'Confirmed', startDate: '2003-01-01', market: 'CA' },
  { id: 'u2', name: 'Yuval Ziv', title: 'President', roleId: 'admin', group: '-', status: 'Active', confirmation: 'Confirmed', startDate: '2019-03-04', market: 'IL' },
  { id: 'u3', name: 'Dave McLaughlin', title: 'Chief Financial Officer', roleId: 'admin', group: '-', status: 'Active', confirmation: 'Confirmed', startDate: '2026-07-01', market: 'US' },
  { id: 'u4', name: 'Lindsay Matthews', title: 'General Counsel and Corporate Secretary', roleId: 'admin', group: '-', status: 'Active', confirmation: 'Confirmed', startDate: '2020-05-18', market: 'CA' },

  // Operating leadership — managers, so they review and approve.
  { id: 'u5', name: 'Samir Zabaneh', title: 'Chief Operating Officer', roleId: 'manager', group: 'Main Group', status: 'Active', confirmation: 'Confirmed', startDate: '2026-07-01', market: 'CA' },
  { id: 'u6', name: 'Eli Rosner', title: 'Chief Product & Technology Officer', roleId: 'manager', group: 'Main Group', status: 'Active', confirmation: 'Confirmed', startDate: '2026-07-01', market: 'US' },
  { id: 'u7', name: 'Caitlin Shetter', title: 'Chief People Officer', roleId: 'manager', group: 'Escalations', status: 'Active', confirmation: 'Confirmed', startDate: '2022-02-14', market: 'CA' },
  { id: 'u8', name: 'Neil Erlick', title: 'Chief Corporate Development Officer', roleId: 'manager', group: 'Escalations', status: 'Active', confirmation: 'Confirmed', startDate: '2017-06-05', market: 'CA' },

  // Regional GMs and commercial leads — analysts, so they own and work cases
  // in their own markets.
  { id: 'u9', name: 'Chris Scappa', title: 'General Manager, North America', roleId: 'analyst', group: 'Main Group', status: 'Active', confirmation: 'Confirmed', startDate: '2020-10-05', market: 'US' },
  { id: 'u10', name: 'Guy Douek', title: 'General Manager, Europe', roleId: 'analyst', group: 'Main Group', status: 'Active', confirmation: 'Confirmed', startDate: '2019-09-16', market: 'GB' },
  { id: 'u11', name: 'Juan Soto', title: 'General Manager, LATAM', roleId: 'analyst', group: 'Escalations', status: 'Active', confirmation: 'Confirmed', startDate: '2021-02-01', market: 'MX' },
  { id: 'u12', name: 'Paul Kawtal', title: 'General Manager, APAC', roleId: 'analyst', group: 'Weekend Cover', status: 'Active', confirmation: 'Confirmed', startDate: '2022-06-06', market: 'SG' },
  { id: 'u13', name: 'Laura Miller', title: 'Chief Revenue Officer and Global Head of eCommerce', roleId: 'analyst', group: 'Main Group', status: 'Active', confirmation: 'Confirmed', startDate: '2021-11-08', market: 'US' },
  { id: 'u14', name: 'Scott Calliham', title: 'Chief Strategy Officer', roleId: 'analyst', group: 'Authenticity', status: 'Active', confirmation: 'Confirmed', startDate: '2021-09-13', market: 'US' },
  { id: 'u15', name: 'Guillaume Conteville', title: 'Chief Marketing Officer', roleId: 'analyst', group: 'Authenticity', status: 'Active', confirmation: 'Confirmed', startDate: '2022-08-22', market: 'GB' },
  { id: 'u16', name: 'Ben Weiner', title: 'Global Head of Partner Channel', roleId: 'analyst', group: 'Weekend Cover', status: 'Active', confirmation: 'Force Change Password', startDate: '2021-04-12', market: 'US' },
];

export const USERS = SEED.map((u, i) => ({
  ...u,
  email: email(u.name),
  initials: initialsOf(u.name),
  role: ROLES.find((r) => r.id === u.roleId)?.name ?? u.roleId,
  lockStatus: i === 7 ? 'Locked' : 'Unlocked',
  skills:
    u.roleId === 'admin'
      ? SKILL_OPTIONS
      : u.roleId === 'manager'
        ? [SKILL_OPTIONS[0], SKILL_OPTIONS[2], SKILL_OPTIONS[3]]
        : [SKILL_OPTIONS[0], SKILL_OPTIONS[1]],
}));

/** The whole directory works cases; there is no separate excluded tier. */
export const STAFF = USERS;

/** Only active analysts and managers take case assignments. */
export const ASSIGNABLE = STAFF.filter((u) => u.status === 'Active' && u.roleId !== 'admin');

export const WORKER_OPTIONS = ASSIGNABLE.map((u) => u.email);
export const REVIEWER_OPTIONS = STAFF.filter((u) => u.roleId !== 'analyst').map((u) => u.email);

export const getUser = (id) => USERS.find((u) => u.id === id) ?? null;
export const userByEmail = (e) => USERS.find((u) => u.email === e) ?? null;

/** The signed-in demo operator. */
export const CURRENT_USER = {
  ...USERS[1],
  roleLabel: 'Admin',
};

export const USER_GROUPS = ['-', ...GROUPS.map((g) => g.name)];
export const USER_STATUSES = ['Active', 'Inactive'];
