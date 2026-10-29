import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { CATEGORIES, SPLITS, splitLabel } from "@/lib/categories";
import { safeNext } from "@/lib/auth";
import { PEOPLE } from "@/config/household";
import { reclassifyAction } from "./actions";
import "@/dashboard/dashboard.css";
import { requireSession } from "@/lib/session";

const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const SOURCES: Record<string, string> = {
  manual: "set by you", rule: "your merchant rule", claude: "Claude", plaid: "the bank's category", keyword: "its description", unclassified: "a guess, waiting for review",
};

async function Edit({ params, searchParams }: { params: PageProps<"/tx/[id]">["params"]; searchParams: PageProps<"/tx/[id]">["searchParams"] }) {
  await connection();
  await requireSession(); // the proxy also checks, but pages must not rely on it alone
  const { id } = await params;
  const sp = await searchParams;
  const back = safeNext(sp.back);
  const t = await prisma.transaction.findUnique({ where: { id }, include: { account: true } });
  if (!t) notFound();
  const atMerchant = await prisma.transaction.count({ where: { merchant: t.merchant } });
  const desc = t.originalDescription ?? t.rawName;
  const card = `${t.account.nickname || t.account.name}${t.account.mask ? ` ****${t.account.mask}` : ""}`;
  const holder = t.account.cardholder === "me" ? `${PEOPLE.me}'s card` : t.account.cardholder === "her" ? `${PEOPLE.her}'s card` : t.account.cardholder === "joint" ? "Joint card" : null;
  const now = t.classificationSource == null ? "Not sorted yet" : t.needsReview ? "Undecided" : splitLabel(t.shareMe ?? 50, PEOPLE.me, PEOPLE.her);

  return (
    <>
      <header className="head">
        <div className="eyebrow">{t.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</div>
        <h1>{title(t.merchant)}</h1>
        <div className="sub"><Link href={back}>← Back</Link></div>
      </header>

      <div className="card">
        <div className="card-top">
          <div className="card-merchant">
            <div className="desc">{desc}</div>
            <div className="meta">{card}{holder ? ` · ${holder}` : ""}{t.cardholderHint ? ` · bank says ${t.cardholderHint}` : ""}{t.pending ? " · pending" : ""}</div>
          </div>
          <div className="amt num">{usd(t.amount)}</div>
        </div>
        <div className="meta">
          Now: {t.category ?? "Other"} · {now}
          {t.classificationSource ? ` · by ${SOURCES[t.classificationSource] ?? t.classificationSource}` : ""}
        </div>
        {t.note ? <div className="meta">Why: {t.note}</div> : null}
      </div>

      <form action={reclassifyAction} className="card">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="back" value={back} />
        <label className="sel">
          <span>Category</span>
          <select name="category" defaultValue={t.category ?? "Other"}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c === "Transfer" ? "Transfer (not spending)" : c}</option>)}
          </select>
        </label>
        <label className="chk">
          <input type="checkbox" name="always" />
          <span>Apply to every {title(t.merchant)} purchase{atMerchant > 1 ? ` (${atMerchant} so far, except ones you set by hand)` : ""}, and future ones</span>
        </label>
        <div className="sub">Whose was it? Tapping one saves.</div>
        <div className="choices" role="group" aria-label="Whose purchase">
          {SPLITS.slice().reverse().map((s) => (
            <button key={s} type="submit" name="share" value={s}
              className={`choice ${s === 100 ? "me" : s === 0 ? "her" : s === 50 ? "shared" : ""} ${t.shareMe === s && t.classificationSource ? "guess" : ""}`}>
              <span>{splitLabel(s, PEOPLE.me, PEOPLE.her).replace("Mostly ", "")}</span>
              <small>{s === 50 ? "50 / 50" : s === 75 || s === 25 ? "mostly" : "all"}</small>
            </button>
          ))}
        </div>
      </form>
    </>
  );
}

export default function TxPage({ params, searchParams }: PageProps<"/tx/[id]">) {
  return (
    <main className="dash">
      <Suspense fallback={<div className="empty">Loading…</div>}>
        <Edit params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
