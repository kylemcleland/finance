import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE, OAUTH_COOKIE, SESSION_MAX_AGE, authConfig, checkIdTokenClaims, createSession, decodeJwtPayload, unsign, type OAuthState,
} from "@/lib/auth";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Step 2: Google sends the browser back here with a one-time code. */
export async function GET(request: NextRequest) {
  const cfg = authConfig();
  const params = request.nextUrl.searchParams;
  const fail = (error: string) => {
    const r = NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
    r.cookies.delete({ name: OAUTH_COOKIE, path: "/auth" });
    return r;
  };
  if (!cfg.configured) return fail("config");
  if (params.get("error")) return fail("cancelled"); // e.g. the person closed Google's account picker

  // The state must match the cookie we set in step 1, which stops forged sign-ins.
  const oauth = await unsign<OAuthState>(cfg.secret, "o1", request.cookies.get(OAUTH_COOKIE)?.value);
  const code = params.get("code");
  if (!oauth || !code || params.get("state") !== oauth.state) return fail("failed");

  let idToken: string | undefined;
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: new URL("/auth/callback", request.nextUrl.origin).toString(),
        grant_type: "authorization_code",
        code_verifier: oauth.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("Google token exchange failed", res.status, await res.text());
      return fail("failed");
    }
    idToken = ((await res.json()) as { id_token?: string }).id_token;
  } catch (e) {
    console.error("Google token exchange error", e);
    return fail("failed");
  }

  const claims = idToken ? decodeJwtPayload(idToken) : null;
  if (!claims) return fail("failed");
  const check = checkIdTokenClaims(claims, { clientId: cfg.clientId, nonce: oauth.nonce, allowed: cfg.allowed });
  if (!check.ok) {
    console.warn("Sign-in rejected:", check.reason);
    return fail(check.reason === "notallowed" ? "notallowed" : "failed");
  }

  const response = NextResponse.redirect(new URL(oauth.next, request.url));
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/auth" });
  response.cookies.set(COOKIE, await createSession(check.email), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
