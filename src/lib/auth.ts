/**
 * Demo-grade authentication.
 *
 * This is a sales demo, not a production system: there is a single shared
 * account and no user store. The session cookie is HMAC-signed so it cannot be
 * hand-forged in devtools, and the credential check is timing-safe, but that is
 * the extent of it — do not carry this file into a real product.
 *
 * Signing uses Web Crypto rather than `node:crypto` so the identical code runs
 * both in `proxy.ts` and in server components.
 */

const DEMO_USERNAME = process.env.DEMO_USERNAME ?? "NuveiDemo";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Changeme123";
const AUTH_SECRET =
  process.env.AUTH_SECRET ?? "cpo-demo-development-secret-not-for-production";

export const SESSION_COOKIE = "cpo_session";
/** Sessions last a working day — long enough to demo, short enough to expire. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

/** Constant-time string comparison, so a wrong password leaks no length or
 *  prefix information through response timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyCredentials(username: string, password: string): boolean {
  // Both comparisons always run, so the timing does not reveal which failed.
  const userOk = safeEqual(username, DEMO_USERNAME);
  const passOk = safeEqual(password, DEMO_PASSWORD);
  return userOk && passOk;
}

export async function createSessionValue(username: string): Promise<string> {
  const issued = Date.now().toString();
  const payload = `${username}.${issued}`;
  return `${payload}.${await sign(payload)}`;
}

/** Returns the username if the cookie is authentic and unexpired, else null. */
export async function readSession(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [username, issued, signature] = parts;

  const expected = await sign(`${username}.${issued}`);
  if (!safeEqual(signature, expected)) return null;

  const age = (Date.now() - Number(issued)) / 1000;
  if (!Number.isFinite(age) || age < 0 || age > SESSION_MAX_AGE_SECONDS) return null;

  return username;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
  secure: process.env.NODE_ENV === "production",
} as const;

/** Shown on the login screen so the demo is self-documenting. */
export const demoHint = { username: DEMO_USERNAME, password: DEMO_PASSWORD };
