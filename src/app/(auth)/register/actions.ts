"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateEmail, validateName, validatePassword } from "@/lib/auth/validation";
import { mapAuthError } from "@/lib/auth/error-messages";
import { createAndSendOtp } from "@/lib/email/otp-service";

export interface SignUpState {
  error?: string;
}

/** Creates the account via the service-role admin API (not
 * supabase.auth.signUp) specifically so Supabase Auth never sends its own
 * confirmation email — `email_confirm: false` leaves the account genuinely
 * unconfirmed (still blocked from signing in) until our own OTP code
 * verifies it in src/app/(auth)/confirm-email/actions.ts. All verification
 * mail now goes exclusively through Resend (src/lib/email/otp-service.ts). */
export async function signUp(_prevState: SignUpState, formData: FormData): Promise<SignUpState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const nameError = validateName(fullName);
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  if (nameError || emailError || passwordError) {
    return { error: nameError ?? emailError ?? passwordError };
  }

  const serviceClient = createServiceRoleClient();
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    return { error: mapAuthError(error?.message ?? "") };
  }

  const otpResult = await createAndSendOtp({ email, purpose: "signup", userId: data.user.id });
  if (!otpResult.ok) {
    return { error: otpResult.error ?? "No pudimos enviar el código de verificación." };
  }

  redirect(`/confirm-email?email=${encodeURIComponent(email)}`);
}
