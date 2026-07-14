"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import { getOpenRouterIntegration, getWhatsAppIntegration } from "@/lib/integrations/queries";
import { disconnectGoogleCalendar, getGoogleCalendarStatus, importGoogleEvents } from "@/lib/integrations/googleCalendar";

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

  revalidatePath("/profile");
}

export async function getGoogleCalendarStatusAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getGoogleCalendarStatus(workspaceId);
}

export async function disconnectGoogleCalendarAction() {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
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
