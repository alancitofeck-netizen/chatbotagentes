"use server";

import { redirect } from "next/navigation";
import { validateEmail } from "@/lib/auth/validation";
import { createAndSendOtp, findUserIdByEmail } from "@/lib/email/otp-service";

export interface ForgotPasswordState {
  error?: string;
}

/** Anti-enumeration by design: whether the account exists or the OTP send
 * was rate-limited, the caller always lands on the same /reset-password
 * code-entry screen — surfacing a distinct error for either case would let
 * an attacker probe which emails have accounts. The actual code (via
 * Resend, src/lib/email/otp-service.ts) only goes out when the account
 * really exists. */
export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();

  const emailError = validateEmail(email);
  if (emailError) return { error: emailError };

  const userId = await findUserIdByEmail(email);
  if (userId) {
    await createAndSendOtp({ email, purpose: "password_reset", userId });
  }

  redirect(`/reset-password?email=${encodeURIComponent(email)}`);
}
