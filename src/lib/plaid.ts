import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { env, requireEnv } from "./env";

let client: PlaidApi | undefined;

export function plaidClient(): PlaidApi {
  if (client) return client;
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env.plaidEnv],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": requireEnv("PLAID_CLIENT_ID"),
        "PLAID-SECRET": requireEnv("PLAID_SECRET"),
      },
    },
  });
  client = new PlaidApi(configuration);
  return client;
}
