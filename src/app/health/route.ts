import { prisma } from "@/lib/db";
import { hasSession } from "@/lib/session";

/**
 * Liveness check. Anonymous callers only learn that the site is up: answering
 * them never wakes the database, so bots and monitors can't keep it running
 * (Netlify bills database time). Signed-in callers also get a database check.
 */
export async function GET() {
  if (!(await hasSession())) return Response.json({ ok: true });
  try {
    const transactions = await prisma.transaction.count();
    return Response.json({ ok: true, database: "ok", transactions });
  } catch (e) {
    return Response.json({ ok: false, database: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
