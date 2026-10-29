/**
 * The Sunday digest. Plain code computes the facts (how the week ranks, what
 * stood out, new places, streaks, what's coming up, where the month is
 * heading, the year so far), and Claude writes a short opening from them.
 * If Claude isn't available the opening falls back to a plain sentence.
 */
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { findRecurring } from "./recurring";
import { ONE_OFF_CATEGORIES } from "./categories";
import { env } from "./env";
import { PEOPLE } from "@/config/household";

const DAY = 86400_000;
const EXCLUDED = ["Transfer", "Income"];
// Cents for small amounts (a $15.49 subscription), whole dollars above $100.
const usd = (n: number) => {
  const a = Math.abs(n);
  return `${n < 0 ? "−" : ""}$${a === 0 ? "0" : a < 100 ? a.toFixed(2) : Math.round(a).toLocaleString("en-US")}`;
};
/** Whole dollars, for totals and averages. */
const usd0 = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const monthName = (d: Date) => d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export type DigestItem = { text: string; href?: string };
export type Digest = {
  subject: string;
  /** Claude's opening, or a plain sentence if Claude isn't available. */
  intro: string;
  /** The facts the opening was written from (also the plain fallback). */
  facts: string[];
  /** This week against a usual week, by category. */
  bars: { category: string; week: number; usual: number }[];
  /** Spending per week for the last 12 weeks, oldest first (one-offs left out). */
  weeks: { start: Date; total: number }[];
  /** Where a month's money went, biggest categories first. */
  month: { label: string; parts: { category: string; amount: number }[] } | null;
  sections: { heading: string; items: DigestItem[] }[];
  review: { count: number; items: DigestItem[] };
};

type Row = { id: string; merchant: string; date: Date; amount: number; category: string | null; oneOff: boolean };

/** Everything except the opening; no Claude call. */
export async function buildDigestFacts(now = new Date()): Promise<Digest> {
  const since = new Date(now.getTime() - 400 * DAY);
  const raw = await prisma.transaction.findMany({
    where: { date: { gte: since, lt: now }, OR: [{ category: null }, { category: { notIn: EXCLUDED } }] },
    select: { id: true, merchant: true, date: true, amount: true, category: true, oneOff: true },
  });
  // Wedding spending is a one-off by nature.
  const rows: Row[] = raw.map((t) => ({ ...t, oneOff: t.oneOff || (t.category != null && ONE_OFF_CATEGORIES.has(t.category)) }));
  const weekOf = (d: Date) => Math.floor((now.getTime() - d.getTime()) / (7 * DAY)); // 0 = the last 7 days
  const WEEKS = 52;
  const steadyWeek = Array.from({ length: WEEKS }, () => 0);
  const catWeek = new Map<string, number[]>();
  for (const t of rows) {
    const k = weekOf(t.date);
    if (k >= WEEKS || t.oneOff) continue;
    steadyWeek[k] += t.amount;
    const c = t.category ?? "Other";
    const arr = catWeek.get(c) ?? Array.from({ length: WEEKS }, () => 0);
    arr[k] += t.amount;
    catWeek.set(c, arr);
  }
  const week = rows.filter((t) => weekOf(t.date) === 0);
  const weekTotal = week.reduce((s, t) => s + t.amount, 0);
  const oneOffs = week.filter((t) => t.oneOff).reduce((s, t) => s + t.amount, 0);
  const usual = steadyWeek.slice(1, 9).reduce((a, b) => a + b, 0) / 8;
  const facts: string[] = [];
  const sections: Digest["sections"] = [];

  // How the week ranks against recent weeks (one-offs left out).
  const thisWeek = steadyWeek[0];
  let rank = "";
  const weeksWithData = steadyWeek.findLastIndex((v) => v !== 0);
  for (const dir of ["biggest", "quietest"] as const) {
    let k = 1;
    while (k <= weeksWithData && (dir === "biggest" ? steadyWeek[k] < thisWeek : steadyWeek[k] > thisWeek)) k++;
    if (k > 6) {
      rank = k > weeksWithData && weeksWithData >= 40 ? `${dir} week in a year` : `${dir} week since ${shortDate(new Date(now.getTime() - 7 * k * DAY))}`;
      break;
    }
  }
  facts.push(`Spent ${usd0(weekTotal)} in the last 7 days${oneOffs ? ` (${usd0(oneOffs)} of it one-off)` : ""}; a usual week is ${usd0(usual)}.${rank ? ` Leaving one-offs aside, it was their ${rank}.` : ""}`);

  // This week against usual, by category.
  const bars = [...catWeek.entries()]
    .map(([category, w]) => ({ category, week: w[0], usual: w.slice(1, 9).reduce((a, b) => a + b, 0) / 8 }))
    .filter((b) => b.week > 1 || b.usual > 1)
    .sort((a, b) => Math.max(b.week, b.usual) - Math.max(a.week, a.usual))
    .slice(0, 6);
  for (const b of bars.slice(0, 3)) facts.push(`${b.category}: ${usd0(b.week)} this week vs ${usd0(b.usual)} usually.`);

  // What stood out: regulars, new places, streaks.
  const stood: DigestItem[] = [];
  const visits = new Map<string, { n: number; total: number }>();
  for (const t of week) if (t.amount > 0) { const v = visits.get(t.merchant) ?? { n: 0, total: 0 }; v.n++; v.total += t.amount; visits.set(t.merchant, v); }
  for (const [m, v] of [...visits.entries()].filter(([, v]) => v.n >= 3).sort((a, b) => b[1].n - a[1].n).slice(0, 2)) {
    stood.push({ text: `${title(m)} ${v.n} times (${usd0(v.total)})` });
    facts.push(`Went to ${title(m)} ${v.n} times this week (${usd(v.total)}).`);
  }
  const firstSeen = new Map<string, number>();
  for (const t of rows) firstSeen.set(t.merchant, Math.min(firstSeen.get(t.merchant) ?? Infinity, t.date.getTime()));
  const fresh = [...new Set(week.filter((t) => t.amount > 0 && (firstSeen.get(t.merchant) ?? 0) >= now.getTime() - 7 * DAY).map((t) => t.merchant))].slice(0, 4);
  if (fresh.length) {
    stood.push({ text: `New places: ${fresh.map(title).join(", ")}` });
    facts.push(`Tried somewhere new: ${fresh.map(title).join(", ")}.`);
  }
  for (const [c, w] of catWeek) {
    const avg = w.slice(1, 13).reduce((a, b) => a + b, 0) / 12;
    let k = 0;
    while (k < 8 && w[k] > Math.max(20, avg * 1.2)) k++;
    if (k >= 3) {
      stood.push({ text: `${c} has run above usual ${k} weeks in a row` });
      facts.push(`${c} has been above usual for ${k} weeks straight.`);
    }
  }
  if (stood.length) sections.push({ heading: "What stood out", items: stood });

  // Biggest purchases.
  const biggest = week.filter((t) => t.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 3);
  if (biggest.length) {
    sections.push({ heading: "Biggest purchases", items: biggest.map((t) => ({ text: `${title(t.merchant)}: ${usd(t.amount)}${t.oneOff ? " (one-off)" : ""}`, href: `/tx/${t.id}` })) });
    facts.push(`Biggest purchase: ${title(biggest[0].merchant)} ${usd(biggest[0].amount)}.`);
  }

  // Coming up, and recurring changes.
  const recurring = findRecurring(rows, now).filter((r) => !r.lapsed);
  const soon = recurring.filter((r) => r.nextDate.getTime() > now.getTime() && r.nextDate.getTime() <= now.getTime() + 7 * DAY)
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime()).slice(0, 5);
  const changed = recurring.filter((r) => r.lastDate.getTime() >= now.getTime() - 7 * DAY && (r.isNew || r.priceUpFrom != null));
  const upcoming: DigestItem[] = [
    ...changed.map((r) => ({ text: r.priceUpFrom != null ? `${title(r.merchant)} went up to ${usd(r.lastAmount)} from ${usd(r.priceUpFrom)}` : `New: ${title(r.merchant)}, ${usd(r.amount)} ${r.cadence} (about ${usd(r.yearly)} a year)`, href: "/recurring" })),
    ...soon.map((r) => ({ text: `${title(r.merchant)} ${usd(r.lastAmount)} around ${shortDate(r.nextDate)}`, href: "/recurring" })),
  ];
  if (upcoming.length) sections.push({ heading: "Recurring", items: upcoming });
  for (const r of changed) facts.push(r.priceUpFrom != null ? `${title(r.merchant)} raised its price to ${usd(r.lastAmount)}.` : `New recurring charge: ${title(r.merchant)} ${usd(r.amount)} ${r.cadence}.`);

  // Where the month is heading, and what's driving it.
  const pacific = now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const monthStart = new Date(`${pacific.slice(0, 7)}-01T00:00:00Z`);
  const lastMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1));
  const elapsed = +pacific.slice(8, 10);
  const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
  const byCatIn = (from: Date, to: Date) => {
    const m = new Map<string, number>();
    for (const t of rows) if (!t.oneOff && t.date >= from && t.date < to) m.set(t.category ?? "Other", (m.get(t.category ?? "Other") ?? 0) + t.amount);
    return m;
  };
  const thisMonthCats = byCatIn(monthStart, now);
  const lastMonthCats = byCatIn(lastMonthStart, monthStart);
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const monthItems: DigestItem[] = [];
  if (elapsed >= 10 && elapsed < daysInMonth) {
    const scale = daysInMonth / elapsed;
    const projected = sum(thisMonthCats) * scale;
    const lastMonth = sum(lastMonthCats);
    const drivers = [...new Set([...thisMonthCats.keys(), ...lastMonthCats.keys()])]
      .map((c) => ({ c, d: (thisMonthCats.get(c) ?? 0) * scale - (lastMonthCats.get(c) ?? 0) }))
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const diff = projected - lastMonth;
    const line = `${monthName(monthStart)} is heading for about ${usd0(projected)}, ${usd0(Math.abs(diff))} ${diff >= 0 ? "above" : "below"} ${monthName(lastMonthStart)}` +
      (drivers[0] && Math.abs(drivers[0].d) > 50 ? `, mostly ${drivers[0].c} (${drivers[0].d >= 0 ? "+" : "−"}${usd0(Math.abs(drivers[0].d))})` : "") + ".";
    monthItems.push({ text: line });
    facts.push(line);
  } else if (elapsed < 10) {
    // Early in a month there's no pace yet; say how last month finished instead.
    const prevStart = new Date(Date.UTC(lastMonthStart.getUTCFullYear(), lastMonthStart.getUTCMonth() - 1, 1));
    const last = sum(lastMonthCats), prev = sum(byCatIn(prevStart, lastMonthStart));
    const lastOneOff = rows.filter((t) => t.oneOff && t.date >= lastMonthStart && t.date < monthStart).reduce((a, t) => a + t.amount, 0);
    if (last > 0 && prev > 0) {
      const line = `${monthName(lastMonthStart)} finished at ${usd0(last)}${lastOneOff ? ` plus ${usd0(lastOneOff)} one-off` : ""}, ${usd0(Math.abs(last - prev))} ${last >= prev ? "more" : "less"} than ${monthName(prevStart)}${lastOneOff ? " leaving one-offs aside" : ""}.`;
      monthItems.push({ text: line });
      facts.push(line);
    }
  } else {
    monthItems.push({ text: `${monthName(monthStart)} so far: ${usd0(sum(thisMonthCats))}.` });
  }

  // The year so far against the same point last year, if there is history.
  const yStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const lyStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
  const lyNow = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()));
  const spendWhere = (from: Date, to: Date) => ({ date: { gte: from, lt: to }, OR: [{ category: null }, { category: { notIn: [...EXCLUDED, ...ONE_OFF_CATEGORIES] } }], oneOff: false });
  const [ytd, lytd, earliest] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { amount: true }, where: spendWhere(yStart, now) }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: spendWhere(lyStart, lyNow) }),
    prisma.transaction.aggregate({ _min: { date: true } }),
  ]);
  if (earliest._min.date && earliest._min.date <= new Date(lyStart.getTime() + 15 * DAY) && (lytd._sum.amount ?? 0) > 0) {
    const a = ytd._sum.amount ?? 0, b = lytd._sum.amount!;
    const pct = Math.round(((a - b) / b) * 100);
    const line = `Year to date: ${usd0(a)}, ${Math.abs(pct)}% ${pct >= 0 ? "more" : "less"} than by this point last year.`;
    monthItems.push({ text: line });
    facts.push(line);
  }
  sections.unshift({ heading: "The month", items: monthItems });

  // Waiting for review: the biggest few, linked.
  const [reviewCount, waiting] = await Promise.all([
    prisma.transaction.count({ where: { needsReview: true } }),
    prisma.transaction.findMany({ where: { needsReview: true }, orderBy: { amount: "desc" }, take: 3, select: { id: true, merchant: true, amount: true } }),
  ]);
  if (reviewCount) facts.push(`${reviewCount} purchases are waiting for them to decide whose they were.`);

  const weeks = Array.from({ length: 12 }, (_, i) => 11 - i).map((k) => ({ start: new Date(now.getTime() - 7 * (k + 1) * DAY), total: steadyWeek[k] }));
  // Where the money went: last month early on, this month once it's a third in.
  const splitFrom = elapsed < 10 ? lastMonthStart : monthStart;
  const splitTo = elapsed < 10 ? monthStart : now;
  const splitCats = new Map<string, number>();
  for (const t of rows) if (t.date >= splitFrom && t.date < splitTo && t.amount !== 0) splitCats.set(t.category ?? "Other", (splitCats.get(t.category ?? "Other") ?? 0) + t.amount);
  const ranked = [...splitCats.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, 5).map(([category, amount]) => ({ category, amount }));
  const rest = ranked.slice(5).reduce((a, [, v]) => a + v, 0);
  if (rest > 0) top.push({ category: "Everything else", amount: rest });
  const month = top.length ? { label: `${monthName(splitFrom)}${elapsed < 10 ? "" : " so far"}`, parts: top } : null;

  const subject = `${usd0(weekTotal)} this week${rank ? ` · ${rank}` : ""}`;
  return {
    subject: `Household ledger: ${subject}`,
    intro: facts[0],
    facts,
    bars,
    weeks,
    month,
    sections,
    review: { count: reviewCount, items: waiting.map((t) => ({ text: `${title(t.merchant)} ${usd(t.amount)}`, href: `/tx/${t.id}?back=%2Freview` })) },
  };
}

let claude: Anthropic | undefined;

/** Claude writes a short, friendly opening from the facts; about half a cent. */
async function writeIntro(facts: string[]): Promise<string | null> {
  if (!env.hasAnthropic) return null;
  claude ??= new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const res = await claude.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 600,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: `You write the opening of ${PEOPLE.me} and ${PEOPLE.her}'s Sunday email about their household spending. Two or three short sentences, warm and lightly playful, like a friend who is good with money. Pick the one or two most interesting facts; use only the facts given and their exact numbers. No advice, no judgement, no greeting, no sign-off, no emoji. Plain text.`,
    messages: [{ role: "user", content: facts.join("\n") }],
  });
  if (res.stop_reason === "refusal") return null;
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  return text || null;
}

export async function buildDigest(now = new Date()): Promise<Digest> {
  const d = await buildDigestFacts(now);
  const intro = await writeIntro(d.facts).catch((e) => {
    console.error("Digest intro failed", e instanceof Error ? e.message : e);
    return null;
  });
  return { ...d, intro: intro ?? d.intro };
}

const abs = (siteUrl: string, href?: string) => (href ? `${siteUrl}${href}` : undefined);

export function digestText(d: Digest, siteUrl: string): string {
  return [
    d.intro, "",
    "This week vs usual",
    ...d.bars.map((b) => `- ${b.category}: ${usd0(b.week)} (usually ${usd0(b.usual)})`), "",
    ...d.sections.flatMap((s) => [s.heading, ...s.items.map((i) => `- ${i.text}${i.href ? ` ${abs(siteUrl, i.href)}` : ""}`), ""]),
    d.review.count ? `${d.review.count} to review: ${siteUrl}/review` : `Nothing to review. ${siteUrl}`,
  ].join("\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Simple, table-based HTML that renders in Gmail and Apple Mail (no SVG, no external CSS). */
export function digestHtml(d: Digest, siteUrl: string): string {
  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const max = Math.max(1, ...d.bars.flatMap((b) => [b.week, b.usual]));
  const pct = (v: number) => Math.max(1, Math.round((Math.max(0, v) / max) * 100));
  const link = (i: DigestItem) => (i.href ? `<a href="${esc(abs(siteUrl, i.href)!)}" style="color:#111;text-decoration:underline">${esc(i.text)}</a>` : esc(i.text));
  const bars = d.bars.map((b) => `
    <tr>
      <td style="${font};font-size:13px;color:#333;padding:4px 8px 4px 0;white-space:nowrap">${esc(b.category)}</td>
      <td style="width:100%;padding:4px 0">
        <div style="background:#111;height:9px;border-radius:5px;width:${pct(b.week)}%"></div>
        <div style="background:#c9c9c4;height:4px;border-radius:2px;margin-top:3px;width:${pct(b.usual)}%"></div>
      </td>
      <td style="${font};font-size:13px;color:#111;padding:4px 0 4px 8px;text-align:right;white-space:nowrap">${usd0(b.week)}<span style="color:#888"> / ${usd0(b.usual)}</span></td>
    </tr>`).join("");
  const sections = d.sections.map((s) => `
    <p style="${font};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#888;margin:22px 0 6px">${esc(s.heading)}</p>
    ${s.items.map((i) => `<p style="${font};font-size:15px;line-height:1.45;color:#111;margin:0 0 6px">${link(i)}</p>`).join("")}`).join("");
  const review = d.review.count
    ? `<p style="${font};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#888;margin:22px 0 6px">Waiting for you (${d.review.count})</p>
       ${d.review.items.map((i) => `<p style="${font};font-size:15px;margin:0 0 6px">${link(i)}</p>`).join("")}`
    : "";
  const label = (t: string) => `<p style="${font};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#888;margin:22px 0 8px">${t}</p>`;
  // 12-week trend: vertical bars as table cells (works in Gmail and Apple Mail).
  const wMax = Math.max(1, ...d.weeks.map((w) => w.total));
  const H = 90;
  const weekBars = d.weeks.length ? `${label("Last 12 weeks, one-offs aside")}
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>${d.weeks.map((w, i) => {
        const h = Math.max(2, Math.round((Math.max(0, w.total) / wMax) * H));
        const last = i === d.weeks.length - 1;
        return `<td style="vertical-align:bottom;height:${H + 16}px;padding:0 2px;text-align:center">
          ${last ? `<div style="${font};font-size:11px;font-weight:700;color:#111;margin-bottom:3px">${usd0(w.total)}</div>` : ""}
          <div style="height:${h}px;background:${last ? "#111" : "#c9c9c4"};border-radius:3px 3px 0 0"></div></td>`;
      }).join("")}</tr>
      <tr>${d.weeks.map((w, i) => {
        const m = w.start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
        const show = i === 0 || m !== d.weeks[i - 1].start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
        return `<td style="${font};font-size:10px;color:#888;padding-top:4px;text-align:left">${show ? m : ""}</td>`;
      }).join("")}</tr>
    </table>` : "";
  // Where the month's money went: one bar split by category, with a legend.
  const COLORS = ["#2a6fdb", "#e8743b", "#19a979", "#f0a30a", "#6f4cc3", "#c9c9c4"];
  const mTotal = d.month ? d.month.parts.reduce((a, p) => a + p.amount, 0) : 0;
  const monthChart = d.month && mTotal > 0 ? `${label(`Where ${esc(d.month.label)}'s money went`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed"><tr>
      ${d.month.parts.map((p, i) => `<td style="width:${Math.max(1, Math.round((p.amount / mTotal) * 100))}%;height:14px;background:${COLORS[i % COLORS.length]}"></td>`).join("")}
    </tr></table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px">
      ${d.month.parts.map((p, i) => `<tr>
        <td style="width:14px;padding:3px 0"><div style="width:10px;height:10px;border-radius:2px;background:${COLORS[i % COLORS.length]}"></div></td>
        <td style="${font};font-size:13px;color:#333;padding:3px 0">${esc(p.category)}</td>
        <td style="${font};font-size:13px;color:#111;padding:3px 0;text-align:right;white-space:nowrap">${usd0(p.amount)} <span style="color:#888">${Math.round((p.amount / mTotal) * 100)}%</span></td>
      </tr>`).join("")}
    </table>` : "";
  return `<div style="max-width:520px;margin:0 auto;padding:8px 4px">
    <p style="${font};font-size:18px;line-height:1.45;color:#111;margin:0 0 18px">${esc(d.intro)}</p>
    ${weekBars}
    ${d.bars.length ? `<p style="${font};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#888;margin:22px 0 6px">This week <span style="color:#111">■</span> vs usual <span style="color:#c9c9c4">■</span></p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${bars}</table>` : ""}
    ${monthChart}
    ${sections}
    ${review}
    <p style="margin:26px 0 0"><a href="${esc(`${siteUrl}${d.review.count ? "/review" : ""}`)}" style="${font};display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 16px;border-radius:8px">${d.review.count ? "Review them" : "Open the ledger"}</a></p>
  </div>`;
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
