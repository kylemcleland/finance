import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { authConfig } from "@/lib/auth";
import { loginAction } from "./actions";
import "@/dashboard/dashboard.css";

async function LoginForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  await connection(); // reads env and the query string at request time
  const params = await searchParams;
  const error = params.error === "1";
  const next = typeof params.next === "string" ? params.next : "/";
  const cfg = authConfig();
  return (
    <>
      {cfg.misconfigured ? (
        <div className="empty">No password is set. Add an <code>APP_PASSWORD</code> environment variable to the site and redeploy.</div>
      ) : cfg.open ? (
        <div className="empty">No password configured, so the app is open in development. <Link href="/">Go to the ledger</Link>.</div>
      ) : (
        <form action={loginAction} className="card">
          <input type="hidden" name="next" value={next} />
          <label className="field">
            <span>Household password</span>
            <input id="password" name="password" type="password" autoComplete="current-password" autoFocus required />
          </label>
          {error ? <div className="form-error">That password did not match.</div> : null}
          <button type="submit" className="primary">Open the ledger</button>
          <div className="sub">Stays signed in on this phone for a year.</div>
        </form>
      )}
    </>
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
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
