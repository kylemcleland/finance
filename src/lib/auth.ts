/**
 * Google sign-in for a two-person household. Only emails listed in
 * ALLOWED_EMAILS get in. A successful sign-in sets a signed cookie that names
 * the person and lasts a year; removing an email from the list signs that
 * person out on their next request, and changing AUTH_SECRET signs out everyone.
 * Nothing here touches the database.
 *
 * Web Crypto only, so the same code runs in the proxy (edge) and in route
 * handlers and server actions.
 */
export const COOKIE = "ledger_session";
/** Short-lived cookie carrying the OAuth state, PKCE verifier and nonce between the two redirects. */
export const OAUTH_COOKIE = "ledger_oauth";
/**
 * Set by the proxy on /auth/* requests. On Netlify the route handler's own
 * request URL is the deploy's internal permalink, not the address the browser
 * used; the proxy (edge) sees the real one. The proxy always overwrites it, and
 * Google only accepts registered redirect URIs anyway.
 */
export const ORIGIN_HEADER = "x-ledger-origin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;
export const OAUTH_MAX_AGE = 60 * 10;

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const enc = new TextEncoder();
const dec = new TextDecoder();

export function authConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const secret = process.env.AUTH_SECRET ?? "";
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const production = process.env.NODE_ENV === "production";
  const configured = Boolean(clientId && clientSecret && secret.length >= 32 && allowed.length > 0);
  return {
    clientId,
    clientSecret,
    secret,
    allowed,
    production,
    configured,
    /** Local development with no Google client set up: the app is open. Never in production. */
    open: !production && !clientId,
    /** Production (or a half-configured dev setup): locked until everything is set. */
    misconfigured: !configured && (production || Boolean(clientId)),
  };
}

// ---------- encoding helpers ----------

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(verifier))));
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value))));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// ---------- signed values (session and OAuth cookies) ----------

/** `<purpose>.<payload>.<signature>`; the purpose is signed too, so an OAuth cookie can never pass as a session. */
export async function sign(secret: string, purpose: string, payload: unknown): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${purpose}.${body}.${await hmac(secret, `${purpose}.${body}`)}`;
}

export async function unsign<T>(secret: string, purpose: string, value: string | undefined): Promise<T | null> {
  if (!value || !secret) return null;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== purpose) return null;
  const expected = await hmac(secret, `${purpose}.${parts[1]}`);
  if (!timingSafeEqual(parts[2], expected)) return null;
  try {
    return JSON.parse(dec.decode(fromB64url(parts[1]))) as T;
  } catch {
    return null;
  }
}

// ---------- sessions ----------

type SessionPayload = { email: string; iat: number };

export async function createSession(email: string, now = Date.now()): Promise<string> {
  return sign(authConfig().secret, "s1", { email: email.toLowerCase(), iat: Math.floor(now / 1000) } satisfies SessionPayload);
}

/** The signed-in email, or null. Re-checks the allowlist so removing someone takes effect at once. */
export async function sessionEmail(cookieValue: string | undefined, now = Date.now()): Promise<string | null> {
  const cfg = authConfig();
  if (!cfg.configured) return null;
  const s = await unsign<SessionPayload>(cfg.secret, "s1", cookieValue);
  if (!s || typeof s.email !== "string" || typeof s.iat !== "number") return null;
  if (now / 1000 - s.iat > SESSION_MAX_AGE) return null;
  return cfg.allowed.includes(s.email) ? s.email : null;
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  if (authConfig().open) return true;
  return (await sessionEmail(cookieValue)) !== null;
}

// ---------- OAuth helpers ----------

export type OAuthState = { state: string; verifier: string; nonce: string; next: string };

/**
 * Only same-site paths. Parsed the way a browser would (which strips tabs and
 * newlines, so "/\t/evil.com" would otherwise become "//evil.com").
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(next)) return "/";
  try {
    const base = "https://same.invalid";
    const u = new URL(next, base);
    return u.origin === base ? `${u.pathname}${u.search}${u.hash}` : "/";
  } catch {
    return "/";
  }
}

export type IdTokenCheck = { ok: true; email: string } | { ok: false; reason: string };

/**
 * Checks the claims of an ID token received directly from Google's token
 * endpoint over TLS in exchange for our client secret. Per OpenID Connect
 * Core 3.1.3.7 the TLS server validation stands in for checking the
 * signature; the claims still have to match.
 */
export function checkIdTokenClaims(
  claims: Record<string, unknown>,
  expected: { clientId: string; nonce: string; allowed: string[] },
  now = Date.now(),
): IdTokenCheck {
  if (!GOOGLE_ISSUERS.has(String(claims.iss))) return { ok: false, reason: "issuer" };
  const aud = claims.aud;
  if (Array.isArray(aud) ? !aud.includes(expected.clientId) : aud !== expected.clientId) return { ok: false, reason: "audience" };
  if (typeof claims.exp !== "number" || claims.exp * 1000 < now) return { ok: false, reason: "expired" };
  if (claims.nonce !== expected.nonce) return { ok: false, reason: "nonce" };
  if (claims.email_verified !== true || typeof claims.email !== "string") return { ok: false, reason: "unverified" };
  const email = claims.email.toLowerCase();
  if (!expected.allowed.includes(email)) return { ok: false, reason: "notallowed" };
  return { ok: true, email };
}

export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(dec.decode(fromB64url(parts[1]))) as Record<string, unknown>;
  } catch {
    return null;
  }
}
