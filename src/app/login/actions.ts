"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateEmail, validatePassword } from "@/lib/auth/validation";
import { mapAuthError } from "@/lib/auth/error-messages";

export interface SignInState {
  error?: string;
}

export async function signIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  if (emailError || passwordError) {
    return { error: emailError ?? passwordError };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  // Si la cuenta tiene 2FA real activado (src/lib/profile/actions.ts —
  // enrollMfaFactor/verifyMfaEnrollment), el password por sí solo solo
  // alcanza aal1 — falta el segundo factor antes de entrar. `middleware.ts`
  // también revisa esto para sesiones ya abiertas que todavía no lo
  // pasaron en este navegador; acá se corta el paso apenas loguea.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
    redirect(`/login/verify-mfa?next=${encodeURIComponent(safeNext)}`);
  }

  redirect(safeNext);
}

/** Segundo paso del login para cuentas con 2FA — ver src/app/login/
 * verify-mfa/page.tsx. Mismo challenge+verify real que la verificación
 * inicial (verifyMfaEnrollment en src/lib/profile/actions.ts). */
export async function verifyMfaAtLogin(factorId: string, code: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) return { error: "No se pudo verificar el código — probá de nuevo." };

  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (error) return { error: "Código incorrecto." };

  return {};
}
