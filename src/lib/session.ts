import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, ORIGIN_HEADER, isValidSession } from "./auth";

/**
 * For server actions and route handlers. The proxy already turns signed-out
 * visitors away, but Server Functions are reachable by direct POST, so each
 * one checks for itself as well.
 */
export async function requireSession(): Promise<void> {
  if (!(await isValidSession((await cookies()).get(COOKIE)?.value))) redirect("/login");
}

export async function hasSession(): Promise<boolean> {
  return isValidSession((await cookies()).get(COOKIE)?.value);
}

/** The address the browser used, as passed on by the proxy (see ORIGIN_HEADER). */
export async function publicOrigin(): Promise<string> {
  const h = await headers();
  return h.get(ORIGIN_HEADER) ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}
