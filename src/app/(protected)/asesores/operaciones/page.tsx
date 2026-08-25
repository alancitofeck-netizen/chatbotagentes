import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAgencyWorkspaceAccessForCurrentUser } from "@/lib/auth/roles";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getAgencyAdvisorOptions } from "@/lib/kpis/agencyPerformance";
import {
  getAgencyPolicies,
  getAgencyPolicyPayments,
  getAgencyOperationalTasks,
  getAgencyPendingDocumentation,
  getAgencyRecentActivity,
} from "@/lib/kpis/agencyOperations";
import { OperacionesShell } from "./OperacionesShell";

export const metadata: Metadata = { title: "Operaciones — Asesores — Growth Link" };

/** "Operaciones": vista operativa cross-asesor sobre pólizas/pagos/tareas/
 * documentación de TODA la agencia — análoga a Performance/Agendas, nunca
 * toca la ficha individual del asesor ni su subpestaña "operacion" (pedido
 * explícito). Un solo fetch de pólizas, del que se derivan funnel/top
 * productos/evolución en memoria (OperacionesShell); pagos y documentación
 * pendiente dependen de esa misma lista para no repetir la resolución de
 * workspaces de asesores. */
export default async function AsesoresOperacionesPage() {
  await requireActiveWorkspace();
  const agencyWorkspaceId = await getAgencyWorkspaceAccessForCurrentUser();
  if (!agencyWorkspaceId) return null;

  const moduleStatus = await getWorkspaceModuleStatus(agencyWorkspaceId);
  const moduleEnabled = moduleStatus.some((m) => m.moduleKey === "asesores" && m.enabled);
  if (!moduleEnabled) return null;

  const [advisors, policies] = await Promise.all([getAgencyAdvisorOptions(), getAgencyPolicies()]);
  const [payments, tasks, pendingDocs, activity] = await Promise.all([
    getAgencyPolicyPayments(policies),
    getAgencyOperationalTasks(agencyWorkspaceId),
    getAgencyPendingDocumentation(policies),
    getAgencyRecentActivity(),
  ]);

  return <OperacionesShell advisors={advisors} policies={policies} payments={payments} tasks={tasks} pendingDocs={pendingDocs} activity={activity} />;
}
