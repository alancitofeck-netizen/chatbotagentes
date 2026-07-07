import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión — Growth Link",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <AuthCard
      title="Inicia sesión"
      description="Ingresa a tu workspace de Growth Link."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-medium text-accent-600 hover:text-accent-700">
            Regístrate
          </Link>
        </>
      }
    >
      <LoginForm next={params.next ?? "/dashboard"} initialError={params.error} />
    </AuthCard>
  );
}
