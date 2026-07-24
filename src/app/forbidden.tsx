import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = {
  title: "Acceso denegado — Growth Link",
};

/** Rendered by next/navigation's forbidden() (next.config.ts's
 * experimental.authInterrupts) — the real HTTP 403 boundary for admin-only
 * surfaces (CRM "Agentes"/ATS for agent-role users, the platform supervisor
 * panel for non-platform-admins) per the role-permissions spec's "debe
 * devolver 403 Forbidden" requirement. */
export default function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Logo />
      <ShieldAlert className="size-10 text-neutral-400" strokeWidth={1.5} aria-hidden="true" />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">
          Acceso denegado
        </h1>
        <p className="max-w-sm text-sm text-neutral-500">No tenés permiso para ver esta sección.</p>
      </div>
      <LinkButton href="/dashboard">Volver al Dashboard</LinkButton>
    </div>
  );
}
