import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";

/**
 * Outbound WhatsApp send, from the Inbox composer through YCloud.
 *
 * docs/blueprint/04-inbox.md is explicit that outbound sends must always go
 * through a single adapter path and always apply, unconditionally:
 *   1. Opt-out check (`contacts.whatsapp_opt_status`) — implemented below.
 *   2. 24h free-session window / approved-template guardrail — NOT
 *      implemented yet (deliberately out of scope: this pass only sends
 *      plain text, no template support exists to fall back to). Flagged
 *      here, not silently skipped — a message sent outside the 24h window
 *      without an approved template will be rejected by YCloud/WhatsApp
 *      itself for now, just not with a friendly in-app error yet.
 *
 * Auth: this is a Route Handler, not a Server Action, so `requireActiveWorkspace()`
 * (which calls `redirect()` on failure) would be wrong here — an API route
 * must return a JSON 401/403, never an HTTP redirect. Uses the redirect-free
 * `getActiveWorkspaceForUser` instead.
 *
 * Workspace-membership check: the conversation lookup is scoped to
 * `workspace_id = <the caller's active workspace>` — a conversation from a
 * different workspace simply won't be found (404), which is exactly
 * "validate the user belongs to the conversation's workspace" without a
 * separate check.
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) {
    return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });
  }

  let body: { conversation_id?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const conversationId = body.conversation_id;
  const content = body.content?.trim();
  if (!conversationId || !content) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (content.length > 4096) {
    // YCloud's documented limit for `text.body` (docs/blueprint/08-integrations.md).
    return NextResponse.json({ error: "content_too_long" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, whatsapp_phone_number_id, contacts(phone, whatsapp_opt_status)")
    .eq("id", conversationId)
    .eq("workspace_id", active.workspaceId)
    .maybeSingle();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  }

  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  const contactPhone = contact?.phone as string | undefined;
  const optStatus = contact?.whatsapp_opt_status as string | undefined;

  if (!contactPhone) {
    return NextResponse.json({ error: "contact_missing_phone" }, { status: 422 });
  }
  if (optStatus === "unsubscribed") {
    console.warn(`[messages/send] blocked: contact for conversation ${conversationId} has opted out.`);
    return NextResponse.json({ error: "contact_unsubscribed" }, { status: 422 });
  }
  if (!conversation.whatsapp_phone_number_id) {
    return NextResponse.json({ error: "conversation_missing_business_number" }, { status: 422 });
  }

  const apiKey = process.env.YCLOUD_API_KEY;
  if (!apiKey) {
    console.error("[messages/send] YCLOUD_API_KEY is not configured — cannot send.");
    return NextResponse.json({ error: "ycloud_not_configured" }, { status: 500 });
  }

  const fromNumber = toE164(conversation.whatsapp_phone_number_id as string);
  const toNumber = toE164(contactPhone);

  let ycloudMessage: { id?: string; wamid?: string; status?: string };
  try {
    const res = await fetch("https://api.ycloud.com/v2/whatsapp/messages", {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromNumber, to: toNumber, type: "text", text: { body: content } }),
    });
    const data = await res.json();
    // Log the full response regardless of outcome — the send response itself
    // carries YCloud's real `status` (accepted|failed|sent|delivered|read per
    // docs/blueprint/08-integrations.md), which matters even on a 2xx HTTP
    // status: YCloud can return 200 with status:"failed" (e.g. recipient
    // outside the 24h session window with no approved template — the
    // guardrail this pass deliberately doesn't implement yet).
    console.log(`[messages/send] YCloud response (HTTP ${res.status}):`, JSON.stringify(data, null, 2));
    if (!res.ok) {
      console.error("[messages/send] YCloud rejected the send:", res.status, data);
      return NextResponse.json({ error: "ycloud_send_failed", detail: data }, { status: 502 });
    }
    ycloudMessage = data;
  } catch (err) {
    console.error("[messages/send] network error calling YCloud:", err);
    return NextResponse.json({ error: "ycloud_network_error" }, { status: 502 });
  }

  if (ycloudMessage.status === "failed") {
    console.error(`[messages/send] YCloud accepted the request but reports status="failed":`, ycloudMessage);
    return NextResponse.json({ error: "ycloud_send_failed", detail: ycloudMessage }, { status: 502 });
  }

  // YCloud accepted the send — persist. If this fails, the message is truly
  // sent (irreversible) but invisible in the Inbox; log loudly so it's not a
  // silent loss, matching the resilience rule in 08-integrations.md.
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", active.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: newMessage, error: insertError } = await supabase
    .from("messages")
    .insert({
      workspace_id: active.workspaceId,
      conversation_id: conversationId,
      direction: "outbound",
      sender_type: "agent",
      sender_id: member?.id ?? null,
      type: "text",
      content: { body: content },
      external_id: ycloudMessage.id ?? null,
      wamid: ycloudMessage.wamid ?? null,
      status: ycloudMessage.status ?? "sent",
    })
    .select("id, created_at")
    .single();

  if (insertError || !newMessage) {
    console.error(
      `[messages/send] YCloud ACCEPTED the message (wamid=${ycloudMessage.wamid}) but persisting it failed — ` +
        "it was really sent and won't show in the Inbox:",
      insertError,
    );
    return NextResponse.json({ error: "persist_failed" }, { status: 500 });
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: newMessage.created_at as string })
    .eq("id", conversationId);

  return NextResponse.json(
    { id: newMessage.id, createdAt: newMessage.created_at, wamid: ycloudMessage.wamid ?? null },
    { status: 200 },
  );
}

/** YCloud's send API wants E.164 (`from`/`to`, always with a leading '+'),
 * while `conversations.whatsapp_phone_number_id` was stored exactly as the
 * inbound webhook's `to` arrived (documented as without '+') — normalize
 * defensively rather than assume either side's format. */
function toE164(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}
