/**
 * Feature flags.
 *
 * `brandSwitcher` exposes the Chameleon brand picker in the console chrome. It
 * is off in the demo — clients should see one brand, theirs — but the theming
 * engine underneath stays fully wired, so turning this on is the only step
 * needed to demo a live re-skin.
 *
 * Enable with NEXT_PUBLIC_BRAND_SWITCHER=on
 */
export const features = {
  brandSwitcher: process.env.NEXT_PUBLIC_BRAND_SWITCHER === "on",
} as const;
