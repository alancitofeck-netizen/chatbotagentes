import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed";
/** Free text on the table (no CHECK constraint) — these are the two values
 * app code recognizes. 'candidate_application' (ATS) is a third documented
 * value in docs/blueprint/02-database.md but this pass only wires up the
 * two the user asked to relate tasks to. */
export type TaskRelatedType = "contact" | "conversation";

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  assignedTo: { memberId: string; fullName: string } | null;
  createdByMemberId: string | null;
  relatedType: TaskRelatedType | null;
  relatedId: string | null;
  /** Resolved display label for whatever related_type/related_id points at
   * — a contact's name (with company, if set) or a conversation's contact
   * name. Null if there's no relation or the target no longer exists. */
  relatedLabel: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

async function resolveRelatedLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  rows: TaskRow[],
): Promise<Map<string, string>> {
  const contactIds = rows.filter((r) => r.related_type === "contact" && r.related_id).map((r) => r.related_id as string);
  const conversationIds = rows
    .filter((r) => r.related_type === "conversation" && r.related_id)
    .map((r) => r.related_id as string);

  const labelById = new Map<string, string>();

  if (contactIds.length) {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, company")
      .eq("workspace_id", workspaceId)
      .in("id", contactIds);
    for (const c of data ?? []) {
      const label = c.company ? `${c.name as string} (${c.company as string})` : (c.name as string);
      labelById.set(c.id as string, label);
    }
  }

  if (conversationIds.length) {
    const { data } = await supabase
      .from("conversations")
      .select("id, contacts(name)")
      .eq("workspace_id", workspaceId)
      .in("id", conversationIds);
    for (const row of data ?? []) {
      const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
      labelById.set(row.id as string, contact ? `Conversación con ${contact.name as string}` : "Conversación");
    }
  }

  return labelById;
}

async function mapTaskRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  rows: TaskRow[],
): Promise<TaskItem[]> {
  const memberIds = [...new Set(rows.map((r) => r.assigned_to).filter((id): id is string => Boolean(id)))];
  const [{ data: memberNames }, relatedLabels] = await Promise.all([
    memberIds.length
      ? supabase.rpc("workspace_member_names", { ws_id: workspaceId })
      : Promise.resolve({ data: [] as { member_id: string; full_name: string }[] }),
    resolveRelatedLabels(supabase, workspaceId, rows),
  ]);

  const nameByMember = new Map<string, string>(
    (memberNames ?? []).map((m: { member_id: string; full_name: string }) => [m.member_id, m.full_name]),
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    priority: r.priority as TaskPriority,
    status: r.status as TaskStatus,
    dueAt: r.due_at,
    assignedTo: r.assigned_to ? { memberId: r.assigned_to, fullName: nameByMember.get(r.assigned_to) ?? "—" } : null,
    createdByMemberId: r.created_by,
    relatedType: (r.related_type as TaskRelatedType | null) ?? null,
    relatedId: r.related_id,
    relatedLabel: r.related_id ? (relatedLabels.get(r.related_id) ?? null) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
  }));
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedMemberId?: string;
  search?: string;
}

/** Full task list for CRM > Tareas — filters applied server-side where cheap
 * (status/priority/assignee are indexed columns), search is a simple ilike. */
export async function getTasks(workspaceId: string, filters: TaskFilters = {}): Promise<TaskItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(
      "id, title, description, priority, status, due_at, assigned_to, created_by, related_type, related_id, created_at, updated_at, completed_at",
    )
    .eq("workspace_id", workspaceId)
    .order("due_at", { ascending: true, nullsFirst: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.assignedMemberId) query = query.eq("assigned_to", filters.assignedMemberId);
  if (filters.search?.trim()) query = query.ilike("title", `%${filters.search.trim()}%`);

  const { data } = await query;
  return mapTaskRows(supabase, workspaceId, (data ?? []) as TaskRow[]);
}

/** Fetches a single task's full detail — used when opening "Editar" from a
 * list that only carries a partial shape (e.g. the Dashboard card's
 * PendingTask), same on-demand-detail pattern as Inbox's
 * getConversationDetail. */
export async function getTaskById(workspaceId: string, taskId: string): Promise<TaskItem | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(
      "id, title, description, priority, status, due_at, assigned_to, created_by, related_type, related_id, created_at, updated_at, completed_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", taskId)
    .maybeSingle();

  if (!data) return null;
  const [item] = await mapTaskRows(supabase, workspaceId, [data as TaskRow]);
  return item;
}

export interface TaskOption {
  id: string;
  label: string;
}

/** Lightweight options for the "Relacionar con" selects in TaskFormSheet —
 * no dedicated search/autocomplete component exists in this project yet, so
 * these feed plain <select> lists (kept small/simple by design, see the
 * plan's explicit scope note). */
export async function getContactOptions(workspaceId: string): Promise<TaskOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, name, company")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  return (data ?? []).map((c) => ({
    id: c.id as string,
    label: c.company ? `${c.name as string} (${c.company as string})` : (c.name as string),
  }));
}

export async function getConversationOptions(workspaceId: string): Promise<TaskOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, contacts(name)")
    .eq("workspace_id", workspaceId)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  return (data ?? []).map((row) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    return { id: row.id as string, label: contact ? `Conversación con ${contact.name as string}` : "Conversación" };
  });
}
