"use server";

import { requireActiveWorkspace } from "@/lib/auth/session";
import { requireAgencyWorkspaceAccess } from "@/lib/auth/roles";
import { getClientAsesoriaDetail, getClientMiniAppLeads, getClientMiniAppLeadDetail } from "./operacion";

/** Fetch on-demand desde los drawers de Operación (Asesorías/Mini Apps) —
 * evita traer por adelantado el detalle de TODAS las asesorías/leads de
 * TODOS los Mini Apps del asesor. Mismo gate que el resto de
 * src/lib/clients/actions.ts (requireAgencyWorkspaceAccess — owner/admin
 * real de la agencia, resuelto por usuario, no por workspace activo). */

export async function getClientAsesoriaDetailAction(clientId: string, asesoriaId: string) {
  await requireActiveWorkspace();
  const workspaceId = await requireAgencyWorkspaceAccess();
  return getClientAsesoriaDetail(workspaceId, clientId, asesoriaId);
}

export async function getClientMiniAppLeadsAction(clientId: string, miniAppId: string) {
  await requireActiveWorkspace();
  const workspaceId = await requireAgencyWorkspaceAccess();
  return getClientMiniAppLeads(workspaceId, clientId, miniAppId);
}

export async function getClientMiniAppLeadDetailAction(clientId: string, leadId: string) {
  await requireActiveWorkspace();
  const workspaceId = await requireAgencyWorkspaceAccess();
  return getClientMiniAppLeadDetail(workspaceId, clientId, leadId);
}
