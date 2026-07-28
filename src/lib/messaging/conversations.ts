import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Picks a business number to attach a brand-new outbound-first conversation
 * to — prefers YCloud (this app's primary channel) over WhatsApp Web,
 * matching the resolution order `resolveMessagingProviderForConversation`
 * already implies. Returns null if the workspace has no connected channel
 * at all, in which case there's nowhere to send from yet. */
export async function getDefaultOutboundBusinessNumber(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<string | null> {
  const { data: ycloudRows } = await supabase
    .from("integration_connections")
    .select("external_account_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", "ycloud")
    .eq("status", "active")
    .limit(1);
  if (ycloudRows?.[0]) return ycloudRows[0].external_account_id as string;

  const { data: sessionRows } = await supabase
    .from("whatsapp_web_sessions")
    .select("phone_e164")
    .eq("workspace_id", workspaceId)
    .eq("status", "connected")
    .limit(1);
  if (sessionRows?.[0]?.phone_e164) return sessionRows[0].phone_e164 as string;

  return null;
}

/** Finds an already-open conversation for this contact, or creates one —
 * mirrors src/lib/messaging/ingest.ts's inbound-triggered version exactly,
 * except this is outbound-first (an agent proactively reaching out to a
 * lead, e.g. from Mini Apps), so `mode` defaults to "human" (not "ai") and
 * `assigned_user_id` is set to whoever is starting it, rather than left
 * null for the AI to pick up. */
export async function getOrCreateOpenConversationForContact(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string,
  businessNumber: string,
  assignedMemberId: string | null,
): Promise<string> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .eq("status", "open")
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      workspace_id: workspaceId,
      contact_id: contactId,
      whatsapp_phone_number_id: businessNumber,
      status: "open",
      mode: "human",
      assigned_user_id: assignedMemberId,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !created) throw new Error("No se pudo crear la conversación.");
  return created.id as string;
}
