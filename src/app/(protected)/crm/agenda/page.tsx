import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { CrmAtsTabStrip } from "../CrmAtsTabStrip";
import { AgendaShell } from "./AgendaShell";

export const metadata: Metadata = {
  title: "Agenda — Growth Link",
};

/** Vista operativa del Sistema de Agendas — ruta propia (mismo criterio que
 * /ats respecto de /crm) para no forzar la vista día/semana/mes/agenda
 * dentro del ?tab= de CrmPageShell, pero comparte el tab strip para
 * sentirse nativa de CRM. Gateada al módulo "asesores" (ya existente, sin
 * module_key nuevo) porque la agenda solo tiene sentido si hay asesores
 * gestionados — el filtro real de "mis citas vs equipo" vive server-side en
 * getAgendaAppointments, no acá. */
export default async function AgendaPage() {
  const { workspaceId, role, isSupervising } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "asesores");
  const moduleStatus = await getWorkspaceModuleStatus(workspaceId);
  const atsEnabled = moduleStatus.some((m) => m.moduleKey === "ats" && m.enabled);
  const isRealAgent = role === "agent" && !isSupervising;
  const isManager = role === "owner" || role === "admin";

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">CRM</h1>
        <p className="text-sm text-neutral-500">Citas de tus asesores, generadas por tu equipo de setters.</p>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <CrmAtsTabStrip atsEnabled={atsEnabled} isAgent={isRealAgent} />
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <AgendaShell isManager={isManager} />
      </div>
    </div>
  );
}
