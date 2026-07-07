import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { LinkButton } from "@/components/ui/LinkButton";

export const metadata: Metadata = {
  title: "Acceso denegado — Growth Link",
};

export default function AccessDeniedPage() {
  return (
    <AuthCard title="Acceso denegado">
      <div className="flex flex-col items-center gap-3 text-center">
        <ShieldAlert className="size-9 text-error" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-sm text-neutral-500">
          No tienes permiso para acceder a este workspace o recurso. Si crees que es un error,
          contacta a quien administra tu workspace.
        </p>
      </div>
      <LinkButton href="/login" fullWidth>
        Volver a iniciar sesión
      </LinkButton>
    </AuthCard>
  );
}
