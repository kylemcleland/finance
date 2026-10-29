import { finishHostedLinks, plaidErrorCode } from "@/lib/plaid-link";

/** Finish completed bank links and say where to go next. Not a server action: callers check the session. */
export async function finishTarget(): Promise<string> {
  try {
    const r = await finishHostedLinks();
    return `/banks?linked=${r.linked.length}&waiting=${r.waiting}`;
  } catch (e) {
    console.error("Plaid link finish failed", plaidErrorCode(e));
    return `/banks?error=${encodeURIComponent(plaidErrorCode(e))}`;
  }
}
