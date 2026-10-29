/**
 * The Sunday digest: last week's spending against a typical week, the month so
 * far, what moved, the biggest purchases, new or pricier recurring charges, and
 * how many purchases wait for review. Built from a template; no Claude call.
 */
import { prisma } from "./db";
import { findRecurring } from "./recurring";
import { ONE_OFF_CATEGORIES } from "./categories";

const DAY = 86400_000;
const EXCLUDED = ["Transfer", "Income"];
// Cents for small amounts (a $15.49 subscription), whole dollars above $100.
const usd = (n: number) => {
  const a = Math.abs(n);
  return `${n < 0 ? "−" : ""}$${a === 0 ? "0" : a < 100 ? a.toFixed(2) : Math.round(a).toLocaleString("en-US")}`;
};
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export type Digest = {
  subject: string;
  headline: string;
  lines: { heading: string; items: string[] }[];
  reviewCount: number;
};

export async function buildDigest(now = new Date()): Promise<Digest> {
  const weekStart = new Date(now.getTime() - 7 * DAY);
  const history = new Date(now.getTime() - 400 * DAY);
  const rows = await prisma.transaction.findMany({
    where: { date: { gte: history, lt: now }, OR: [{ category: null }, { category: { notIn: EXCLUDED } }] },
    select: { merchant: true, date: true, amount: true, category: true, oneOff: true },
  });
  // Wedding spending is a one-off by nature.
  for (const t of rows) if (t.category && ONE_OFF_CATEGORIES.has(t.category)) t.oneOff = true;
  const reviewCount = await prisma.transaction.count({ where: { needsReview: true } });

  const inWeek = (d: Date, k: number) => d >= new Date(weekStart.getTime() - k * 7 * DAY) && d < new Date(now.getTime() - k * 7 * DAY);
  const week = rows.filter((t) => inWeek(t.date, 0));
  const weekTotal = week.reduce((s, t) => s + t.amount, 0);
  // A typical week: the eight before this one, one-offs left out.
  const prior = Array.from({ length: 8 }, (_, k) => rows.filter((t) => inWeek(t.date, k + 1) && !t.oneOff));
  const typical = prior.reduce((s, w) => s + w.reduce((a, t) => a + t.amount, 0), 0) / 8;
  const oneOffs = week.filter((t) => t.oneOff).reduce((s, t) => s + t.amount, 0);

  // Month so far, and its pace once the month is a third in.
  const pacific = now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const monthStart = new Date(`${pacific.slice(0, 7)}-01T00:00:00Z`);
  const monthRows = rows.filter((t) => t.date >= monthStart);
  const monthTotal = monthRows.reduce((s, t) => s + t.amount, 0);
  const elapsed = +pacific.slice(8, 10);
  const daysInMonth = new Date(Date.UTC(+pacific.slice(0, 4), +pacific.slice(5, 7), 0)).getUTCDate();
  const steadyMonth = monthTotal - monthRows.filter((t) => t.oneOff).reduce((s, t) => s + t.amount, 0);

  // What moved: this week's categories against their typical week.
  const byCat = (list: typeof rows) => {
    const m = new Map<string, number>();
    for (const t of list) m.set(t.category ?? "Other", (m.get(t.category ?? "Other") ?? 0) + t.amount);
    return m;
  };
  const thisWeekCats = byCat(week);
  const typicalCats = byCat(prior.flat());
  const moved = [...thisWeekCats.entries()]
    .map(([c, v]) => ({ c, v, usual: (typicalCats.get(c) ?? 0) / 8 }))
    .sort((a, b) => Math.abs(b.v - b.usual) - Math.abs(a.v - a.usual))
    .slice(0, 3)
    .map(({ c, v, usual }) => `${c}: ${usd(v)} (usually ${usd(usual)})`);

  const biggest = week.filter((t) => t.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 3)
    .map((t) => `${title(t.merchant)}: ${usd(t.amount)}${t.oneOff ? " (one-off)" : ""}`);

  const recurring = findRecurring(rows, now).filter((r) => !r.lapsed && r.lastDate >= weekStart && (r.isNew || r.priceUpFrom != null))
    .map((r) => r.priceUpFrom != null
      ? `${title(r.merchant)} went up to ${usd(r.lastAmount)} from ${usd(r.priceUpFrom)} (${r.cadence})`
      : `New: ${title(r.merchant)}, ${usd(r.amount)} ${r.cadence}, about ${usd(r.yearly)} a year`);

  const diff = weekTotal - typical;
  const headline = `You spent ${usd(weekTotal)} this week${oneOffs ? `, including ${usd(oneOffs)} one-off` : ""}. ` +
    (typical ? (Math.abs(diff) < typical * 0.1 ? "About a usual week." : `${usd(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than a usual week (${usd(typical)}).`) : "");
  const lines: Digest["lines"] = [
    {
      heading: "This month",
      items: [
        `${usd(monthTotal)} so far${monthTotal !== steadyMonth ? ` (${usd(monthTotal - steadyMonth)} of it one-off)` : ""}` +
          (elapsed >= 10 && elapsed < daysInMonth
            ? `; on pace for ${usd((steadyMonth / elapsed) * daysInMonth)}${monthTotal !== steadyMonth ? " not counting one-offs" : ""}.`
            : "."),
      ],
    },
  ];
  if (moved.length) lines.push({ heading: "What moved", items: moved });
  if (biggest.length) lines.push({ heading: "Biggest purchases", items: biggest });
  if (recurring.length) lines.push({ heading: "Recurring charges", items: recurring });
  return { subject: `Household ledger: ${usd(weekTotal)} this week`, headline, lines, reviewCount };
}

export function digestText(d: Digest, siteUrl: string): string {
  return [
    d.headline, "",
    ...d.lines.flatMap((l) => [l.heading, ...l.items.map((i) => `- ${i}`), ""]),
    d.reviewCount ? `${d.reviewCount} purchase${d.reviewCount === 1 ? "" : "s"} to review: ${siteUrl}/review` : `Nothing to review. ${siteUrl}`,
  ].join("\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function digestHtml(d: Digest, siteUrl: string): string {
  const p = "margin:0 0 12px;font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#111";
  return [
    `<p style="${p};font-size:17px"><strong>${esc(d.headline)}</strong></p>`,
    ...d.lines.map((l) => `<p style="${p}"><strong>${esc(l.heading)}</strong><br>${l.items.map(esc).join("<br>")}</p>`),
    `<p style="${p}"><a href="${esc(siteUrl)}${d.reviewCount ? "/review" : ""}" style="color:#111">${d.reviewCount ? `${d.reviewCount} to review →` : "Open the ledger →"}</a></p>`,
  ].join("\n");
}

/** Sends through Resend (macandjack.com is already a Resend sending domain). */
export async function sendDigest(to: string[], d: Digest, siteUrl: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set on the site");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.DIGEST_FROM || "Household Ledger <ledger@macandjack.com>",
      to, subject: d.subject, text: digestText(d, siteUrl), html: digestHtml(d, siteUrl),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const DIGEST_KEY = "digest-last-sent";

/** On Sunday mornings (Pacific), send the digest to the household once. */
export async function sendWeeklyDigestIfDue(siteUrl: string, to: string[], now = new Date()): Promise<string> {
  const weekday = now.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Los_Angeles" });
  if (weekday !== "Sun") return "not Sunday";
  if (!process.env.RESEND_API_KEY) return "no RESEND_API_KEY";
  if (!to.length) return "no recipients";
  const last = await prisma.appState.findUnique({ where: { key: DIGEST_KEY } });
  const lastAt = (last?.value as { at?: string } | undefined)?.at;
  if (lastAt && now.getTime() - new Date(lastAt).getTime() < 6 * DAY) return "already sent this week";
  await sendDigest(to, await buildDigest(now), siteUrl);
  await prisma.appState.upsert({ where: { key: DIGEST_KEY }, update: { value: { at: now.toISOString() } }, create: { key: DIGEST_KEY, value: { at: now.toISOString() } } });
  return "sent";
}
