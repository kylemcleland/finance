import { prisma } from "./db";
import { ONE_OFF_CATEGORIES } from "./categories";
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
  /** First transaction on record; a month that starts after its 1st is partial history. */
  earliestDate: string | null;
  /** month -> spending marked one-off; included in spend, left out of pace and yearly estimates. */
  oneOff: Record<string, number>;
};

const MAX_SLOTS = 6;
const EXCLUDED = new Set(["Income", "Transfer"]);

export async function buildDashboardData(opts: { months?: number } = {}): Promise<DashboardData> {
  const windowMonths = opts.months ?? 6;
  // Only the window is loaded row by row; counts and review merchants come
  // from small aggregate queries (every load wakes the billed database).
  const [range, cats, total, sources, review] = await Promise.all([
    prisma.transaction.aggregate({ _min: { date: true }, _max: { date: true } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.transaction.count(),
    prisma.transaction.groupBy({ by: ["classificationSource"], _count: { _all: true } }),
    prisma.transaction.groupBy({
      by: ["merchant"], where: { needsReview: true }, _count: { _all: true }, _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
  ]);
  const budgets = new Map(cats.map((c) => [c.name, c.monthlyBudget]));

  const latest = range._max.date ?? null;
  const months: string[] = [];
  if (latest) {
    const end = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
    for (let i = windowMonths - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
      months.push(d.toISOString().slice(0, 7));
    }
  }
  const monthSet = new Set(months);
  const txs = months.length
    ? await prisma.transaction.findMany({ where: { date: { gte: new Date(`${months[0]}-01T00:00:00Z`) } }, orderBy: { date: "asc" } })
    : [];

  const spend: DashboardData["spend"] = {};
  const split: DashboardData["split"] = {};
  const allocated: DashboardData["allocated"] = {};
  const oneOff: DashboardData["oneOff"] = {};
  const totals = new Map<string, number>();
  const bySource: Record<string, number> = {};
  for (const g of sources) bySource[g.classificationSource ?? "not sorted yet"] = g._count._all;
  const reviewCount = review.reduce((n, g) => n + g._count._all, 0);

  for (const m of months) {
    spend[m] = {};
    split[m] = { me: 0, her: 0, shared: 0, undecided: 0 };
    allocated[m] = { me: 0, her: 0 };
    oneOff[m] = 0;
  }

  for (const t of txs) {
    const m = t.date.toISOString().slice(0, 7);
    const category = t.category ?? "Other";
    // Refunds (negative amounts) are netted into their category, so a return
    // takes the purchase back out of the month's spending.
    if (!monthSet.has(m) || t.amount === 0 || EXCLUDED.has(category)) continue;

    spend[m][category] = (spend[m][category] ?? 0) + t.amount;
    totals.set(category, (totals.get(category) ?? 0) + t.amount);
    if (t.oneOff || ONE_OFF_CATEGORIES.has(category)) oneOff[m] += t.amount;

    // Undecided or not yet sorted: counted half each, as the page says,
    // whatever the classifier's tentative guess was.
    const undecided = t.needsReview || t.shareMe == null || t.classificationSource == null;
    const share = undecided ? 0.5 : t.shareMe! / 100;
    if (undecided) split[m].undecided += t.amount;
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
      merchants: review.slice(0, 8).map((g) => ({ merchant: g.merchant, count: g._count._all, total: g._sum.amount ?? 0 })),
    },
    counts: { transactions: total, bySource },
    earliestDate: range._min.date ? ymd(range._min.date) : null,
    oneOff,
  };
}
