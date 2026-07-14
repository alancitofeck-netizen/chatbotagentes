"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import {
  getOpportunityTasks,
  getTaskById,
  getTasks,
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
}

/** Agents/viewers can only assign tasks to themselves — "si tiene permisos"
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
}

export async function createTask(input: TaskInput) {
  const { workspaceId, role } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  if (!ownMemberId) throw new Error("No se pudo resolver tu usuario en este workspace.");

  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");

  const assignedTo = await resolveAssignedTo(role, input.assignedTo, ownMemberId);
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").insert({
    workspace_id: workspaceId,
    created_by: ownMemberId,
    assigned_to: assignedTo,
    title,
    description: input.description.trim() || null,
    priority: input.priority,
    status: "pending",
    due_at: input.dueAt,
    related_type: input.relatedType,
    related_id: input.relatedId,
  });
  if (error) throw new Error("No se pudo crear la tarea.");

  revalidateTaskPaths();
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

  revalidateTaskPaths();
}

/** Quick-toggle from the checkbox (Dashboard card and CRM > Tareas list) —
 * always marks as completed; there's no quick-toggle back to pending from
 * the checkbox alone (use "Editar" > Estado for that). */
export async function completeTask(taskId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId);

  revalidateTaskPaths();
}

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
