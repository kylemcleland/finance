import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { findRecurring, type Recurring } from "@/lib/recurring";
import "@/dashboard/dashboard.css";

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n < 100 ? 2 : 0, maximumFractionDigits: n < 100 ? 2 : 0 })}`;
const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function Row({ r }: { r: Recurring }) {
  const href = `/transactions?merchant=${encodeURIComponent(r.merchant)}&month=${r.lastDate.toISOString().slice(0, 7)}`;
  return (
    <Link href={href} className="row tx">
      <span className="m">
        {title(r.merchant)}
        <div className="meta">
          {r.cadence} · last {day(r.lastDate)}{r.lapsed ? "" : ` · next ~${day(r.nextDate)}`}
          {r.isNew ? " · new" : ""}
          {r.priceUpFrom != null ? ` · up from ${usd(r.priceUpFrom)}` : ""}
          {r.category ? ` · ${r.category}` : ""}
        </div>
      </span>
      <span className="c num">{usd(r.lastAmount)}<div className="meta">{usd0(r.yearly)}/yr</div></span>
    </Link>
  );
}

/** The last ~13 months of spending, run through the recurring-charge finder. */
async function loadRecurring() {
  const now = new Date();
  const rows = await prisma.transaction.findMany({
    where: { date: { gte: new Date(now.getTime() - 400 * 86400_000) }, amount: { gt: 0 }, OR: [{ category: null }, { category: { notIn: ["Transfer", "Income"] } }] },
    select: { merchant: true, date: true, amount: true, category: true },
  });
  return findRecurring(rows, now);
}

async function List() {
  await connection();
  await requireSession();
  const all = await loadRecurring();
  const active = all.filter((r) => !r.lapsed);
  const lapsed = all.filter((r) => r.lapsed);
  const flagged = active.filter((r) => r.isNew || r.priceUpFrom != null);
  const monthly = active.reduce((s, r) => s + r.monthly, 0);
  return (
    <>
      <header className="head">
        <div className="eyebrow">Household ledger</div>
        <h1>Recurring</h1>
        <div className="sub">
          {active.length} recurring charge{active.length === 1 ? "" : "s"}: about {usd0(monthly)} a month, {usd0(monthly * 12)} a year.{" "}
          <Link href="/">Back to the ledger</Link>
        </div>
      </header>
      {flagged.length ? (
        <section>
          <div className="sec-head"><h2>Worth a look</h2><span className="sub">new or more expensive</span></div>
          <div className="review">{flagged.map((r) => <Row key={r.merchant} r={r} />)}</div>
        </section>
      ) : null}
      <section>
        <div className="sec-head"><h2>Active</h2><span className="sub">biggest yearly cost first</span></div>
        {active.length ? <div className="review">{active.map((r) => <Row key={r.merchant} r={r} />)}</div> : <div className="empty">Nothing recurring found yet. It needs a few months of history.</div>}
      </section>
      {lapsed.length ? (
        <section>
          <div className="sec-head"><h2>Looks cancelled</h2><span className="sub">no recent charge</span></div>
          <div className="review">{lapsed.map((r) => <Row key={r.merchant} r={r} />)}</div>
        </section>
      ) : null}
      <div className="sub">Found from steady charges at a steady amount (weekly to yearly). Tap one to see every charge.</div>
    </>
  );
}

export default function RecurringPage() {
  return (
    <main className="dash">
      <Suspense fallback={<div className="empty">Loading…</div>}>
        <List />
      </Suspense>
    </main>
  );
}
