/**
 * Link a Plaid *sandbox* Item without a browser: creates a sandbox public
 * token for a test institution, exchanges it, and stores the Item and its
 * accounts. Real banks need Plaid Link in the browser (a later step).
 *
 *   npm run plaid:link -- [--institution ins_109508] [--owner shared|me|her]
 */
import { CountryCode, Products } from "plaid";
import { parseArgs } from "@/lib/args";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";
import { env } from "@/lib/env";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const institutionId = String(args.institution ?? "ins_109508"); // First Platypus Bank
  const owner = String(args.owner ?? "shared");
  if (env.plaidEnv !== "sandbox") {
    throw new Error("plaid:link only works against the sandbox. Real banks need Plaid Link in the browser.");
  }
  const plaid = plaidClient();

  const pub = await plaid.sandboxPublicTokenCreate({
    institution_id: institutionId,
    initial_products: [Products.Transactions],
  });
  const exchanged = await plaid.itemPublicTokenExchange({ public_token: pub.data.public_token });
  const { access_token, item_id } = exchanged.data;

  let institution: string | undefined;
  try {
    const inst = await plaid.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    });
    institution = inst.data.institution.name;
  } catch {
    /* name is cosmetic */
  }

  const item = await prisma.plaidItem.upsert({
    where: { itemId: item_id },
    update: { accessToken: access_token, institutionId, institution },
    create: { itemId: item_id, accessToken: access_token, institutionId, institution },
  });

  const accounts = await plaid.accountsGet({ access_token });
  for (const a of accounts.data.accounts) {
    await prisma.account.upsert({
      where: { plaidAccountId: a.account_id },
      update: { name: a.name, mask: a.mask, type: a.type, itemId: item.id },
      create: { plaidAccountId: a.account_id, name: a.name, mask: a.mask, type: a.type, owner, itemId: item.id },
    });
  }
  console.log(`Linked ${institution ?? institutionId} (${item_id}) with ${accounts.data.accounts.length} accounts, owner=${owner}.`);
  console.log("Next: npm run plaid:sync");
}

main()
  .catch((e) => {
    console.error(e?.response?.data ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
