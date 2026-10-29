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

/** Twelve monthly bars, the selected month dark, the 12-month average dashed; tap a bar to open that month. */
function Trend({ trend, selected, avg, hrefFor }: { trend: Array<{ m: string; total: number }>; selected: string; avg: number; hrefFor: (m: string) => string }) {
  const W = 360, H = 150, padT = 18, padB = 18, gap = 4;
  const max = Math.max(...trend.map((x) => x.total), avg, 1);
  const bw = (W - gap * (trend.length - 1)) / trend.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const label = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "narrow", timeZone: "UTC" });
  const short = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : `$${Math.round(v)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" role="img" aria-label="Monthly totals for the last 12 months">
      {trend.map((x, i) => {
        const X = i * (bw + gap);
        const sel = x.m === selected;
        return (
          <a key={x.m} href={hrefFor(x.m)}>
            <title>{`${x.m}: ${short(x.total)}`}</title>
            <rect x={X} y={y(x.total)} width={bw} height={Math.max(0, H - padB - y(x.total))} rx={3} className={sel ? "bar sel" : "bar"} />
            <text x={X + bw / 2} y={H - 4} textAnchor="middle" className={sel ? "lbl sel" : "lbl"}>{label(x.m)}</text>
            {sel ? (
              // Keep the value label inside the chart at either edge.
              <text x={i === 0 ? X : i === trend.length - 1 ? X + bw : X + bw / 2} y={Math.max(11, y(x.total) - 5)}
                textAnchor={i === 0 ? "start" : i === trend.length - 1 ? "end" : "middle"} className="val">{short(x.total)}</text>
            ) : null}
          </a>
        );
      })}
      <line x1={0} x2={W} y1={y(avg)} y2={y(avg)} className="avg" />
    </svg>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/transactions">["searchParams"] }) {
  await connection();
  const p = await searchParams;
  const month = typeof p.month === "string" && /^\d{4}-\d{2}$/.test(p.month) ? p.month : new Date().toISOString().slice(0, 7);
  const category = typeof p.category === "string" && (CATEGORIES as readonly string[]).includes(p.category) ? p.category : null;
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(`${shift(month, 1)}-01T00:00:00Z`);
  const trendMonths = Array.from({ length: 12 }, (_, i) => shift(month, i - 11));
  const all = await prisma.transaction.findMany({
    where: {
      date: { gte: new Date(`${trendMonths[0]}-01T00:00:00Z`), lt: end },
      // The dashboard files uncategorized rows under Other.
      ...(category === "Other" ? { OR: [{ category: "Other" }, { category: null }] } : category ? { category } : { NOT: { category: { in: ["Transfer", "Income"] } } }),
    },
    include: { account: true },
    orderBy: [{ amount: "desc" }, { date: "desc" }],
  });
  const txs = all.filter((t) => t.date >= start);
  const byMonthTotal = new Map<string, number>();
  for (const t of all) if (t.amount > 0) byMonthTotal.set(t.date.toISOString().slice(0, 7), (byMonthTotal.get(t.date.toISOString().slice(0, 7)) ?? 0) + t.amount);
  const trend = trendMonths.map((m) => ({ m, total: byMonthTotal.get(m) ?? 0 }));
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

  // Who it was for: each purchase's split, undecided or unsorted counted apart.
  const who = { me: 0, her: 0, shared: 0, undecided: 0 };
  const byCard = new Map<string, number>();
  for (const t of spending) {
    if (t.classificationSource == null || t.shareMe == null || t.needsReview) who.undecided += t.amount;
    else if (t.shareMe === 50) who.shared += t.amount;
    else { who.me += (t.amount * t.shareMe) / 100; who.her += (t.amount * (100 - t.shareMe)) / 100; }
    const card = `${t.account.nickname || t.account.name}${t.account.mask ? ` ****${t.account.mask}` : ""}`;
    byCard.set(card, (byCard.get(card) ?? 0) + t.amount);
  }
  const cards = [...byCard.entries()].sort((a, b) => b[1] - a[1]);

  // Pace: the month in progress projected from days elapsed; a year from the last three full months.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const inProgress = today.slice(0, 7) === month;
  const daysInMonth = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  const elapsed = inProgress ? +today.slice(8, 10) : daysInMonth;
  const projected = inProgress && elapsed >= 3 ? (total / elapsed) * daysInMonth : null;
  const fullMonths = trend.filter((x) => x.m < (inProgress ? month : shift(month, 1))).slice(-3);
  const avg3 = fullMonths.length ? fullMonths.reduce((a, x) => a + x.total, 0) / fullMonths.length : null;
  const avg12 = trend.filter((x) => !(inProgress && x.m === month)).reduce((a, x) => a + x.total, 0) / (inProgress ? 11 : 12);
  const href = (m: string) => `/transactions?${category ? `category=${encodeURIComponent(category)}&` : ""}month=${m}`;

  const saved = typeof p.saved === "string" ? Number(p.saved) : 0;
  return (
    <>
      {saved ? <div className="card">Saved{saved > 1 ? `, and re-filed ${saved - 1} other purchase${saved === 2 ? "" : "s"} at that merchant` : ""}.</div> : null}
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

      <section>
        <div className="sec-head"><h2>Last 12 months</h2><span className="sub">avg {usd0(avg12)}/mo</span></div>
        <Trend trend={trend} selected={month} avg={avg12} hrefFor={href} />
        <div className="sub">
          {projected != null ? `On pace for ${usd0(projected)} this month. ` : ""}
          {avg3 != null ? `About ${usd0(avg3 * 12)} a year at the last ${fullMonths.length === 1 ? "month's" : `${fullMonths.length} months'`} rate` : ""}
          {avg3 != null ? `; ${usd0(avg12 * 12)} at the 12-month average.` : ""}
        </div>
      </section>

      {spending.length ? (
        <section>
          <div className="sec-head"><h2>Who it was for</h2></div>
          <div className="review">
            {([[PEOPLE.me, who.me], [PEOPLE.her, who.her], ["Shared", who.shared], ["Undecided", who.undecided]] as const)
              .filter(([, v]) => v > 0.5)
              .map(([k, v]) => (
                <div key={k} className="row"><span className="m">{k}</span><span className="c num">{usd0(v)} <span className="meta">{Math.round((v / total) * 100)}%</span></span></div>
              ))}
          </div>
          {cards.length > 1 ? (
            <>
              <div className="sec-head"><h2>By card</h2></div>
              <div className="review">
                {cards.map(([c, v]) => (
                  <div key={c} className="row"><span className="m">{c}</span><span className="c num">{usd0(v)} <span className="meta">{Math.round((v / total) * 100)}%</span></span></div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

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
        <div className="sec-head"><h2>Purchases</h2><span className="sub">biggest first · tap one to change it</span></div>
        {txs.length === 0 ? <div className="empty">Nothing here this month.</div> : (
          <div className="review">
            {txs.map((t) => {
              const desc = t.originalDescription ?? t.rawName;
              const card = `${t.account.nickname || t.account.name}${t.account.mask ? ` ****${t.account.mask}` : ""}`;
              const split = t.shareMe == null || t.classificationSource == null ? "not sorted yet" : t.needsReview ? "undecided" : splitLabel(t.shareMe, PEOPLE.me, PEOPLE.her);
              return (
                <Link key={t.id} href={`/tx/${t.id}?back=${encodeURIComponent(href(month))}`} className="row tx">
                  <span className="m">
                    {title(t.merchant)}
                    {sameText(desc, t.merchant) ? null : <div className="desc">{desc}</div>}
                    <div className="meta">{day(t.date)} · {card} · {split}{category ? "" : ` · ${t.category ?? "Other"}`}{t.pending ? " · pending" : ""}</div>
                  </span>
                  <span className="c num">{usd(t.amount)}</span>
                </Link>
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
