/**
 * White-label brand definitions.
 *
 * Every visual decision in the app reads from a semantic token below — never a
 * raw hex. Swapping `Brand.tokens` re-skins the entire console, which is the
 * whole point of the white-label demo.
 *
 * The `nuvei` brand's palette is lifted verbatim from the Nuvei 2026 design
 * system (the `--_2026-color---swatches--*` custom properties served on
 * nuvei.com), so the default skin is pixel-accurate to the real brand.
 */

export type BrandTokens = {
  /** Primary brand colour — headers, primary buttons, active nav. */
  primary: string;
  primaryHover: string;
  /** Text/icon colour placed on top of `primary`. */
  onPrimary: string;
  /** Secondary/interactive accent — links, focus rings, highlights. */
  accent: string;
  accentSoft: string;
  onAccent: string;

  /** App canvas. */
  surface: string;
  /** Cards, panels, table rows sitting above the canvas. */
  surfaceRaised: string;
  /** Wells, table headers, inset areas. */
  surfaceSunken: string;
  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  textOnDark: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;

  /** Corner radius scale root, in px. */
  radius: string;
};

export type Brand = {
  id: string;
  /** Display name shown in the UI chrome. */
  name: string;
  /** Product name for the orchestration console itself. */
  productName: string;
  /** Short tagline used on the login/overview surfaces. */
  tagline: string;
  /** Inline SVG mark, rendered with `currentColor` so it inherits the theme. */
  logo: string;
  fonts: { sans: string; display: string };
  tokens: BrandTokens;
};

const nuvei: Brand = {
  id: "nuvei",
  name: "Nuvei",
  productName: "Commerce Payment Orchestration",
  tagline: "The infrastructure for every payment, everywhere.",
  logo: `<svg viewBox="0 0 150 32" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Nuvei">
    <text x="0" y="24" font-family="inherit" font-size="26" font-weight="700" letter-spacing="0.5" fill="currentColor">nuvei</text>
    <circle cx="80" cy="22" r="3.4" fill="currentColor"/>
  </svg>`,
  fonts: { sans: "var(--font-inter-tight)", display: "var(--font-inter-tight)" },
  tokens: {
    primary: "#160850", // core-navy
    primaryHover: "#22145a", // core-navy-100
    onPrimary: "#faf9f8", // warm-white
    accent: "#0c98d4", // signal-blue
    accentSoft: "#edf6fd", // blue-1000
    onAccent: "#ffffff",

    surface: "#faf9f8", // warm-white
    surfaceRaised: "#ffffff",
    surfaceSunken: "#f1efed", // sand-grey
    border: "#e4e0dc",
    borderStrong: "#cfc9c2", // support-grey

    text: "#160850",
    textMuted: "#6b6577",
    textOnDark: "#faf9f8",

    success: "#4d8a04",
    successSoft: "#dffaa0", // light-green
    warning: "#b26a00",
    warningSoft: "#fdf0d5",
    danger: "#d81f21",
    dangerSoft: "#ffdad6", // light-red

    radius: "10",
  },
};

/**
 * A deliberately different second skin. Its only job is to prove the console is
 * genuinely white-label: same components, zero code changes, different brand.
 */
const northwind: Brand = {
  id: "northwind",
  name: "Northwind Pay",
  productName: "Payment Orchestration",
  tagline: "One integration. Every payment route.",
  logo: `<svg viewBox="0 0 210 32" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Northwind Pay">
    <path d="M2 26V6h4.6l9 12V6h4.8v20h-4.6l-9-12v12H2Z" fill="currentColor"/>
    <text x="26" y="24" font-family="inherit" font-size="22" font-weight="600" letter-spacing="-0.2" fill="currentColor">orthwind Pay</text>
  </svg>`,
  fonts: { sans: "var(--font-inter-tight)", display: "var(--font-inter-tight)" },
  tokens: {
    primary: "#0f3d2e",
    primaryHover: "#155140",
    onPrimary: "#f6faf8",
    accent: "#12a06a",
    accentSoft: "#e6f6ef",
    onAccent: "#ffffff",

    surface: "#f7faf8",
    surfaceRaised: "#ffffff",
    surfaceSunken: "#eef4f1",
    border: "#dde7e2",
    borderStrong: "#c2d2cb",

    text: "#0f2620",
    textMuted: "#5c6f68",
    textOnDark: "#f6faf8",

    success: "#2f7d32",
    successSoft: "#dff5e1",
    warning: "#a86400",
    warningSoft: "#fbeed3",
    danger: "#c62828",
    dangerSoft: "#fadbd8",

    radius: "6",
  },
};

export const brands: Record<string, Brand> = { nuvei, northwind };

export const defaultBrandId = "nuvei";

export function getBrand(id: string | undefined): Brand {
  return brands[id ?? defaultBrandId] ?? brands[defaultBrandId];
}

/** Maps brand tokens onto the CSS custom properties consumed by Tailwind. */
export function brandToCssVars(brand: Brand): Record<string, string> {
  const t = brand.tokens;
  return {
    "--brand-primary": t.primary,
    "--brand-primary-hover": t.primaryHover,
    "--brand-on-primary": t.onPrimary,
    "--brand-accent": t.accent,
    "--brand-accent-soft": t.accentSoft,
    "--brand-on-accent": t.onAccent,
    "--brand-surface": t.surface,
    "--brand-surface-raised": t.surfaceRaised,
    "--brand-surface-sunken": t.surfaceSunken,
    "--brand-border": t.border,
    "--brand-border-strong": t.borderStrong,
    "--brand-text": t.text,
    "--brand-text-muted": t.textMuted,
    "--brand-text-on-dark": t.textOnDark,
    "--brand-success": t.success,
    "--brand-success-soft": t.successSoft,
    "--brand-warning": t.warning,
    "--brand-warning-soft": t.warningSoft,
    "--brand-danger": t.danger,
    "--brand-danger-soft": t.dangerSoft,
    "--brand-radius": `${t.radius}px`,
    "--brand-font-sans": brand.fonts.sans,
    "--brand-font-display": brand.fonts.display,
  };
}
