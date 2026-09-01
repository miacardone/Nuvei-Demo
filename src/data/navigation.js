/**
 * NAVIGATION — one source of truth for the rail, the routes and Permissions,
 * for all three perspectives (merchant / acquirer / issuer).
 *
 * Every route is prefixed with its perspective (`/merchant/...`,
 * `/acquirer/...`, `/issuer/...`), so switching perspective is a URL change,
 * not a re-login. `permission` is the key Permissions grants against — the
 * grid is generated from THIS list per perspective, so a nav change can never
 * leave a stale permission behind.
 *
 * The merchant tree is the client's edited IA carried over unchanged from the
 * Vinted build of this console:
 *
 *   · "Rule check", not "Criteria check" — it checks a rule, not a criterion.
 *   · NO Case priority page. Priority is derived from due date and value
 *     (domain/statuses.js), so there is nothing to administer.
 *   · Archived is a TAB inside Case management, not a sibling page.
 *   · NO Scheduler page. A schedule belongs to a report, so it is a step in
 *     the Custom reports builder.
 *   · Users is ONE page with tabs, not a dropdown of three.
 *   · NO Unmatched docs section anywhere.
 *
 * The acquirer and issuer trees are new — see src/data/perspectives.js for
 * why a perspective is a different lens on the same case book rather than a
 * separate product.
 */

export const LOGIN_ROUTE = '/login';

/* ------------------------------------------------------------------ *
 * Merchant
 * ------------------------------------------------------------------ */

const merchantRoutes = {
  dashboard: '/merchant/dashboard',

  /* Two distinct products that both use the word "alert".
   *   · alerts        — the operational digest derived from our own case book
   *                     (domain/alerts.js): "what should I look at first".
   *   · alertCaseWork — the network early-warning product (Verifi CDRN /
   *                     Visa RDR / Ethoca, data/alerts.js): refund before a
   *                     chargeback is ever filed.
   * They are not two views of one thing and must not be merged. */
  alerts: '/merchant/alerts',
  alertCaseWork: '/merchant/alerts/case-work',
  alertSettings: '/merchant/alerts/settings',
  alertPermissions: '/merchant/alerts/permissions',
  alertReporting: '/merchant/alerts/reporting',
  alertAssignments: '/merchant/alerts/assignments',
  alertValidations: '/merchant/alerts/validations',

  ruleGroups: '/merchant/rules/groups',
  addRule: '/merchant/rules/groups/add',
  bulkActions: '/merchant/rules/bulk',
  ruleCheck: '/merchant/rules/check',

  assignmentReasons: '/merchant/case-admin/assignment-reasons',
  queueManagement: '/merchant/case-admin/queues',
  caseManagement: '/merchant/case-admin/cases',
  uploadCases: '/merchant/case-admin/upload',

  workCase: '/merchant/work-case',
  workCaseDetail: (id = ':caseId') => `/merchant/work-case/${id}`,

  reportsCenter: '/merchant/reports/center',
  monitoring: '/merchant/reports/monitoring',
  customReports: '/merchant/reports/custom',

  users: '/merchant/users',
  apiDocumentation: '/merchant/api-docs',

  accountSettings: '/merchant/settings/account',
  webhooks: '/merchant/settings/webhooks',
  systemPreferences: '/merchant/settings/system',

  templatesLibrary: '/merchant/templates',

  help: '/merchant/help',
};

const merchantNav = [
  { label: 'Dashboard', path: merchantRoutes.dashboard, icon: 'dashboard', permission: 'Dashboard', area: 'Cases' },
  {
    label: 'Alerts',
    path: '/merchant/alerts-group',
    icon: 'bell',
    children: [
      // end: true — '/merchant/alerts' is a string-prefix of every sibling
      // below it, so without an exact match this link would stay highlighted
      // no matter which sibling was active.
      { label: 'Priority alerts', path: merchantRoutes.alerts, icon: 'shield', permission: 'Priority Alerts', area: 'Cases', end: true },
      { label: 'Alert case work', path: merchantRoutes.alertCaseWork, icon: 'inbox', permission: 'Alert Case Work', area: 'Cases' },
      { label: 'Alert settings', path: merchantRoutes.alertSettings, icon: 'sliders', permission: 'Alert Settings', area: 'Cases' },
      { label: 'Alert permissions', path: merchantRoutes.alertPermissions, icon: 'lock', permission: 'Alert Permissions', area: 'Administration' },
      { label: 'Alert reporting', path: merchantRoutes.alertReporting, icon: 'file', permission: 'Alert Reporting', area: 'Reports' },
      { label: 'Alert assignments', path: merchantRoutes.alertAssignments, icon: 'user', permission: 'Alert Assignments', area: 'Administration' },
      { label: 'Alert validations', path: merchantRoutes.alertValidations, icon: 'checklist', permission: 'Alert Validations', area: 'Cases' },
    ],
  },
  {
    label: 'Rules',
    path: '/merchant/rules',
    icon: 'rules',
    children: [
      { label: 'Rule groups', path: merchantRoutes.ruleGroups, icon: 'layers', permission: 'Rule Groups', area: 'Rules' },
      { label: 'Bulk actions', path: merchantRoutes.bulkActions, icon: 'checklist', permission: 'Bulk Actions', area: 'Rules' },
      { label: 'Rule check', path: merchantRoutes.ruleCheck, icon: 'searchCheck', permission: 'Rule Check', area: 'Rules' },
    ],
  },
  {
    label: 'Case admin',
    path: '/merchant/case-admin',
    icon: 'folder',
    children: [
      { label: 'Assignment reasons', path: merchantRoutes.assignmentReasons, icon: 'tag', permission: 'Assignment Reasons', area: 'Administration' },
      { label: 'Queue management', path: merchantRoutes.queueManagement, icon: 'inbox', permission: 'Queue Management', area: 'Administration' },
      { label: 'Case management', path: merchantRoutes.caseManagement, icon: 'table', permission: 'Case Management', area: 'Cases' },
      { label: 'Upload cases', path: merchantRoutes.uploadCases, icon: 'upload', permission: 'Upload Cases', area: 'Cases' },
    ],
  },
  { label: 'Work case', path: merchantRoutes.workCase, icon: 'briefcase', permission: 'Work Case', area: 'Cases' },
  {
    label: 'Reports',
    path: '/merchant/reports',
    icon: 'chart',
    children: [
      { label: 'Reports center', path: merchantRoutes.reportsCenter, icon: 'pie', permission: 'Reports Center', area: 'Reports' },
      { label: 'Monitoring', path: merchantRoutes.monitoring, icon: 'activity', permission: 'Monitoring', area: 'Reports' },
      { label: 'Custom reports', path: merchantRoutes.customReports, icon: 'spreadsheet', permission: 'Custom Reports', area: 'Reports' },
    ],
  },
  { label: 'Users', path: merchantRoutes.users, icon: 'users', permission: 'User Management', area: 'Administration' },
  { label: 'API documentation', path: merchantRoutes.apiDocumentation, icon: 'code', permission: 'API Documentation', area: 'Administration' },
  {
    label: 'Settings',
    path: '/merchant/settings',
    icon: 'cog',
    children: [
      { label: 'Account settings', path: merchantRoutes.accountSettings, icon: 'userCircle', permission: 'Account Settings', area: 'Administration' },
      { label: 'Webhooks', path: merchantRoutes.webhooks, icon: 'webhook', permission: 'Webhooks', area: 'Administration' },
      { label: 'System preferences', path: merchantRoutes.systemPreferences, icon: 'sliders', permission: 'System Preferences', area: 'Administration' },
    ],
  },
  { label: 'Templates library', path: merchantRoutes.templatesLibrary, icon: 'file', permission: 'Templates Library', area: 'Administration' },
  { label: 'Help', path: merchantRoutes.help, icon: 'help', permission: 'Help', area: 'Administration' },
];

/* ------------------------------------------------------------------ *
 * Acquirer
 * ------------------------------------------------------------------ */

const acquirerRoutes = {
  overview: '/acquirer/overview',

  portfolioMerchants: '/acquirer/portfolio/merchants',
  onboarding: '/acquirer/portfolio/onboarding',
  underwriting: '/acquirer/portfolio/underwriting',

  disputesCases: '/acquirer/disputes/cases',
  representment: '/acquirer/disputes/representment',

  workCase: '/acquirer/work-case',
  workCaseDetail: (id = ':caseId') => `/acquirer/work-case/${id}`,

  risk: '/acquirer/risk',
  settlement: '/acquirer/settlement',
  reporting: '/acquirer/reporting',

  users: '/acquirer/users',
  accountSettings: '/acquirer/settings',
  templatesLibrary: '/acquirer/templates',
  help: '/acquirer/help',
};

const acquirerNav = [
  { label: 'Overview', path: acquirerRoutes.overview, icon: 'dashboard', permission: 'Overview', area: 'Cases' },
  {
    label: 'Portfolio',
    path: '/acquirer/portfolio',
    icon: 'folder',
    children: [
      { label: 'Merchants', path: acquirerRoutes.portfolioMerchants, icon: 'table', permission: 'Portfolio Merchants', area: 'Portfolio' },
      { label: 'Onboarding', path: acquirerRoutes.onboarding, icon: 'upload', permission: 'Onboarding', area: 'Portfolio' },
      { label: 'Underwriting', path: acquirerRoutes.underwriting, icon: 'searchCheck', permission: 'Underwriting', area: 'Portfolio' },
    ],
  },
  {
    label: 'Disputes',
    path: '/acquirer/disputes',
    icon: 'layers',
    children: [
      { label: 'Cases', path: acquirerRoutes.disputesCases, icon: 'table', permission: 'Disputes Cases', area: 'Cases' },
      { label: 'Representment', path: acquirerRoutes.representment, icon: 'checklist', permission: 'Representment', area: 'Cases' },
    ],
  },
  { label: 'Risk', path: acquirerRoutes.risk, icon: 'activity', permission: 'Risk', area: 'Reports' },
  { label: 'Settlement', path: acquirerRoutes.settlement, icon: 'pie', permission: 'Settlement', area: 'Reports' },
  { label: 'Reporting', path: acquirerRoutes.reporting, icon: 'chart', permission: 'Reporting', area: 'Reports' },
  { label: 'Users', path: acquirerRoutes.users, icon: 'users', permission: 'User Management', area: 'Administration' },
  { label: 'Settings', path: acquirerRoutes.accountSettings, icon: 'cog', permission: 'Account Settings', area: 'Administration' },
  { label: 'Templates library', path: acquirerRoutes.templatesLibrary, icon: 'file', permission: 'Templates Library', area: 'Administration' },
  { label: 'Help', path: acquirerRoutes.help, icon: 'help', permission: 'Help', area: 'Administration' },
];

/* ------------------------------------------------------------------ *
 * Issuer
 * ------------------------------------------------------------------ */

const issuerRoutes = {
  overview: '/issuer/overview',
  cardholders: '/issuer/cardholders',

  approvals: '/issuer/authorizations/approvals',
  declines: '/issuer/authorizations/declines',

  disputesCases: '/issuer/disputes/cases',
  chargebacks: '/issuer/disputes/chargebacks',

  workCase: '/issuer/work-case',
  workCaseDetail: (id = ':caseId') => `/issuer/work-case/${id}`,

  fraud: '/issuer/fraud',
  statements: '/issuer/statements',
  reporting: '/issuer/reporting',

  users: '/issuer/users',
  accountSettings: '/issuer/settings',
  templatesLibrary: '/issuer/templates',
  help: '/issuer/help',
};

const issuerNav = [
  { label: 'Overview', path: issuerRoutes.overview, icon: 'dashboard', permission: 'Overview', area: 'Cases' },
  { label: 'Cardholders', path: issuerRoutes.cardholders, icon: 'users', permission: 'Cardholders', area: 'Cases' },
  {
    label: 'Authorizations',
    path: '/issuer/authorizations',
    icon: 'checklist',
    children: [
      { label: 'Approvals', path: issuerRoutes.approvals, icon: 'table', permission: 'Approvals', area: 'Cases' },
      { label: 'Declines', path: issuerRoutes.declines, icon: 'table', permission: 'Declines', area: 'Cases' },
    ],
  },
  {
    label: 'Disputes',
    path: '/issuer/disputes',
    icon: 'layers',
    children: [
      { label: 'Cases', path: issuerRoutes.disputesCases, icon: 'table', permission: 'Disputes Cases', area: 'Cases' },
      { label: 'Chargebacks', path: issuerRoutes.chargebacks, icon: 'table', permission: 'Chargebacks', area: 'Cases' },
    ],
  },
  { label: 'Fraud', path: issuerRoutes.fraud, icon: 'activity', permission: 'Fraud', area: 'Reports' },
  { label: 'Statements', path: issuerRoutes.statements, icon: 'spreadsheet', permission: 'Statements', area: 'Reports' },
  { label: 'Reporting', path: issuerRoutes.reporting, icon: 'chart', permission: 'Reporting', area: 'Reports' },
  { label: 'Users', path: issuerRoutes.users, icon: 'users', permission: 'User Management', area: 'Administration' },
  { label: 'Settings', path: issuerRoutes.accountSettings, icon: 'cog', permission: 'Account Settings', area: 'Administration' },
  { label: 'Templates library', path: issuerRoutes.templatesLibrary, icon: 'file', permission: 'Templates Library', area: 'Administration' },
  { label: 'Help', path: issuerRoutes.help, icon: 'help', permission: 'Help', area: 'Administration' },
];

/* ------------------------------------------------------------------ *
 * Registry + lookups
 * ------------------------------------------------------------------ */

const ROUTES_BY_PERSPECTIVE = { merchant: merchantRoutes, acquirer: acquirerRoutes, issuer: issuerRoutes };
const NAV_BY_PERSPECTIVE = { merchant: merchantNav, acquirer: acquirerNav, issuer: issuerNav };

const navLeavesOf = (nav) =>
  nav.flatMap((item) =>
    item.children ? item.children.map((c) => ({ ...c, parent: item.label })) : [{ ...item, parent: null }],
  );

const NAV_LEAVES_BY_PERSPECTIVE = Object.fromEntries(
  Object.entries(NAV_BY_PERSPECTIVE).map(([id, nav]) => [id, navLeavesOf(nav)]),
);

/**
 * Merchant routes under their pre-perspective name. The alert screens brought
 * across from the other builds import `ROUTES` directly; they are merchant
 * screens, so this alias is exact rather than a convenience.
 */
export const ROUTES = merchantRoutes;

export const routesFor = (perspective) => ROUTES_BY_PERSPECTIVE[perspective] ?? merchantRoutes;
export const navFor = (perspective) => NAV_BY_PERSPECTIVE[perspective] ?? merchantNav;
export const navLeavesFor = (perspective) => NAV_LEAVES_BY_PERSPECTIVE[perspective] ?? NAV_LEAVES_BY_PERSPECTIVE.merchant;

/** The route a perspective lands on right after switching to it or signing in. */
export const landingRouteFor = (perspective) => {
  const routes = routesFor(perspective);
  return routes.dashboard ?? routes.overview;
};

export const titleForPath = (pathname, perspective) =>
  navLeavesFor(perspective).find((l) => pathname === l.path || pathname.startsWith(`${l.path}/`))?.label ?? '';
