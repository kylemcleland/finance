/**
 * One shared household password, one long-lived signed cookie. There are two
 * users and nothing to attribute, so there are no accounts.
 * Web Crypto only, so the same code runs in the proxy and in server actions.
 */
export const COOKIE = "ledger_session";
const SESSION_VALUE = "household-v1";

const enc = new TextEncoder();

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function authConfig() {
  const password = process.env.APP_PASSWORD ?? "";
  const secret = process.env.AUTH_SECRET || password;
  const production = process.env.NODE_ENV === "production";
  return { password, secret, production, open: !password && !production, misconfigured: !password && production };
}

export async function sessionToken(): Promise<string> {
  return hmac(authConfig().secret, SESSION_VALUE);
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  const cfg = authConfig();
  if (cfg.open) return true;
  if (!cookieValue || !cfg.secret) return false;
  return timingSafeEqual(cookieValue, await sessionToken());
}

export async function checkPassword(attempt: string): Promise<boolean> {
  const cfg = authConfig();
  if (!cfg.password) return false;
  // Compare digests so length differences leak nothing.
  const [a, b] = await Promise.all([hmac(cfg.secret, attempt), hmac(cfg.secret, cfg.password)]);
  return timingSafeEqual(a, b);
}
