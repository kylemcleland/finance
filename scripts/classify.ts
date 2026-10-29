/**
 * Run the three-layer classifier over stored transactions and export a CSV.
 *
 *   npm run classify            # only transactions never classified
 *   npm run classify -- --all   # re-run everything except manual decisions
 *
 * Layer 3 (Claude) is used only when ANTHROPIC_API_KEY is set; otherwise
 * unresolved rows lean on the cardholder or split 50/50 and are flagged.
 */
import { parseArgs } from "@/lib/args";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { exportCsv, printSummary } from "@/lib/export";
import { classifyPending } from "@/lib/sync";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Claude layer: ${env.hasAnthropic ? "live" : "stubbed (no ANTHROPIC_API_KEY)"}`);
  const { counts, failed } = await classifyPending({ all: Boolean(args.all) });
  if (failed) console.log(`${failed} rows failed and stay unclassified; run again to retry.`);
  const n = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Classified ${n}: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ") || "nothing to do"}`);
  printSummary(await exportCsv());
  console.log("\nWrote exports/transactions.csv");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
