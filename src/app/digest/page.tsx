import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { publicOrigin, requireSession } from "@/lib/session";
import { buildDigest, digestHtml } from "@/lib/digest";
import { PendingButton } from "@/components/pending-button";
import { sendTestDigestAction } from "./actions";
import "@/dashboard/dashboard.css";

async function Preview({ searchParams }: { searchParams: PageProps<"/digest">["searchParams"] }) {
  await connection();
  await requireSession();
  const p = await searchParams;
  const d = await buildDigest();
  const configured = Boolean(process.env.RESEND_API_KEY);
  return (
    <>
      {p.sent === "1" ? <div className="card">Sent. Check your inbox (and spam, the first time).</div> : null}
      {typeof p.error === "string" ? <div className="card form-error">Couldn&apos;t send: {p.error}</div> : null}
      {/* The exact email, sandboxed: no scripts, links open in a new tab. */}
      <iframe title="This week's digest" className="digest-frame" sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={`<base target="_blank">${digestHtml(d, await publicOrigin())}`} />
      <div className="card">
        <div className="sub">
          {configured
            ? "This goes to both of you every Sunday morning. The opening is written fresh by Claude each time."
            : "Weekly emails are off until a RESEND_API_KEY is added to the site's environment variables."}
        </div>
        {configured ? (
          <form action={sendTestDigestAction}>
            <PendingButton pendingText="Sending…">Email me a test</PendingButton>
          </form>
        ) : null}
      </div>
    </>
  );
}

export default function DigestPage({ searchParams }: PageProps<"/digest">) {
  return (
    <main className="dash">
      <header className="head">
        <div className="eyebrow">Household ledger</div>
        <h1>Weekly digest</h1>
        <div className="sub"><Link href="/">Back to the ledger</Link></div>
      </header>
      <Suspense fallback={<div className="empty">Loading…</div>}>
        <Preview searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
