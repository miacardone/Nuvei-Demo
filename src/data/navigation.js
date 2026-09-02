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

/**
 * ONE TREE. Nuvei is the acquirer, so the operator never switches persona —
 * they choose which merchant they are looking at (see data/merchant-scope.js).
 * Every screen this console carries therefore hangs off a single `/acquirer`
 * nav, rather than being split across three role trees.
 *
 * Route SUFFIXES are still what App.jsx registers under `/:perspective`, and
 * the suffix sets of the old merchant / acquirer / issuer trees barely
 * overlapped, so the union below reaches every page without renaming a route.
 */
const acquirerRoutes = {
  overview: '/acquirer/overview',
  dashboard: '/acquirer/dashboard',

  portfolioMerchants: '/acquirer/portfolio/merchants',
  onboarding: '/acquirer/portfolio/onboarding',
  underwriting: '/acquirer/portfolio/underwriting',

  /* Two products that both say "alert" — see the note in the nav below. */
  alerts: '/acquirer/alerts',
  alertCaseWork: '/acquirer/alerts/case-work',
  alertSettings: '/acquirer/alerts/settings',
  alertPermissions: '/acquirer/alerts/permissions',
  alertReporting: '/acquirer/alerts/reporting',
  alertAssignments: '/acquirer/alerts/assignments',
  alertValidations: '/acquirer/alerts/validations',

  disputesCases: '/acquirer/disputes/cases',
  representment: '/acquirer/disputes/representment',
  chargebacks: '/acquirer/disputes/chargebacks',

  caseManagement: '/acquirer/case-admin/cases',
  assignmentReasons: '/acquirer/case-admin/assignment-reasons',
  queueManagement: '/acquirer/case-admin/queues',
  uploadCases: '/acquirer/case-admin/upload',

  workCase: '/acquirer/work-case',
  workCaseDetail: (id = ':caseId') => `/acquirer/work-case/${id}`,

  ruleGroups: '/acquirer/rules/groups',
  addRule: '/acquirer/rules/groups/add',
  bulkActions: '/acquirer/rules/bulk',
  ruleCheck: '/acquirer/rules/check',

  cardholders: '/acquirer/cardholders',
  approvals: '/acquirer/authorizations/approvals',
  declines: '/acquirer/authorizations/declines',

  risk: '/acquirer/risk',
  fraud: '/acquirer/fraud',
  settlement: '/acquirer/settlement',
  statements: '/acquirer/statements',

  reporting: '/acquirer/reporting',
  reportsCenter: '/acquirer/reports/center',
  monitoring: '/acquirer/reports/monitoring',
  customReports: '/acquirer/reports/custom',

  users: '/acquirer/users',
  apiDocumentation: '/acquirer/api-docs',
  templatesLibrary: '/acquirer/templates',

  accountSettings: '/acquirer/settings/account',
  webhooks: '/acquirer/settings/webhooks',
  systemPreferences: '/acquirer/settings/system',

  help: '/acquirer/help',
};

const acquirerNav = [
  { label: 'Overview', path: acquirerRoutes.overview, icon: 'dashboard', permission: 'Overview', area: 'Cases' },
  { label: 'Dispute dashboard', path: acquirerRoutes.dashboard, icon: 'activity', permission: 'Dashboard', area: 'Cases' },
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
    label: 'Alerts',
    path: '/acquirer/alerts-group',
    icon: 'bell',
    children: [
      // end: true — '/acquirer/alerts' is a string-prefix of every sibling
      // below it, so without an exact match this link would stay highlighted
      // no matter which sibling was active.
      { label: 'Priority alerts', path: acquirerRoutes.alerts, icon: 'shield', permission: 'Priority Alerts', area: 'Cases', end: true },
      { label: 'Alert case work', path: acquirerRoutes.alertCaseWork, icon: 'inbox', permission: 'Alert Case Work', area: 'Cases' },
      { label: 'Alert settings', path: acquirerRoutes.alertSettings, icon: 'sliders', permission: 'Alert Settings', area: 'Cases' },
      { label: 'Alert permissions', path: acquirerRoutes.alertPermissions, icon: 'lock', permission: 'Alert Permissions', area: 'Administration' },
      { label: 'Alert reporting', path: acquirerRoutes.alertReporting, icon: 'file', permission: 'Alert Reporting', area: 'Reports' },
      { label: 'Alert assignments', path: acquirerRoutes.alertAssignments, icon: 'user', permission: 'Alert Assignments', area: 'Administration' },
      { label: 'Alert validations', path: acquirerRoutes.alertValidations, icon: 'checklist', permission: 'Alert Validations', area: 'Cases' },
    ],
  },
  {
    label: 'Disputes',
    path: '/acquirer/disputes',
    icon: 'layers',
    children: [
      { label: 'Cases', path: acquirerRoutes.disputesCases, icon: 'table', permission: 'Disputes Cases', area: 'Cases' },
      { label: 'Representment', path: acquirerRoutes.representment, icon: 'checklist', permission: 'Representment', area: 'Cases' },
      { label: 'Chargebacks', path: acquirerRoutes.chargebacks, icon: 'table', permission: 'Chargebacks', area: 'Cases' },
    ],
  },
  { label: 'Work case', path: acquirerRoutes.workCase, icon: 'briefcase', permission: 'Work Case', area: 'Cases' },
  {
    label: 'Case admin',
    path: '/acquirer/case-admin',
    icon: 'inbox',
    children: [
      { label: 'Case management', path: acquirerRoutes.caseManagement, icon: 'table', permission: 'Case Management', area: 'Cases' },
      { label: 'Assignment reasons', path: acquirerRoutes.assignmentReasons, icon: 'tag', permission: 'Assignment Reasons', area: 'Administration' },
      { label: 'Queue management', path: acquirerRoutes.queueManagement, icon: 'inbox', permission: 'Queue Management', area: 'Administration' },
      { label: 'Upload cases', path: acquirerRoutes.uploadCases, icon: 'upload', permission: 'Upload Cases', area: 'Cases' },
    ],
  },
  {
    label: 'Rules',
    path: '/acquirer/rules',
    icon: 'rules',
    children: [
      { label: 'Rule groups', path: acquirerRoutes.ruleGroups, icon: 'layers', permission: 'Rule Groups', area: 'Rules' },
      { label: 'Bulk actions', path: acquirerRoutes.bulkActions, icon: 'checklist', permission: 'Bulk Actions', area: 'Rules' },
      { label: 'Rule check', path: acquirerRoutes.ruleCheck, icon: 'searchCheck', permission: 'Rule Check', area: 'Rules' },
    ],
  },
  {
    label: 'Authorizations',
    path: '/acquirer/authorizations',
    icon: 'card',
    children: [
      { label: 'Approvals', path: acquirerRoutes.approvals, icon: 'table', permission: 'Approvals', area: 'Cases' },
      { label: 'Declines', path: acquirerRoutes.declines, icon: 'table', permission: 'Declines', area: 'Cases' },
    ],
  },
  { label: 'Cardholders', path: acquirerRoutes.cardholders, icon: 'users', permission: 'Cardholders', area: 'Cases' },
  { label: 'Risk', path: acquirerRoutes.risk, icon: 'activity', permission: 'Risk', area: 'Reports' },
  { label: 'Fraud', path: acquirerRoutes.fraud, icon: 'shield', permission: 'Fraud', area: 'Reports' },
  { label: 'Settlement', path: acquirerRoutes.settlement, icon: 'pie', permission: 'Settlement', area: 'Reports' },
  { label: 'Statements', path: acquirerRoutes.statements, icon: 'spreadsheet', permission: 'Statements', area: 'Reports' },
  {
    label: 'Reports',
    path: '/acquirer/reports',
    icon: 'chart',
    children: [
      { label: 'Reporting', path: acquirerRoutes.reporting, icon: 'chart', permission: 'Reporting', area: 'Reports' },
      { label: 'Reports center', path: acquirerRoutes.reportsCenter, icon: 'pie', permission: 'Reports Center', area: 'Reports' },
      { label: 'Monitoring', path: acquirerRoutes.monitoring, icon: 'activity', permission: 'Monitoring', area: 'Reports' },
      { label: 'Custom reports', path: acquirerRoutes.customReports, icon: 'spreadsheet', permission: 'Custom Reports', area: 'Reports' },
    ],
  },
  { label: 'Users', path: acquirerRoutes.users, icon: 'users', permission: 'User Management', area: 'Administration' },
  { label: 'API documentation', path: acquirerRoutes.apiDocumentation, icon: 'code', permission: 'API Documentation', area: 'Administration' },
  { label: 'Templates library', path: acquirerRoutes.templatesLibrary, icon: 'file', permission: 'Templates Library', area: 'Administration' },
  {
    label: 'Settings',
    path: '/acquirer/settings',
    icon: 'cog',
    children: [
      { label: 'Account settings', path: acquirerRoutes.accountSettings, icon: 'userCircle', permission: 'Account Settings', area: 'Administration' },
      { label: 'Webhooks', path: acquirerRoutes.webhooks, icon: 'webhook', permission: 'Webhooks', area: 'Administration' },
      { label: 'System preferences', path: acquirerRoutes.systemPreferences, icon: 'sliders', permission: 'System Preferences', area: 'Administration' },
    ],
  },
  { label: 'Help', path: acquirerRoutes.help, icon: 'help', permission: 'Help', area: 'Administration' },
];

const ROUTES_BY_PERSPECTIVE = { acquirer: acquirerRoutes };
const NAV_BY_PERSPECTIVE = { acquirer: acquirerNav };

const navLeavesOf = (nav) =>
  nav.flatMap((item) =>
    item.children ? item.children.map((c) => ({ ...c, parent: item.label })) : [{ ...item, parent: null }],
  );

const NAV_LEAVES_BY_PERSPECTIVE = Object.fromEntries(
  Object.entries(NAV_BY_PERSPECTIVE).map(([id, nav]) => [id, navLeavesOf(nav)]),
);

/** Screens carried over from the other builds import `ROUTES` directly. */
export const ROUTES = acquirerRoutes;

export const routesFor = () => acquirerRoutes;
export const navFor = () => acquirerNav;
export const navLeavesFor = () => NAV_LEAVES_BY_PERSPECTIVE.acquirer;

/** The route a perspective lands on right after switching to it or signing in. */
export const landingRouteFor = (perspective) => {
  const routes = routesFor(perspective);
  return routes.dashboard ?? routes.overview;
};

export const titleForPath = (pathname, perspective) =>
  navLeavesFor(perspective).find((l) => pathname === l.path || pathname.startsWith(`${l.path}/`))?.label ?? '';
