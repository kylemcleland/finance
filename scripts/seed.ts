/**
 * Idempotent seed: budget categories, the three logical accounts used by CSV
 * imports, and a few starter merchant rules. Safe to re-run.
 */
import { prisma } from "@/lib/db";
import { CATEGORIES, DEFAULT_BUDGETS } from "@/lib/categories";

const ACCOUNTS = [
  { name: "Joint Checking", owner: "shared" },
  { name: "Kyle Card", owner: "me" },
  { name: "Her Card", owner: "her" },
];

const RULES: Array<{ pattern: string; category: string; shareMe: number; note?: string }> = [
  { pattern: "trader joe", category: "Groceries", shareMe: 50 },
  { pattern: "costco", category: "Groceries", shareMe: 50 },
  { pattern: "netflix", category: "Subscriptions", shareMe: 50 },
  { pattern: "spotify", category: "Subscriptions", shareMe: 50 },
];

async function main() {
  for (const [i, name] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { name },
      update: { sortOrder: i },
      create: { name, sortOrder: i, monthlyBudget: DEFAULT_BUDGETS[name] ?? null },
    });
  }
  for (const a of ACCOUNTS) {
    const existing = await prisma.account.findFirst({ where: { name: a.name, plaidAccountId: null } });
    if (!existing) await prisma.account.create({ data: a });
  }
  for (const r of RULES) {
    await prisma.merchantRule.upsert({
      where: { pattern_exact: { pattern: r.pattern, exact: false } },
      update: {},
      create: { ...r, exact: false },
    });
  }
  console.log(`Seeded ${CATEGORIES.length} categories, ${ACCOUNTS.length} accounts, ${RULES.length} rules.`);
}

main().finally(() => prisma.$disconnect());
