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

export const env = {
  /** Postgres connection string. Netlify DB sets NETLIFY_DB_URL; anywhere else use DATABASE_URL. */
  databaseUrl: process.env.DATABASE_URL ?? process.env.NETLIFY_DB_URL ?? "",
  plaidEnv: (process.env.PLAID_ENV ?? "production") as "sandbox" | "production",
  /** Comma-separated Plaid access tokens so linked banks survive a fresh database. */
  plaidAccessTokens: process.env.PLAID_ACCESS_TOKENS ?? "",
  hasPlaid: Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET),
  hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY),
};
