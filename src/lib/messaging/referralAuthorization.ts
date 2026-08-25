import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { digitsOnly } from "@/lib/integrations/ycloud";

/** "Solo Referidos CRM" — el gate de autorización pedido explícitamente por
 * el usuario: cuando está activo, el webhook de WhatsApp descarta CUALQUIER
 * mensaje de un número que no esté en asesoria_referrals de ese workspace,
 * ANTES de crear contacto/conversación/mensaje (nunca "guardar primero y
 * filtrar después"). Se agrega acá, no dentro de ingest.ts, para no
 * modificar el pipeline compartido por YCloud/WhatsApp Web/Instagram —
 * cada webhook llama a este check ANTES de invocar ingestInboundWhatsAppMessage.
 *
 * `asesoria_referrals` (0120_asesoria_referrals.sql) es la única fuente real
 * de "referido" en este CRM hoy — reusada tal cual, sin tabla nueva, según
 * lo confirmado con el usuario. */

/** Variantes con cliente de sesión (Server Actions, UI) — leen/escriben el
 * toggle por-workspace en `workspaces.whatsapp_referrals_only`. */
export async function getWhatsAppReferralsOnlyMode(workspaceId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("workspaces").select("whatsapp_referrals_only").eq("id", workspaceId).maybeSingle();
  return (data?.whatsapp_referrals_only as boolean | undefined) ?? true;
}

export async function updateWhatsAppReferralsOnlyMode(workspaceId: string, enabled: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").update({ whatsapp_referrals_only: enabled }).eq("id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el modo de WhatsApp.");
}

/** Variantes para los webhooks (service-role, sin sesión de usuario) — el
 * caller ya tiene un cliente service-role instanciado (mismo patrón que
 * resolveWorkspaceIdForYCloudAccount), se lo pasa en vez de crear uno nuevo. */
export async function isReferralsOnlyModeEnabled(supabase: SupabaseClient, workspaceId: string): Promise<boolean> {
  const { data } = await supabase.from("workspaces").select("whatsapp_referrals_only").eq("id", workspaceId).maybeSingle();
  return (data?.whatsapp_referrals_only as boolean | undefined) ?? true;
}

/** ¿Este teléfono es un referido autorizado en este workspace? Comparación
 * SIEMPRE por dígitos puros en ambos lados — asesoria_referrals.phone se
 * guarda SIN "+" (regexp_replace(...,'\D','','g'), ver
 * src/app/api/asesorias/[asesoriaId]/sync/route.ts línea ~164), mientras que
 * el teléfono que llega del webhook viene normalizado CON "+"
 * (normalizeE164). Comparar los strings tal cual nunca matchea — se
 * confirmó leyendo ambos paths antes de escribir esto, para no terminar
 * rechazando en silencio a TODOS los referidos reales. */
export async function isPhoneAuthorizedReferral(supabase: SupabaseClient, workspaceId: string, phoneRaw: string): Promise<boolean> {
  const digits = digitsOnly(phoneRaw);
  if (!digits) return false;
  const { data } = await supabase.from("asesoria_referrals").select("id").eq("workspace_id", workspaceId).eq("phone", digits).limit(1).maybeSingle();
  return data !== null;
}
