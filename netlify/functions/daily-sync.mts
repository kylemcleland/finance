/**
 * Scheduled: pull new transactions from Plaid and classify them.
 * Runs daily at 11:00 UTC (early morning US time). Scheduled functions have a
 * short time limit, so this does one sync pass and classifies what is new;
 * anything left over is picked up the next day.
 */
import type { Config } from "@netlify/functions";
import { syncPlaid, classifyPending } from "../../src/lib/sync";
import { env } from "../../src/lib/env";

const dailySync = async () => {
  const started = Date.now();
  let sync: Awaited<ReturnType<typeof syncPlaid>> | null = null;
  if (env.hasPlaid) sync = await syncPlaid(console.log);
  else console.log("Plaid keys not set; skipping sync");
  // Scheduled functions get about 30 seconds; leave headroom for in-flight calls.
  const classified = await classifyPending({ deadline: started + 15_000 });
  console.log(JSON.stringify({ sync, classified, ms: Date.now() - started }));
};

export default dailySync;

export const config: Config = { schedule: "0 11 * * *" };
