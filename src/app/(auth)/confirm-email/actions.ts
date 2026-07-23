"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { provisionDefaultWorkspaceIfNeeded } from "@/lib/auth/provision-workspace";

export interface ResendState {
  sent?: boolean;
  error?: string;
}

export async function resendConfirmation(
  _prevState: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Falta el correo a confirmar." };

  const supabase = await createClient();
  // No `emailRedirectTo` needed here — the "Confirm signup" template now
  // sends {{ .Token }} (a 6-digit code the user types into VerifyCodeForm
  // below), not a clickable link, so there's no redirect URL to resolve.
  const { error } = await supabase.auth.resend({ type: "signup", email });

  if (error) return { error: "No pudimos reenviar el código. Intenta de nuevo en un momento." };
  return { sent: true };
}

export interface VerifyCodeState {
  error?: string;
}

/** Confirms the account with the 6-digit code from the "Confirm signup"
 * email (replaces the old click-the-link flow — see
 * docs/blueprint 00-product.md's signup flow). Mirrors what
 * src/app/auth/callback/route.ts does after a successful link-based
 * exchange: provision the user's default workspace, then land them in the
 * app — this path just never goes through that route at all, since
 * verifyOtp here already establishes the session directly. */
export async function verifySignupCode(
  _prevState: VerifyCodeState,
  formData: FormData,
): Promise<VerifyCodeState> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  if (!email) return { error: "Falta el correo a confirmar." };
  if (!/^\d{6}$/.test(code)) return { error: "El código debe tener 6 dígitos." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });

  if (error || !data.user) {
    return { error: "Código incorrecto o expirado. Pedí uno nuevo." };
  }

  if (data.user.email) {
    // Non-fatal if it fails — the (protected) layout will still catch a
    // user with zero workspaces and show a clear error instead of a crash
    // (same fallback already relied on in auth/callback/route.ts).
    await provisionDefaultWorkspaceIfNeeded(data.user.id, data.user.email).catch(() => {});
  }

  redirect("/dashboard");
}
