import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Restablecer contraseña — Growth Link",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Crea una nueva contraseña" description="Elige una contraseña segura para tu cuenta.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
