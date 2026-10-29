import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, isValidSession } from "./auth";

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
