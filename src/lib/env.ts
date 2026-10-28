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
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  plaidEnv: (process.env.PLAID_ENV ?? "sandbox") as "sandbox" | "production",
  hasPlaid: Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET),
  hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY),
};
