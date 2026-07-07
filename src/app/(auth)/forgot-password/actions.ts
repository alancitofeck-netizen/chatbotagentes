"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { validateEmail } from "@/lib/auth/validation";

export interface ForgotPasswordState {
  error?: string;
  sent?: boolean;
}

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();

  const emailError = validateEmail(email);
  if (emailError) return { error: emailError };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();

  // Supabase always resolves successfully here regardless of whether the
  // email exists, to avoid leaking which accounts are registered — the UI
  // shows the same "check your email" state either way.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  });

  return { sent: true };
}
