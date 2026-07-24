"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createAndSendOtp, verifyOtp, findUserIdByEmail } from "@/lib/email/otp-service";
import { establishSessionForUser } from "@/lib/auth/mint-session";
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

  const userId = await findUserIdByEmail(email);
  const result = await createAndSendOtp({ email, purpose: "signup", userId: userId ?? undefined });

  if (!result.ok) return { error: result.error ?? "No pudimos reenviar el código." };
  return { sent: true };
}

export interface VerifyCodeState {
  error?: string;
}

const VERIFY_ERROR_MESSAGES: Record<string, string> = {
  no_code: "No encontramos un código pendiente para este correo. Pedí uno nuevo.",
  expired: "El código expiró. Pedí uno nuevo.",
  too_many_attempts: "Demasiados intentos con este código. Pedí uno nuevo.",
  invalid: "Código incorrecto. Probá de nuevo.",
};

/** Confirms the account with our own 6-digit Resend-delivered code (see
 * src/lib/email/otp-service.ts) — replaces the old Supabase-Auth-OTP /
 * magic-link based confirmation entirely. On success: flips email_confirm
 * to true via the admin API, mints a real session without needing the
 * password again (establishSessionForUser), provisions the default
 * workspace, then lands the user in the app exactly like before. */
export async function verifySignupCode(
  _prevState: VerifyCodeState,
  formData: FormData,
): Promise<VerifyCodeState> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  if (!email) return { error: "Falta el correo a confirmar." };
  if (!/^\d{6}$/.test(code)) return { error: "El código debe tener 6 dígitos." };

  const result = await verifyOtp({ email, purpose: "signup", code });
  if (!result.success || !result.userId) {
    return { error: result.error ? VERIFY_ERROR_MESSAGES[result.error] : "Código incorrecto o expirado." };
  }

  const serviceClient = createServiceRoleClient();
  const { error: confirmError } = await serviceClient.auth.admin.updateUserById(result.userId, {
    email_confirm: true,
  });
  if (confirmError) return { error: "No pudimos confirmar la cuenta. Intentá de nuevo." };

  const sessionEstablished = await establishSessionForUser(email);
  if (!sessionEstablished) {
    // The account IS confirmed at this point — just send them to /login
    // instead of leaving them stuck, rather than failing the whole flow.
    redirect("/login");
  }

  await provisionDefaultWorkspaceIfNeeded(result.userId, email).catch(() => {});

  redirect("/dashboard");
}
