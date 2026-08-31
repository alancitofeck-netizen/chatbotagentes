"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { requireManagerRole, requireNotSupervising } from "@/lib/auth/roles";
import { notifyManagers } from "@/lib/notifications/service";
import { getOpenRouterIntegration, getWhatsAppIntegration } from "@/lib/integrations/queries";
import { disconnectGoogleCalendar, getGoogleCalendarStatus, importGoogleEvents } from "@/lib/integrations/googleCalendar";
import { disconnectGoogleDrive, getGoogleDriveStatus } from "@/lib/integrations/googleDrive";
import { disconnectGoogleSheets } from "@/lib/integrations/googleSheets";
import { disconnectInstagram, getInstagramStatus } from "@/lib/integrations/instagram";
import {
  getManychatStatus,
  generateManychatWebhookSecret,
  disconnectManychat,
  getManychatLeads,
  getManychatLeadDetail,
  updateManychatLeadStatus,
  getManychatDashboardSummary,
  getManychatContentStats,
  saveManychatApiToken,
  syncManychatContacts,
} from "@/lib/integrations/manychat";
import { getWhatsAppReferralsOnlyMode, updateWhatsAppReferralsOnlyMode } from "@/lib/messaging/referralAuthorization";

export async function getWhatsAppIntegrationAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getWhatsAppIntegration(workspaceId);
}

/** Delegates the actual write to public.upsert_whatsapp_integration (RPC,
 * supabase/migrations/0012_whatsapp_integration_vault.sql) — a SECURITY
 * DEFINER function, because storing the real key in Supabase Vault requires
 * calling `vault.create_secret`/`update_secret`, which PostgREST doesn't
 * expose and `authenticated` has no grants on directly. The RPC re-checks
 * owner/admin itself; the check here just fails fast with a friendlier
 * message before making the round trip. */
export async function saveWhatsAppIntegration(input: {
  externalAccountId: string;
  apiKey: string;
  displayName?: string;
}) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const externalAccountId = input.externalAccountId.trim();
  const apiKey = input.apiKey.trim();
  if (!externalAccountId) throw new Error("El número de WhatsApp Business es obligatorio.");

  const supabase = await createClient();
  // Blank apiKey means "keep the existing key" (editing display name/phone
  // only) — the RPC only touches Vault when p_api_key is non-null, so this
  // must send `null`, not an empty string, or it would try to overwrite the
  // secret with blank text.
  const { error } = await supabase.rpc("upsert_whatsapp_integration", {
    p_workspace_id: workspaceId,
    p_external_account_id: externalAccountId,
    p_api_key: apiKey || null,
    p_display_name: input.displayName?.trim() || null,
  });

  if (error) {
    throw new Error(
      apiKey || undefined
        ? "No se pudo guardar la integración de WhatsApp."
        : "No se pudo guardar — si es la primera vez que conectás este workspace, la API Key es obligatoria.",
    );
  }

  revalidatePath("/profile");
}

export async function disconnectWhatsAppIntegration() {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const supabase = await createClient();
  const { error } = await supabase.rpc("disconnect_whatsapp_integration", { p_workspace_id: workspaceId });
  if (error) throw new Error("No se pudo desconectar la integración de WhatsApp.");

  const ownMemberId = await getCurrentMemberId(workspaceId);
  await notifyManagers(
    workspaceId,
    { eventType: "integration_disconnected", title: "Integración desconectada", message: "WhatsApp (YCloud) se desconectó.", actionUrl: "/profile" },
    ownMemberId,
  );

  revalidatePath("/profile");
}

export async function getOpenRouterIntegrationAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getOpenRouterIntegration(workspaceId);
}

/** Mirrors saveWhatsAppIntegration exactly — delegates to
 * public.upsert_openrouter_integration (0021_openrouter_integration_vault.sql),
 * same SECURITY DEFINER/Vault reasoning, no external_account_id input (it's
 * derived server-side as workspace_id::text, see that migration). */
export async function saveOpenRouterIntegration(input: { apiKey: string; displayName?: string }) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const apiKey = input.apiKey.trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_openrouter_integration", {
    p_workspace_id: workspaceId,
    p_api_key: apiKey || null,
    p_display_name: input.displayName?.trim() || null,
  });

  if (error) {
    throw new Error(
      apiKey || undefined
        ? "No se pudo guardar la integración de OpenRouter."
        : "No se pudo guardar — si es la primera vez que conectás este workspace, la API Key es obligatoria.",
    );
  }

  revalidatePath("/profile");
}

export async function disconnectOpenRouterIntegration() {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const supabase = await createClient();
  const { error } = await supabase.rpc("disconnect_openrouter_integration", { p_workspace_id: workspaceId });
  if (error) throw new Error("No se pudo desconectar la integración de OpenRouter.");

  const ownMemberId = await getCurrentMemberId(workspaceId);
  await notifyManagers(
    workspaceId,
    { eventType: "integration_disconnected", title: "Integración desconectada", message: "OpenRouter se desconectó.", actionUrl: "/profile" },
    ownMemberId,
  );

  revalidatePath("/profile");
}

export async function getGoogleCalendarStatusAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getGoogleCalendarStatus(workspaceId);
}

// Google Calendar/Sheets/Drive are deliberately NOT gated by
// requireManagerRole (owner/admin only) — each Agent administers their OWN
// workspace's integrations (a self-service signup has no owner/admin at
// all, per provision-workspace.ts). requireNotSupervising (src/lib/auth/roles.ts)
// is the only thing still blocked: a platform admin's "modo supervisor"
// session, not a real member.
export async function disconnectGoogleCalendarAction() {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  await disconnectGoogleCalendar(workspaceId);
  revalidatePath("/profile");
}

export async function syncGoogleCalendarNowAction() {
  const { workspaceId } = await requireActiveWorkspace();
  const result = await importGoogleEvents(workspaceId);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return result;
}

export async function getGoogleDriveStatusAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getGoogleDriveStatus(workspaceId);
}

export async function disconnectGoogleDriveAction() {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  await disconnectGoogleDrive(workspaceId);
  revalidatePath("/profile");
  revalidatePath("/documents");
}

export async function disconnectGoogleSheetsAction() {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  await disconnectGoogleSheets(workspaceId);
  revalidatePath("/profile");
  revalidatePath("/crm");
}

export async function getInstagramStatusAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getInstagramStatus(workspaceId);
}

export async function disconnectInstagramAction() {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  await disconnectInstagram(workspaceId);
  revalidatePath("/profile");
  revalidatePath("/inbox");
}

export async function getManychatStatusAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getManychatStatus(workspaceId);
}

export async function generateManychatWebhookSecretAction() {
  const { workspaceId, role, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  requireManagerRole(role);
  const secret = await generateManychatWebhookSecret(workspaceId);
  // Activa el módulo automáticamente al conectar — sin esto, el usuario
  // tendría que además ir a Configuración → Módulos a prenderlo a mano,
  // un segundo paso que no aporta nada acá (a diferencia de otros módulos,
  // conectar YA es la señal explícita de que lo quiere activo).
  const supabase = await createClient();
  await supabase.from("workspace_modules").upsert({ workspace_id: workspaceId, module_key: "manychat", enabled: true, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,module_key" });
  revalidatePath("/manychat");
  revalidatePath("/dashboard");
  return secret;
}

export async function disconnectManychatAction() {
  const { workspaceId, role, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  requireManagerRole(role);
  await disconnectManychat(workspaceId);
  revalidatePath("/profile");
  revalidatePath("/manychat");
}

export async function getManychatLeadsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getManychatLeads(workspaceId);
}

export async function getManychatLeadDetailAction(contactId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getManychatLeadDetail(workspaceId, contactId);
}

export async function updateManychatLeadStatusAction(contactId: string, status: string) {
  const { workspaceId } = await requireActiveWorkspace();
  await updateManychatLeadStatus(workspaceId, contactId, status);
  revalidatePath("/manychat");
}

export async function getManychatDashboardSummaryAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getManychatDashboardSummary(workspaceId);
}

export async function getManychatContentStatsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getManychatContentStats(workspaceId);
}

export async function saveManychatApiTokenAction(token: string) {
  const { workspaceId, role, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  requireManagerRole(role);
  if (!token.trim()) throw new Error("El API Token es obligatorio.");
  await saveManychatApiToken(workspaceId, token.trim());
  revalidatePath("/manychat");
}

export async function syncManychatContactsAction() {
  const { workspaceId, role, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  requireManagerRole(role);
  const result = await syncManychatContacts(workspaceId);
  revalidatePath("/manychat");
  return result;
}

/** "Solo Referidos CRM" — mismo criterio que Google Calendar/Sheets/Drive:
 * cada Agent administra el modo de WhatsApp de SU PROPIO workspace, no
 * gateado a owner/admin. requireNotSupervising sigue bloqueando la sesión
 * "modo supervisor" de un platform admin (no es un miembro real). */
export async function getWhatsAppReferralsOnlyModeAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getWhatsAppReferralsOnlyMode(workspaceId);
}

export async function updateWhatsAppReferralsOnlyModeAction(enabled: boolean) {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  await updateWhatsAppReferralsOnlyMode(workspaceId, enabled);
  revalidatePath("/profile");
}
