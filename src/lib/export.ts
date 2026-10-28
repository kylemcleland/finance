import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "./db";
import { toCsv, ymd } from "./csv";

export type Summary = {
  rows: number;
  bySource: Record<string, number>;
  needsReview: number;
  byCategory: Array<{ category: string; total: number }>;
  paid: { me: number; her: number; shared: number };
  allocated: { me: number; her: number };
  /** Positive: "me" has paid more than my share; negative: she has. */
  balanceMe: number;
};

/** Expenses only: positive amounts in non-Income / non-Transfer categories. */
function isExpense(t: { amount: number; category: string | null }) {
  return t.amount > 0 && t.category !== "Income" && t.category !== "Transfer";
}

export async function exportCsv(path = "exports/transactions.csv"): Promise<Summary> {
  const txs = await prisma.transaction.findMany({ include: { account: true }, orderBy: { date: "desc" } });
  const header = ["date", "amount", "merchant", "description", "account", "paid_by", "category", "share_me_pct", "source", "needs_review", "note"];
  const rows = txs.map((t) => [
    ymd(t.date), t.amount.toFixed(2), t.merchant, t.rawName, t.account.name, t.account.owner,
    t.category, t.shareMe, t.classificationSource, t.needsReview, t.note,
  ]);
  mkdirSync(path.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  writeFileSync(path, toCsv([header, ...rows]));

  const summary: Summary = {
    rows: txs.length, bySource: {}, needsReview: 0, byCategory: [],
    paid: { me: 0, her: 0, shared: 0 }, allocated: { me: 0, her: 0 }, balanceMe: 0,
  };
  const cat = new Map<string, number>();
  for (const t of txs) {
    const src = t.classificationSource ?? "unclassified";
    summary.bySource[src] = (summary.bySource[src] ?? 0) + 1;
    if (t.needsReview) summary.needsReview++;
    if (!isExpense(t)) continue;
    cat.set(t.category!, (cat.get(t.category!) ?? 0) + t.amount);
    const owner = t.account.owner as "me" | "her" | "shared";
    summary.paid[owner] += t.amount;
    const share = (t.shareMe ?? 50) / 100;
    summary.allocated.me += t.amount * share;
    summary.allocated.her += t.amount * (1 - share);
  }
  // Shared-account money is treated as half each.
  const paidMe = summary.paid.me + summary.paid.shared / 2;
  summary.balanceMe = paidMe - summary.allocated.me;
  summary.byCategory = [...cat.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  return summary;
}

export function printSummary(s: Summary) {
  const usd = (n: number) => `$${n.toFixed(2)}`;
  console.log(`\n${s.rows} transactions. Sources: ${Object.entries(s.bySource).map(([k, v]) => `${k}=${v}`).join(", ")}. Needs review: ${s.needsReview}`);
  console.log("\nSpend by category:");
  for (const c of s.byCategory) console.log(`  ${c.category.padEnd(14)} ${usd(c.total).padStart(12)}`);
  console.log(`\nPaid:      me ${usd(s.paid.me)}, her ${usd(s.paid.her)}, joint ${usd(s.paid.shared)}`);
  console.log(`Allocated: me ${usd(s.allocated.me)}, her ${usd(s.allocated.her)}`);
  const who = s.balanceMe >= 0 ? "she owes me" : "I owe her";
  console.log(`Balance:   ${who} ${usd(Math.abs(s.balanceMe))}`);
}
