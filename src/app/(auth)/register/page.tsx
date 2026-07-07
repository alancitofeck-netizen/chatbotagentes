import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Crear cuenta — Growth Link",
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Crea tu cuenta"
      description="Empieza a atender WhatsApp con IA y humanos en el mismo lugar."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-accent-600 hover:text-accent-700">
            Inicia sesión
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
