/**
 * Idempotent seed: budget categories, three account names used by the sample
 * CSV, and a few starter merchant rules. Safe to re-run.
 */
import { prisma } from "@/lib/db";
import { CATEGORIES, DEFAULT_BUDGETS } from "@/lib/categories";

// cardholder: who carries the card (a hint for personal purchases). null = joint.
const ACCOUNTS = [
  { name: "Joint Checking", cardholder: null },
  { name: "Kyle Card", cardholder: "me" },
  { name: "Jackie Card", cardholder: "her" },
];

// Starter rules, edit freely. shareMe: 100 all Kyle, 75 mostly Kyle, 50 shared, 25 mostly Jackie, 0 all Jackie.
// shareMe null = varies: category is fixed, every purchase gets its own split decision.
const RULES: Array<{ pattern: string; category: string; shareMe: number | null; note?: string }> = [
  { pattern: "target", category: "Shopping", shareMe: null, note: "varies" },
  { pattern: "amazon", category: "Shopping", shareMe: null, note: "varies" },
  { pattern: "amzn", category: "Shopping", shareMe: null, note: "varies" },
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
    else if (existing.cardholder !== a.cardholder) await prisma.account.update({ where: { id: existing.id }, data: { cardholder: a.cardholder } });
  }
  for (const r of RULES) {
    await prisma.merchantRule.upsert({
      where: { pattern_exact: { pattern: r.pattern, exact: false } },
      update: { category: r.category, shareMe: r.shareMe },
      create: { ...r, exact: false },
    });
  }
  console.log(`Seeded ${CATEGORIES.length} categories, ${ACCOUNTS.length} accounts, ${RULES.length} rules.`);
}

main().finally(() => prisma.$disconnect());
