/**
 * Scheduled: pull new transactions from Plaid and classify them.
 * Runs daily at 11:00 UTC (early morning US time). Scheduled functions have a
 * short time limit, so this does one sync pass and classifies what is new;
 * anything left over is picked up the next day.
 */
import type { Config } from "@netlify/functions";
import { syncPlaid, classifyPending, sortLocally } from "../../src/lib/sync";
import { getSortRun, isRunning, startBackgroundSort } from "../../src/lib/background";
import { env } from "../../src/lib/env";

const dailySync = async () => {
  const started = Date.now();
  let sync: Awaited<ReturnType<typeof syncPlaid>> | null = null;
  if (env.hasPlaid) sync = await syncPlaid(console.log, { deadline: started + 10_000 });
  else console.log("Plaid keys not set; skipping sync");
  const local = await sortLocally();
  // Claude sorting runs in the background function (15 minutes). If the
  // site's address is unknown here, fall back to a short run inside this
  // function (scheduled functions get about 30 seconds).
  const siteUrl = (globalThis as { Netlify?: { env: { get(k: string): string | undefined } } }).Netlify?.env.get("URL") ?? process.env.URL;
  let background = false;
  if (local.waitingForClaude > 0 && siteUrl) {
    background = await startBackgroundSort(siteUrl, "daily").catch((e) => { console.error("Could not start background sorting", e); return false; });
  }
  const alreadyRunning = isRunning(await getSortRun());
  const classified = local.waitingForClaude > 0 && !background && !alreadyRunning ? await classifyPending({ deadline: started + 18_000 }) : null;
  console.log(JSON.stringify({ sync, local, background, classified, ms: Date.now() - started }));
};

export default dailySync;

export const config: Config = { schedule: "0 11 * * *" };
