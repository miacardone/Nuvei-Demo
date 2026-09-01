/**
 * Permission matrix — one grid per perspective.
 *
 * DERIVED FROM EACH PERSPECTIVE'S OWN NAVIGATION, not a shared list. Every
 * page permission traces back to a real nav leaf in data/navigation.js, so a
 * nav change can never leave a stale permission behind and the counts always
 * add up to something real.
 *
 * Non-navigation capabilities (export, bulk edit, delete…) are added on top,
 * per perspective — an acquirer has no Rules page, so it gets no rule
 * capabilities either.
 */

import { navLeavesFor } from '@/data/navigation';
import { ROLES } from '@/data/people';

const CAPABILITIES_BY_PERSPECTIVE = {
  merchant: [
    { permission: 'Export Cases', area: 'Cases' },
    { permission: 'Bulk Edit Cases', area: 'Cases' },
    { permission: 'Reassign Cases', area: 'Cases' },
    { permission: 'Delete Cases', area: 'Cases' },
    { permission: 'Create Rule', area: 'Rules' },
    { permission: 'Edit Rule', area: 'Rules' },
    { permission: 'Delete Rule', area: 'Rules' },
    { permission: 'Export Reports', area: 'Reports' },
    { permission: 'Schedule Reports', area: 'Reports' },
    { permission: 'Skills', area: 'Administration' },
    { permission: 'Permissions', area: 'Administration' },
  ],
  acquirer: [
    { permission: 'Export Cases', area: 'Cases' },
    { permission: 'Reassign Cases', area: 'Cases' },
    { permission: 'Approve Underwriting', area: 'Portfolio' },
    { permission: 'Export Reports', area: 'Reports' },
    { permission: 'Skills', area: 'Administration' },
    { permission: 'Permissions', area: 'Administration' },
  ],
  issuer: [
    { permission: 'Export Cases', area: 'Cases' },
    { permission: 'Reassign Cases', area: 'Cases' },
    { permission: 'Override Decline', area: 'Cases' },
    { permission: 'Export Reports', area: 'Reports' },
    { permission: 'Skills', area: 'Administration' },
    { permission: 'Permissions', area: 'Administration' },
  ],
};

/** Fixed display order; a perspective only shows the areas it actually has. */
const AREA_ORDER = ['Cases', 'Portfolio', 'Rules', 'Reports', 'Administration'];

const ANALYST_ALLOW_BY_PERSPECTIVE = {
  merchant: new Set(['Dashboard', 'Case Management', 'Work Case', 'Export Cases', 'Reports Center', 'Account Settings', 'Help', 'Rule Check']),
  acquirer: new Set(['Overview', 'Disputes Cases', 'Representment', 'Work Case', 'Export Cases', 'Reporting', 'Account Settings', 'Help']),
  issuer: new Set(['Overview', 'Cardholders', 'Approvals', 'Declines', 'Disputes Cases', 'Chargebacks', 'Work Case', 'Fraud', 'Export Cases', 'Reporting', 'Account Settings', 'Help']),
};

const MANAGER_DENY_BY_PERSPECTIVE = {
  merchant: new Set(['Delete Cases', 'Delete Rule', 'Permissions', 'System Preferences']),
  acquirer: new Set(['Approve Underwriting', 'Permissions']),
  issuer: new Set(['Override Decline', 'Permissions']),
};

export function permissionsFor(perspective) {
  const fromNav = navLeavesFor(perspective)
    .filter((l) => l.permission)
    .map((l) => ({ permission: l.permission, area: l.area ?? 'Administration' }));
  const capabilities = CAPABILITIES_BY_PERSPECTIVE[perspective] ?? [];
  const combined = [...fromNav, ...capabilities];

  const areas = AREA_ORDER.filter((area) => combined.some((p) => p.area === area));
  const groups = areas.map((area) => ({
    area,
    permissions: [...new Set(combined.filter((p) => p.area === area).map((p) => p.permission))],
  }));
  const all = groups.flatMap((g) => g.permissions);

  const analystAllow = ANALYST_ALLOW_BY_PERSPECTIVE[perspective] ?? ANALYST_ALLOW_BY_PERSPECTIVE.merchant;
  const managerDeny = MANAGER_DENY_BY_PERSPECTIVE[perspective] ?? MANAGER_DENY_BY_PERSPECTIVE.merchant;

  return {
    areas,
    groups,
    all,
    defaultGrants: {
      admin: new Set(all),
      manager: new Set(all.filter((p) => !managerDeny.has(p))),
      analyst: new Set(all.filter((p) => analystAllow.has(p))),
    },
  };
}

/** Role tabs on the Permissions page, in display order. */
export const PERMISSION_ROLES = ROLES.map((r) => ({ id: r.id, name: r.name, description: r.description }));
