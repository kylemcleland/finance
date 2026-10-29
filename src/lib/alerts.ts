/**
 * Things the household should know about without visiting Banks: a bank whose
 * login expired, syncing that has stalled, or Claude sorting that is failing.
 */
import { prisma } from "./db";
import { getSyncState } from "./sync";
import { getSortRun } from "./background";

export type Alert = { text: string; href: string };

export async function buildAlerts(now = Date.now()): Promise<Alert[]> {
  const [items, state, run] = await Promise.all([
    prisma.plaidItem.findMany({ select: { id: true, institution: true, itemId: true, lastSyncedAt: true } }),
    getSyncState(),
    getSortRun(),
  ]);
  const alerts: Alert[] = [];
  for (const item of items) {
    const err = state[item.id]?.error;
    if (!err) continue;
    const name = item.institution ?? "A bank";
    alerts.push({
      text: err.code === "ITEM_LOGIN_REQUIRED" || err.code === "PENDING_EXPIRATION"
        ? `${name} needs you to log in again. Tap to reconnect.`
        : `${name} didn't sync (${err.code}).`,
      href: "/banks",
    });
  }
  for (const item of items) {
    if (state[item.id]?.investments?.status === "consent") {
      alerts.push({ text: `${item.institution ?? "A bank"}: allow access to payments from its investment-type accounts (like the one paying the mortgage). Tap to allow.`, href: "/banks" });
    }
  }
  const lastSync = Math.max(0, ...items.map((i) => i.lastSyncedAt?.getTime() ?? 0));
  if (items.length && lastSync && now - lastSync > 36 * 3600_000) {
    alerts.push({ text: `Banks last synced ${Math.floor((now - lastSync) / 86400_000)} days ago.`, href: "/banks" });
  }
  if (run?.lastError && run.finishedAt && now - new Date(run.finishedAt).getTime() < 7 * 86400_000) {
    alerts.push({ text: `Claude sorting hit an error: ${run.lastError.slice(0, 120)}`, href: "/banks" });
  }
  return alerts;
}
