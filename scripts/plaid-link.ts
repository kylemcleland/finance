/**
 * Link a bank. Two modes:
 *
 * Production (default, works from a phone, no server needed) via Plaid Hosted Link:
 *   npm run plaid:link              # prints a plaid.com URL; open it, log into the bank
 *   npm run plaid:link -- --finish  # afterwards: exchanges the result and stores the Item
 *
 * Sandbox shortcut (PLAID_ENV=sandbox only, fake bank, no browser):
 *   npm run plaid:link -- --sandbox [--institution ins_109508]
 */
import { Products } from "plaid";
import { parseArgs } from "@/lib/args";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { plaidClient } from "@/lib/plaid";
import { saveItem } from "@/lib/plaid-items";
import { finishHostedLinks, startHostedLink } from "@/lib/plaid-link";

async function start() {
  const url = await startHostedLink();
  console.log(`Open this on your phone and log into the bank (valid 24h):\n\n  ${url}\n`);
  console.log("When Plaid says you're done, run: npm run plaid:link -- --finish");
}

async function finish() {
  const { linked, waiting, expired } = await finishHostedLinks();
  for (const l of linked) console.log(`Linked ${l.institution}: ${l.accounts.join(", ")}`);
  if (waiting) console.log(`${waiting} link session(s) not finished yet.`);
  if (expired) console.log(`${expired} expired link session(s) removed.`);
  if (!linked.length && !waiting) console.log("Nothing to finish. Start one with: npm run plaid:link");
  if (linked.length) {
    const tokens = (await prisma.plaidItem.findMany()).map((i) => i.accessToken);
    console.log("\nSave this as the PLAID_ACCESS_TOKENS environment secret so a fresh database can re-attach these banks:");
    console.log("\n  " + tokens.join(",") + "\n");
    console.log("Next: npm run plaid:sync");
  }
}

async function sandboxLink(institutionId: string) {
  if (env.plaidEnv !== "sandbox") throw new Error("--sandbox needs PLAID_ENV=sandbox and the sandbox secret");
  const plaid = plaidClient();
  const pub = await plaid.sandboxPublicTokenCreate({ institution_id: institutionId, initial_products: [Products.Transactions] });
  const exchanged = await plaid.itemPublicTokenExchange({ public_token: pub.data.public_token });
  const { item, accounts } = await saveItem({ accessToken: exchanged.data.access_token, itemId: exchanged.data.item_id, institutionId });
  console.log(`Linked sandbox ${item.institution ?? institutionId} with ${accounts.length} accounts.`);
  console.log("Next: npm run plaid:sync");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.finish) return finish();
  if (args.sandbox) return sandboxLink(String(args.institution ?? "ins_109508"));
  return start();
}

main()
  .catch((e) => { console.error(e?.response?.data ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
