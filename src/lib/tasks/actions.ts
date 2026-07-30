"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity/log";
import { getOrCreateDefaultGroup } from "@/lib/tasks/groups/actions";
import {
  getContactRelatedTasks,
  getOpportunityTasks,
  getTaskActivity,
  getTaskById,
  getTaskComments,
  getTaskDetail,
  getTasks,
  getTasksByGroup,
  type RelationEntityType,
  type TaskFilters,
  type TaskPriority,
  type TaskRelatedType,
  type TaskStatus,
} from "@/lib/tasks/queries";

const MANAGER_ROLES = ["owner", "admin"];

export interface TaskInput {
  title: string;
  description: string;
  priority: TaskPriority;
  /** Combined date+time ISO string, already assembled client-side (the form
   * has separate date/time inputs — see TaskFormSheet) — null means no due date. */
  dueAt: string | null;
  assignedTo: string;
  relatedType: TaskRelatedType | null;
  relatedId: string | null;
  /** Omitted (or null) by call sites that don't know about Grupos yet
   * (CardDetailSheet's opportunity mini-form, ConversationThread's "Crear
   * tarea") — createTask resolves those to the workspace's auto-provisioned
   * "General" group so nothing becomes an orphaned task. */
  groupId?: string | null;
}

/** Agents can only assign tasks to themselves — "si tiene permisos"
 * per the user's spec, interpreted as an app-level guard (not RLS, since
 * tasks_insert/update already allow any agent to write). Owner/admin may
 * assign to any member. Enforced server-side, not just hidden in the UI. */
async function resolveAssignedTo(role: string, requestedMemberId: string, ownMemberId: string): Promise<string> {
  if (MANAGER_ROLES.includes(role)) return requestedMemberId || ownMemberId;
  return ownMemberId;
}

function revalidateTaskPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/crm");
  revalidatePath("/tasks");
}

/** createTask/updateTask/completeTask are already plain, importable server
 * functions — the natural extension point for a future automations engine
 * (Sección 10 del rediseño: "lead ganado → crear tarea → ...") to call
 * without any new UI or trigger machinery being built in this pass. */
export async function createTask(input: TaskInput) {
  const { workspaceId, role } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  if (!ownMemberId) throw new Error("No se pudo resolver tu usuario en este workspace.");

  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");

  const assignedTo = await resolveAssignedTo(role, input.assignedTo, ownMemberId);
  const groupId = input.groupId ?? (await getOrCreateDefaultGroup(workspaceId));
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: workspaceId,
      group_id: groupId,
      created_by: ownMemberId,
      assigned_to: assignedTo,
      title,
      description: input.description.trim() || null,
      priority: input.priority,
      status: "pending",
      due_at: input.dueAt,
      related_type: input.relatedType,
      related_id: input.relatedId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear la tarea.");

  await logActivity(supabase, workspaceId, ownMemberId, "task", data.id as string, "task_created");
  revalidateTaskPaths();
  return { id: data.id as string };
}

export async function updateTask(taskId: string, input: TaskInput & { status: TaskStatus }) {
  const { workspaceId, role } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  if (!ownMemberId) throw new Error("No se pudo resolver tu usuario en este workspace.");

  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");

  const assignedTo = await resolveAssignedTo(role, input.assignedTo, ownMemberId);
  const supabase = await createClient();

  await supabase
    .from("tasks")
    .update({
      title,
      description: input.description.trim() || null,
      priority: input.priority,
      status: input.status,
      due_at: input.dueAt,
      assigned_to: assignedTo,
      related_type: input.relatedType,
      related_id: input.relatedId,
      // status is the source of truth (confirmed with the user) — completed_at
      // stays in sync automatically so the Dashboard's existing "pending"
      // notion (originally completed_at is null) keeps working.
      completed_at: input.status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId);

  await logActivity(supabase, workspaceId, ownMemberId, "task", taskId, "task_updated");
  revalidateTaskPaths();
  revalidatePath(`/tasks/${taskId}`);
}

/** Quick-toggle from the checkbox (Dashboard card and Lista view) — always
 * marks as completed; there's no quick-toggle back to pending from the
 * checkbox alone (use "Editar" > Estado or the Kanban view for that). */
export async function completeTask(taskId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  await supabase
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId);

  await logActivity(supabase, workspaceId, ownMemberId, "task", taskId, "task_status_changed", { status: "completed" });
  revalidateTaskPaths();
  revalidatePath(`/tasks/${taskId}`);
}

/** Owner/admin-only at the RLS layer (tasks_delete) — never exposed before
 * this redesign (no bulk/individual delete existed at all in the app). */
export async function deleteTask(taskId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo eliminar la tarea. Puede requerir rol de owner/admin.");
  revalidateTaskPaths();
}

export async function bulkCompleteTasks(taskIds: string[]) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!taskIds.length) return;
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in("id", taskIds)
    .eq("workspace_id", workspaceId);
  revalidateTaskPaths();
}

export async function bulkDeleteTasks(taskIds: string[]) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!taskIds.length) return;
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().in("id", taskIds).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudieron eliminar las tareas seleccionadas. Puede requerir rol de owner/admin.");
  revalidateTaskPaths();
}

export async function bulkAssignTasks(taskIds: string[], assignedTo: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  if (!taskIds.length || !ownMemberId) return;
  const resolvedAssignee = await resolveAssignedTo(role, assignedTo, ownMemberId);
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ assigned_to: resolvedAssignee, updated_at: new Date().toISOString() })
    .in("id", taskIds)
    .eq("workspace_id", workspaceId);
  revalidateTaskPaths();
}

/** Drives the Kanban view's drag & drop — same `onMove(id, stage, position)`
 * contract the generic KanbanBoard primitive already uses for CRM/ATS, with
 * "stage" narrowed to a task's fixed status enum instead of a configurable
 * pipeline stage. */
export async function moveTask(taskId: string, status: TaskStatus, position: number) {
  const { workspaceId } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  await supabase
    .from("tasks")
    .update({
      status,
      position,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId);

  await logActivity(supabase, workspaceId, ownMemberId, "task", taskId, "task_status_changed", { status });
  revalidateTaskPaths();
  revalidatePath(`/tasks/${taskId}`);
}

export async function toggleTaskFavorite(taskId: string, isFavorite: boolean) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await supabase.from("tasks").update({ is_favorite: isFavorite }).eq("id", taskId).eq("workspace_id", workspaceId);
  revalidateTaskPaths();
  revalidatePath(`/tasks/${taskId}`);
}

/** Saves the block editor's body separately from the property form
 * (updateTask above) — same "view/edit are separate concerns" convention
 * already used elsewhere in the app (e.g. CardDetailSheet/EventDetailDrawer
 * keep read and edit as two components), applied here to "properties" vs
 * "document body" instead. Writes both the Tiptap JSON doc and a derived
 * plain-text extract, so every existing plain-text reader of `description`
 * (TaskFormSheet, PendingTasks, search) keeps working unchanged. */
export async function updateTaskDescription(taskId: string, descriptionJson: unknown, plainText: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ description_json: descriptionJson, description: plainText.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId);
  revalidatePath(`/tasks/${taskId}`);
}

export async function updateTaskTitle(taskId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await supabase.from("tasks").update({ title: trimmed, updated_at: new Date().toISOString() }).eq("id", taskId).eq("workspace_id", workspaceId);
  revalidateTaskPaths();
  revalidatePath(`/tasks/${taskId}`);
}

// ---------------------------------------------------------------------------
// Checklist (subtasks)
// ---------------------------------------------------------------------------

export async function addChecklistItem(taskId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  const { workspaceId } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  const { count } = await supabase
    .from("task_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId);
  const { error } = await supabase
    .from("task_checklist_items")
    .insert({ workspace_id: workspaceId, task_id: taskId, title: trimmed, position: count ?? 0 });
  if (error) throw new Error("No se pudo agregar el ítem.");
  await logActivity(supabase, workspaceId, ownMemberId, "task", taskId, "task_checklist_item_added");
  revalidatePath(`/tasks/${taskId}`);
}

export async function toggleChecklistItem(itemId: string, taskId: string, isCompleted: boolean) {
  const { workspaceId } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  await supabase.from("task_checklist_items").update({ is_completed: isCompleted }).eq("id", itemId).eq("workspace_id", workspaceId);
  if (isCompleted) await logActivity(supabase, workspaceId, ownMemberId, "task", taskId, "task_checklist_item_completed");
  revalidatePath(`/tasks/${taskId}`);
}

export async function deleteChecklistItem(itemId: string, taskId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await supabase.from("task_checklist_items").delete().eq("id", itemId).eq("workspace_id", workspaceId);
  revalidatePath(`/tasks/${taskId}`);
}

export async function reorderChecklistItems(taskId: string, orderedIds: string[]) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("task_checklist_items").update({ position: index }).eq("id", id).eq("workspace_id", workspaceId)),
  );
  revalidatePath(`/tasks/${taskId}`);
}

// ---------------------------------------------------------------------------
// Relations (multi-relation panel — task_relations, additive to the legacy
// single related_type/related_id column, which stays untouched)
// ---------------------------------------------------------------------------

export async function addTaskRelation(taskId: string, type: RelationEntityType, relatedId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_relations")
    .insert({ workspace_id: workspaceId, task_id: taskId, related_type: type, related_id: relatedId });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      revalidatePath(`/tasks/${taskId}`);
      return; // ya relacionado — idempotente, no es un error real
    }
    throw new Error("No se pudo agregar la relación.");
  }
  await logActivity(supabase, workspaceId, ownMemberId, "task", taskId, "task_relation_added", { type });
  revalidatePath(`/tasks/${taskId}`);
}

export async function removeTaskRelation(relationId: string, taskId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await supabase.from("task_relations").delete().eq("id", relationId).eq("workspace_id", workspaceId);
  revalidatePath(`/tasks/${taskId}`);
}

// ---------------------------------------------------------------------------
// Comments (public.notes, notable_type='task')
// ---------------------------------------------------------------------------

export async function addTaskComment(taskId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { workspaceId } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  await supabase.from("notes").insert({ workspace_id: workspaceId, notable_type: "task", notable_id: taskId, author_id: ownMemberId, body: trimmed });
  await logActivity(supabase, workspaceId, ownMemberId, "task", taskId, "task_comment_added");
  revalidatePath(`/tasks/${taskId}`);
}

// ---------------------------------------------------------------------------
// Tags (reuses public.tags — the same table Contactos already uses via
// contact_tags — through the new task_tags join table)
// ---------------------------------------------------------------------------

export async function getWorkspaceTagsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("id, name, color").eq("workspace_id", workspaceId).order("name", { ascending: true });
  return (data ?? []) as { id: string; name: string; color: string }[];
}

export async function toggleTaskTag(taskId: string, tagId: string, on: boolean) {
  // task_tags has no workspace_id column of its own (scoped through its
  // parent task via RLS, same as contact_tags) — requireActiveWorkspace()
  // here is purely the auth guard, its return value isn't needed.
  await requireActiveWorkspace();
  const supabase = await createClient();
  if (on) {
    await supabase.from("task_tags").insert({ task_id: taskId, tag_id: tagId });
  } else {
    await supabase.from("task_tags").delete().eq("task_id", taskId).eq("tag_id", tagId);
  }
  revalidateTaskPaths();
  revalidatePath(`/tasks/${taskId}`);
}

// ---------------------------------------------------------------------------
// Query wrappers (client components fetching on demand — same pattern as
// getOpportunityTasksAction)
// ---------------------------------------------------------------------------

export async function getTasksAction(filters: TaskFilters = {}) {
  const { workspaceId } = await requireActiveWorkspace();
  return getTasks(workspaceId, filters);
}

export async function getTaskByIdAction(taskId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getTaskById(workspaceId, taskId);
}

export async function getOpportunityTasksAction(opportunityId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getOpportunityTasks(workspaceId, opportunityId);
}

export async function getTasksByGroupAction(groupId: string, filters: TaskFilters = {}) {
  const { workspaceId } = await requireActiveWorkspace();
  return getTasksByGroup(workspaceId, groupId, filters);
}

export async function getContactRelatedTasksAction(contactId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getContactRelatedTasks(workspaceId, contactId);
}

export async function getTaskDetailAction(taskId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getTaskDetail(workspaceId, taskId);
}

export async function getTaskCommentsAction(taskId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getTaskComments(workspaceId, taskId);
}

export async function getTaskActivityAction(taskId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getTaskActivity(workspaceId, taskId);
}
