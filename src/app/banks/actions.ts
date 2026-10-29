"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, publicOrigin } from "@/lib/session";
import { plaidErrorCode, startHostedLink, startReconnect } from "@/lib/plaid-link";
import { finishTarget } from "./finish-target";
import { sortLocally, syncPlaid } from "@/lib/sync";
import { startBackgroundSort } from "@/lib/background";

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

/**
 * Pull new transactions now, settle everything that needs no Claude in one
 * fast pass, and start the background sorter (up to 15 minutes) for the rest.
 * The sync resumes where it stopped, so it can be tapped again.
 */
export async function syncNowAction() {
  await requireSession();
  let target: string;
  try {
    const started = Date.now();
    const report = await syncPlaid(console.log, { deadline: started + 12_000 });
    const local = await sortLocally();
    let background = false;
    if (local.waitingForClaude > 0) {
      background = await startBackgroundSort(await publicOrigin(), "sync-now").catch((e) => {
        console.error("Could not start background sorting", e);
        return false;
      });
    }
    target = `/banks?synced=${report.added}&sorted=${local.resolved}&waiting=${local.waitingForClaude}&bg=${background ? 1 : 0}${report.complete ? "" : "&more=1"}${report.errors.length ? `&failed=${report.errors.length}` : ""}`;
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

/** Log in to a bank again (Plaid update mode); the next sync clears the error. */
export async function reconnectAction(formData: FormData) {
  await requireSession();
  const itemId = String(formData.get("itemId") ?? "");
  let url: string;
  try {
    url = await startReconnect(itemId, `${await publicOrigin()}/banks?reconnected=1`);
  } catch (e) {
    console.error("Plaid reconnect failed", plaidErrorCode(e));
    redirect(`/banks?error=${encodeURIComponent(plaidErrorCode(e))}`);
  }
  redirect(url);
}
