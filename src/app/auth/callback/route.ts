import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { provisionDefaultWorkspaceIfNeeded } from "@/lib/auth/provision-workspace";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Single exchange point for every Supabase email link: sign-up confirmation,
 * password recovery, and (later) magic links / OAuth. Supports both the
 * PKCE `code` flow and the OTP `token_hash` flow since Supabase's email
 * templates can be configured either way.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing_code") };

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "El enlace expiró o ya fue usado. Solicita uno nuevo.");
    return NextResponse.redirect(loginUrl);
  }

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    // Plan decision #2: every user gets a personal workspace automatically.
    // Non-fatal if it fails — the (protected) layout will still catch a
    // user with zero workspaces and show a clear error instead of a crash.
    await provisionDefaultWorkspaceIfNeeded(user.id, user.email).catch(() => {});
  }

  return NextResponse.redirect(new URL("/dashboard", origin));
}
