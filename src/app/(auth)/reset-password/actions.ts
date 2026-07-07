"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validatePassword, validatePasswordConfirmation } from "@/lib/auth/validation";
import { mapAuthError } from "@/lib/auth/error-messages";

export interface ResetPasswordState {
  error?: string;
}

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const passwordError = validatePassword(password);
  const confirmError = validatePasswordConfirmation(password, confirmPassword);
  if (passwordError || confirmError) {
    return { error: passwordError ?? confirmError };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  redirect("/dashboard");
}
