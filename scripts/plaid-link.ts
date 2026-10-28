/**
 * Link a bank. Two modes:
 *
 * Production (default, works from a phone, no server needed) via Plaid Hosted Link:
 *   npm run plaid:link -- --owner shared      # prints a plaid.com URL; open it, log into the bank
 *   npm run plaid:link -- --finish            # afterwards: exchanges the result and stores the Item
 *
 * Sandbox shortcut (PLAID_ENV=sandbox only, fake bank, no browser):
 *   npm run plaid:link -- --sandbox [--institution ins_109508] [--owner shared]
 *
 * --owner says whose money the linked accounts hold: me | her | shared.
 */
import { CountryCode, Products } from "plaid";
import { parseArgs } from "@/lib/args";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { plaidClient } from "@/lib/plaid";
import { saveItem } from "@/lib/plaid-items";

const OWNERS = ["me", "her", "shared"];

async function startHostedLink(owner: string) {
  const plaid = plaidClient();
  const res = await plaid.linkTokenCreate({
    client_name: "Shared Expenses",
    language: "en",
    country_codes: [CountryCode.Us],
    user: { client_user_id: `household-${owner}` },
    products: [Products.Transactions],
    transactions: { days_requested: 730 },
    hosted_link: { url_lifetime_seconds: 60 * 60 * 24, is_mobile_app: false },
  });
  const { link_token, hosted_link_url, expiration } = res.data;
  if (!hosted_link_url) throw new Error("Plaid did not return a hosted_link_url");
  await prisma.plaidLinkSession.create({
    data: { linkToken: link_token, url: hosted_link_url, owner, expiresAt: new Date(expiration) },
  });
  console.log(`Open this on your phone and log into the bank (valid 24h, owner=${owner}):\n\n  ${hosted_link_url}\n`);
  console.log("When Plaid says you're done, run: npm run plaid:link -- --finish");
}

async function finishHostedLinks() {
  const plaid = plaidClient();
  const pending = await prisma.plaidLinkSession.findMany();
  if (pending.length === 0) {
    console.log("No pending link sessions. Start one with: npm run plaid:link -- --owner shared");
    return;
  }
  const tokensForEnv: string[] = (await prisma.plaidItem.findMany()).map((i) => i.accessToken);
  for (const s of pending) {
    const got = await plaid.linkTokenGet({ link_token: s.linkToken });
    const result = (got.data.link_sessions ?? [])
      .flatMap((ls) => ls.results?.item_add_results ?? [])
      .at(-1);
    if (!result) {
      const expired = s.expiresAt < new Date();
      console.log(`${expired ? "Expired" : "Not finished yet"}: ${s.url}`);
      if (expired) await prisma.plaidLinkSession.delete({ where: { linkToken: s.linkToken } });
      continue;
    }
    const exchanged = await plaid.itemPublicTokenExchange({ public_token: result.public_token });
    const { item, accounts } = await saveItem({
      accessToken: exchanged.data.access_token,
      itemId: exchanged.data.item_id,
      owner: s.owner,
      institutionId: result.institution?.institution_id,
      institution: result.institution?.name,
    });
    await prisma.plaidLinkSession.delete({ where: { linkToken: s.linkToken } });
    console.log(`Linked ${item.institution ?? item.itemId}: ${accounts.map((a) => `${a.name} ****${a.mask ?? ""}`).join(", ")} (owner=${s.owner})`);
    tokensForEnv.push(`${exchanged.data.access_token}@${s.owner}`);
  }
  if (tokensForEnv.length) {
    console.log("\nSave this as the PLAID_ACCESS_TOKENS environment secret so a fresh database can re-attach these banks:");
    const owners = new Map((await prisma.plaidItem.findMany({ include: { accounts: true } })).map((i) => [i.accessToken, i.accounts[0]?.owner ?? "shared"]));
    console.log("\n  " + [...owners.entries()].map(([t, o]) => `${t}@${o}`).join(",") + "\n");
    console.log("Next: npm run plaid:sync");
  }
}

async function sandboxLink(institutionId: string, owner: string) {
  if (env.plaidEnv !== "sandbox") throw new Error("--sandbox needs PLAID_ENV=sandbox and the sandbox secret");
  const plaid = plaidClient();
  const pub = await plaid.sandboxPublicTokenCreate({ institution_id: institutionId, initial_products: [Products.Transactions] });
  const exchanged = await plaid.itemPublicTokenExchange({ public_token: pub.data.public_token });
  const { item, accounts } = await saveItem({ accessToken: exchanged.data.access_token, itemId: exchanged.data.item_id, institutionId, owner });
  console.log(`Linked sandbox ${item.institution ?? institutionId} with ${accounts.length} accounts, owner=${owner}.`);
  console.log("Next: npm run plaid:sync");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const owner = String(args.owner ?? "shared");
  if (!OWNERS.includes(owner)) throw new Error(`--owner must be one of ${OWNERS.join(", ")}`);
  if (args.finish) return finishHostedLinks();
  if (args.sandbox) return sandboxLink(String(args.institution ?? "ins_109508"), owner);
  return startHostedLink(owner);
}

main()
  .catch((e) => { console.error(e?.response?.data ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
