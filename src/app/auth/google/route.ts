import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, OAUTH_MAX_AGE, authConfig, pkceChallenge, randomToken, safeNext, sign, type OAuthState } from "@/lib/auth";

/** Step 1: send the browser to Google with a fresh state, PKCE challenge and nonce. */
export async function GET(request: NextRequest) {
  const cfg = authConfig();
  if (!cfg.configured) return NextResponse.redirect(new URL("/login?error=config", request.url));

  const oauth: OAuthState = {
    state: randomToken(),
    verifier: randomToken(48),
    nonce: randomToken(),
    next: safeNext(request.nextUrl.searchParams.get("next")),
  };
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: new URL("/auth/callback", request.nextUrl.origin).toString(),
    response_type: "code",
    scope: "openid email",
    state: oauth.state,
    nonce: oauth.nonce,
    code_challenge: await pkceChallenge(oauth.verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const response = NextResponse.redirect(google);
  response.cookies.set(OAUTH_COOKIE, await sign(cfg.secret, "o1", oauth), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax", // must survive the top-level redirect back from Google
    path: "/auth",
    maxAge: OAUTH_MAX_AGE,
  });
  return response;
}
