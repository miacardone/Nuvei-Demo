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
  /** Official wordmark, with the artboard and navy container stripped so it
   *  sits on already-themed chrome. Glyphs use currentColor; the dot keeps
   *  the mark's own blue. */
  logo: `<svg viewBox="94 60 506 177" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Nuvei">
    <path d="M99.5207 120.857L99.5212 229L132.5 229L132.5 158L132.5 157.5L133 156.5L134.5 154.5L136 153L137.5 151.5L139.5 150L141.5 148.5L143.5 147.5L145.5 146.5L149 145.5L151.5 145L154 145L156 145L158 145L161.5 145.5L164 146.5L166 147.5L167.5 148.5L169.5 150L171 151.5L172.5 153.5L173.5 155.5L174.5 158L175 160.5L175.5 163.198L175.5 229L207.5 229L207.5 189L207.5 149L207 144.5L206.5 141.5L205.5 138L204 134.5L203 132.5L201 129.5L199 127L196 124.5L193 122.5L189 120.5L185 119L180 118L175 117.5L168.5 117.5L163 118.5L157.5 120L154.5 121L151 122.5L147 124.5L143.5 126.5L140.5 128.5L138 130.5L135 133.5L132.5 136L132.5 120.857L99.5207 120.857Z" fill="currentColor" stroke="currentColor"/>
    <path d="M325.496 228.225L325.328 120.642L292.364 120.591L292.475 191.223L292.475 191.72L291.977 192.714L290.481 194.702L288.984 196.192L287.487 197.681L285.49 199.171L283.493 200.66L281.496 201.651L279.498 202.643L276.001 203.633L273.503 204.126L271.004 204.122L269.005 204.119L267.006 204.116L263.507 203.613L261.007 202.615L259.006 201.617L257.505 200.619L255.504 199.124L254.002 197.63L252.5 195.638L251.497 193.646L250.494 191.158L249.99 188.67L249.486 185.985L249.385 120.524L217.399 120.474L217.461 160.267L217.523 200.06L218.03 204.538L218.534 207.523L219.539 211.006L221.044 214.49L222.046 216.482L224.05 219.469L226.053 221.959L229.056 224.451L232.057 226.445L236.059 228.441L240.059 229.94L245.058 230.942L250.057 231.447L256.554 231.457L262.05 230.471L267.545 228.987L270.542 227.997L274.038 226.51L278.033 224.527L281.528 222.543L284.524 220.558L287.019 218.572L290.013 215.592L292.509 213.109L292.532 228.174L325.496 228.225Z" fill="currentColor" stroke="currentColor"/>
    <path d="M402 228.293L445.402 120.291L410.5 120.291L385 192.5L358.5 120.291L324.5 120.291L367.5 228.293L402 228.293Z" fill="currentColor" stroke="currentColor"/>
    <path d="M549.999 184.497L470.379 184.499L470.5 164.498L520.5 164.498L520.5 161.997L520.001 158.997L519 155.997L518 153.997L516.5 151.497L515 149.497L513.5 147.997L511.5 146.497L509 144.997L506 143.497L502.001 141.997L498.001 141.497L492.501 141.497L489 141.997L485 143.497L482 144.997L479.5 146.497L477.5 147.997L476 149.497L474.5 151.497L473 153.997L472 155.997L471 158.997L470.501 161.997L470.5 164L470 164.5L469.5 184.499L439 186.5L438.5 181L438.5 175.5L438.5 168.5L439 163.5L440 158.997L441 155.5L442.5 152L444.5 147.5L447 143L449.5 139.5L453 135.5L456.5 132L460 129L463.5 126.5L466.5 124.5L469.5 123L473 121.5L477 120L480.5 119L483.5 118.5L487 118L490.501 117.497L500.501 117.497L504.5 118L508 118.5L511.5 119.5L515 120.5L519 122.5L523 124.5L526.5 126.5L529.5 128.5L533 131.5L535.5 134.5L538.5 138L541 142L543 145.5L544 147.75L545 150L546 152.5L547.5 156.5L548.5 160L549.5 164.497L550 170L550.001 172.997L549.999 184.497Z" fill="currentColor" stroke="currentColor"/>
    <path d="M528.075 198.505L540.998 217.999L538 220L535 222L531.5 224L527 226L522.5 227.5L517.5 229L513 230L507.5 231L501.998 231.499L492.498 231.499L488 231L482 230L476 228.5L470.5 226.5L466 224.5L461.5 221.5L457 218L453.5 214.5L450 210.5L447.498 207.501L444.998 203.501L442.998 199.501L441.498 196.001L439.998 191.501L438.998 186.501L439 180L471 184.5L471.5 187L472.5 190L474 193L476 196L478.5 199L481 201.5L484 203.5L488.5 205.5L493 206.5L497 207L500.5 207.499L503.998 207.499L509 207L511 206.5L514.5 205.5L518.5 204L522 202.5L525 200.5L528.075 198.505Z" fill="currentColor" stroke="currentColor"/>
    <path d="M591 121V228H559.5V121H591Z" fill="currentColor" stroke="currentColor"/>
    <circle cx="574.5" cy="85.5" r="19.5" fill="#4496CE"/>
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
