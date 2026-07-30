"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import { getGroupStats, getTaskGroups, type GroupColor } from "./queries";
import { GROUP_TEMPLATES } from "./groupTemplates";

function revalidateGroups() {
  revalidatePath("/tasks");
}

export interface TaskGroupInput {
  name: string;
  description: string;
  icon: string;
  color: GroupColor;
  coverImageUrl: string | null;
}

export async function createTaskGroup(input: TaskGroupInput): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const name = input.name.trim();
  if (!name) throw new Error("El nombre es obligatorio.");
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { count } = await supabase.from("task_groups").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
  const { data, error } = await supabase
    .from("task_groups")
    .insert({
      workspace_id: workspaceId,
      name,
      description: input.description.trim() || null,
      icon: input.icon || "📁",
      color: input.color,
      cover_image_url: input.coverImageUrl,
      created_by: memberId,
      position: count ?? 0,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear el grupo.");
  revalidateGroups();
  return { id: data.id as string };
}

export async function updateTaskGroup(groupId: string, input: TaskGroupInput): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const name = input.name.trim();
  if (!name) throw new Error("El nombre es obligatorio.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_groups")
    .update({
      name,
      description: input.description.trim() || null,
      icon: input.icon || "📁",
      color: input.color,
      cover_image_url: input.coverImageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", groupId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el grupo.");
  revalidateGroups();
  revalidatePath(`/tasks/groups/${groupId}`);
}

export async function toggleGroupFavorite(groupId: string, isFavorite: boolean): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await supabase.from("task_groups").update({ is_favorite: isFavorite }).eq("id", groupId).eq("workspace_id", workspaceId);
  revalidateGroups();
  revalidatePath(`/tasks/groups/${groupId}`);
  revalidatePath("/tasks/favorites");
}

export async function archiveGroup(groupId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await supabase.from("task_groups").update({ is_archived: true }).eq("id", groupId).eq("workspace_id", workspaceId);
  revalidateGroups();
  revalidatePath("/tasks/archived");
}

export async function unarchiveGroup(groupId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await supabase.from("task_groups").update({ is_archived: false }).eq("id", groupId).eq("workspace_id", workspaceId);
  revalidateGroups();
  revalidatePath("/tasks/archived");
}

/** Same drag-reorder pattern as reorderPipelineStages (src/lib/crm/actions.ts),
 * used by ManagePipelineSheet.tsx — bulk-update `position`, no renumbering
 * logic beyond the plain array index. */
export async function reorderGroups(orderedIds: string[]): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("task_groups").update({ position: index }).eq("id", id).eq("workspace_id", workspaceId)),
  );
  revalidateGroups();
}

/** Idempotent: the auto-provisioned catch-all group for tasks created by
 * flows that don't know about Grupos (CardDetailSheet's opportunity
 * mini-form, ConversationThread's "Crear tarea"). Never surfaced as
 * duplicable/archivable in the UI, always sorted last in the sidebar
 * (position -1 plus getTaskGroups' is_default-last ordering). */
export async function getOrCreateDefaultGroup(workspaceId: string): Promise<string> {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("task_groups").select("id").eq("workspace_id", workspaceId).eq("is_default", true).maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("task_groups")
    .insert({ workspace_id: workspaceId, name: "General", icon: "📥", color: "neutral", is_default: true, position: -1 })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear el grupo General.");
  return data.id as string;
}

/** Clones the group's own properties plus its tasks (title/description/
 * priority/due date, reset to status "pending") — deliberately does NOT
 * copy checklist items/comments/files, same "duplicate the shell, not every
 * child record" line Documents' own duplicateDocument already draws. */
export async function duplicateGroup(groupId: string): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { data: original, error: fetchError } = await supabase
    .from("task_groups")
    .select("name, description, icon, color, cover_image_url")
    .eq("id", groupId)
    .eq("workspace_id", workspaceId)
    .single();
  if (fetchError || !original) throw new Error("Grupo no encontrado.");

  const { count } = await supabase.from("task_groups").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
  const { data: newGroup, error: insertError } = await supabase
    .from("task_groups")
    .insert({
      workspace_id: workspaceId,
      name: `${original.name} (copia)`,
      description: original.description,
      icon: original.icon,
      color: original.color,
      cover_image_url: original.cover_image_url,
      created_by: memberId,
      position: count ?? 0,
    })
    .select("id")
    .single();
  if (insertError || !newGroup) throw new Error("No se pudo duplicar el grupo.");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, description, priority, due_at, assigned_to")
    .eq("workspace_id", workspaceId)
    .eq("group_id", groupId);
  if (tasks && tasks.length > 0) {
    await supabase.from("tasks").insert(
      tasks.map((t) => ({
        workspace_id: workspaceId,
        group_id: newGroup.id,
        created_by: memberId,
        assigned_to: t.assigned_to,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: "pending",
        due_at: t.due_at,
      })),
    );
  }

  revalidateGroups();
  return { id: newGroup.id as string };
}

export async function createGroupFromTemplate(templateKey: string): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const template = GROUP_TEMPLATES.find((t) => t.key === templateKey);
  if (!template) throw new Error("Plantilla no encontrada.");
  const supabase = await createClient();

  const { count } = await supabase.from("task_groups").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
  const { data: group, error } = await supabase
    .from("task_groups")
    .insert({
      workspace_id: workspaceId,
      name: template.label,
      description: template.description,
      icon: template.icon,
      color: template.color,
      created_by: memberId,
      position: count ?? 0,
    })
    .select("id")
    .single();
  if (error || !group) throw new Error("No se pudo crear el grupo.");

  await supabase.from("tasks").insert(
    template.taskTitles.map((title) => ({
      workspace_id: workspaceId,
      group_id: group.id,
      created_by: memberId,
      assigned_to: memberId,
      title,
      priority: "medium",
      status: "pending",
    })),
  );

  revalidateGroups();
  return { id: group.id as string };
}

export async function getTaskGroupsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getTaskGroups(workspaceId);
}

export async function getGroupStatsAction(groupId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getGroupStats(workspaceId, groupId);
}
