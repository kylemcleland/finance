import { prisma } from "@/lib/db";

/** Unauthenticated liveness check: confirms the app can reach its database. */
export async function GET() {
  try {
    const transactions = await prisma.transaction.count();
    return Response.json({ ok: true, transactions });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
