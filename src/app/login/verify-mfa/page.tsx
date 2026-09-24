import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VerifyMfaForm } from "./VerifyMfaForm";

export const metadata: Metadata = {
  title: "Verificación en dos pasos — Growth Link",
};

interface VerifyMfaPageProps {
  searchParams: Promise<{ next?: string }>;
}

/** Segundo paso del login para cuentas con 2FA real activado (ver
 * src/lib/profile/actions.ts) — src/app/login/actions.ts's `signIn`
 * redirige acá en vez de a `next` directo cuando la sesión recién lograda
 * todavía no llegó a aal2. No está en PROTECTED_PREFIXES de middleware.ts
 * a propósito: esta página necesita ser alcanzable ANTES de completar el
 * segundo factor. */
export default async function VerifyMfaPage({ searchParams }: VerifyMfaPageProps) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/dashboard";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // Ya está en aal2 (ej. volvió a esta URL después de verificar, o llegó
  // por error) — no hay nada más que pedir.
  if (!aal || aal.currentLevel === aal.nextLevel) redirect(safeNext);

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factorId = factors?.totp.find((f) => f.status === "verified")?.id ?? null;
  // Red de seguridad: aal.nextLevel === "aal2" ya implica que existe un
  // factor verificado, pero si por lo que sea no aparece acá no hay nada
  // que verificar — dejar pasar en vez de trabar el login por completo.
  if (!factorId) redirect(safeNext);

  return <VerifyMfaForm factorId={factorId} next={safeNext} />;
}
