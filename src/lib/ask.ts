/**
 * "Ask Claude" about the household's spending. Each question is answered
 * from a compact snapshot: per-month totals by category (with top merchants)
 * for six months, precomputed so Claude does not have to add up hundreds of
 * lines, plus every purchase from the last three months for drilling in.
 */
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { splitLabel } from "./categories";
import { HOUSEHOLD_NOTES, PEOPLE } from "@/config/household";

export const ASK_MODEL = "claude-opus-5-5";
const EXCLUDED = new Set(["Transfer", "Income"]);
const usd = (n: number) => `$${n.toFixed(2)}`;
const ym = (d: Date) => d.toISOString().slice(0, 7);
const shift = (m: string, by: number) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + by, 1)).toISOString().slice(0, 7);
};

export async function buildAskContext(now = new Date()): Promise<string> {
  const thisMonth = ym(now);
  const months = Array.from({ length: 6 }, (_, i) => shift(thisMonth, i - 5));
  const detailFrom = months[3];
  const txs = await prisma.transaction.findMany({
    where: { date: { gte: new Date(`${months[0]}-01T00:00:00Z`) } },
    include: { account: true },
    orderBy: { date: "asc" },
  });

  type Agg = { total: number; count: number; merchants: Map<string, number> };
  const byMonth = new Map<string, Map<string, Agg>>();
  const split = new Map<string, { me: number; her: number; shared: number; undecided: number }>();
  const detail: string[] = [];
  let unsorted = 0;

  for (const t of txs) {
    const m = ym(t.date);
    const category = t.category ?? "Other";
    const sorted = t.classificationSource != null && t.shareMe != null;
    if (!sorted) unsorted++;
    const card = `${t.account.nickname || t.account.name}${t.account.mask ? ` ****${t.account.mask}` : ""}`;
    const holder = t.account.cardholder === "me" ? PEOPLE.me : t.account.cardholder === "her" ? PEOPLE.her : t.account.cardholder === "joint" ? "joint" : "cardholder unknown";
    const who = !sorted ? "not sorted yet" : t.needsReview ? "undecided" : splitLabel(t.shareMe!, PEOPLE.me, PEOPLE.her);
    if (m >= detailFrom) {
      const desc = t.originalDescription ?? t.rawName;
      detail.push([t.date.toISOString().slice(0, 10), usd(t.amount), category, t.merchant, desc !== t.merchant ? `"${desc}"` : "", `${card} (${holder})`, who, t.pending ? "pending" : ""].filter(Boolean).join(" | "));
    }
    if (EXCLUDED.has(category) || t.amount <= 0) continue;
    const cats = byMonth.get(m) ?? new Map<string, Agg>();
    const a = cats.get(category) ?? { total: 0, count: 0, merchants: new Map() };
    a.total += t.amount; a.count++;
    a.merchants.set(t.merchant, (a.merchants.get(t.merchant) ?? 0) + t.amount);
    cats.set(category, a); byMonth.set(m, cats);
    const s = split.get(m) ?? { me: 0, her: 0, shared: 0, undecided: 0 };
    if (!sorted || t.needsReview) s.undecided += t.amount;
    else if (t.shareMe === 50) s.shared += t.amount;
    else { s.me += (t.amount * t.shareMe!) / 100; s.her += (t.amount * (100 - t.shareMe!)) / 100; }
    split.set(m, s);
  }

  const summary: string[] = [];
  for (const m of months) {
    const cats = [...(byMonth.get(m)?.entries() ?? [])].sort((a, b) => b[1].total - a[1].total);
    const total = cats.reduce((s, [, a]) => s + a.total, 0);
    const s = split.get(m);
    summary.push(`## ${m}${m === thisMonth ? " (in progress)" : ""}: ${usd(total)} spent` +
      (s ? ` — ${PEOPLE.me}-only ${usd(s.me)}, ${PEOPLE.her}-only ${usd(s.her)}, shared ${usd(s.shared)}, undecided ${usd(s.undecided)}` : ""));
    for (const [c, a] of cats) {
      const top = [...a.merchants.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([n, v]) => `${n} ${usd(v)}`).join("; ");
      summary.push(`- ${c}: ${usd(a.total)} (${a.count} purchases). Top: ${top}`);
    }
  }

  return [
    `Data as of ${now.toISOString().slice(0, 10)}. Months covered: ${months[0]} to ${thisMonth}. ${unsorted} transactions are not sorted yet (their split is unknown).`,
    "Spending totals exclude Transfer (card payments, ATM withdrawals, moving money between accounts) and Income, and count refunds separately.",
    "",
    "# Monthly totals by category (precomputed, use these for totals)",
    ...summary,
    "",
    `# Every transaction from ${detailFrom} on`,
    "date | amount (positive = money out, negative = refund/credit) | category | merchant | bank description | card (cardholder) | split",
    ...detail,
  ].join("\n");
}

export const ASK_INSTRUCTIONS = `You answer questions about a household's spending, for ${PEOPLE.me} and ${PEOPLE.her}, from the data below. It is their own data and they are asking on their phone.

${HOUSEHOLD_NOTES}

How to answer:
- Lead with the answer in one or two sentences, then the specifics that explain it: merchants, dates, amounts, which card.
- Use the precomputed monthly totals for totals; use the transaction list to explain them. Do not invent transactions.
- When asked "why is X high", compare with earlier months and name the purchases that make the difference.
- Be brief. Plain text only: no Markdown headings, bold or tables. Short "- " bullet lines are fine.
- If the data cannot answer (e.g. a month outside the range, or splits not sorted yet), say so plainly.`;

export type AskMessage = { role: "user" | "assistant"; content: string };

let client: Anthropic | undefined;

/** Streams the answer's text. Thinking is not shown. */
export async function* askClaude(history: AskMessage[], context: string): AsyncGenerator<string> {
  client ??= new Anthropic({ timeout: 55_000, maxRetries: 1 });
  const stream = client.beta.messages.stream({
    model: ASK_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // if this model declines, the API retries on a fallback model in the same call
    output_config: { effort: "low" },
    system: [
      { type: "text", text: ASK_INSTRUCTIONS },
      // The data is the big, stable part: cached, so follow-up questions are cheap.
      { type: "text", text: context, cache_control: { type: "ephemeral" } },
    ],
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") yield "\n\n(Claude declined to answer that one.)";
  if (final.stop_reason === "max_tokens") yield "\n\n(The answer was cut off; ask a narrower question.)";
}
