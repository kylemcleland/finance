/**
 * Idempotent seed: budget categories, three account names used by the sample
 * CSV, and a few starter merchant rules. Safe to re-run.
 */
import { prisma } from "@/lib/db";
import { CATEGORIES, DEFAULT_BUDGETS } from "@/lib/categories";

const ACCOUNTS = [{ name: "Joint Checking" }, { name: "Kyle Card" }, { name: "Jackie Card" }];

// Starter rules, edit freely. shareMe: 100 all Kyle, 75 mostly Kyle, 50 shared, 25 mostly Jackie, 0 all Jackie.
const RULES: Array<{ pattern: string; category: string; shareMe: number; note?: string }> = [
  { pattern: "trader joe", category: "Groceries", shareMe: 50 },
  { pattern: "costco", category: "Groceries", shareMe: 50 },
  { pattern: "netflix", category: "Subscriptions", shareMe: 50 },
  { pattern: "spotify", category: "Subscriptions", shareMe: 50 },
  { pattern: "peloton", category: "Health", shareMe: 100, note: "example from the plan" },
  { pattern: "steamgames", category: "Entertainment", shareMe: 100, note: "example" },
  { pattern: "sephora", category: "Personal", shareMe: 0, note: "example" },
  { pattern: "nail lounge", category: "Personal", shareMe: 0, note: "example" },
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
