import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authConfig, checkIdTokenClaims, createSession, decodeJwtPayload, isValidSession, pkceChallenge, safeNext, sessionEmail, sign, unsign,
} from "./auth";

const SECRET = "x".repeat(40);
const KYLE = "kyle@example.com";
const JACKIE = "jackie@example.com";

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
}

beforeEach(() => {
  setEnv({
    NODE_ENV: "production",
    GOOGLE_CLIENT_ID: "client-123",
    GOOGLE_CLIENT_SECRET: "shh",
    AUTH_SECRET: SECRET,
    ALLOWED_EMAILS: ` ${KYLE}, Jackie@Example.com `,
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("authConfig", () => {
  it("normalizes the allowlist", () => {
    expect(authConfig().allowed).toEqual([KYLE, JACKIE]);
    expect(authConfig().configured).toBe(true);
  });
  it("locks production when anything is missing", () => {
    vi.stubEnv("ALLOWED_EMAILS", "");
    expect(authConfig()).toMatchObject({ configured: false, misconfigured: true, open: false });
  });
  it("rejects a short AUTH_SECRET", () => {
    vi.stubEnv("AUTH_SECRET", "short");
    expect(authConfig().configured).toBe(false);
  });
  it("is open only in development with no Google client", () => {
    setEnv({ NODE_ENV: "development", GOOGLE_CLIENT_ID: "" });
    expect(authConfig().open).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(authConfig().open).toBe(false);
  });
});

describe("sessions", () => {
  it("round-trips an allowed email", async () => {
    const token = await createSession(KYLE);
    expect(await sessionEmail(token)).toBe(KYLE);
    expect(await isValidSession(token)).toBe(true);
  });
  it("signs a person out once they leave the allowlist", async () => {
    const token = await createSession(JACKIE);
    vi.stubEnv("ALLOWED_EMAILS", KYLE);
    expect(await sessionEmail(token)).toBeNull();
  });
  it("rejects tampering, other secrets, and expiry", async () => {
    const token = await createSession(KYLE);
    const [p, body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ email: JACKIE, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
    expect(await sessionEmail(`${p}.${forged}.${sig}`)).toBeNull();
    expect(await sessionEmail(`${p}.${body}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`)).toBeNull();
    vi.stubEnv("AUTH_SECRET", "y".repeat(40));
    expect(await sessionEmail(token)).toBeNull();
    vi.stubEnv("AUTH_SECRET", SECRET);
    const old = await createSession(KYLE, Date.now() - 400 * 24 * 3600 * 1000);
    expect(await sessionEmail(old)).toBeNull();
    expect(await isValidSession(undefined)).toBe(false);
  });
  it("never accepts the OAuth cookie as a session", async () => {
    const oauth = await sign(SECRET, "o1", { email: KYLE, iat: Math.floor(Date.now() / 1000) });
    expect(await sessionEmail(oauth)).toBeNull();
    expect(await unsign(SECRET, "o1", oauth)).toMatchObject({ email: KYLE });
  });
});

describe("checkIdTokenClaims", () => {
  const expected = { clientId: "client-123", nonce: "n1", allowed: [KYLE, JACKIE] };
  const good = { iss: "https://accounts.google.com", aud: "client-123", exp: Date.now() / 1000 + 600, nonce: "n1", email: "Kyle@Example.com", email_verified: true };

  it("accepts a valid token and lowercases the email", () => {
    expect(checkIdTokenClaims(good, expected)).toEqual({ ok: true, email: KYLE });
  });
  it.each([
    ["issuer", { iss: "https://evil.example" }],
    ["audience", { aud: "someone-else" }],
    ["expired", { exp: Date.now() / 1000 - 1 }],
    ["nonce", { nonce: "other" }],
    ["unverified", { email_verified: false }],
    ["notallowed", { email: "stranger@example.com" }],
  ])("rejects %s", (reason, patch) => {
    expect(checkIdTokenClaims({ ...good, ...patch }, expected)).toEqual({ ok: false, reason });
  });
});

describe("helpers", () => {
  it("keeps redirects on this site", () => {
    expect(safeNext("/review")).toBe("/review");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/%09/x\u0000", undefined, 3]) expect(safeNext(bad)).toBe("/");
    expect(safeNext("/transactions?category=Dining&month=2026-10")).toBe("/transactions?category=Dining&month=2026-10");
    expect(new URL(safeNext("/%09/evil.com"), "https://site.example").origin).toBe("https://site.example");
  });
  it("computes the RFC 7636 PKCE example", async () => {
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  it("decodes a JWT payload", () => {
    const jwt = `e30.${Buffer.from(JSON.stringify({ a: 1 })).toString("base64url")}.sig`;
    expect(decodeJwtPayload(jwt)).toEqual({ a: 1 });
    expect(decodeJwtPayload("nope")).toBeNull();
  });
});
