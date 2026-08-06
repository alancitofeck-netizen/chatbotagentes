import type { SupabaseClient } from "@supabase/supabase-js";

/** Contexto de ejecución de una herramienta del Asistente IA — mismo motivo
 * que tools/shared.ts del motor de WhatsApp (siempre service-role, ya que
 * corre server-side sin sesión RLS-scoped dentro del loop), pero sin
 * conversationId/contactId (acá no hay conversación con un tercero, ver la
 * nota en 0106_ai_assistant_module.sql). */
export interface AssistantToolContext {
  supabase: SupabaseClient;
  workspaceId: string;
  memberId: string;
}

export type AssistantToolHandler = (args: Record<string, unknown>, ctx: AssistantToolContext) => Promise<unknown>;

/** Mismo motivo que crossTenantRejection (tools/shared.ts del motor de
 * WhatsApp): nunca confiar en un id que el modelo pasó como argumento sin
 * re-verificar que pertenece a este workspace primero. */
export function crossTenantRejection(entity: string): Error {
  return new Error(`cross_tenant_id_rejected: ${entity} no pertenece a este workspace`);
}
