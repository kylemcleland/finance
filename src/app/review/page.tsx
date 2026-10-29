import { Suspense } from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { CATEGORIES, SPLITS, splitLabel } from "@/lib/categories";
import { PEOPLE } from "@/config/household";
import { reopenAction } from "./actions";
import { ReviewQueue, type ReviewItem } from "./queue";
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
  const items: ReviewItem[] = pending.map((t) => ({
    id: t.id,
    merchant: t.merchant,
    day: day(t.date),
    account: `${t.account.nickname || t.account.name}${t.account.mask ? ` ****${t.account.mask}` : ""}`,
    cardholder:
      t.account.cardholder === "me" ? `${PEOPLE.me}'s card`
      : t.account.cardholder === "her" ? `${PEOPLE.her}'s card`
      : t.account.cardholder === "joint" ? "Joint card"
      : t.account.id === "manual-cash" ? null
      : "Cardholder not set",
    swipedBy: t.cardholderHint,
    note: t.note,
    amount: t.amount,
    shareMe: t.shareMe,
    category: t.category,
  }));
  const splits = SPLITS.slice().reverse().map((s) => ({
    value: s,
    label: splitLabel(s, PEOPLE.me, PEOPLE.her).replace("Mostly ", ""),
    sub: s === 50 ? "50 / 50" : s === 75 || s === 25 ? "mostly" : "all",
    tone: s === 100 ? "me" : s === 0 ? "her" : s === 50 ? "shared" : "",
  }));

  return (
    <>
      <ReviewQueue items={items} total={total} categories={CATEGORIES} splits={splits} />

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
