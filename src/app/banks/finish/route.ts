import { NextResponse } from "next/server";
import { hasSession, publicOrigin } from "@/lib/session";
import { finishTarget } from "../finish-target";

/**
 * Plaid Hosted Link sends the browser here when the bank login is done.
 * Finishing is idempotent (it only exchanges completed sessions), so a GET is fine.
 */
export async function GET() {
  const origin = await publicOrigin();
  if (!(await hasSession())) return NextResponse.redirect(new URL("/login?next=%2Fbanks", origin));
  return NextResponse.redirect(new URL(await finishTarget(), origin));
}
