import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Recuperar contraseña — Growth Link",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Recupera tu contraseña"
      description="Te enviamos un enlace a tu correo para crear una nueva."
      footer={
        <Link href="/login" className="font-medium text-accent-600 hover:text-accent-700">
          ← Volver a iniciar sesión
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
