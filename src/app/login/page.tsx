import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { authConfig, safeNext } from "@/lib/auth";
import "@/dashboard/dashboard.css";

const ERRORS: Record<string, string> = {
  notallowed: "That Google account isn't on the household list. Try the other account on this phone.",
  cancelled: "Sign-in was cancelled.",
  failed: "Sign-in didn't finish. Please try again.",
  config: "Sign-in isn't set up on this site yet.",
};

async function SignIn({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  await connection(); // reads env and the query string at request time
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const next = safeNext(params.next);
  const cfg = authConfig();
  if (cfg.open) {
    return <div className="empty">Google sign-in isn&apos;t configured, so the app is open in development. <Link href="/">Go to the ledger</Link>.</div>;
  }
  if (cfg.misconfigured) {
    return (
      <div className="empty">
        Sign-in isn&apos;t set up yet. The site needs <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,{" "}
        <code>AUTH_SECRET</code> and <code>ALLOWED_EMAILS</code>.
      </div>
    );
  }
  return (
    <div className="card">
      {/* A plain link, not <Link>: this has to leave the app for Google, and must not be prefetched. */}
      <a className="primary" href={`/auth/google${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>
        Sign in with Google
      </a>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="sub">Stays signed in on this phone for a year.</div>
    </div>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="dash login">
      <header className="head">
        <div className="eyebrow">Household ledger</div>
        <h1>Sign in</h1>
      </header>
      <Suspense fallback={null}>
        <SignIn searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
