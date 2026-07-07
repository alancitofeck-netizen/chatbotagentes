"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) return { error: "No pudimos reenviar el correo. Intenta de nuevo en un momento." };
  return { sent: true };
}
