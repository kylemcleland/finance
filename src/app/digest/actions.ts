"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, sessionEmail } from "@/lib/auth";
import { requireSession, publicOrigin } from "@/lib/session";
import { buildDigest, sendDigest } from "@/lib/digest";

/** Email this week's digest to whoever is signed in, to check it arrives. */
export async function sendTestDigestAction() {
  await requireSession();
  const email = await sessionEmail((await cookies()).get(COOKIE)?.value);
  if (!email) redirect("/digest?sent=none");
  let target = "/digest?sent=1";
  try {
    await sendDigest([email], await buildDigest(), await publicOrigin());
  } catch (e) {
    target = `/digest?error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`;
  }
  redirect(target);
}
