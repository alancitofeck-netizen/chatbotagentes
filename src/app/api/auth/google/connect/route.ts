import { NextResponse, type NextRequest } from "next/server";
import { getGoogleAccountAuthUrl } from "@/lib/integrations/googleAccount";

const STATE_COOKIE = "gl_google_oauth_state";

/** Starts "Continuar con Google" for login/signup. Unlike the three
 * existing Google integrations (Calendar/Sheets/Drive), there's no logged-in
 * workspace yet to double as the `state` CSRF token, so a random nonce is
 * minted and held in a short-lived httpOnly cookie instead, compared back in
 * the callback. */
export async function GET(request: NextRequest) {
  try {
    const state = crypto.randomUUID();
    const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;
    const authUrl = getGoogleAccountAuthUrl(redirectUri, state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (err) {
    console.error("[google login connect] failed to build auth URL:", err);
    const target = new URL("/login", request.url);
    target.searchParams.set("error", "No pudimos iniciar el inicio de sesión con Google. Intenta de nuevo.");
    return NextResponse.redirect(target);
  }
}
