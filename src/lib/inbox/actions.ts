"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import {
  getConversationDetail,
  getConversationList,
  getWorkspaceMembers,
  getWorkspaceTags,
} from "@/lib/inbox/queries";
import { sendOutboundWhatsAppMessage } from "@/lib/messaging/send";

export async function getConversationListAction(filters: { status?: string; search?: string }) {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  return getConversationList(workspaceId, filters, memberId);
}

/** Upserts this agent's own read-state row (conversation_reads,
 * supabase/migrations/0014_conversation_reads.sql) — fire-and-forget from the
 * client whenever a conversation is opened, so unread counts clear and stay
 * cleared across reloads. RLS only lets an agent write their own member_id
 * row, enforced at the DB level regardless of what's passed here. */
export async function markConversationRead(conversationId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return;

  const supabase = await createClient();
  await supabase.from("conversation_reads").upsert(
    { conversation_id: conversationId, workspace_id: workspaceId, member_id: memberId, last_read_at: new Date().toISOString() },
    { onConflict: "conversation_id,member_id" },
  );
}

export async function getConversationDetailAction(conversationId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getConversationDetail(workspaceId, conversationId);
}

export async function getWorkspaceMembersAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getWorkspaceMembers(workspaceId);
}

export async function getWorkspaceTagsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getWorkspaceTags(workspaceId);
}

export async function updateConversationStatus(conversationId: string, status: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase
    .from("conversations")
    .update({ status })
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId);

  revalidatePath("/inbox");
}

/** Mirrors updateConversationStatus exactly — `mode` (human/ai/hybrid,
 * docs/blueprint/13-agent-engine.md) was schema-only until the Motor de IA
 * pass: the Buffer Inteligente flush reads it to decide whether to invoke
 * the Agent Runtime at all (src/lib/ai/decisionEngine.ts). */
export async function updateConversationMode(conversationId: string, mode: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase
    .from("conversations")
    .update({ mode })
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId);

  revalidatePath("/inbox");
}

/**
 * Draft-approval workflow (modo asistido, Agentes IA) — `messages.status`
 * has no CHECK constraint (confirmed), so 'draft'/'approved'/'rejected' are
 * fully additive. Never deletes a draft row on approve/reject — same
 * "a real message's own row is never rewritten/erased" rule already
 * followed for the failed-send retry flow in ConversationThread.tsx, and it
 * feeds the future Métricas "derivaciones/rechazos" stat for free.
 *
 * Discriminated result instead of throw — this calls `sendOutboundWhatsAppMessage`
 * (an external YCloud call), the exact failure mode this session's established
 * rule targets (thrown errors from a Server Action doing an external call get
 * redacted to a generic message in production builds, confirmed empirically).
 */
export async function approveDraftMessage(messageId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { data: draft } = await supabase
    .from("messages")
    .select("id, conversation_id, content")
    .eq("id", messageId)
    .eq("workspace_id", workspaceId)
    .eq("status", "draft")
    .maybeSingle();
  if (!draft) return { ok: false, error: "draft_not_found" };

  const body = (draft.content as { body?: string } | null)?.body ?? "";
  // Re-validates opt-out/24h-window at THIS moment — deliberately not
  // checked when the draft was created, since time may have passed between
  // the AI drafting it and a human approving it (agentRuntime.ts).
  const result = await sendOutboundWhatsAppMessage({
    supabase,
    workspaceId,
    conversationId: draft.conversation_id as string,
    content: body,
    senderType: "agent",
    senderId: memberId,
  });
  if (!result.ok) return { ok: false, error: result.error };

  await supabase.from("messages").update({ status: "approved" }).eq("id", messageId);
  revalidatePath("/inbox");
  return { ok: true };
}

export async function editDraftMessage(messageId: string, newContent: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  if (!newContent.trim()) throw new Error("El mensaje no puede estar vacío.");
  const supabase = await createClient();

  const { error } = await supabase
    .from("messages")
    .update({ content: { body: newContent.trim() } })
    .eq("id", messageId)
    .eq("workspace_id", workspaceId)
    .eq("status", "draft");
  if (error) throw new Error("No se pudo editar el borrador.");

  revalidatePath("/inbox");
}

export async function rejectDraftMessage(messageId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("messages")
    .update({ status: "rejected" })
    .eq("id", messageId)
    .eq("workspace_id", workspaceId)
    .eq("status", "draft");
  if (error) throw new Error("No se pudo rechazar la sugerencia.");

  revalidatePath("/inbox");
}

export async function assignConversation(conversationId: string, memberId: string | null) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase
    .from("conversations")
    .update({ assigned_user_id: memberId })
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId);

  revalidatePath("/inbox");
}

export async function addConversationNote(conversationId: string, body: string) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!body.trim()) return;
  const supabase = await createClient();

  await supabase.from("notes").insert({
    workspace_id: workspaceId,
    notable_type: "conversation",
    notable_id: conversationId,
    body: body.trim(),
  });

  revalidatePath("/inbox");
}

export async function toggleContactTag(contactId: string, tagId: string, enabled: boolean) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  // contact_tags has no workspace_id column of its own (scoped via contacts in
  // RLS) — re-validate the contact belongs to this workspace before writing,
  // same defense-in-depth already used for moveOpportunityCard (src/lib/crm/actions.ts).
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!contact) throw new Error("Contacto no encontrado en este workspace.");

  if (enabled) {
    await supabase
      .from("contact_tags")
      .upsert({ contact_id: contactId, tag_id: tagId }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
  } else {
    await supabase.from("contact_tags").delete().eq("contact_id", contactId).eq("tag_id", tagId);
  }

  // Tags are shared between Inbox/Contactos and the CRM board (they live on the
  // contact, not a per-module table) — revalidate both consumers.
  revalidatePath("/inbox");
  revalidatePath("/crm");
}

/** No tag-creation UI existed anywhere before the CRM board redesign — tags
 * could only be toggled if they already existed. Shared here (not duplicated
 * in crm/actions.ts) since tags are a core concept reused across modules. */
export async function createWorkspaceTag(name: string, color: string) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!name.trim()) throw new Error("El nombre de la etiqueta es obligatorio.");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tags")
    .insert({ workspace_id: workspaceId, name: name.trim(), color })
    .select("id, name, color")
    .single();

  if (error || !data) {
    if (error?.code === "23505") throw new Error("Ya existe una etiqueta con ese nombre.");
    throw new Error("No se pudo crear la etiqueta.");
  }

  revalidatePath("/inbox");
  revalidatePath("/crm");
  return { id: data.id as string, name: data.name as string, color: data.color as string };
}
