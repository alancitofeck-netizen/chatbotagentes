import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getLinkedWorkspaceId } from "./queries";
import { getAsesoriaList, getAsesoriaById, getAsesoriaResponses, type AsesoriaListItem, type AsesoriaRow, type AsesoriaResponseRow } from "@/lib/asesorias/queries";
import { getWorkspaceReferrals, type ReferralRow } from "@/lib/asesorias/referrals";
import {
  getMiniAppsList,
  getMiniAppLeads,
  getMiniAppLeadDetail,
  getMiniAppDetail,
  type MiniAppListItem,
  type MiniAppLeadRow,
  type MiniAppLeadDetail,
  type MiniAppDetail,
} from "@/lib/miniApps/queries";

/** Capa de datos de "Operación" (ficha de Asesores) — wrappers finos que
 * resuelven `linkedWorkspaceId` (workspace REAL del asesor, ver
 * getLinkedWorkspaceId en queries.ts) y delegan en las queries ya existentes
 * de Asesorías/Referidos/Mini Apps (todas ya reciben `workspaceId` explícito,
 * ver 13-agent-engine.md/03-modules.md — ninguna depende de sesión activa).
 * Es la misma indirección que ya usa getClientAppointments/getClientPolicies
 * para bookings/policies — acá se extiende a los otros 3 módulos del asesor,
 * de solo lectura (nunca se escribe nada de otro workspace desde acá). */

export async function getClientAsesorias(workspaceId: string, clientId: string): Promise<AsesoriaListItem[]> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return [];
  return getAsesoriaList(linkedWorkspaceId);
}

export interface ClientAsesoriaDetail {
  asesoria: AsesoriaRow;
  responses: AsesoriaResponseRow[];
}

export async function getClientAsesoriaDetail(workspaceId: string, clientId: string, asesoriaId: string): Promise<ClientAsesoriaDetail | null> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return null;
  const [asesoria, responses] = await Promise.all([getAsesoriaById(linkedWorkspaceId, asesoriaId), getAsesoriaResponses(linkedWorkspaceId, asesoriaId)]);
  if (!asesoria) return null;
  return { asesoria, responses };
}

export async function getClientReferrals(workspaceId: string, clientId: string): Promise<ReferralRow[]> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return [];
  return getWorkspaceReferrals(linkedWorkspaceId);
}

export async function getClientMiniApps(workspaceId: string, clientId: string): Promise<MiniAppListItem[]> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return [];
  return getMiniAppsList(linkedWorkspaceId);
}

export async function getClientMiniAppLeads(workspaceId: string, clientId: string, miniAppId: string): Promise<MiniAppLeadRow[]> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return [];
  return getMiniAppLeads(linkedWorkspaceId, miniAppId);
}

export interface ClientMiniAppLeadDetail {
  lead: MiniAppLeadDetail;
  miniApp: MiniAppDetail | null;
}

export async function getClientMiniAppLeadDetail(workspaceId: string, clientId: string, leadId: string): Promise<ClientMiniAppLeadDetail | null> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return null;
  const lead = await getMiniAppLeadDetail(linkedWorkspaceId, leadId);
  if (!lead) return null;
  const miniApp = await getMiniAppDetail(linkedWorkspaceId, lead.miniAppId);
  return { lead, miniApp };
}

export interface ClientOperacionModules {
  asesorias: boolean;
  miniApps: boolean;
}

/** Oculta las sub-pestañas Asesorías/Mini Apps si el asesor no tiene esos
 * módulos habilitados en su propio workspace — mismo criterio que ya usa
 * asesores/page.tsx para el módulo "asesores" en sí. */
export async function getClientOperacionModules(workspaceId: string, clientId: string): Promise<ClientOperacionModules> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return { asesorias: false, miniApps: false };
  const statuses = await getWorkspaceModuleStatus(linkedWorkspaceId);
  const enabledByKey = new Map(statuses.map((s) => [s.moduleKey, s.enabled]));
  return { asesorias: enabledByKey.get("asesorias") ?? false, miniApps: enabledByKey.get("mini_apps") ?? false };
}

export interface ClientRecentMiniAppLead {
  id: string;
  miniAppId: string;
  miniAppName: string;
  nombre: string;
  receivedAt: string;
}

/** Única query nueva del rediseño: getMiniAppsList (miniApps/queries.ts) ya
 * trae agregados por Mini App (leadsCount/lastLeadAt) pero no filas de leads
 * cross-todas-las-apps — hace falta para "Actividad reciente" del Resumen. */
export async function getClientRecentMiniAppLeads(workspaceId: string, clientId: string, limit = 8): Promise<ClientRecentMiniAppLead[]> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("mini_app_leads")
    .select("id, mini_app_id, nombre, received_at, mini_apps(name)")
    .eq("workspace_id", linkedWorkspaceId)
    .order("received_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => {
    const miniApp = Array.isArray(r.mini_apps) ? r.mini_apps[0] : r.mini_apps;
    return {
      id: r.id as string,
      miniAppId: r.mini_app_id as string,
      miniAppName: (miniApp?.name as string | undefined) ?? "Mini App",
      nombre: r.nombre as string,
      receivedAt: r.received_at as string,
    };
  });
}
