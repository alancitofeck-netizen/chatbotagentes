import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";
import { LoginForm } from "./LoginForm";
import { BrandPanel } from "./BrandPanel";

export const metadata: Metadata = {
  title: "Iniciar sesión — Growth Link",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

/** Own top-level route (not under src/app/(auth)/) so this redesign doesn't
 * change register/forgot-password/reset-password/confirm-email, which keep
 * using the shared AuthCard + src/app/(auth)/layout.tsx exactly as before —
 * moving physical folders doesn't change the URL (/login stays /login),
 * confirmed nothing else imports these files by path. */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 p-4 sm:p-8">
      <div className="w-full max-w-6xl overflow-hidden rounded-[28px] bg-surface-1 shadow-[var(--elevation-lg)] lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col justify-center gap-8 p-8 sm:p-12 lg:p-14">
          <Logo />

          <div className="flex flex-col gap-2">
            <h1 className="text-balance text-[28px] leading-[36px] font-semibold tracking-[-0.02em] text-foreground">
              Bienvenido a Growth Link
            </h1>
            <p className="text-[15px] leading-6 text-neutral-500">
              La plataforma donde tu equipo gestiona clientes, conversaciones, automatizaciones e IA desde un solo
              lugar.
            </p>
          </div>

          <LoginForm next={params.next ?? "/dashboard"} initialError={params.error} />
        </div>

        <BrandPanel />
      </div>
    </div>
  );
}
