import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getManychatStatus, getManychatLeads, getManychatDashboardSummary, getManychatContentStats } from "@/lib/integrations/manychat";
import { ManychatShell } from "./ManychatShell";

export const metadata: Metadata = {
  title: "ManyChat — Growth Link",
};

/** Módulo independiente (fuera de CRM) — GrowthLink recibe/analiza la
 * actividad de los leads que ManyChat gestiona en Instagram, nunca
 * controla su flujo. Mismo patrón de acceso que Agentes IA/Aseguradoras:
 * cualquier rol del workspace puede verlo, gateado por workspace_modules
 * (a diferencia de Agentes IA, este SÍ tiene un toggle real porque requiere
 * conexión explícita). */
export default async function ManychatPage() {
  const { workspaceId, name: workspaceName, role } = await requireActiveWorkspace();
  const canManage = role === "owner" || role === "admin";
  const moduleStatus = await getWorkspaceModuleStatus(workspaceId);
  const enabled = moduleStatus.some((m) => m.moduleKey === "manychat" && m.enabled);

  const [status, leads, dashboard, contentStats] = await Promise.all([
    getManychatStatus(workspaceId),
    enabled ? getManychatLeads(workspaceId) : Promise.resolve([]),
    enabled ? getManychatDashboardSummary(workspaceId) : Promise.resolve(null),
    enabled ? getManychatContentStats(workspaceId) : Promise.resolve([]),
  ]);

  return (
    <ManychatShell
      workspaceName={workspaceName}
      moduleEnabled={enabled}
      canManage={canManage}
      status={status}
      leads={leads}
      dashboard={dashboard}
      contentStats={contentStats}
    />
  );
}
