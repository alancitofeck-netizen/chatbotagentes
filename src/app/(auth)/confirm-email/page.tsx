import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResendButton } from "./ResendButton";
import { VerifyCodeForm } from "./VerifyCodeForm";

export const metadata: Metadata = {
  title: "Confirma tu correo — Growth Link",
};

interface ConfirmEmailPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function ConfirmEmailPage({ searchParams }: ConfirmEmailPageProps) {
  const { email = "" } = await searchParams;

  return (
    <AuthCard
      title="Confirma tu correo"
      footer={
        <Link href="/login" className="font-medium text-accent-600 hover:text-accent-700">
          ← Volver a iniciar sesión
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck className="size-9 text-accent-500" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-sm text-neutral-500">
          Te enviamos un código de 6 dígitos
          {email && (
            <>
              {" "}a <span className="font-medium text-foreground">{email}</span>
            </>
          )}
          . Ingresalo para activar tu cuenta y tu workspace.
        </p>
      </div>
      {email && <VerifyCodeForm email={email} />}
      {email && <ResendButton email={email} />}
    </AuthCard>
  );
}
