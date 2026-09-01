/**
 * Safe localStorage access.
 *
 * Reading localStorage directly throws in more places than people expect —
 * Safari private mode with storage blocked, embedded webviews, and any
 * non-browser render. Preferences are a nicety, so a failure here must never
 * take a screen down with it.
 */

export function readPref(key, fallback = null) {
  try {
    const value = globalThis.localStorage?.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key, value) {
  try {
    globalThis.localStorage?.setItem(key, String(value));
  } catch {
    /* storage unavailable — the preference simply does not persist */
  }
}
