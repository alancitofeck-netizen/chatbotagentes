"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { validateEmail, validateName, validatePassword } from "@/lib/auth/validation";
import { mapAuthError } from "@/lib/auth/error-messages";

export interface SignUpState {
  error?: string;
}

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

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  redirect(`/confirm-email?email=${encodeURIComponent(email)}`);
}
