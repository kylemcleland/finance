import { prisma } from "./db";
import { ymd } from "./csv";
import { PEOPLE } from "@/config/household";

/** Everything the dashboard renders, precomputed so the page itself only draws. */
export type DashboardData = {
  generatedAt: string;
  people: { me: string; her: string };
  latestDate: string | null;
  /** Ascending, e.g. ["2026-05", ..., "2026-10"]. */
  months: string[];
  /** Ordered by total spend over the window. slot is the fixed color slot; null = folded into Other. */
  categories: Array<{ name: string; budget: number | null; slot: number | null }>;
  /** month -> category -> expense total. Income and transfers excluded. */
  spend: Record<string, Record<string, number>>;
  /** month -> expenses bucketed by allocation. Rows awaiting review are "undecided"; 50/50 rows are "shared". */
  split: Record<string, { me: number; her: number; shared: number; undecided: number }>;
  /** month -> what each person was allocated. */
  allocated: Record<string, { me: number; her: number }>;
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
  const allocated: DashboardData["allocated"] = {};
  const totals = new Map<string, number>();
  const bySource: Record<string, number> = {};
  const reviewMerchants = new Map<string, { count: number; total: number }>();
  let reviewCount = 0;

  for (const m of months) {
    spend[m] = {};
    split[m] = { me: 0, her: 0, shared: 0, undecided: 0 };
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
    if (t.needsReview || t.shareMe == null) split[m].undecided += t.amount;
    else if (t.shareMe === 50) split[m].shared += t.amount;
    else {
      split[m].me += t.amount * share;
      split[m].her += t.amount * (1 - share);
    }
    allocated[m].me += t.amount * share;
    allocated[m].her += t.amount * (1 - share);
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const categories = ranked.map((name, i) => ({
    name,
    budget: budgets.get(name) ?? null,
    slot: i < MAX_SLOTS ? i + 1 : null,
  }));

  return {
    generatedAt: new Date().toISOString(),
    people: { ...PEOPLE },
    latestDate: latest ? ymd(latest) : null,
    months,
    categories,
    spend,
    split,
    allocated,
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
