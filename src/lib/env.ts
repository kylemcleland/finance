import "dotenv/config";

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing ${name}. Set it in the cloud environment secrets or in .env (see .env.example).`,
    );
  }
  return v;
}

/** Netlify's runtime environment (functions), where Netlify Database puts its connection string. */
function netlifyEnv(name: string): string | undefined {
  try {
    return (globalThis as { Netlify?: { env?: { get(k: string): string | undefined } } }).Netlify?.env?.get(name);
  } catch {
    return undefined;
  }
}

export const env = {
  /**
   * Postgres connection string. DATABASE_URL wins when set (local, or any
   * other host). On Netlify, read NETLIFY_DB_URL the way @netlify/database
   * does (Netlify.env first), then process.env.
   */
  get databaseUrl(): string {
    return process.env.DATABASE_URL || netlifyEnv("NETLIFY_DB_URL") || process.env.NETLIFY_DB_URL || "";
  },
  /** Which sources were present, for error messages. Never the values. */
  databaseUrlSources(): string {
    const netlify = (globalThis as { Netlify?: unknown }).Netlify !== undefined;
    return [
      `DATABASE_URL ${process.env.DATABASE_URL ? "set" : "unset"}`,
      `Netlify runtime ${netlify ? "present" : "absent"}`,
      `Netlify.env NETLIFY_DB_URL ${netlifyEnv("NETLIFY_DB_URL") ? "set" : "unset"}`,
      `process.env NETLIFY_DB_URL ${process.env.NETLIFY_DB_URL ? "set" : "unset"}`,
    ].join(", ");
  },
  plaidEnv: (process.env.PLAID_ENV ?? "production") as "sandbox" | "production",
  /** Comma-separated Plaid access tokens so linked banks survive a fresh database. */
  plaidAccessTokens: process.env.PLAID_ACCESS_TOKENS ?? "",
  /** PLAID_SECRET, or PLAID_CLIENT_SECRET as some dashboards label it. */
  plaidSecret: process.env.PLAID_SECRET || process.env.PLAID_CLIENT_SECRET || "",
  hasPlaid: Boolean(process.env.PLAID_CLIENT_ID && (process.env.PLAID_SECRET || process.env.PLAID_CLIENT_SECRET)),
  hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY),
};
