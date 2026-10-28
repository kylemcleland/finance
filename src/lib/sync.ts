/**
 * Library form of the sync + classify pipeline, shared by the CLI scripts and
 * the scheduled Netlify function.
 */
import type { Transaction as PlaidTransaction, RemovedTransaction } from "plaid";
import { prisma } from "./db";
import { plaidClient } from "./plaid";
import { normalizeMerchant } from "./merchant";
import { importItemsFromEnv, saveAccount } from "./plaid-items";
import { classify } from "./classify";
import { defaultClassifier, type Cardholder, type ClaudeClassifier } from "./claude";
import { PEOPLE } from "@/config/household";

export type SyncReport = { items: number; added: number; modified: number; removed: number };

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

/** Pull new, changed and removed transactions for every linked bank. */
export async function syncPlaid(log: (s: string) => void = () => {}): Promise<SyncReport> {
  const plaid = plaidClient();
  await importItemsFromEnv();
  const items = await prisma.plaidItem.findMany();
  const report: SyncReport = { items: items.length, added: 0, modified: 0, removed: 0 };
  for (const item of items) {
    let cursor = item.cursor ?? undefined;
    for (;;) {
      const res = await plaid.transactionsSync({ access_token: item.accessToken, cursor, count: 500 });
      const d = res.data;
      for (const a of d.accounts) await saveAccount(a, item.id);
      const accounts = await prisma.account.findMany({ where: { itemId: item.id } });
      const byPlaidId = new Map(accounts.map((a) => [a.plaidAccountId!, a.id]));

      for (const t of d.added) { await upsertTransaction(t, byPlaidId); report.added++; }
      for (const t of d.modified) { await upsertTransaction(t, byPlaidId); report.modified++; }
      for (const r of d.removed as RemovedTransaction[]) {
        await prisma.transaction.deleteMany({ where: { externalId: r.transaction_id } });
        report.removed++;
      }
      cursor = d.next_cursor;
      await prisma.plaidItem.update({ where: { id: item.id }, data: { cursor, lastSyncedAt: new Date() } });
      if (!d.has_more) break;
    }
    log(`${item.institution ?? item.itemId}: synced`);
  }
  return report;
}

/** Account cardholder first; else Plaid's account_owner text if it names one of us. */
export function cardholderOf(account: { cardholder: string | null }, hint: string | null): Cardholder {
  if (account.cardholder === "me" || account.cardholder === "her") return account.cardholder;
  const h = (hint ?? "").toLowerCase();
  if (!h) return null;
  if (h.includes(PEOPLE.me.toLowerCase())) return "me";
  if (h.includes(PEOPLE.her.toLowerCase())) return "her";
  return null;
}

/** Run the three-layer classifier. By default only rows never classified; `all` redoes everything but manual decisions. */
export async function classifyPending(opts: { all?: boolean; claude?: ClaudeClassifier } = {}): Promise<Record<string, number>> {
  const rules = await prisma.merchantRule.findMany();
  const cache = new Map((await prisma.merchantCache.findMany()).map((c) => [c.merchant, c]));
  const claude = opts.claude ?? defaultClassifier();
  const txs = await prisma.transaction.findMany({
    where: opts.all ? { NOT: { classificationSource: "manual" } } : { classificationSource: null },
    include: { account: true },
    orderBy: { date: "asc" },
  });
  const counts: Record<string, number> = {};
  for (const t of txs) {
    const input = {
      merchant: t.merchant, rawName: t.rawName, amount: t.amount,
      plaidCategoryPrimary: t.plaidCategoryPrimary, plaidCategoryDetailed: t.plaidCategoryDetailed,
      account: t.account.name,
      cardholder: cardholderOf(t.account, t.cardholderHint),
      date: t.date.toISOString().slice(0, 10),
    };
    const { result, fromClaude } = await classify(input, rules, cache.get(t.merchant), claude);
    if (fromClaude) {
      const saved = await prisma.merchantCache.upsert({
        where: { merchant: t.merchant },
        update: fromClaude,
        create: { merchant: t.merchant, ...fromClaude },
      });
      cache.set(t.merchant, saved);
    }
    await prisma.transaction.update({
      where: { id: t.id },
      data: {
        category: result.category, shareMe: result.shareMe, classificationSource: result.source,
        needsReview: result.needsReview, note: result.note ?? null, classifiedAt: new Date(),
      },
    });
    counts[result.source] = (counts[result.source] ?? 0) + 1;
  }
  return counts;
}
