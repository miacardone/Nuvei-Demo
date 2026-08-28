# CPO Demo — white-label payment orchestration console

A demo of a Commerce Payment Orchestration console that can be re-skinned for any
brand without touching a single component.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TypeScript

```bash
npm install
npm run dev
```

## How the white-labelling works

There are three layers, and components only ever touch the top one.

1. **Brand definitions** — `src/lib/brand.ts`. Each brand is a plain object:
   name, product name, tagline, logo SVG, fonts, and a `BrandTokens` palette.
2. **CSS custom properties** — the active brand is serialised to
   `--brand-*` variables and set as an inline style on `<html>` during SSR, so
   the first paint is already themed and there is no flash of the wrong brand.
3. **Semantic Tailwind utilities** — `src/app/globals.css` maps those variables
   into Tailwind's `@theme`, producing `bg-primary`, `text-ink-muted`,
   `border-line`, `bg-success-soft`, `rounded-[var(--brand-radius)]` and so on.

The rule that keeps it white-label: **no component names a colour.** There are
no hex values and no `blue-600`s outside `src/lib/brand.ts`. Swapping the brand
object re-skins everything — chrome, charts, status pills, focus rings, radii.

The active brand is persisted in a `brand` cookie and resolved server-side in
`src/app/layout.tsx`.

### Adding a brand

Add one entry to `brands` in `src/lib/brand.ts`. Nothing else changes:

```ts
const acme: Brand = {
  id: "acme",
  name: "Acme Payments",
  productName: "Payment Orchestration",
  tagline: "…",
  logo: `<svg …>`,       // uses currentColor so it inherits the theme
  fonts: { sans: "var(--font-inter-tight)", display: "var(--font-inter-tight)" },
  tokens: { /* the full BrandTokens set */ },
};
```

Two skins ship today — switch between them with the **Brand** control in the
top bar:

| Brand | Role |
| --- | --- |
| **Nuvei** (default) | Palette and type taken verbatim from the Nuvei 2026 design system |
| **Northwind Pay** | A deliberately different skin, to prove the theming is real |

### Nuvei brand tokens

Sourced from the `--_2026-color---swatches--*` custom properties served on
nuvei.com, so the default skin matches the live brand:

| Token | Value |
| --- | --- |
| Core navy | `#160850` |
| Core navy 100 | `#22145a` |
| Signal blue | `#0c98d4` |
| Warm white | `#faf9f8` |
| Sand grey | `#f1efed` |
| Support grey | `#cfc9c2` |
| Green | `#71ba05` |
| Red | `#f83133` |

Typeface: **Inter Tight** (Nuvei's 2026 brand face), loaded via `next/font`.

## Signing in

The console sits behind a login. Credentials:

```
NuveiDemo / Changeme123
```

They are also printed on the login screen so the demo is self-documenting.
Override them with `DEMO_USERNAME` / `DEMO_PASSWORD` (see `.env.example`).

This is **demo-grade auth**, deliberately: one shared account, no user store. The
session cookie is httpOnly and HMAC-signed so it cannot be forged in devtools,
the credential check is constant-time, and sessions expire after 8 hours — but
it is not a substitute for real authentication. `src/proxy.ts` gates every route
and verifies the signature rather than just checking the cookie exists.

Set `AUTH_SECRET` to a random value anywhere this is reachable by anyone else.

## Project layout

```
src/
  proxy.ts              route gate (Next 16's successor to middleware.ts)
  app/
    layout.tsx          brand resolution + font loading
    login/              login page, form, and session actions
    globals.css         semantic token → Tailwind mapping
    page.tsx            Overview dashboard
    <area>/page.tsx     scaffolded console areas
  components/
    brand-provider.tsx  brand context + cookie switching
    brand-mark.tsx      themed wordmark
    shell/              sidebar, topbar, brand switcher, icons
    ui/                 card, status pill, delta, pending panel
  lib/
    brand.ts            brand definitions and tokens
    nav.ts              console navigation
    demo-data.ts        deterministic sandbox data
```

## Status

**Built:** the theming system, login and session handling, app shell,
navigation, and the Overview dashboard (KPIs, provider traffic, routing rules,
recent transactions).

**Scaffolded but intentionally empty:** Transactions, Routing rules, Providers,
Risk & fraud, Disputes, Analytics, Settings. These route and theme correctly but
show a placeholder — they are waiting on the CPO specification so the flows
match the real product instead of a guess.

## Caveats

- All figures in `src/lib/demo-data.ts` are illustrative placeholders, not real
  Nuvei data. They are fixed rather than randomised so the demo renders
  identically every time.
- The Nuvei mark is the official wordmark, with the artboard and navy container
  stripped so it sits on already-themed chrome; the full lockup is kept at
  `public/brand/nuvei-logo-lockup.svg`. The Northwind Pay mark is a typographic
  stand-in for the invented demo brand.
