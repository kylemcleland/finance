/**
 * Run the three-layer classifier over stored transactions and export a CSV.
 *
 *   npm run classify            # only unclassified transactions
 *   npm run classify -- --all   # re-run everything except manual corrections
 *
 * Layer 3 (Claude) is used only when ANTHROPIC_API_KEY is set; otherwise
 * unresolved rows are split 50/50 and flagged needs_review.
 */
import { parseArgs } from "@/lib/args";
import { classify } from "@/lib/classify";
import { defaultClassifier } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { exportCsv, printSummary } from "@/lib/export";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rules = await prisma.merchantRule.findMany();
  const cache = new Map((await prisma.merchantCache.findMany()).map((c) => [c.merchant, c]));
  const claude = defaultClassifier();
  console.log(`Rules: ${rules.length}. Cached merchants: ${cache.size}. Claude layer: ${env.hasAnthropic ? "live" : "stubbed (no ANTHROPIC_API_KEY)"}`);

  const txs = await prisma.transaction.findMany({
    where: args.all ? { NOT: { classificationSource: "manual" } } : { classificationSource: null },
    include: { account: true },
    orderBy: { date: "asc" },
  });

  const counts: Record<string, number> = {};
  for (const t of txs) {
    const input = {
      merchant: t.merchant, rawName: t.rawName, amount: t.amount,
      plaidCategoryPrimary: t.plaidCategoryPrimary, plaidCategoryDetailed: t.plaidCategoryDetailed,
      account: t.account.name,
      date: t.date.toISOString().slice(0, 10),
    };
    const { result, fromClaude } = await classify(input, rules, cache.get(t.merchant), claude);
    if (fromClaude) {
      const saved = await prisma.merchantCache.upsert({
        where: { merchant: t.merchant },
        update: fromClaude,
        create: { merchant: t.merchant, ...fromClaude },
      });
      cache.set(t.merchant, saved);
    }
    await prisma.transaction.update({
      where: { id: t.id },
      data: {
        category: result.category, shareMe: result.shareMe, classificationSource: result.source,
        needsReview: result.needsReview, note: result.note ?? null, classifiedAt: new Date(),
      },
    });
    counts[result.source] = (counts[result.source] ?? 0) + 1;
  }
  console.log(`Classified ${txs.length}: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ") || "nothing to do"}`);
  printSummary(await exportCsv());
  console.log("\nWrote exports/transactions.csv");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
