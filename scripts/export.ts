/** Write exports/transactions.csv and print a summary. */
import { prisma } from "@/lib/db";
import { exportCsv, printSummary } from "@/lib/export";

exportCsv()
  .then((s) => { printSummary(s); console.log("\nWrote exports/transactions.csv"); })
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
