import type { AccountBase } from "plaid";
import { prisma } from "./db";
import { env } from "./env";
import { plaidClient } from "./plaid";

/** Store an Item and its accounts. Idempotent. */
export async function saveItem(opts: {
  accessToken: string;
  itemId?: string;
  institutionId?: string | null;
  institution?: string | null;
}) {
  const plaid = plaidClient();
  let { itemId, institutionId, institution } = opts;
  if (!itemId || !institution) {
    const got = await plaid.itemGet({ access_token: opts.accessToken });
    itemId = got.data.item.item_id;
    institutionId ??= got.data.item.institution_id ?? null;
    institution ??= got.data.item.institution_name ?? null;
  }
  const item = await prisma.plaidItem.upsert({
    where: { itemId },
    update: { accessToken: opts.accessToken, institutionId, institution },
    create: { itemId, accessToken: opts.accessToken, institutionId, institution },
  });
  const accounts = await plaid.accountsGet({ access_token: opts.accessToken });
  for (const a of accounts.data.accounts) await saveAccount(a, item.id);
  return { item, accounts: accounts.data.accounts };
}

export async function saveAccount(a: AccountBase, itemId: string) {
  return prisma.account.upsert({
    where: { plaidAccountId: a.account_id },
    update: { name: a.name, mask: a.mask, type: a.type, itemId },
    create: { plaidAccountId: a.account_id, name: a.name, mask: a.mask, type: a.type, itemId },
  });
}

/**
 * Re-attach banks listed in PLAID_ACCESS_TOKENS (comma-separated access tokens).
 * Lets a fresh database (new cloud session) sync without re-linking.
 */
export async function importItemsFromEnv(): Promise<number> {
  const entries = env.plaidAccessTokens.split(",").map((s) => s.trim()).filter(Boolean);
  let added = 0;
  for (const entry of entries) {
    const accessToken = entry.split("@")[0]; // tolerate the older "token@owner" form
    const exists = await prisma.plaidItem.findFirst({ where: { accessToken } });
    if (exists) continue;
    const { item } = await saveItem({ accessToken });
    console.log(`Attached ${item.institution ?? item.itemId} from PLAID_ACCESS_TOKENS`);
    added++;
  }
  return added;
}
