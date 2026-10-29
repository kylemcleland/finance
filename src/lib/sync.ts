/**
 * Library form of the sync + classify pipeline, shared by the CLI scripts and
 * the scheduled Netlify function.
 */
import type { Transaction as PlaidTransaction, RemovedTransaction } from "plaid";
import { prisma } from "./db";
import { plaidClient } from "./plaid";
import { normalizeMerchant } from "./merchant";
import { importItemsFromEnv, saveAccount } from "./plaid-items";
import { plaidErrorCode } from "./plaid-link";
import { hasInvestmentAccounts, syncInvestmentCash, type InvestmentsStatus } from "./plaid-investments";
import { classify, classifyLocally, knownCategory, matchRule } from "./classify";
import { defaultClassifier, type Cardholder, type ClaudeClassifier } from "./claude";
import { NAME_MATCHES } from "@/config/household";

export type SyncReport = {
  items: number; added: number; modified: number; removed: number;
  /** False when the time budget ran out with more pages waiting; the next run continues from the saved cursor. */
  complete: boolean;
  /** Banks that failed this run (e.g. ITEM_LOGIN_REQUIRED: the bank login expired). */
  errors: Array<{ institution: string; code: string }>;
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
    originalDescription: t.original_description ?? null,
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
  // A pending transaction later posts under a new id. Keep whatever was
  // decided about the pending copy, then drop it.
  const postedFromPending = [...page.added, ...page.modified].filter((t) => t.pending_transaction_id);
  const pendingIds = postedFromPending.map((t) => t.pending_transaction_id!);
  const decided = pendingIds.length
    ? await prisma.transaction.findMany({
        where: { externalId: { in: pendingIds }, classificationSource: { not: null } },
        select: { externalId: true, category: true, shareMe: true, classificationSource: true, needsReview: true, note: true, classifiedAt: true },
      })
    : [];
  const removed = page.removed.map((r) => r.transaction_id);
  if (pendingIds.length || removed.length) {
    await prisma.transaction.deleteMany({ where: { externalId: { in: [...pendingIds, ...removed] } } });
  }
  if (page.added.length) {
    await prisma.transaction.createMany({
      data: page.added.map((t) => ({ externalId: t.transaction_id, ...transactionData(t, byPlaidId) })),
      skipDuplicates: true,
    });
    // Rows we already had (a history re-pull): bring amount, date and pending
    // up to date and fill in the bank description, in one statement. Their
    // category, split and decisions are left alone.
    const ids = page.added.map((t) => t.transaction_id);
    await prisma.$executeRaw`
      UPDATE "Transaction" AS t
      SET "amount" = v.amount, "date" = v.date, "pending" = v.pending,
          "originalDescription" = COALESCE(t."originalDescription", v.description)
      FROM unnest(
        ${ids}::text[],
        ${page.added.map((t) => t.amount)}::float8[],
        ${page.added.map((t) => new Date(`${t.authorized_date ?? t.date}T00:00:00Z`))}::timestamp[],
        ${page.added.map((t) => t.pending)}::boolean[],
        ${page.added.map((t) => t.original_description ?? null)}::text[]
      ) AS v(id, amount, date, pending, description)
      WHERE t."externalId" = v.id
        AND (t."amount" <> v.amount OR t."date" <> v.date OR t."pending" <> v.pending
             OR (t."originalDescription" IS NULL AND v.description IS NOT NULL))`;
  }
  for (const t of page.modified) {
    const data = transactionData(t, byPlaidId);
    await prisma.transaction.upsert({ where: { externalId: t.transaction_id }, update: data, create: { externalId: t.transaction_id, ...data } });
  }
  const byPending = new Map(decided.map((d) => [d.externalId, d]));
  for (const t of postedFromPending) {
    const d = byPending.get(t.pending_transaction_id!);
    if (!d) continue;
    await prisma.transaction.updateMany({
      where: { externalId: t.transaction_id, classificationSource: null },
      data: { category: d.category, shareMe: d.shareMe, classificationSource: d.classificationSource, needsReview: d.needsReview, note: d.note, classifiedAt: d.classifiedAt },
    });
  }
}

type SyncClient = Pick<ReturnType<typeof plaidClient>, "transactionsSync"> &
  Partial<Pick<ReturnType<typeof plaidClient>, "accountsGet" | "investmentsTransactionsGet">>;

/** Per bank: the cursor a paginated pull started from (to restart it), the last error, and investment-account status. */
type ItemSyncState = {
  startCursor?: string | null;
  error?: { code: string; at: string };
  /** Whether we've asked Plaid for the full account list (to spot investment accounts). */
  accountsChecked?: boolean;
  investments?: InvestmentsStatus;
};
const SYNC_STATE_KEY = "sync-state";

export async function getSyncState(): Promise<Record<string, ItemSyncState>> {
  const row = await prisma.appState.findUnique({ where: { key: SYNC_STATE_KEY } });
  return (row?.value as Record<string, ItemSyncState> | undefined) ?? {};
}
async function saveSyncState(state: Record<string, ItemSyncState>) {
  await prisma.appState.upsert({ where: { key: SYNC_STATE_KEY }, update: { value: state }, create: { key: SYNC_STATE_KEY, value: state } });
}

/**
 * Pull new, changed and removed transactions for every linked bank, starting
 * with the one synced longest ago. With a `deadline` (epoch ms) no new page is
 * fetched after it; the cursor is saved after every page, so the next run
 * picks up where this one stopped. One bank's error (an expired login, say)
 * is recorded and the others still sync. If Plaid reports that data changed
 * mid-pagination, that bank restarts from the cursor the pagination began at.
 */
export async function syncPlaid(
  log: (s: string) => void = () => {},
  opts: { deadline?: number; plaid?: SyncClient } = {},
): Promise<SyncReport> {
  const plaid = opts.plaid ?? plaidClient();
  if (!opts.plaid) await importItemsFromEnv();
  const items = await prisma.plaidItem.findMany({ orderBy: [{ lastSyncedAt: { sort: "asc", nulls: "first" } }] });
  const report: SyncReport = { items: items.length, added: 0, modified: 0, removed: 0, complete: true, errors: [] };
  const timeUp = () => opts.deadline !== undefined && Date.now() > opts.deadline;
  const state = await getSyncState();
  for (const item of items) {
    const st: ItemSyncState = state[item.id] ?? {};
    state[item.id] = st;
    let cursor = item.cursor ?? undefined;
    let byPlaidId: Map<string, string> | null = null;
    try {
      for (;;) {
        if (timeUp()) { report.complete = false; break; }
        if (!("startCursor" in st)) {
          st.startCursor = cursor ?? null;
          await saveSyncState(state);
        }
        const res = await plaid.transactionsSync({
          access_token: item.accessToken, cursor, count: 500,
          options: { include_original_description: true },
        });
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
        if (!d.has_more) {
          delete st.startCursor;
          delete st.error;
          await saveSyncState(state);
          break;
        }
      }
      log(`${item.institution ?? item.itemId}: ${report.complete ? "synced" : "paused, continues next run"}`);
    } catch (e) {
      const code = plaidErrorCode(e);
      if (code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION") {
        // Plaid's rule: restart the whole pagination from where it began.
        await prisma.plaidItem.update({ where: { id: item.id }, data: { cursor: st.startCursor ?? null } });
        delete st.startCursor;
      } else {
        st.error = { code, at: new Date().toISOString() };
        report.errors.push({ institution: item.institution ?? item.itemId, code });
      }
      await saveSyncState(state);
      log(`${item.institution ?? item.itemId}: error ${code}`);
    }

    // Investment-type accounts (a Fidelity cash account) aren't in the
    // transaction feed; read their cash movements separately.
    if (!timeUp() && plaid.investmentsTransactionsGet && st.investments?.status !== "unsupported") {
      try {
        let accounts = await prisma.account.findMany({ where: { itemId: item.id }, select: { type: true } });
        if (!hasInvestmentAccounts(accounts) && !st.accountsChecked && plaid.accountsGet) {
          const got = await plaid.accountsGet({ access_token: item.accessToken });
          for (const a of got.data.accounts) await saveAccount(a, item.id);
          accounts = await prisma.account.findMany({ where: { itemId: item.id }, select: { type: true } });
          st.accountsChecked = true;
        }
        const recentlyRefused = st.investments?.status === "not-enabled" && Date.now() - new Date(st.investments.at).getTime() < 7 * 86400_000;
        if (hasInvestmentAccounts(accounts) && !recentlyRefused) {
          const r = await syncInvestmentCash(item, st.investments, plaid as Parameters<typeof syncInvestmentCash>[2]);
          st.investments = r.status;
          report.added += r.added;
          log(`${item.institution ?? item.itemId}: investment cash ${r.status.status}, ${r.added} new`);
        }
      } catch (e) {
        log(`${item.institution ?? item.itemId}: investment accounts check failed ${plaidErrorCode(e)}`);
      }
      await saveSyncState(state);
    }
  }
  // A card hold that expired is normally removed by Plaid, but a history
  // re-pull never reports removals. Pending charges should post or vanish
  // within days; anything still pending after two weeks is a dead hold.
  if (report.complete && report.errors.length === 0) {
    const stale = await prisma.transaction.deleteMany({
      where: { source: "plaid", pending: true, date: { lt: new Date(Date.now() - 14 * 86400_000) } },
    });
    if (stale.count) log(`Removed ${stale.count} expired pending holds`);
  }
  return report;
}

/** Account cardholder first; else whose name the bank reports (Plaid's account_owner), if it names one of us. */
export function cardholderOf(account: { cardholder: string | null }, hint: string | null): Cardholder {
  if (account.cardholder === "me" || account.cardholder === "her") return account.cardholder;
  return personFromName(hint);
}

/** "JACKELIN SALINAS" -> "her". Whole words; first names before surnames; null when unclear. */
export function personFromName(name: string | null | undefined): Cardholder {
  const words = new Set((name ?? "").toLowerCase().split(/[^a-z]+/).filter(Boolean));
  if (!words.size) return null;
  for (const part of ["first", "last"] as const) {
    const me = NAME_MATCHES.me[part].some((n) => words.has(n));
    const her = NAME_MATCHES.her[part].some((n) => words.has(n));
    if (me !== her) return me ? "me" : "her";
  }
  return null;
}

type TxWithAccount = Awaited<ReturnType<typeof prisma.transaction.findMany<{ include: { account: true } }>>>[number];

function inputOf(t: TxWithAccount) {
  return {
    merchant: t.merchant, rawName: t.originalDescription ?? t.rawName, amount: t.amount,
    plaidCategoryPrimary: t.plaidCategoryPrimary, plaidCategoryDetailed: t.plaidCategoryDetailed,
    account: t.account.nickname ?? t.account.name,
    cardholder: cardholderOf(t.account, t.cardholderHint),
    date: t.date.toISOString().slice(0, 10),
  };
}

export type LocalSortReport = { resolved: number; categorized: number; waitingForClaude: number; settled: number };

/**
 * The fast pass over every unsorted row, with no Claude calls: rules, cached
 * merchant answers, Plaid or keyword categories and the cardholder settle
 * what they can, written back in bulk. Rows only Claude (or a person) can
 * split stay unsorted but get their category now, so the dashboard shows the
 * real category instead of "Other" while they wait.
 */
export async function sortLocally(): Promise<LocalSortReport> {
  const rules = await prisma.merchantRule.findMany();
  const cache = new Map((await prisma.merchantCache.findMany()).map((c) => [c.merchant, c]));
  const txs = await prisma.transaction.findMany({ where: { classificationSource: null }, include: { account: true } });
  const resolved: Array<{ id: string; category: string; shareMe: number; source: string; needsReview: boolean; note: string | null }> = [];
  const categorized: Array<{ id: string; category: string }> = [];
  for (const t of txs) {
    const input = inputOf(t);
    const r = classifyLocally(input, rules, cache.get(t.merchant));
    if (r) resolved.push({ id: t.id, category: r.category, shareMe: r.shareMe, source: r.source, needsReview: r.needsReview, note: r.note ?? null });
    else {
      const c = knownCategory(input, rules, cache.get(t.merchant));
      if (c && c !== t.category) categorized.push({ id: t.id, category: c });
    }
  }
  for (let i = 0; i < resolved.length; i += 1000) {
    const chunk = resolved.slice(i, i + 1000);
    await prisma.$executeRaw`
      UPDATE "Transaction" AS t
      SET "category" = v.category, "shareMe" = v.share, "classificationSource" = v.source,
          "needsReview" = v.review, "note" = v.note, "classifiedAt" = NOW()
      FROM unnest(
        ${chunk.map((r) => r.id)}::text[], ${chunk.map((r) => r.category)}::text[], ${chunk.map((r) => r.shareMe)}::int[],
        ${chunk.map((r) => r.source)}::text[], ${chunk.map((r) => r.needsReview)}::boolean[], ${chunk.map((r) => r.note)}::text[]
      ) AS v(id, category, share, source, review, note)
      WHERE t.id = v.id AND t."classificationSource" IS NULL`;
  }
  // Merchants whose rule says one-off (a wedding venue): mark their purchases.
  const oneOffIds = txs.filter((t) => !t.oneOff && matchRule(t.merchant, rules)?.oneOff).map((t) => t.id);
  if (oneOffIds.length) await prisma.transaction.updateMany({ where: { id: { in: oneOffIds } }, data: { oneOff: true } });
  for (let i = 0; i < categorized.length; i += 1000) {
    const chunk = categorized.slice(i, i + 1000);
    await prisma.$executeRaw`
      UPDATE "Transaction" AS t SET "category" = v.category
      FROM unnest(${chunk.map((r) => r.id)}::text[], ${chunk.map((r) => r.category)}::text[]) AS v(id, category)
      WHERE t.id = v.id AND t."classificationSource" IS NULL`;
  }
  const settled = await settleOldReviews();
  return { resolved: resolved.length, categorized: categorized.length, waitingForClaude: txs.length - resolved.length, settled };
}

export const AUTO_SETTLE_DAYS = 45;

/**
 * Keep the review queue short: purchases waiting longer than 45 days are
 * settled with their current best guess (the split the classifier proposed,
 * or half each). Anything that would leave spending (Transfer, Income) stays
 * for a person to confirm.
 */
export async function settleOldReviews(now = Date.now()): Promise<number> {
  const cutoff = new Date(now - AUTO_SETTLE_DAYS * 86400_000);
  return prisma.$executeRaw`
    UPDATE "Transaction"
    SET "needsReview" = false,
        "shareMe" = COALESCE("shareMe", 50),
        "note" = CONCAT_WS(' · ', "note", 'settled automatically after 45 days')
    WHERE "needsReview" = true
      AND "date" < ${cutoff}
      AND "classificationSource" IS DISTINCT FROM 'manual'
      AND ("category" IS NULL OR "category" NOT IN ('Transfer', 'Income'))`;
}

export type ClassifyReport = {
  /** Rows classified this run, by source. */
  counts: Record<string, number>;
  /** Rows still waiting (time ran out, or a Claude call failed); the next run picks them up. */
  remaining: number;
  failed: number;
  /** The most recent Claude error, e.g. a rate limit or an empty credit balance. */
  lastError: string | null;
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
  // Settle everything that needs no Claude in one bulk pass first, so the
  // slow Claude calls below only see the rows that need them.
  if (!opts.all) await sortLocally();
  const rules = await prisma.merchantRule.findMany();
  const cache = new Map((await prisma.merchantCache.findMany()).map((c) => [c.merchant, c]));
  const claude = opts.claude ?? defaultClassifier();
  // Prisma's NOT drops NULLs, so "everything but manual" spells the NULLs out.
  const where = opts.all ? { OR: [{ classificationSource: null }, { classificationSource: { not: "manual" } }] } : { classificationSource: null };
  const txs = await prisma.transaction.findMany({ where, include: { account: true }, orderBy: { date: "desc" } });
  const counts: Record<string, number> = {};
  let failed = 0;
  let done = 0;
  let lastError: string | null = null;
  const timeUp = () => opts.deadline !== undefined && Date.now() > opts.deadline;

  async function classifyOne(t: (typeof txs)[number]) {
    const input = inputOf(t);
    const { result, fromClaude } = await classify(input, rules, cache.get(t.merchant), claude);
    // Never let one purchase's answer overwrite a merchant already known to vary.
    if (fromClaude && cache.get(t.merchant)?.shareMe !== null) {
      const saved = await prisma.merchantCache.upsert({
        where: { merchant: t.merchant },
        update: fromClaude,
        create: { merchant: t.merchant, ...fromClaude },
      });
      cache.set(t.merchant, saved);
    }
    // Only write if nobody decided this row while Claude was thinking (a
    // background run can take minutes).
    const written = await prisma.transaction.updateMany({
      where: { id: t.id, ...where },
      data: {
        category: result.category, shareMe: result.shareMe, classificationSource: result.source,
        needsReview: result.needsReview, note: result.note ?? null, classifiedAt: new Date(),
        ...(matchRule(t.merchant, rules)?.oneOff ? { oneOff: true } : {}),
      },
    });
    if (written.count) counts[result.source] = (counts[result.source] ?? 0) + 1;
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
          lastError = e instanceof Error ? e.message : String(e);
          console.error(`Classify failed for ${t.merchant}:`, lastError);
        });
      byMerchant.set(t.merchant, run);
      await run;
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 4) }, worker));
  return { counts, remaining: txs.length - done, failed, lastError };
}
