import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { getResetTokenCookie } from "@/lib/auth/reset-token-cookie";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { VerifyResetCodeForm } from "./VerifyResetCodeForm";
import { ResendResetCodeButton } from "./ResendResetCodeButton";

export const metadata: Metadata = {
  title: "Restablecer contraseña — Growth Link",
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ email?: string }>;
}

/** Two stages on the same route, distinguished by the httpOnly reset-token
 * cookie (src/lib/auth/reset-token-cookie.ts): no cookie yet → code entry
 * (stage 1, verifyResetCode); cookie present → new password (stage 2,
 * resetPassword). Mirrors /confirm-email's ?email=-driven code-entry UX. */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { email = "" } = await searchParams;
  const resetToken = await getResetTokenCookie();

  if (resetToken) {
    return (
      <AuthCard title="Crea una nueva contraseña" description="Elige una contraseña segura para tu cuenta.">
        <ResetPasswordForm email={email} />
      </AuthCard>
    );
  }

  if (!email) redirect("/forgot-password");

  return (
    <AuthCard
      title="Verifica el código"
      footer={
        <Link href="/login" className="font-medium text-accent-600 hover:text-accent-700">
          ← Volver a iniciar sesión
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck className="size-9 text-accent-500" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-sm text-neutral-500">
          Si existe una cuenta con <span className="font-medium text-foreground">{email}</span>, te enviamos un
          código de 6 dígitos para restablecer tu contraseña.
        </p>
      </div>
      <VerifyResetCodeForm email={email} />
      <ResendResetCodeButton email={email} />
    </AuthCard>
  );
}
