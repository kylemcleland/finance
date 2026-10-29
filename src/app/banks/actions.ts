"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, publicOrigin } from "@/lib/session";
import { plaidErrorCode, startHostedLink } from "@/lib/plaid-link";
import { finishTarget } from "./finish-target";
import { classifyPending, syncPlaid } from "@/lib/sync";

/** Open Plaid's hosted bank login; Plaid sends the browser to /banks/finish when done. */
export async function startLinkAction() {
  await requireSession();
  let url: string;
  try {
    url = await startHostedLink(`${await publicOrigin()}/banks/finish`);
  } catch (e) {
    console.error("Plaid link start failed", plaidErrorCode(e));
    redirect(`/banks?error=${encodeURIComponent(plaidErrorCode(e))}`);
  }
  redirect(url);
}

export async function finishLinkAction() {
  await requireSession();
  redirect(await finishTarget());
}

/** Pull new transactions now instead of waiting for the daily sync. Resumable, so it can be tapped again. */
export async function syncNowAction() {
  await requireSession();
  let target: string;
  try {
    // Stay well inside the function time limit. Both steps resume where they
    // stopped, so whatever is left waits for the next tap or the morning run.
    const started = Date.now();
    const report = await syncPlaid(console.log, { deadline: started + 10_000 });
    const classified = await classifyPending({ deadline: started + 18_000 });
    const count = Object.values(classified.counts).reduce((a, b) => a + b, 0);
    target = `/banks?synced=${report.added}&classified=${count}&left=${classified.remaining}${report.complete ? "" : "&more=1"}`;
  } catch (e) {
    console.error("Sync failed", plaidErrorCode(e));
    target = `/banks?error=${encodeURIComponent(plaidErrorCode(e))}`;
  }
  redirect(target);
}

const CARDHOLDERS = new Set(["me", "her", "joint", ""]);

/**
 * Who carries a card: "me", "her", "joint", or "" for not set. Purchases on
 * that card still waiting for review (and not judged by a person or Claude)
 * go back to the classifier, which uses the cardholder as a hint on the next
 * sync.
 */
export async function setCardholderAction(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const value = String(formData.get("cardholder") ?? "");
  if (!id || !CARDHOLDERS.has(value)) return;
  await prisma.account.update({ where: { id }, data: { cardholder: value || null } });
  await prisma.transaction.updateMany({
    where: { accountId: id, needsReview: true, classificationSource: { in: ["unclassified", "plaid", "keyword"] } },
    data: { classificationSource: null },
  });
  revalidatePath("/banks");
  revalidatePath("/review");
}

/** Our own name for an account; empty clears it back to the bank's name. */
export async function setNicknameAction(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (!id) return;
  await prisma.account.update({ where: { id }, data: { nickname: nickname || null } });
  revalidatePath("/banks");
  revalidatePath("/review");
}
