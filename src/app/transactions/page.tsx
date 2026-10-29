import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { CATEGORIES, splitLabel } from "@/lib/categories";
import { PEOPLE } from "@/config/household";
import "@/dashboard/dashboard.css";

const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shift = (m: string, by: number) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + by, 1)).toISOString().slice(0, 7);
};
const sameText = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]/g, "") === b.toLowerCase().replace(/[^a-z0-9]/g, "");

async function List({ searchParams }: { searchParams: PageProps<"/transactions">["searchParams"] }) {
  await connection();
  const p = await searchParams;
  const month = typeof p.month === "string" && /^\d{4}-\d{2}$/.test(p.month) ? p.month : new Date().toISOString().slice(0, 7);
  const category = typeof p.category === "string" && (CATEGORIES as readonly string[]).includes(p.category) ? p.category : null;
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(`${shift(month, 1)}-01T00:00:00Z`);
  const txs = await prisma.transaction.findMany({
    where: {
      date: { gte: start, lt: end },
      // The dashboard files uncategorized rows under Other.
      ...(category === "Other" ? { OR: [{ category: "Other" }, { category: null }] } : category ? { category } : { NOT: { category: { in: ["Transfer", "Income"] } } }),
    },
    include: { account: true },
    orderBy: [{ amount: "desc" }, { date: "desc" }],
  });
  const spending = txs.filter((t) => t.amount > 0);
  const total = spending.reduce((s, t) => s + t.amount, 0);
  const refunds = txs.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const byMerchant = new Map<string, { total: number; count: number }>();
  for (const t of spending) {
    const m = byMerchant.get(t.merchant) ?? { total: 0, count: 0 };
    m.total += t.amount; m.count++;
    byMerchant.set(t.merchant, m);
  }
  const top = [...byMerchant.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 6);
  const href = (m: string) => `/transactions?${category ? `category=${encodeURIComponent(category)}&` : ""}month=${m}`;

  return (
    <>
      <header className="head">
        <div className="eyebrow">{category ?? "All spending"}</div>
        <h1>{monthName(month)}</h1>
        <div className="sub">
          {usd0(total)} across {spending.length} purchase{spending.length === 1 ? "" : "s"}
          {refunds ? `, ${usd0(-refunds)} back in refunds` : ""}.{" "}
          <Link href={href(shift(month, -1))}>← {monthName(shift(month, -1)).split(" ")[0]}</Link>{" · "}
          <Link href={href(shift(month, 1))}>{monthName(shift(month, 1)).split(" ")[0]} →</Link>{" · "}
          <Link href="/">Back to the ledger</Link>
        </div>
      </header>

      {top.length > 1 ? (
        <section>
          <div className="sec-head"><h2>Where it went</h2></div>
          <div className="review">
            {top.map(([m, v]) => (
              <div key={m} className="row">
                <span className="m">{title(m)} <span className="meta">· {v.count}×</span></span>
                <span className="c num">{usd0(v.total)} <span className="meta">{total ? `${Math.round((v.total / total) * 100)}%` : ""}</span></span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="sec-head"><h2>Purchases</h2><span className="sub">biggest first</span></div>
        {txs.length === 0 ? <div className="empty">Nothing here this month.</div> : (
          <div className="review">
            {txs.map((t) => {
              const desc = t.originalDescription ?? t.rawName;
              const card = `${t.account.nickname || t.account.name}${t.account.mask ? ` ****${t.account.mask}` : ""}`;
              const split = t.shareMe == null || t.classificationSource == null ? "not sorted yet" : t.needsReview ? "undecided" : splitLabel(t.shareMe, PEOPLE.me, PEOPLE.her);
              return (
                <div key={t.id} className="row tx">
                  <span className="m">
                    {title(t.merchant)}
                    {sameText(desc, t.merchant) ? null : <div className="desc">{desc}</div>}
                    <div className="meta">{day(t.date)} · {card} · {split}{category ? "" : ` · ${t.category ?? "Other"}`}{t.pending ? " · pending" : ""}</div>
                  </span>
                  <span className="c num">{usd(t.amount)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <main className="dash">
      <Suspense fallback={<div className="empty">Loading…</div>}>
        <List searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
