import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { finishLinkAction, startLinkAction, syncNowAction } from "./actions";
import "@/dashboard/dashboard.css";

const when = (d: Date | null) =>
  d ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : "never";

function notice(p: Record<string, string | string[] | undefined>): { text: string; error?: boolean } | null {
  const n = (k: string) => Number(p[k] ?? 0);
  if (typeof p.error === "string") return { text: `Plaid said: ${p.error}. Try again, or check the Plaid keys on the site.`, error: true };
  if (p.linked !== undefined) {
    if (n("linked")) return { text: `Linked ${n("linked")} bank${n("linked") === 1 ? "" : "s"}. Tap Sync now to pull transactions.` };
    if (n("waiting")) return { text: "Plaid hasn't reported that bank login as finished yet. Finish it in Plaid, then tap Finish linking." };
    return { text: "Nothing to finish." };
  }
  if (p.synced !== undefined) return { text: `Pulled ${n("synced")} new transactions and sorted ${n("classified")}. Plaid can take a few minutes after linking to have history ready, so tap again if it's 0.` };
  return null;
}

async function Banks({ searchParams }: { searchParams: PageProps<"/banks">["searchParams"] }) {
  await connection();
  const params = await searchParams;
  const [items, pending] = await Promise.all([
    prisma.plaidItem.findMany({ include: { accounts: true }, orderBy: { createdAt: "asc" } }),
    prisma.plaidLinkSession.count({ where: { expiresAt: { gt: new Date() } } }),
  ]);
  const msg = notice(params);
  return (
    <>
      {msg ? <div className={msg.error ? "form-error card" : "card"}>{msg.text}</div> : null}
      {!env.hasPlaid ? (
        <div className="empty">Plaid isn&apos;t set up on this site: it needs <code>PLAID_CLIENT_ID</code> and <code>PLAID_SECRET</code>.</div>
      ) : (
        <>
          <section className="review">
            {items.length === 0 ? <div className="empty">No banks linked yet.</div> : null}
            {items.map((item) => (
              <div key={item.id} className="row">
                <span className="m">
                  {item.institution ?? "Bank"}
                  <div className="sub">{item.accounts.map((a) => `${a.name} ****${a.mask ?? ""}`).join(", ")}</div>
                </span>
                <span className="c">synced {when(item.lastSyncedAt)}</span>
              </div>
            ))}
          </section>
          <div className="card">
            <form action={startLinkAction}>
              <button type="submit" className="primary">Link a bank</button>
            </form>
            <div className="sub">Opens Plaid. Log into the bank there, and Plaid brings you back here when you&apos;re done. Each bank uses one of the plan&apos;s 10 links, so link each bank once.</div>
            {pending ? (
              <form action={finishLinkAction}>
                <button type="submit" className="primary">Finish linking ({pending} open)</button>
              </form>
            ) : null}
            {items.length ? (
              <form action={syncNowAction}>
                <button type="submit" className="primary">Sync now</button>
              </form>
            ) : null}
            <div className="sub">New transactions also sync by themselves every morning.</div>
          </div>
        </>
      )}
    </>
  );
}

export default function BanksPage({ searchParams }: PageProps<"/banks">) {
  return (
    <main className="dash">
      <header className="head">
        <div className="eyebrow">Household ledger</div>
        <h1>Banks</h1>
        <div className="sub"><Link href="/">Back to the ledger</Link></div>
      </header>
      <Suspense fallback={<div className="empty">Loading…</div>}>
        <Banks searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
