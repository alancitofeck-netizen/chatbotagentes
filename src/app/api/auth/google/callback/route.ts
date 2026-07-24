import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findUserIdByEmail } from "@/lib/email/otp-service";
import { establishSessionForUser } from "@/lib/auth/mint-session";
import { provisionDefaultWorkspaceIfNeeded } from "@/lib/auth/provision-workspace";
import { exchangeCodeForTokens, getGoogleProfile, storeGoogleAccountGrant } from "@/lib/integrations/googleAccount";

const STATE_COOKIE = "gl_google_oauth_state";

/** Handles both sign-in AND sign-up in one path: Google already proves email
 * ownership, so an unknown email becomes a brand-new account (role "agent",
 * never "owner" — provisionDefaultWorkspaceIfNeeded enforces that), while a
 * known email just logs in, exactly matching the user's spec ("Se crea
 * automáticamente su cuenta si no existe"). */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  const failure = (target: string) => {
    const url = new URL(target, request.url);
    url.searchParams.set("error", "No pudimos completar el inicio de sesión con Google. Intenta de nuevo.");
    const response = NextResponse.redirect(url);
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  if (oauthError || !code || !state || !expectedState || state !== expectedState) {
    return failure("/login");
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const profile = await getGoogleProfile(tokens.accessToken);
    if (!profile.email) return failure("/login");

    const serviceClient = createServiceRoleClient();
    let userId = await findUserIdByEmail(profile.email);

    if (!userId) {
      const { data, error } = await serviceClient.auth.admin.createUser({
        email: profile.email,
        email_confirm: true,
        user_metadata: { full_name: profile.name },
      });
      if (error || !data.user) return failure("/login");
      userId = data.user.id;
    } else {
      // Covers an existing email/password account that never confirmed —
      // Google already verified this address, so there's nothing left to
      // gate on.
      await serviceClient.auth.admin.updateUserById(userId, { email_confirm: true });
    }

    const sessionEstablished = await establishSessionForUser(profile.email);
    if (!sessionEstablished) return failure("/login");

    const workspaceId = await provisionDefaultWorkspaceIfNeeded(userId, profile.email);
    await storeGoogleAccountGrant(workspaceId, tokens, profile);

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (err) {
    console.error("[google login callback] failed:", err);
    return failure("/login");
  }
}
