/**
 * Background: sort waiting transactions with Claude for up to ~13 minutes
 * (Netlify allows 15). Started by Sync now and by the daily sync; refuses
 * requests without the app's token and does nothing if a run is going.
 */
import type { Config } from "@netlify/functions";
import { classifyPending } from "../../src/lib/sync";
import { checkSortToken, getSortRun, isRunning, setSortRun } from "../../src/lib/background";

const sortBackground = async (req: Request) => {
  if (!checkSortToken(req.headers.get("x-ledger-token"))) {
    console.warn("sort-background: bad token");
    return;
  }
  if (isRunning(await getSortRun())) {
    console.log("sort-background: a run is already going");
    return;
  }
  const trigger = String(((await req.json().catch(() => ({}))) as { trigger?: string }).trigger ?? "unknown").slice(0, 40);
  const started = Date.now();
  await setSortRun({ startedAt: new Date(started).toISOString(), trigger });
  try {
    const r = await classifyPending({ deadline: started + 13 * 60_000, concurrency: 3 });
    const classified = Object.values(r.counts).reduce((a, b) => a + b, 0);
    await setSortRun({
      startedAt: new Date(started).toISOString(), finishedAt: new Date().toISOString(), trigger,
      classified, remaining: r.remaining, failed: r.failed, lastError: r.lastError,
    });
    console.log(JSON.stringify({ classified, ...r, ms: Date.now() - started }));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await setSortRun({ startedAt: new Date(started).toISOString(), finishedAt: new Date().toISOString(), trigger, lastError: message });
    throw e;
  }
};

export default sortBackground;

export const config: Config = { background: true };
