import type { Metadata } from "next";
import { Users, ShieldAlert } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAgencyWorkspaceAccessForCurrentUser } from "@/lib/auth/roles";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getClientsList } from "@/lib/clients/queries";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClientesListShell } from "./ClientesListShell";

export const metadata: Metadata = {
  title: "Asesores — Growth Link",
};

/** Panel administrativo de owner/admin reales de la agencia sobre las
 * cuentas reales de asesores de Growth Link (workspaces/workspace_members/
 * auth.users, ver getRealAdvisorWorkspaces en queries.ts) — nunca clientes
 * comerciales de un asesor, y nunca entra al workspace del asesor (eso es
 * "Administrar" en CRM → Agentes, un flujo aparte, sin tocar). Gate real:
 * getAgencyWorkspaceAccessForCurrentUser() — resuelve por USUARIO (owner/admin
 * real de la agencia), no por workspace activo, así que funciona parado en
 * cualquier workspace propio (ver 0152_agency_access_by_user.sql). Las
 * queries de acá abajo usan el workspaceId de la AGENCIA que devuelve, nunca
 * el activo. */
export default async function AsesoresPage() {
  await requireActiveWorkspace();
  const agencyWorkspaceId = await getAgencyWorkspaceAccessForCurrentUser();
  const isManager = agencyWorkspaceId !== null;

  const moduleStatus = isManager ? await getWorkspaceModuleStatus(agencyWorkspaceId) : [];
  const moduleEnabled = moduleStatus.some((m) => m.moduleKey === "asesores" && m.enabled);

  const [clients, members] = isManager && moduleEnabled ? await Promise.all([getClientsList(agencyWorkspaceId), getWorkspaceMembers(agencyWorkspaceId)]) : [[], []];

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-primary-600 text-white">
          <Users className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Asesores</h1>
          <p className="text-sm text-neutral-500">Gestioná y monitoreá las cuentas de asesores de Growth Link.</p>
        </div>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        {!isManager ? (
          <EmptyState
            icon={ShieldAlert}
            title="Acceso restringido"
            description="Este módulo es solo para owner/admin del workspace de la agencia."
          />
        ) : (
          <ClientesListShell initialClients={clients} members={members} moduleEnabled={moduleEnabled} />
        )}
      </div>
    </div>
  );
}
