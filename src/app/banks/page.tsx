import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { getSortRun, isRunning } from "@/lib/background";
import { env } from "@/lib/env";
import { finishLinkAction, reconnectAction, startLinkAction, syncNowAction } from "./actions";
import { getSyncState } from "@/lib/sync";
import { hasInvestmentAccounts } from "@/lib/plaid-investments";
import { PendingButton } from "@/components/pending-button";
import { AccountEditor } from "./account-editor";
import { PEOPLE } from "@/config/household";
import "@/dashboard/dashboard.css";
import { isAdmin, requireSession } from "@/lib/session";

const when = (d: Date | null) =>
  d ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }) : "never";

function notice(p: Record<string, string | string[] | undefined>): { text: string; error?: boolean } | null {
  const n = (k: string) => Number(p[k] ?? 0);
  if (p.reconnected !== undefined) return { text: "Reconnected. Tap Sync now to catch up on that bank." };
  if (typeof p.error === "string") {
    const hint = p.error === "ITEM_LOGIN_REQUIRED" ? " The bank login expired: use Reconnect next to that bank." : p.error.startsWith("INVALID_API_KEYS") ? " Check the Plaid keys on the site." : " Try again in a minute.";
    return { text: `Plaid said: ${p.error}.${hint}`, error: true };
  }
  if (p.linked !== undefined) {
    if (n("linked")) return { text: `Linked ${n("linked")} bank${n("linked") === 1 ? "" : "s"}. Tap Sync now to pull transactions.` };
    if (n("waiting")) return { text: "Plaid hasn't reported that bank login as finished yet. Finish it in Plaid, then tap Finish linking." };
    return { text: "Nothing to finish." };
  }
  if (p.synced !== undefined) {
    const more = (p.more ? " More history is still coming: tap Sync now again." : "") + (n("failed") ? ` ${n("failed")} bank${n("failed") === 1 ? "" : "s"} failed; see below.` : "");
    const bg = n("waiting") ? (p.bg === "1" ? ` Claude is sorting the other ${n("waiting")} in the background; see below.` : ` ${n("waiting")} still need Claude and will be sorted shortly.`) : "";
    return { text: `Pulled ${n("synced")} new transactions and sorted ${n("sorted")} straight away.${bg}${more} Plaid can take a few minutes after linking to have history ready.` };
  }
  return null;
}

async function Banks({ searchParams }: { searchParams: PageProps<"/banks">["searchParams"] }) {
  await connection();
  await requireSession(); // the proxy also checks, but pages must not rely on it alone
  const params = await searchParams;
  const [items, pending, run, unsorted] = await Promise.all([
    prisma.plaidItem.findMany({ include: { accounts: true }, orderBy: { createdAt: "asc" } }),
    prisma.plaidLinkSession.count({ where: { expiresAt: { gt: new Date() } } }),
    getSortRun(),
    prisma.transaction.count({ where: { classificationSource: null } }),
  ]);
  const syncState = await getSyncState();
  const admin = await isAdmin();
  const msg = notice(params);
  return (
    <>
      {msg ? <div className={msg.error ? "form-error card" : "card"}>{msg.text}</div> : null}
      {run || unsorted ? (
        <div className="card">
          <div><strong>Sorting with Claude:</strong>{" "}
            {isRunning(run) ? `running since ${when(new Date(run!.startedAt))}.` : run?.finishedAt ? `last run finished ${when(new Date(run.finishedAt))}, sorted ${run.classified ?? 0}.` : "not run yet."}
            {" "}{unsorted ? `${unsorted} purchase${unsorted === 1 ? "" : "s"} still waiting.` : "Nothing waiting."}
          </div>
          {run?.lastError ? <div className="form-error">Last Claude error: {run.lastError}</div> : null}
          <div className="sub">Refresh this page to see progress. Waiting purchases already show their category on the dashboard; the split follows.</div>
        </div>
      ) : null}
      {!env.hasPlaid ? (
        <div className="empty">Plaid isn&apos;t set up on this site: it needs <code>PLAID_CLIENT_ID</code> and <code>PLAID_SECRET</code>.</div>
      ) : (
        <>
          {items.length ? <div className="sub">Give each card a name you recognize and say who carries it. Review shows both, and sorting uses the cardholder as a hint.</div> : null}
          <section className="review">
            {items.length === 0 ? <div className="empty">No banks linked yet.</div> : null}
            {items.map((item) => (
              <div key={item.id} className="bank">
                <div className="row">
                  <span className="m">{item.institution ?? "Bank"}</span>
                  <span className="c">synced {when(item.lastSyncedAt)}{admin ? <> · <Link href={`/banks/raw?item=${item.id}`} prefetch={false}>raw data</Link></> : null}</span>
                </div>
                {syncState[item.id]?.error ? (
                  <div className="row">
                    <span className="m plain form-error">
                      {syncState[item.id]!.error!.code === "ITEM_LOGIN_REQUIRED" || syncState[item.id]!.error!.code === "PENDING_EXPIRATION"
                        ? "The bank login expired."
                        : `Last sync failed: ${syncState[item.id]!.error!.code}`}
                    </span>
                    <form action={reconnectAction}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <PendingButton pendingText="Opening Plaid…" className="primary small">Reconnect</PendingButton>
                    </form>
                  </div>
                ) : null}
                {(() => {
                  const inv = syncState[item.id]?.investments;
                  // Retirement accounts (a 401(k)) are skipped, so only links with a cash or brokerage account get a status line.
                  if (!inv || !hasInvestmentAccounts(item.accounts)) return null;
                  if (inv.status === "ok") return <div className="row"><span className="m plain meta">Payments from investment accounts included.</span></div>;
                  if (inv.status === "consent") return (
                    <div className="row">
                      <span className="m plain">Payments from this bank&apos;s investment-type accounts (like a cash account that pays the mortgage) need one more permission.</span>
                      <form action={reconnectAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="investments" value="1" />
                        <PendingButton pendingText="Opening Plaid…" className="primary small">Allow</PendingButton>
                      </form>
                    </div>
                  );
                  if (inv.status === "not-enabled") return <div className="row"><span className="m plain form-error">Plaid hasn&apos;t enabled investment data for this app ({inv.code}), so payments from investment-type accounts can&apos;t be read. Turn on Investments under Products in the Plaid dashboard, then tap Sync now.</span></div>;
                  if (inv.status === "error") return <div className="row"><span className="m plain form-error">Couldn&apos;t read investment-type accounts: {inv.code}</span></div>;
                  return null;
                })()}
                {item.accounts.map((a) => (
                  <AccountEditor key={a.id} accountId={a.id} bankName={a.name} mask={a.mask}
                    nickname={a.nickname} cardholder={a.cardholder} me={PEOPLE.me} her={PEOPLE.her} />
                ))}
              </div>
            ))}
          </section>
          <div className="card">
            <form action={startLinkAction}>
              <PendingButton pendingText="Opening Plaid…">Link a bank</PendingButton>
            </form>
            <form action={startLinkAction}>
              <input type="hidden" name="investments" value="1" />
              <PendingButton pendingText="Opening Plaid…" className="primary small">Link an investment cash account</PendingButton>
            </form>
            <div className="sub">For a brokerage or cash management account that pays bills (like a Fidelity account paying the mortgage). Pick &quot;Fidelity Investments&quot;, not NetBenefits; 401(k)s are skipped.</div>
            <div className="sub">Opens Plaid. Log into the bank there, and Plaid brings you back here when you&apos;re done. Each bank uses one of the plan&apos;s 10 links, so link each bank once.</div>
            {pending ? (
              <form action={finishLinkAction}>
                <PendingButton pendingText="Finishing…">Finish linking ({pending} open)</PendingButton>
              </form>
            ) : null}
            {items.length ? (
              <form action={syncNowAction}>
                <PendingButton pendingText="Syncing… this can take up to 20 seconds">Sync now</PendingButton>
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
