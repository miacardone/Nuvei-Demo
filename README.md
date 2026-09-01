# Nuvei Dispute Console

A white-label dispute case-management console, tenanted to Nuvei — the Dispute
Lab product with Nuvei's brand, vocabulary and portfolio.

**Stack:** Vite · React 18 · React Router 6 — matching the other Dispute Lab
builds, so fixes can move between them.

```bash
npm install
npm run dev
```

## Signing in

```
NuveiDemo / <VITE_DEMO_PASSWORD>
```

Set `VITE_DEMO_PASSWORD` in `.env.local` (copy `.env.example`). Sign-in is
refused outright when it is unset, so an unconfigured build cannot be walked
into with an empty field.

> **This gate is not security.** The console is a static SPA with no server, so
> these values are compiled into the JavaScript bundle and are readable by
> anyone who opens devtools on the deployed site. Keeping them in the
> environment stops them being committed to a public repository — it does not
> make them secret. Never put a real credential here. If the demo ever needs
> genuine access control, it needs a server-side check, which this architecture
> does not currently have.

## Where this came from

Assembled from three existing Dispute Lab builds, which are **read-only source
material and were not modified**:

| Build | Contributed |
| --- | --- |
| **Expedia** | The base. Three perspectives (merchant / acquirer / issuer) over one case book, pages organised per perspective, acquirer portfolio, issuer screens. |
| **Vinted** (newest) | Evidence, dispute packet, redaction studio, dispute editor, doc raster/markup, pre-dispute alerts, rules store, operational alert digest. |
| **Nutrameg** | The network early-warning alert suite: case work, settings, permissions, reporting, assignments, validations. |

Where a file existed in more than one build, the more evolved version was taken.
Stylesheets were merged at selector level so components from any build keep
their styling.

### The two "Alerts" are different products

They share a word and nothing else, so they are wired as siblings rather than
merged:

- **Priority alerts** — a digest derived from our own case book
  (`domain/alerts.js`): *what should I look at first.*
- **Alert case work** and its admin pages — the network early-warning product,
  Verifi CDRN / Visa RDR / Ethoca (`data/alerts.js`): *refund before a
  chargeback is ever filed.*

## Indemnification

Nuvei takes on liability for a merchant's chargebacks in exchange for a charge.
This is a **service-level term set per merchant**, so it lives on the acquirer's
merchant record — Acquirer → Portfolio → Merchants → open a merchant:

- a tick box to indemnify the merchant,
- a charge basis: **set fee** per dispute, or **basis points** of processed
  volume,
- the rate, and **Apply**.

The portfolio table carries an Indemnification column and an *Indemnified* KPI
showing how much exposure we carry.

Two things are deliberate:

- **The form edits a draft and commits on Apply.** Nothing writes as you type: a
  rate is a real commercial term, and a control taking effect mid-keystroke
  would put `4` bps briefly live on the way to `45`. Apply stays disabled until
  the draft differs from what is stored, so it never confirms a change it did
  not make.
- **The projected annual charge is shown.** The two bases price the same
  merchant an order of magnitude apart — a fee scales with dispute count, basis
  points scale with turnover. Without the figure, choosing between them is a
  guess.

Settings sit with the acquirer rather than in the merchant's own settings: the
merchant does not get to switch its own liability off. They are seeded from risk
tier, so the screen shows both states and shows the same ones at every demo, and
they persist to `localStorage` so a change made mid-demo survives a reload.

## White-labelling

`src/brand/brand.config.js` is the control file: palette, wordmark paths,
currency, locale, vocabulary, reason codes, entities, queues, thresholds,
feature flags.

**The rule:** no component hard-codes a colour, a brand name, or any
tenant-specific value. Colours reach the DOM as CSS custom properties written by
`BrandProvider`; nouns reach JSX through `brand.terms`; the logo reaches the DOM
as a *path*, never an import.

Anything keyed by tenant data — maps, weight tables, seed lists — must be
derived **positionally** from the tenant's own lists, never named literally.
`data/alerts.js` shows this: statement descriptors are built from
`brand.entities` by position, because a table keyed on one tenant's entity ids
silently produces entity-less rows the moment another tenant is generated.

### Nuvei brand tokens

From the `--_2026-color---swatches--*` custom properties published on nuvei.com,
so the skin matches the live brand rather than approximating it:

| Token | Value |
| --- | --- |
| Core navy | `#160850` |
| Signal blue | `#0C98D4` |
| Warm white | `#FAF9F8` |
| Sand grey | `#F1EFED` |
| Support grey | `#CFC9C2` |

The wordmark is the supplied asset with the artboard and container stripped, in
navy (`/tenant-nuvei-navy.svg`) and white (`/tenant-nuvei-white.svg`); the dot
over the "i" keeps the mark's own blue in both.

### Nuvei is the processor

The tenant is an acquirer, not a merchant. That has two consequences worth
knowing before editing the data:

- The **acquirer seat is Nuvei itself**. `ACQUIRER_NAME` is `brand.name`, not an
  entry from `brand.acquirers` — that list is the *other* processors a merchant
  might use, and reading it produced "Every merchant Chase processes for, Nuvei
  included", naming a competitor as the operator of this console.
- The **flagship merchant is a customer**, `brand.flagshipMerchant`, not the
  tenant. Nuvei does not appear in its own merchant portfolio.

## Project layout

```
src/
  brand/          brand.config.js (the control file), BrandProvider, Wordmark
  data/           case book, portfolio, alerts, indemnification, navigation
  domain/         case types, statuses, metrics, criteria, evidence, alerts
  pages/
    merchant/     dashboard, alerts, rules, case admin, reports, settings
    acquirer/     portfolio, onboarding, underwriting, representment, risk
    issuer/       cardholders, authorizations, fraud, statements
    shared/       work case, disputes, users, reporting, templates
  components/
    portfolio/    IndemnificationPanel
    ui/           DataTable, Form, Surface, Modal, Overlay, Icon
    workcase/     dispute editor, redaction studio, packet preview, doc viewer
  styles/         tokens.css, base.css, components.css
```

## Deploying

Set `VITE_DEMO_USERNAME` and `VITE_DEMO_PASSWORD` on the host and redeploy —
Vite inlines `VITE_*` at **build** time, so changing them requires a rebuild,
not just a restart.
