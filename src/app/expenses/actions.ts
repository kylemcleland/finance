"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { addManualExpense, addRecurringExpense, deleteManualExpense, parseManualExpense, stopRecurring, updateManualExpense } from "@/lib/manual";

export async function saveExpenseAction(formData: FormData) {
  await requireSession();
  const parsed = parseManualExpense({
    date: formData.get("date"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    category: formData.get("category"),
    share: formData.get("share"),
  });
  const id = String(formData.get("id") ?? "");
  if (!parsed.ok) redirect(`/expenses?error=${parsed.error}${id ? `&edit=${encodeURIComponent(id)}` : ""}`);
  const repeat = !id && formData.get("repeat") === "1";
  if (id) await updateManualExpense(id, parsed.value);
  else if (repeat) await addRecurringExpense(parsed.value);
  else await addManualExpense(parsed.value);
  revalidatePath("/");
  redirect(`/expenses?saved=${id ? "updated" : repeat ? "repeating" : "added"}`);
}

export async function deleteExpenseAction(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (id) await deleteManualExpense(id);
  revalidatePath("/");
  redirect("/expenses?saved=deleted");
}

/** Stop a monthly expense; the months already added stay. */
export async function stopRecurringAction(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (id) await stopRecurring(id);
  redirect("/expenses?saved=stopped");
}
