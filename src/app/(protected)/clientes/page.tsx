import type { Metadata } from "next";
import { Users, ShieldAlert } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getClientsList } from "@/lib/clients/queries";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClientesListShell } from "./ClientesListShell";

export const metadata: Metadata = {
  title: "Clientes — Growth Link",
};

/** Fase 1 de este módulo: acceso restringido a owner/admin en TODO el
 * módulo (a diferencia del resto del CRM) — ver plan del módulo. La RLS de
 * `clients`/`client_contracts` sigue permitiendo select a cualquier
 * miembro (defensa en profundidad), pero la página nunca renderiza
 * contenido real para un agente. */
export default async function ClientesPage() {
  const { workspaceId, role } = await requireActiveWorkspace();
  const isManager = role === "owner" || role === "admin";

  const moduleStatus = await getWorkspaceModuleStatus(workspaceId);
  const moduleEnabled = moduleStatus.some((m) => m.moduleKey === "clientes" && m.enabled);

  const [clients, members] = isManager && moduleEnabled ? await Promise.all([getClientsList(workspaceId), getWorkspaceMembers(workspaceId)]) : [[], []];

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-primary-600 text-white">
          <Users className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Clientes</h1>
          <p className="text-sm text-neutral-500">Centro de control interno de los clientes propios de Growth Link.</p>
        </div>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        {!isManager ? (
          <EmptyState
            icon={ShieldAlert}
            title="Acceso restringido"
            description="Este módulo es solo para owners y admins del workspace."
          />
        ) : (
          <ClientesListShell initialClients={clients} members={members} moduleEnabled={moduleEnabled} />
        )}
      </div>
    </div>
  );
}
