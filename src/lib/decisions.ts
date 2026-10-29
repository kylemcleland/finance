import { prisma } from "./db";
import { isCategory, snapSplit } from "./categories";

/**
 * Record a human decision on one transaction. With `always`, the merchant
 * becomes an exact rule and every other undecided purchase there is settled
 * the same way.
 */
export async function decide(opts: {
  id: string; shareMe: number; category?: string | null; always?: boolean;
  /** With `always`: also re-file past purchases at the merchant (except ones decided by hand), not only undecided ones. */
  applyToPast?: boolean;
  /** Set the one-off flag (left out of pace and yearly estimates); with `always`, for the merchant too. */
  oneOff?: boolean;
}) {
  const tx = await prisma.transaction.findUnique({ where: { id: opts.id } });
  if (!tx) throw new Error("Transaction not found");
  const shareMe = snapSplit(opts.shareMe);
  const category = opts.category && isCategory(opts.category) ? opts.category : tx.category ?? "Other";
  const now = new Date();
  await prisma.transaction.update({
    where: { id: tx.id },
    data: { shareMe, category, needsReview: false, classificationSource: "manual", classifiedAt: now, note: null, ...(opts.oneOff !== undefined ? { oneOff: opts.oneOff } : {}) },
  });
  let alsoSettled = 0;
  if (opts.always) {
    await prisma.merchantRule.upsert({
      where: { pattern_exact: { pattern: tx.merchant, exact: true } },
      update: { category, shareMe, ...(opts.oneOff !== undefined ? { oneOff: opts.oneOff } : {}) },
      create: { pattern: tx.merchant, exact: true, category, shareMe, oneOff: opts.oneOff ?? false },
    });
    const r = await prisma.transaction.updateMany({
      where: opts.applyToPast
        ? { merchant: tx.merchant, id: { not: tx.id }, OR: [{ classificationSource: null }, { classificationSource: { not: "manual" } }] }
        : { merchant: tx.merchant, needsReview: true, id: { not: tx.id } },
      data: { shareMe, category, needsReview: false, classificationSource: "rule", classifiedAt: now, note: null, ...(opts.oneOff !== undefined && opts.applyToPast ? { oneOff: opts.oneOff } : {}) },
    });
    alsoSettled = r.count;
  }
  return { shareMe, category, alsoSettled };
}

/** Put a transaction back in the review queue. */
export async function reopen(id: string) {
  await prisma.transaction.update({ where: { id }, data: { needsReview: true } });
}
