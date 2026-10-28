"use server";

import { revalidatePath } from "next/cache";
import { decide, reopen } from "@/lib/decisions";

export async function decideAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const share = Number(formData.get("share"));
  if (!id || Number.isNaN(share)) return;
  await decide({
    id,
    shareMe: share,
    category: formData.get("category")?.toString() || null,
    always: formData.get("always") === "on",
  });
  revalidatePath("/review");
  revalidatePath("/");
}

export async function reopenAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await reopen(id);
  revalidatePath("/review");
  revalidatePath("/");
}
