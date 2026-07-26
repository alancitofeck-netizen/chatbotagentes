import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { digitsOnly } from "@/lib/integrations/ycloud";

export type MessagingProviderResolution =
  | { provider: "ycloud" }
  | { provider: "whatsapp_web"; sessionId: string }
  | null;

/**
 * Resolves which provider owns a conversation's business number — reuses
 * `conversations.whatsapp_phone_number_id` as-is for BOTH providers (no new
 * column) by matching it against `integration_connections` (YCloud) first,
 * then `whatsapp_web_sessions` (WhatsApp Web).
 *
 * IMPORTANT: always call with a service-role client, never a request-scoped
 * one — `whatsapp_web_sessions` RLS only lets a plain Agent see their OWN
 * row, but this routing decision needs to see every connected session in
 * the workspace regardless of who's sending the message (e.g. Agent B
 * replying on a conversation tied to Agent A's connected number). Same
 * reasoning `sendOutboundWhatsAppMessage` already applies to
 * `getYCloudCredentials` (src/lib/integrations/ycloud.ts).
 */
export async function resolveMessagingProviderForConversation(
  supabase: SupabaseClient,
  workspaceId: string,
  businessNumber: string | null,
): Promise<MessagingProviderResolution> {
  if (!businessNumber) return null;
  const target = digitsOnly(businessNumber);

  const { data: ycloudRows } = await supabase
    .from("integration_connections")
    .select("external_account_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", "ycloud")
    .eq("status", "active");
  if ((ycloudRows ?? []).some((r) => digitsOnly(r.external_account_id as string) === target)) {
    return { provider: "ycloud" };
  }

  const { data: sessionRows } = await supabase
    .from("whatsapp_web_sessions")
    .select("id, phone_e164")
    .eq("workspace_id", workspaceId)
    .eq("status", "connected");
  const match = (sessionRows ?? []).find((r) => r.phone_e164 && digitsOnly(r.phone_e164 as string) === target);
  if (match) return { provider: "whatsapp_web", sessionId: match.id as string };

  return null;
}
