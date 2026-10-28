import { prisma } from "./db";
import { ymd } from "./csv";

/** Everything the dashboard renders, precomputed so the page itself only draws. */
export type DashboardData = {
  generatedAt: string;
  latestDate: string | null;
  /** Ascending, e.g. ["2026-05", ..., "2026-10"]. */
  months: string[];
  /** Ordered by total spend over the window. slot is the fixed color slot; null = folded into Other. */
  categories: Array<{ name: string; budget: number | null; slot: number | null }>;
  /** month -> category -> expense total. Income and transfers excluded. */
  spend: Record<string, Record<string, number>>;
  /** month -> expenses bucketed by allocation. 50/50 rows are "shared"; other rows split by share. */
  split: Record<string, { me: number; her: number; shared: number }>;
  /** month -> what each wallet paid (joint = shared account). */
  paid: Record<string, { me: number; her: number; joint: number }>;
  /** month -> what each person was allocated. */
  allocated: Record<string, { me: number; her: number }>;
  /** month -> running balance at month end. Positive: she owes me. */
  balance: Record<string, number>;
  review: { count: number; merchants: Array<{ merchant: string; count: number; total: number }> };
  counts: { transactions: number; bySource: Record<string, number> };
};

const MAX_SLOTS = 6;
const EXCLUDED = new Set(["Income", "Transfer"]);

export async function buildDashboardData(opts: { months?: number } = {}): Promise<DashboardData> {
  const windowMonths = opts.months ?? 6;
  const [txs, cats] = await Promise.all([
    prisma.transaction.findMany({ include: { account: true }, orderBy: { date: "asc" } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const budgets = new Map(cats.map((c) => [c.name, c.monthlyBudget]));

  const latest = txs.at(-1)?.date ?? null;
  const months: string[] = [];
  if (latest) {
    const end = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
    for (let i = windowMonths - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
      months.push(d.toISOString().slice(0, 7));
    }
  }
  const monthSet = new Set(months);

  const spend: DashboardData["spend"] = {};
  const split: DashboardData["split"] = {};
  const paid: DashboardData["paid"] = {};
  const allocated: DashboardData["allocated"] = {};
  const balance: DashboardData["balance"] = {};
  const totals = new Map<string, number>();
  const bySource: Record<string, number> = {};
  const reviewMerchants = new Map<string, { count: number; total: number }>();
  let reviewCount = 0;

  for (const m of months) {
    spend[m] = {};
    split[m] = { me: 0, her: 0, shared: 0 };
    paid[m] = { me: 0, her: 0, joint: 0 };
    allocated[m] = { me: 0, her: 0 };
  }

  for (const t of txs) {
    const src = t.classificationSource ?? "unclassified";
    bySource[src] = (bySource[src] ?? 0) + 1;
    if (t.needsReview) {
      reviewCount++;
      const r = reviewMerchants.get(t.merchant) ?? { count: 0, total: 0 };
      r.count++;
      r.total += t.amount;
      reviewMerchants.set(t.merchant, r);
    }
    const m = t.date.toISOString().slice(0, 7);
    const category = t.category ?? "Other";
    if (!monthSet.has(m) || t.amount <= 0 || EXCLUDED.has(category)) continue;

    spend[m][category] = (spend[m][category] ?? 0) + t.amount;
    totals.set(category, (totals.get(category) ?? 0) + t.amount);

    const share = (t.shareMe ?? 50) / 100;
    if (t.shareMe === 50 || t.shareMe == null) split[m].shared += t.amount;
    else {
      split[m].me += t.amount * share;
      split[m].her += t.amount * (1 - share);
    }
    const owner = t.account.owner as "me" | "her" | "shared";
    if (owner === "shared") paid[m].joint += t.amount;
    else paid[m][owner] += t.amount;
    allocated[m].me += t.amount * share;
    allocated[m].her += t.amount * (1 - share);
  }

  let running = 0;
  for (const m of months) {
    running += paid[m].me + paid[m].joint / 2 - allocated[m].me;
    balance[m] = running;
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const categories = ranked.map((name, i) => ({
    name,
    budget: budgets.get(name) ?? null,
    slot: i < MAX_SLOTS ? i + 1 : null,
  }));

  return {
    generatedAt: new Date().toISOString(),
    latestDate: latest ? ymd(latest) : null,
    months,
    categories,
    spend,
    split,
    paid,
    allocated,
    balance,
    review: {
      count: reviewCount,
      merchants: [...reviewMerchants.entries()]
        .map(([merchant, v]) => ({ merchant, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    },
    counts: { transactions: txs.length, bySource },
  };
}
