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

const SEED = [
  { id: 'u1', name: 'Monica Baker', roleId: 'admin', group: '-', status: 'Active', confirmation: 'Confirmed', startDate: '2021-04-11', market: 'US' },
  { id: 'u2', name: 'Priya Shah', roleId: 'admin', group: 'Main Group', status: 'Active', confirmation: 'Confirmed', startDate: '2021-10-17', market: 'US' },
  { id: 'u3', name: 'Camille Dubois', roleId: 'manager', group: 'Main Group', status: 'Active', confirmation: 'Confirmed', startDate: '2022-04-07', market: 'FR' },
  { id: 'u4', name: 'David Chen', roleId: 'manager', group: 'Escalations', status: 'Active', confirmation: 'Confirmed', startDate: '2022-06-30', market: 'CA' },
  { id: 'u5', name: 'Lena Fischer', roleId: 'analyst', group: 'Main Group', status: 'Active', confirmation: 'Confirmed', startDate: '2022-06-22', market: 'DE' },
  { id: 'u6', name: 'Ashley Nguyen', roleId: 'analyst', group: 'Main Group', status: 'Active', confirmation: 'Force Change Password', startDate: '2022-06-23', market: 'US' },
  { id: 'u7', name: 'Hiroshi Tanaka', roleId: 'analyst', group: 'Authenticity', status: 'Active', confirmation: 'Confirmed', startDate: '2022-06-23', market: 'JP' },
  { id: 'u8', name: 'Alba Garcia', roleId: 'analyst', group: 'Authenticity', status: 'Inactive', confirmation: 'Confirmed', startDate: '2022-08-26', market: 'ES' },
  { id: 'u9', name: 'Carlos Ruiz', roleId: 'analyst', group: 'Escalations', status: 'Active', confirmation: 'Confirmed', startDate: '2022-06-23', market: 'MX' },
  { id: 'u10', name: 'Andrea Conti', roleId: 'analyst', group: 'Main Group', status: 'Active', confirmation: 'Confirmed', startDate: '2022-06-23', market: 'IT' },
  { id: 'u11', name: 'James Thompson', roleId: 'analyst', group: 'Weekend Cover', status: 'Active', confirmation: 'Confirmed', startDate: '2023-02-15', market: 'GB' },
  { id: 'u12', name: 'Sofia Marino', roleId: 'analyst', group: 'Weekend Cover', status: 'Active', confirmation: 'Confirmed', startDate: '2023-09-01', market: 'AU' },
  // Expedia Group leadership — admin-tier so they carry elevated access
  // without landing in the case-assignment pool (ASSIGNABLE excludes admins).
  // `leadership: true` also keeps them out of the random note/history/
  // reviewer draws elsewhere (see STAFF below) — real names shouldn't get
  // auto-attached to fictional per-case narrative content.
  { id: 'u13', name: 'Ariane Gorin', roleId: 'admin', group: '-', status: 'Active', confirmation: 'Confirmed', startDate: '2024-04-01', market: 'US', leadership: true },
  { id: 'u14', name: 'Barry Diller', roleId: 'admin', group: '-', status: 'Active', confirmation: 'Confirmed', startDate: '2003-01-01', market: 'US', leadership: true },
  { id: 'u15', name: 'Eric Hart', roleId: 'admin', group: '-', status: 'Active', confirmation: 'Confirmed', startDate: '2019-01-01', market: 'US', leadership: true },
  { id: 'u16', name: 'Derek Andersen', roleId: 'admin', group: '-', status: 'Active', confirmation: 'Confirmed', startDate: '2023-01-01', market: 'US', leadership: true },
  { id: 'u17', name: 'Robert Dzielak', roleId: 'admin', group: '-', status: 'Active', confirmation: 'Confirmed', startDate: '2015-01-01', market: 'US', leadership: true },
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

/** Operational staff — excludes leadership, who carry admin access but don't
 *  do casework and shouldn't be auto-attached to fictional case content. */
export const STAFF = USERS.filter((u) => !u.leadership);

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
