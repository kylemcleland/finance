/**
 * Pull transactions for every linked Item with /transactions/sync, resuming
 * from the stored cursor. Re-runnable; applies added/modified/removed.
 *
 *   npm run plaid:sync
 */
import type { Transaction as PlaidTransaction, RemovedTransaction } from "plaid";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";
import { normalizeMerchant } from "@/lib/merchant";
import { importItemsFromEnv, saveAccount } from "@/lib/plaid-items";

async function upsertTransaction(t: PlaidTransaction, accountIdByPlaidId: Map<string, string>) {
  const accountId = accountIdByPlaidId.get(t.account_id);
  if (!accountId) throw new Error(`Unknown account ${t.account_id}; run plaid:link again`);
  const rawName = t.merchant_name || t.name;
  const data = {
    source: "plaid",
    date: new Date(`${t.authorized_date ?? t.date}T00:00:00Z`),
    amount: t.amount, // Plaid: positive = money out
    merchant: normalizeMerchant(rawName),
    rawName: t.name,
    plaidCategoryPrimary: t.personal_finance_category?.primary ?? null,
    plaidCategoryDetailed: t.personal_finance_category?.detailed ?? null,
    pending: t.pending,
    cardholderHint: t.account_owner ?? null,
    accountId,
  };
  // A pending transaction later posts under a new id; drop the pending copy.
  if (t.pending_transaction_id) {
    await prisma.transaction.deleteMany({ where: { externalId: t.pending_transaction_id } });
  }
  await prisma.transaction.upsert({
    where: { externalId: t.transaction_id },
    update: data,
    create: { externalId: t.transaction_id, ...data },
  });
}

async function main() {
  const plaid = plaidClient();
  await importItemsFromEnv();
  const items = await prisma.plaidItem.findMany();
  if (items.length === 0) {
    console.log("No linked banks. Run: npm run plaid:link");
    return;
  }
  for (const item of items) {
    let cursor = item.cursor ?? undefined;
    let added = 0, modified = 0, removed = 0;
    for (;;) {
      const res = await plaid.transactionsSync({ access_token: item.accessToken, cursor, count: 500 });
      const d = res.data;

      // Make sure every account in the response exists locally.
      for (const a of d.accounts) await saveAccount(a, item.id);
      const accounts = await prisma.account.findMany({ where: { itemId: item.id } });
      const byPlaidId = new Map(accounts.map((a) => [a.plaidAccountId!, a.id]));

      for (const t of d.added) { await upsertTransaction(t, byPlaidId); added++; }
      for (const t of d.modified) { await upsertTransaction(t, byPlaidId); modified++; }
      for (const r of d.removed as RemovedTransaction[]) {
        await prisma.transaction.deleteMany({ where: { externalId: r.transaction_id } });
        removed++;
      }
      cursor = d.next_cursor;
      await prisma.plaidItem.update({ where: { id: item.id }, data: { cursor, lastSyncedAt: new Date() } });
      if (!d.has_more) break;
    }
    console.log(`${item.institution ?? item.itemId}: +${added} ~${modified} -${removed}`);
  }
  console.log("Next: npm run classify");
}

main()
  .catch((e) => {
    console.error(e?.response?.data ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
