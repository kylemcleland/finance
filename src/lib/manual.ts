/**
 * Expenses entered by hand (cash, or anything paid outside the linked
 * accounts). Stored as ordinary transactions on a "Cash and other" account,
 * already decided (classificationSource "manual"), so the classifier, the
 * Plaid sync and the ATM migration all leave them alone.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "./db";
import { CATEGORIES, SPLITS, type Category } from "./categories";
import { normalizeMerchant } from "./merchant";

export const MANUAL_ACCOUNT_ID = "manual-cash";
export const MANUAL_SOURCE = "manual";

export type ManualExpense = { date: string; amount: number; description: string; category: Category; shareMe: number };

/** Parse and check form input. Returns an error message, or the clean values. */
export function parseManualExpense(f: { date?: unknown; amount?: unknown; description?: unknown; category?: unknown; share?: unknown }, today = new Date()):
  { ok: true; value: ManualExpense } | { ok: false; error: string } {
  const amount = Math.round(Number(String(f.amount ?? "").replace(/[$,\s]/g, "")) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) return { ok: false, error: "amount" };
  const description = String(f.description ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!description) return { ok: false, error: "description" };
  const date = String(f.date ?? "");
  const d = new Date(`${date}T00:00:00Z`);
  const latest = new Date(today.getTime() + 2 * 86_400_000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(d.getTime()) || d > latest || d.getUTCFullYear() < 2000) return { ok: false, error: "date" };
  const category = String(f.category ?? "");
  if (!(CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: "category" };
  const shareMe = Number(f.share);
  if (!(SPLITS as readonly number[]).includes(shareMe)) return { ok: false, error: "split" };
  return { ok: true, value: { date, amount, description, category: category as Category, shareMe } };
}

function fields(e: ManualExpense) {
  return {
    date: new Date(`${e.date}T00:00:00Z`),
    amount: e.amount,
    merchant: normalizeMerchant(e.description) || e.description.toLowerCase(),
    rawName: e.description,
    category: e.category,
    shareMe: e.shareMe,
    classificationSource: MANUAL_SOURCE,
    needsReview: false,
    classifiedAt: new Date(),
    note: "Entered by hand",
  };
}

export async function addManualExpense(e: ManualExpense) {
  await prisma.account.upsert({
    where: { id: MANUAL_ACCOUNT_ID },
    update: {},
    create: { id: MANUAL_ACCOUNT_ID, name: "Cash and other", type: "manual" },
  });
  return prisma.transaction.create({
    data: { externalId: `manual:${randomUUID()}`, source: MANUAL_SOURCE, accountId: MANUAL_ACCOUNT_ID, ...fields(e) },
  });
}

/** Only touches rows entered by hand, never bank transactions. */
export async function updateManualExpense(id: string, e: ManualExpense) {
  return prisma.transaction.updateMany({ where: { id, source: MANUAL_SOURCE }, data: fields(e) });
}

export async function deleteManualExpense(id: string) {
  return prisma.transaction.deleteMany({ where: { id, source: MANUAL_SOURCE } });
}

export function recentManualExpenses(take = 25) {
  return prisma.transaction.findMany({ where: { source: MANUAL_SOURCE }, orderBy: [{ date: "desc" }, { classifiedAt: "desc" }], take });
}
