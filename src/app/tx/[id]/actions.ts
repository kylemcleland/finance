"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { decide } from "@/lib/decisions";
import { safeNext } from "@/lib/auth";

/** Re-file one purchase (and, if asked, every purchase at its merchant). */
export async function reclassifyAction(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const share = Number(formData.get("share"));
  const back = safeNext(formData.get("back"));
  if (!id || Number.isNaN(share)) redirect(back);
  const always = formData.get("always") === "on";
  const r = await decide({
    id, shareMe: share, category: formData.get("category")?.toString() || null, always, applyToPast: always,
    oneOff: formData.get("oneOff") === "on",
  });
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/review");
  const sep = back.includes("?") ? "&" : "?";
  redirect(`${back}${sep}saved=${always ? r.alsoSettled + 1 : 1}`);
}
