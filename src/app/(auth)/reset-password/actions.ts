"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validatePassword, validatePasswordConfirmation } from "@/lib/auth/validation";
import { verifyOtp, issueResetToken, consumeResetToken } from "@/lib/email/otp-service";
import { setResetTokenCookie, getResetTokenCookie, clearResetTokenCookie } from "@/lib/auth/reset-token-cookie";

export interface VerifyResetCodeState {
  error?: string;
  verified?: boolean;
}

const VERIFY_ERROR_MESSAGES: Record<string, string> = {
  // "no_code" is deliberately mapped to the same generic message as
  // "invalid" here (unlike confirm-email's version of this map) — this is
  // the password-reset flow, where distinguishing "no code was ever sent"
  // from "wrong code" would tell an attacker whether the email has an
  // account at all (see requestPasswordReset's anti-enumeration comment).
  no_code: "Código incorrecto o expirado.",
  invalid: "Código incorrecto o expirado.",
  expired: "El código expiró. Pedí uno nuevo.",
  too_many_attempts: "Demasiados intentos con este código. Pedí uno nuevo.",
};

/** Stage 1 of /reset-password — verifies the Resend-delivered code, then
 * mints a short-lived reset token stored as an httpOnly cookie (never the
 * URL) so stage 2 (resetPassword below) can authorize a password change
 * without a real Supabase session and without asking for the code again.
 *
 * Deliberately does NOT redirect() itself — the target URL
 * (/reset-password?email=...) is identical to the current one (only the
 * cookie changed), and Next.js's client Router Cache doesn't know to
 * invalidate a same-URL render just because a cookie it depends on changed
 * server-side (confirmed live: same class of bug as the platform
 * supervisor-mode exit button, see src/lib/platform/actions.ts). Returning
 * `verified: true` instead lets VerifyResetCodeForm.tsx call
 * router.refresh() itself, which forces the fresh server read. */
export async function verifyResetCode(
  _prevState: VerifyResetCodeState,
  formData: FormData,
): Promise<VerifyResetCodeState> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  if (!email) return { error: "Falta el correo." };
  if (!/^\d{6}$/.test(code)) return { error: "El código debe tener 6 dígitos." };

  const result = await verifyOtp({ email, purpose: "password_reset", code });
  if (!result.success || !result.otpId) {
    return { error: result.error ? VERIFY_ERROR_MESSAGES[result.error] : "Código incorrecto o expirado." };
  }

  const token = await issueResetToken(result.otpId);
  await setResetTokenCookie(token);

  return { verified: true };
}

export interface ResetPasswordState {
  error?: string;
}

/** Stage 2 — the reset-token cookie (set by verifyResetCode) is the only
 * proof of identity here; there's no Supabase session in this flow at all.
 * Updates the password directly via the admin API (service role), never
 * `supabase.auth.updateUser`, since that requires an active session. */
export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const passwordError = validatePassword(password);
  const confirmError = validatePasswordConfirmation(password, confirmPassword);
  if (passwordError || confirmError) {
    return { error: passwordError ?? confirmError };
  }

  const token = await getResetTokenCookie();
  if (!token) return { error: "El enlace de restablecimiento expiró. Pedí un código nuevo." };

  const result = await consumeResetToken(email, token);
  if (!result.success || !result.userId) {
    await clearResetTokenCookie();
    return { error: "El enlace de restablecimiento expiró o ya fue usado. Pedí un código nuevo." };
  }

  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient.auth.admin.updateUserById(result.userId, { password });
  await clearResetTokenCookie();

  if (error) return { error: "No pudimos actualizar la contraseña. Intentá de nuevo." };

  redirect("/login");
}
