import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { CATEGORIES, SPLITS, splitLabel } from "@/lib/categories";
import { MANUAL_SOURCE, activeRecurring, recentManualExpenses } from "@/lib/manual";
import { PEOPLE } from "@/config/household";
import { deleteExpenseAction, saveExpenseAction, stopRecurringAction } from "./actions";
import "@/dashboard/dashboard.css";
import { requireSession } from "@/lib/session";

const TZ = "America/Los_Angeles";
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const ERRORS: Record<string, string> = {
  amount: "Enter an amount above $0.",
  description: "Add a short description.",
  date: "Pick a date that isn't in the future.",
  category: "Pick a category.",
  split: "Tap one of the split buttons to save.",
};
const SAVED: Record<string, string> = {
  added: "Expense added.", updated: "Expense updated.", deleted: "Expense deleted.",
  repeating: "Added. It repeats every month on that day; any past months since that date were filled in too.",
  stopped: "Stopped. Months already added stay.",
};
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

async function Expenses({ searchParams }: { searchParams: PageProps<"/expenses">["searchParams"] }) {
  await connection();
  await requireSession(); // the proxy also checks, but pages must not rely on it alone
  const p = await searchParams;
  const editId = typeof p.edit === "string" ? p.edit : "";
  const [editing, recent, repeating] = await Promise.all([
    editId ? prisma.transaction.findFirst({ where: { id: editId, source: MANUAL_SOURCE } }) : null,
    recentManualExpenses(),
    activeRecurring(),
  ]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
  const error = typeof p.error === "string" ? ERRORS[p.error] : undefined;
  const saved = typeof p.saved === "string" ? SAVED[p.saved] : undefined;

  return (
    <>
      {saved ? <div className="card">{saved}</div> : null}
      <form action={saveExpenseAction} className="card" key={editing?.id ?? "new"}>
        {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
        <label className="field">
          <span>Amount</span>
          <input name="amount" inputMode="decimal" placeholder="0.00" required autoFocus={!editing}
            defaultValue={editing ? editing.amount.toFixed(2) : undefined} />
        </label>
        <label className="field">
          <span>What was it?</span>
          <input name="description" maxLength={80} placeholder="Farmers market, haircut tip…" required
            defaultValue={editing?.rawName} />
        </label>
        <div className="card-foot">
          <label className="sel">
            <span>Date</span>
            <input type="date" name="date" max={today} defaultValue={editing ? editing.date.toISOString().slice(0, 10) : today} required />
          </label>
          <label className="sel">
            <span>Category</span>
            <select name="category" defaultValue={editing?.category ?? "Groceries"}>
              {CATEGORIES.filter((c) => c !== "Income" && c !== "Transfer").map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        {editing ? null : (
          <label className="chk">
            <input type="checkbox" name="repeat" value="1" />
            <span>Repeats monthly on this day (a mortgage, rent). Pick the first payment&apos;s date to fill in past months too.</span>
          </label>
        )}
        <div className="sub">Whose was it? Tapping one saves.</div>
        <div className="choices" role="group" aria-label="Whose expense">
          {SPLITS.slice().reverse().map((s) => (
            <button key={s} type="submit" name="share" value={s}
              className={`choice ${s === 100 ? "me" : s === 0 ? "her" : s === 50 ? "shared" : ""} ${editing?.shareMe === s ? "guess" : ""}`}>
              <span>{splitLabel(s, PEOPLE.me, PEOPLE.her).replace("Mostly ", "")}</span>
              <small>{s === 50 ? "50 / 50" : s === 75 || s === 25 ? "mostly" : "all"}</small>
            </button>
          ))}
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        {editing ? <Link href="/expenses" className="sub">Cancel editing</Link> : null}
      </form>

      {repeating.length ? (
        <section>
          <div className="sec-head"><h2>Repeats monthly</h2></div>
          <div className="review">
            {repeating.map((r) => (
              <form key={r.id} action={stopRecurringAction} className="row">
                <input type="hidden" name="id" value={r.id} />
                <span className="m">{r.description} <span className="meta">· the {ordinal(r.dayOfMonth)} · {splitLabel(r.shareMe, PEOPLE.me, PEOPLE.her)} · {r.category}</span></span>
                <span className="c num">{usd(r.amount)} <button type="submit" className="linkish">Stop</button></span>
              </form>
            ))}
          </div>
          <div className="sub">To change the amount, stop it and add it again from the next payment&apos;s date.</div>
        </section>
      ) : null}

      <section>
        <div className="sec-head"><h2>Entered by hand</h2></div>
        {recent.length === 0 ? <div className="empty">Nothing entered yet. Cash purchases and anything paid outside your linked accounts go here.</div> : (
          <div className="review">
            {recent.map((t) => (
              <form key={t.id} action={deleteExpenseAction} className="row">
                <input type="hidden" name="id" value={t.id} />
                <span className="m">{t.rawName} <span className="meta">· {day(t.date)} · {splitLabel(t.shareMe ?? 50, PEOPLE.me, PEOPLE.her)} · {t.category}</span></span>
                <span className="c num">
                  {usd(t.amount)} <Link href={`/expenses?edit=${t.id}`} className="linkish">Edit</Link>{" "}
                  <button type="submit" className="linkish">Delete</button>
                </span>
              </form>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  return (
    <main className="dash">
      <header className="head">
        <div className="eyebrow">Household ledger</div>
        <h1>Add an expense</h1>
        <div className="sub"><Link href="/">Back to the ledger</Link></div>
      </header>
      <Suspense fallback={<div className="empty">Loading…</div>}>
        <Expenses searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
