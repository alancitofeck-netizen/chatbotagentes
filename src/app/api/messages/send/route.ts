import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { sendOutboundWhatsAppMessage } from "@/lib/messaging/send";

/**
 * Outbound WhatsApp send, from the Inbox composer through YCloud. Thin
 * wrapper around the shared `sendOutboundWhatsAppMessage` (src/lib/messaging/
 * send.ts) — the opt-out/24h-window/persistence/audit logic used to live
 * inline here; it moved out so the AI/automation send paths (Motor de IA)
 * reuse the exact same checks instead of duplicating them.
 *
 * Auth: this is a Route Handler, not a Server Action, so `requireActiveWorkspace()`
 * (which calls `redirect()` on failure) would be wrong here — an API route
 * must return a JSON 401/403, never an HTTP redirect. Uses the redirect-free
 * `getActiveWorkspaceForUser` instead.
 *
 * Workspace-membership check: the conversation lookup inside the shared
 * function is scoped to `workspace_id = <the caller's active workspace>` — a
 * conversation from a different workspace simply won't be found (404).
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

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", active.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  const result = await sendOutboundWhatsAppMessage({
    supabase,
    workspaceId: active.workspaceId,
    conversationId,
    content,
    senderType: "agent",
    senderId: member?.id ?? null,
  });

  if (!result.ok) {
    const status =
      result.error === "conversation_not_found"
        ? 404
        : result.error === "ycloud_not_configured"
          ? 500
          : result.error === "ycloud_send_failed" || result.error === "ycloud_network_error"
            ? 502
            : result.error === "persist_failed"
              ? 500
              : 422;
    return NextResponse.json({ error: result.error, detail: "detail" in result ? result.detail : undefined }, { status });
  }

  return NextResponse.json({ id: result.id, createdAt: result.createdAt, wamid: result.wamid }, { status: 200 });
}
