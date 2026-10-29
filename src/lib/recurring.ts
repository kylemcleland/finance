/**
 * Find subscriptions and other recurring charges in the transaction history:
 * a merchant that charges on a steady rhythm (weekly to yearly) at a steady
 * amount. Plain code, no Claude; computed when someone looks.
 */
export type Charge = { merchant: string; date: Date; amount: number; category: string | null };

export type Recurring = {
  merchant: string;
  category: string | null;
  cadence: "weekly" | "every 2 weeks" | "monthly" | "quarterly" | "yearly";
  /** Typical charge (median). */
  amount: number;
  lastAmount: number;
  lastDate: Date;
  nextDate: Date;
  count: number;
  monthly: number;
  yearly: number;
  /** First seen within the last 75 days. */
  isNew: boolean;
  /** The latest charge is more than 5% above the typical one before it. */
  priceUpFrom: number | null;
  /** No charge for 1.6 intervals: probably cancelled. */
  lapsed: boolean;
};

const CADENCES = [
  { name: "weekly", days: 7, min: 5, max: 9, minCount: 4 },
  { name: "every 2 weeks", days: 14, min: 12, max: 17, minCount: 3 },
  { name: "monthly", days: 30.44, min: 26, max: 35, minCount: 3 },
  { name: "quarterly", days: 91, min: 80, max: 100, minCount: 2 },
  { name: "yearly", days: 365, min: 340, max: 390, minCount: 2 },
] as const;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const DAY = 86400_000;

export function findRecurring(charges: Charge[], now = new Date()): Recurring[] {
  const byMerchant = new Map<string, Charge[]>();
  for (const c of charges) {
    if (c.amount <= 0) continue;
    const list = byMerchant.get(c.merchant) ?? [];
    list.push(c);
    byMerchant.set(c.merchant, list);
  }
  const out: Recurring[] = [];
  for (const [merchant, list] of byMerchant) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    // Two charges on the same day (a split order) count as one.
    const days: Charge[] = [];
    for (const c of list) {
      const prev = days.at(-1);
      if (prev && Math.abs(c.date.getTime() - prev.date.getTime()) < DAY) prev.amount += c.amount;
      else days.push({ ...c });
    }
    if (days.length < 2) continue;
    const gaps = days.slice(1).map((c, i) => (c.date.getTime() - days[i].date.getTime()) / DAY);
    const gap = median(gaps);
    const cadence = CADENCES.find((c) => gap >= c.min && gap <= c.max);
    if (!cadence || days.length < cadence.minCount) continue;
    // Regular rhythm: most gaps near the median.
    const regular = gaps.filter((g) => Math.abs(g - gap) <= Math.max(3, gap * 0.35)).length / gaps.length;
    if (regular < 0.7) continue;
    // Steady amount: most charges within 20% of the median (a price rise is allowed).
    const amounts = days.map((c) => c.amount);
    const typical = median(amounts);
    const steady = amounts.filter((a) => Math.abs(a - typical) <= Math.max(1, typical * 0.2)).length / amounts.length;
    if (steady < 0.7) continue;

    const last = days.at(-1)!;
    const before = median(amounts.slice(0, -1));
    const priceUp = last.amount > before * 1.05 + 0.5;
    // Cost at today's price: after a price rise, the latest charge is what it costs now.
    const monthly = ((priceUp ? last.amount : typical) * 30.44) / cadence.days;
    out.push({
      merchant,
      category: last.category,
      cadence: cadence.name,
      amount: typical,
      lastAmount: last.amount,
      lastDate: last.date,
      nextDate: new Date(last.date.getTime() + cadence.days * DAY),
      count: days.length,
      monthly,
      yearly: monthly * 12,
      isNew: now.getTime() - days[0].date.getTime() < 75 * DAY,
      priceUpFrom: priceUp ? before : null,
      lapsed: now.getTime() - last.date.getTime() > cadence.days * 1.6 * DAY,
    });
  }
  return out.sort((a, b) => Number(a.lapsed) - Number(b.lapsed) || b.yearly - a.yearly);
}
