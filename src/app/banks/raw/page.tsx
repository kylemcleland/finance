import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin, requireSession } from "@/lib/session";
import { inspectItem } from "@/lib/plaid-inspect";
import "@/dashboard/dashboard.css";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** What Plaid returns for one link right now, read fresh and saved nowhere. */
async function Raw({ searchParams }: { searchParams: PageProps<"/banks/raw">["searchParams"] }) {
  await connection();
  await requireSession();
  if (!(await isAdmin())) notFound();
  const id = (await searchParams).item;
  const item = typeof id === "string" ? await prisma.plaidItem.findUnique({ where: { id } }) : null;
  if (!item) return <div className="empty">No such bank link.</div>;
  const r = await inspectItem(item.accessToken);
  return (
    <>
      <div className="card">
        <div className="sub">
          Bank feed: {r.bank.error ? <span className="form-error">error {r.bank.error}</span>
            : `${r.bank.status ?? "no status"}, ${r.bank.pages} page${r.bank.pages === 1 ? "" : "s"}${r.bank.complete ? "" : " (stopped early)"}`}
        </div>
        <div className="sub">
          Investment feed: {r.investments.error ? <span className="form-error">error {r.investments.error}</span> : `${r.investments.total} transactions in two years`}
        </div>
      </div>
      <section className="review">
        {r.accounts.map((a) => (
          <div key={a.plaidAccountId} className="bank">
            <div className="row">
              <span className="m plain">{a.name} ****{a.mask ?? ""}</span>
              <span className="c">{a.type}{a.subtype ? ` / ${a.subtype}` : ""}{a.balance != null ? ` · ${usd(a.balance)}` : ""}</span>
            </div>
            <div className="row"><span className="m plain meta">
              Bank feed: {a.bank.count} · Investment feed: {a.investments.count}
              {Object.keys(a.investments.kinds).length ? ` (${Object.entries(a.investments.kinds).map(([k, n]) => `${k} ×${n}`).join(", ")})` : ""}
            </span></div>
            {[...a.bank.latest.map((s) => ({ ...s, feed: "bank" })), ...a.investments.latest.map((s) => ({ ...s, feed: "inv" }))]
              .sort((x, y) => y.date.localeCompare(x.date))
              .map((s, i) => (
                <div key={i} className="row">
                  <span className="m plain">{s.date} · {s.name}<br /><span className="meta">{s.feed}: {s.label || "no label"}</span></span>
                  <span className="c">{usd(s.amount)}</span>
                </div>
              ))}
          </div>
        ))}
      </section>
    </>
  );
}

export default function RawPage({ searchParams }: PageProps<"/banks/raw">) {
  return (
    <main className="dash">
      <header className="head">
        <div className="eyebrow">Household ledger</div>
        <h1>Plaid raw data</h1>
        <div className="sub">
          Exactly what Plaid sends for this link right now, newest 15 per feed per account. Nothing here is saved. <Link href="/banks">Back to banks</Link>
        </div>
      </header>
      <Suspense fallback={<div className="empty">Asking Plaid… this can take up to 20 seconds.</div>}>
        <Raw searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
