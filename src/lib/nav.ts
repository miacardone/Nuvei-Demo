/**
 * Console navigation. Mirrors the capability areas of a payment orchestration
 * hub: route configuration, acceptance optimisation, risk, disputes, reporting.
 */
export type NavItem = { href: string; label: string; icon: string; ready?: boolean };

export const navItems: NavItem[] = [
  { href: "/", label: "Overview", icon: "grid", ready: true },
  { href: "/transactions", label: "Transactions", icon: "list" },
  { href: "/routing", label: "Routing rules", icon: "route" },
  { href: "/providers", label: "Providers", icon: "plug" },
  { href: "/risk", label: "Risk & fraud", icon: "shield" },
  { href: "/disputes", label: "Disputes", icon: "gavel" },
  { href: "/analytics", label: "Analytics", icon: "chart" },
  { href: "/settings", label: "Settings", icon: "cog" },
];
