import type { Metadata } from "next";
import { Inbox, Kanban, SquareUser } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Dashboard — Growth Link",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const firstName = ((user.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground text-balance">
          {firstName ? `Hola, ${firstName}` : "Hola de nuevo"}
        </h1>
        <p className="text-sm text-neutral-500">
          Este es tu dashboard temporal — los módulos de Inbox, CRM y ATS se activan próximamente.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <EmptyState
          icon={Inbox}
          title="Inbox"
          description="Tu bandeja de WhatsApp con IA y handoff humano llega en la próxima fase."
        />
        <EmptyState
          icon={Kanban}
          title="CRM"
          description="Pipeline de ventas y contactos, integrado al mismo inbox."
        />
        <EmptyState
          icon={SquareUser}
          title="ATS"
          description="Reclutamiento con IA de preclasificación, integrado al mismo inbox."
        />
      </div>
    </div>
  );
}
