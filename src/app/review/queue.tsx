"use client";

import { useOptimistic, useState } from "react";
import Link from "next/link";
import { decideAction } from "./actions";

export type ReviewItem = {
  id: string;
  merchant: string;
  /** Already formatted, e.g. "Oct 26". */
  day: string;
  /** Card name and last four, e.g. "Sapphire ****1234". */
  account: string;
  /** "Kyle's card", "Joint card", "Cardholder not set", or null for hand-entered expenses. */
  cardholder: string | null;
  /** Who the bank says made the purchase, when it reports it. */
  swipedBy: string | null;
  note: string | null;
  amount: number;
  shareMe: number | null;
  category: string | null;
};

const usd = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * The review queue. A decision hides its card at once (and every card at the
 * merchant when "always" is ticked) while the save runs in the background, so
 * cards can be decided back to back without waiting on the server. If a save
 * fails, the optimistic hide is dropped and the card comes back.
 */
export function ReviewQueue(props: {
  items: ReviewItem[];
  total: number;
  categories: readonly string[];
  splits: Array<{ value: number; label: string; sub: string; tone: string }>;
}) {
  const { items, total, categories, splits } = props;
  const [gone, hide] = useOptimistic<string[], string[]>([], (state, ids) => [...state, ...ids]);
  const [error, setError] = useState<string | null>(null);

  const visible = items.filter((t) => !gone.includes(t.id));
  const waiting = Math.max(0, total - (items.length - visible.length));
  const merchantCounts = new Map<string, number>();
  for (const t of visible) merchantCounts.set(t.merchant, (merchantCounts.get(t.merchant) ?? 0) + 1);

  async function decide(t: ReviewItem, formData: FormData) {
    const always = formData.get("always") === "on";
    hide(always ? items.filter((i) => i.merchant === t.merchant).map((i) => i.id) : [t.id]);
    setError(null);
    try {
      await decideAction(formData);
    } catch (e) {
      console.error(e);
      setError(`Couldn't save ${title(t.merchant)}. It's back in the list; try again.`);
    }
  }

  return (
    <>
      <header className="head">
        <div className="eyebrow">Household ledger</div>
        <h1>Review</h1>
        <div className="sub">
          {waiting === 0 ? "Nothing waiting. " : `${waiting} purchase${waiting === 1 ? "" : "s"} waiting for a split. `}
          <Link href="/">Back to the ledger</Link>
        </div>
      </header>
      {error ? <div className="form-error card">{error}</div> : null}

      {visible.length === 0 ? (
        <div className="empty">{waiting > 0 ? "Loading more…" : "All caught up."}</div>
      ) : (
        <section className="queue">
          {visible.map((t) => {
            const others = (merchantCounts.get(t.merchant) ?? 1) - 1;
            return (
              <form key={t.id} action={(fd) => decide(t, fd)} className="card">
                <input type="hidden" name="id" value={t.id} />
                <div className="card-top">
                  <div className="card-merchant">
                    <div className="m">{title(t.merchant)}</div>
                    <div className="meta">
                      {t.day} · {t.account}
                      {t.cardholder ? ` · ${t.cardholder}` : ""}
                      {t.swipedBy ? ` · bank says ${t.swipedBy}` : ""}
                      {t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                  <div className="amt num">{usd(t.amount)}</div>
                </div>
                <div className="choices" role="group" aria-label="Whose purchase">
                  {splits.map((s) => (
                    <button key={s.value} type="submit" name="share" value={s.value}
                      className={`choice ${s.tone} ${t.shareMe === s.value ? "guess" : ""}`}
                      title={t.shareMe === s.value ? "Current guess" : undefined}>
                      <span>{s.label}</span>
                      <small>{s.sub}</small>
                    </button>
                  ))}
                </div>
                <div className="card-foot">
                  <label className="sel">
                    <span>Category</span>
                    <select name="category" defaultValue={t.category ?? "Other"}>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="chk">
                    <input type="checkbox" name="always" />
                    <span>Always for {title(t.merchant)}{others ? ` (+${others} waiting)` : ""}</span>
                  </label>
                </div>
              </form>
            );
          })}
          {waiting > visible.length ? <div className="sub">Showing the newest {visible.length} of {waiting}.</div> : null}
        </section>
      )}
    </>
  );
}
