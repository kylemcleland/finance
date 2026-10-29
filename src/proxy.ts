import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, ORIGIN_HEADER, isValidSession } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Pass on the address the browser used (see ORIGIN_HEADER); always overwritten.
  const headers = new Headers(request.headers);
  headers.set(ORIGIN_HEADER, request.nextUrl.origin);
  const pass = () => NextResponse.next({ request: { headers } });

  // Public: the sign-in page, the Google sign-in routes, and the health check.
  if (pathname === "/login" || pathname === "/health" || pathname.startsWith("/auth/")) return pass();
  if (await isValidSession(request.cookies.get(COOKIE)?.value)) return pass();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:png|svg|ico|jpg|webp|txt|xml)$).*)"],
};
