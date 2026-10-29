"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE } from "@/lib/auth";

export async function logoutAction() {
  const store = await cookies();
  store.delete(COOKIE);
  redirect("/login");
}
