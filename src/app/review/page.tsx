import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { CATEGORIES, SPLITS, splitLabel } from "@/lib/categories";
import { PEOPLE } from "@/config/household";
import { decideAction, reopenAction } from "./actions";
import "@/dashboard/dashboard.css";

const usd = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

async function Queue() {
  await connection();
  const [pending, recent] = await Promise.all([
    prisma.transaction.findMany({ where: { needsReview: true }, include: { account: true }, orderBy: { date: "desc" }, take: 60 }),
    prisma.transaction.findMany({ where: { classificationSource: "manual" }, include: { account: true }, orderBy: { classifiedAt: "desc" }, take: 8 }),
  ]);
  const total = await prisma.transaction.count({ where: { needsReview: true } });
  const merchantCounts = new Map<string, number>();
  for (const t of pending) merchantCounts.set(t.merchant, (merchantCounts.get(t.merchant) ?? 0) + 1);

  return (
    <>
      <header className="head">
        <div className="eyebrow">Household ledger</div>
        <h1>Review</h1>
        <div className="sub">
          {total === 0 ? "Nothing waiting. " : `${total} purchase${total === 1 ? "" : "s"} waiting for a split. `}
          <Link href="/">Back to the ledger</Link>
        </div>
      </header>

      {pending.length === 0 ? (
        <div className="empty">All caught up.</div>
      ) : (
        <section className="queue">
          {pending.map((t) => {
            const others = (merchantCounts.get(t.merchant) ?? 1) - 1;
            const hint = t.account.cardholder === "me" ? PEOPLE.me : t.account.cardholder === "her" ? PEOPLE.her : null;
            return (
              <form key={t.id} action={decideAction} className="card">
                <input type="hidden" name="id" value={t.id} />
                <div className="card-top">
                  <div className="card-merchant">
                    <div className="m">{title(t.merchant)}</div>
                    <div className="meta">
                      {day(t.date)} · {t.account.name}
                      {hint ? ` · ${hint}'s card` : ""}
                      {t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                  <div className="amt num">{usd(t.amount)}</div>
                </div>
                <div className="choices" role="group" aria-label="Whose purchase">
                  {SPLITS.slice().reverse().map((s) => (
                    <button key={s} type="submit" name="share" value={s} className={`choice ${s === 100 ? "me" : s === 0 ? "her" : s === 50 ? "shared" : ""} ${t.shareMe === s ? "guess" : ""}`} title={t.shareMe === s ? "Current guess" : undefined}>
                      <span>{splitLabel(s, PEOPLE.me, PEOPLE.her).replace("Mostly ", "")}</span>
                      <small>{s === 50 ? "50 / 50" : s === 75 || s === 25 ? "mostly" : "all"}</small>
                    </button>
                  ))}
                </div>
                <div className="card-foot">
                  <label className="sel">
                    <span>Category</span>
                    <select name="category" id={`cat-${t.id}`} defaultValue={t.category ?? "Other"}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="chk">
                    <input type="checkbox" name="always" id={`always-${t.id}`} />
                    <span>Always for {title(t.merchant)}{others ? ` (+${others} waiting)` : ""}</span>
                  </label>
                </div>
              </form>
            );
          })}
          {total > pending.length ? <div className="sub">Showing the newest {pending.length} of {total}.</div> : null}
        </section>
      )}

      {recent.length ? (
        <section>
          <div className="sec-head"><h2>Recent decisions</h2></div>
          <div className="review">
            {recent.map((t) => (
              <form key={t.id} action={reopenAction} className="row">
                <input type="hidden" name="id" value={t.id} />
                <span className="m">{title(t.merchant)} <span className="meta">· {splitLabel(t.shareMe ?? 50, PEOPLE.me, PEOPLE.her)} · {t.category}</span></span>
                <span className="c num">{usd(t.amount)} <button type="submit" className="linkish">Undo</button></span>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export default function ReviewPage() {
  return (
    <main className="dash">
      <Suspense fallback={<div className="sub">Loading the queue…</div>}>
        <Queue />
      </Suspense>
    </main>
  );
}
