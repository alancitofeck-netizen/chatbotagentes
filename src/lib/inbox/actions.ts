"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import {
  getConversationDetail,
  getConversationList,
  getWorkspaceMembers,
  getWorkspaceTags,
} from "@/lib/inbox/queries";

export async function getConversationListAction(filters: { status?: string; search?: string }) {
  const { workspaceId } = await requireActiveWorkspace();
  return getConversationList(workspaceId, filters);
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

  revalidatePath("/inbox");
}
