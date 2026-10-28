"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, checkPassword, sessionToken } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const attempt = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!(await checkPassword(attempt))) {
    redirect(`/login?error=1${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
  }
  const store = await cookies();
  const proto = (await headers()).get("x-forwarded-proto") ?? "http";
  store.set(COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: proto === "https", // https on Netlify; plain http only when running locally
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(COOKIE);
  redirect("/login");
}
