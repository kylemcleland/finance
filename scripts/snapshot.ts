/**
 * Write exports/dashboard.html: a self-contained snapshot of the dashboard
 * (styles, renderer and data inlined) that can be opened or published anywhere.
 *
 *   npm run snapshot -- [--note "Synthetic sample data"]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "@/lib/args";
import { prisma } from "@/lib/db";
import { buildDashboardData } from "@/lib/dashboard-data";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = { ...(await buildDashboardData()), note: typeof args.note === "string" ? args.note : undefined };
  const css = readFileSync("src/dashboard/dashboard.css", "utf8");
  const js = readFileSync("src/dashboard/render.js", "utf8").replace(/^export function/m, "function");
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const html = `<title>Household Ledger</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600&display=swap">
<style>
${css}
</style>
<main id="dash" class="dash"></main>
<script>
${js}
renderDashboard(document.getElementById("dash"), ${json});
</script>
`;
  mkdirSync("exports", { recursive: true });
  writeFileSync("exports/dashboard.html", html);
  console.log(`Wrote exports/dashboard.html (${data.counts.transactions} transactions, ${data.months[0]}..${data.months.at(-1)})`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
