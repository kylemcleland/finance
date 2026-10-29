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

export type SyncReport = {
  items: number; added: number; modified: number; removed: number;
  /** False when the time budget ran out with more pages waiting; the next run continues from the saved cursor. */
  complete: boolean;
};

function transactionData(t: PlaidTransaction, accountIdByPlaidId: Map<string, string>) {
  const accountId = accountIdByPlaidId.get(t.account_id);
  if (!accountId) throw new Error(`Unknown account ${t.account_id}; run plaid:link again`);
  const rawName = t.merchant_name || t.name;
  return {
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
}

/**
 * Store one page from /transactions/sync. New rows go in with one bulk insert
 * (a first sync is thousands of rows, and one query per row would outrun the
 * function time limit); changed rows are few and updated one by one.
 */
async function savePage(
  page: { added: PlaidTransaction[]; modified: PlaidTransaction[]; removed: RemovedTransaction[] },
  byPlaidId: Map<string, string>,
) {
  // A pending transaction later posts under a new id; drop the pending copy.
  const replacedPending = [...page.added, ...page.modified].map((t) => t.pending_transaction_id).filter((id): id is string => Boolean(id));
  const removed = page.removed.map((r) => r.transaction_id);
  if (replacedPending.length || removed.length) {
    await prisma.transaction.deleteMany({ where: { externalId: { in: [...replacedPending, ...removed] } } });
  }
  if (page.added.length) {
    await prisma.transaction.createMany({
      data: page.added.map((t) => ({ externalId: t.transaction_id, ...transactionData(t, byPlaidId) })),
      skipDuplicates: true,
    });
  }
  for (const t of page.modified) {
    const data = transactionData(t, byPlaidId);
    await prisma.transaction.upsert({ where: { externalId: t.transaction_id }, update: data, create: { externalId: t.transaction_id, ...data } });
  }
}

type SyncClient = Pick<ReturnType<typeof plaidClient>, "transactionsSync">;

/**
 * Pull new, changed and removed transactions for every linked bank. With a
 * `deadline` (epoch ms) no new page is fetched after it; the cursor is saved
 * after every page, so the next run picks up where this one stopped.
 */
export async function syncPlaid(
  log: (s: string) => void = () => {},
  opts: { deadline?: number; plaid?: SyncClient } = {},
): Promise<SyncReport> {
  const plaid = opts.plaid ?? plaidClient();
  if (!opts.plaid) await importItemsFromEnv();
  const items = await prisma.plaidItem.findMany();
  const report: SyncReport = { items: items.length, added: 0, modified: 0, removed: 0, complete: true };
  const timeUp = () => opts.deadline !== undefined && Date.now() > opts.deadline;
  for (const item of items) {
    let cursor = item.cursor ?? undefined;
    let byPlaidId: Map<string, string> | null = null;
    for (;;) {
      if (timeUp()) { report.complete = false; break; }
      const res = await plaid.transactionsSync({ access_token: item.accessToken, cursor, count: 500 });
      const d = res.data;
      if (!byPlaidId) {
        for (const a of d.accounts) await saveAccount(a, item.id);
        const accounts = await prisma.account.findMany({ where: { itemId: item.id } });
        byPlaidId = new Map(accounts.map((a) => [a.plaidAccountId!, a.id]));
      }
      await savePage(d as { added: PlaidTransaction[]; modified: PlaidTransaction[]; removed: RemovedTransaction[] }, byPlaidId);
      report.added += d.added.length;
      report.modified += d.modified.length;
      report.removed += d.removed.length;
      cursor = d.next_cursor;
      await prisma.plaidItem.update({ where: { id: item.id }, data: { cursor, lastSyncedAt: new Date() } });
      if (!d.has_more) break;
    }
    log(`${item.institution ?? item.itemId}: ${report.complete ? "synced" : "paused, continues next run"}`);
    if (!report.complete) break;
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

export type ClassifyReport = {
  /** Rows classified this run, by source. */
  counts: Record<string, number>;
  /** Rows still waiting (time ran out, or a Claude call failed); the next run picks them up. */
  remaining: number;
  failed: number;
};

/**
 * Run the three-layer classifier. By default only rows never classified; `all`
 * redoes everything but manual decisions. Newest first, so the months on the
 * dashboard fill in first.
 *
 * Netlify functions have a short time limit, so with a `deadline` (epoch ms)
 * no new row starts after it and the rest wait for the next run. Claude calls
 * run a few at a time, but rows at the same merchant wait for that merchant's
 * first answer so it is asked once and cached. A failed row is left for later
 * instead of failing the run.
 */
export async function classifyPending(
  opts: { all?: boolean; claude?: ClaudeClassifier; deadline?: number; concurrency?: number } = {},
): Promise<ClassifyReport> {
  const rules = await prisma.merchantRule.findMany();
  const cache = new Map((await prisma.merchantCache.findMany()).map((c) => [c.merchant, c]));
  const claude = opts.claude ?? defaultClassifier();
  const where = opts.all ? { NOT: { classificationSource: "manual" } } : { classificationSource: null };
  const txs = await prisma.transaction.findMany({ where, include: { account: true }, orderBy: { date: "desc" } });
  const counts: Record<string, number> = {};
  let failed = 0;
  let done = 0;
  const timeUp = () => opts.deadline !== undefined && Date.now() > opts.deadline;

  async function classifyOne(t: (typeof txs)[number]) {
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
    done++;
  }

  const queue = [...txs];
  const byMerchant = new Map<string, Promise<void>>();
  async function worker() {
    while (queue.length && !timeUp()) {
      const t = queue.shift()!;
      const run = (byMerchant.get(t.merchant) ?? Promise.resolve())
        .then(() => (timeUp() ? undefined : classifyOne(t)))
        .catch((e) => {
          failed++;
          console.error(`Classify failed for ${t.merchant}:`, e instanceof Error ? e.message : e);
        });
      byMerchant.set(t.merchant, run);
      await run;
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 4) }, worker));
  return { counts, remaining: txs.length - done, failed };
}
