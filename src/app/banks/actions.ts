"use server";

import { redirect } from "next/navigation";
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
    const started = Date.now();
    const report = await syncPlaid(console.log);
    // Stay well inside the function time limit; whatever is left waits for the next tap or the morning run.
    const classified = await classifyPending({ deadline: started + 15_000 });
    const count = Object.values(classified.counts).reduce((a, b) => a + b, 0);
    target = `/banks?synced=${report.added}&classified=${count}&left=${classified.remaining}`;
  } catch (e) {
    console.error("Sync failed", plaidErrorCode(e));
    target = `/banks?error=${encodeURIComponent(plaidErrorCode(e))}`;
  }
  redirect(target);
}
