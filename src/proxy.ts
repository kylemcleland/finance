import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, isValidSession } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Public: the sign-in page, the Google sign-in routes, and the health check.
  if (pathname === "/login" || pathname === "/health" || pathname.startsWith("/auth/")) return NextResponse.next();
  if (await isValidSession(request.cookies.get(COOKIE)?.value)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:png|svg|ico|jpg|webp|txt|xml)$).*)"],
};
