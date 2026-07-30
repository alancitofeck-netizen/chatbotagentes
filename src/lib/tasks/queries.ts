import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed";
/** Free text on the table (no CHECK constraint) — these are the values app
 * code recognizes. 'candidate_application' (ATS) is a fourth documented
 * value in docs/blueprint/02-database.md, not wired up here. 'opportunity'
 * added so a CRM deal can have its own related tasks (CardDetailSheet's
 * "Tareas" tab). This is the legacy single-relation column
 * (tasks.related_type/related_id) — kept exactly as-is for backward
 * compatibility with CardDetailSheet/TaskFormSheet. The richer, multi-
 * relation system for the Workspace's full task page is `task_relations`
 * (0066_tasks_workspace.sql), typed below as RelationEntityType. */
export type TaskRelatedType = "contact" | "conversation" | "opportunity";

/** Entity types a task can relate to via the new `task_relations` join table
 * — a superset of the legacy TaskRelatedType ("Clientes"/"Contactos" both
 * map to "contact", "Pipeline" maps to "opportunity", "Pólizas" maps to the
 * real advisor_policies table). */
export type RelationEntityType = "contact" | "conversation" | "opportunity" | "advisor_policy" | "event" | "document";

export interface TaskTagItem {
  id: string;
  name: string;
  color: string;
}

export interface TaskItem {
  id: string;
  groupId: string | null;
  title: string;
  description: string | null;
  descriptionJson: unknown | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  assignedTo: { memberId: string; fullName: string; avatarUrl: string | null } | null;
  createdByMemberId: string | null;
  relatedType: TaskRelatedType | null;
  relatedId: string | null;
  /** Resolved display label for whatever related_type/related_id points at
   * — a contact's name (with company, if set) or a conversation's contact
   * name. Null if there's no relation or the target no longer exists. */
  relatedLabel: string | null;
  position: number;
  isFavorite: boolean;
  tags: TaskTagItem[];
  checklistTotal: number;
  checklistDone: number;
  commentCount: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface TaskRow {
  id: string;
  group_id: string | null;
  title: string;
  description: string | null;
  description_json: unknown | null;
  priority: string;
  status: string;
  due_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  related_type: string | null;
  related_id: string | null;
  position: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const TASK_SELECT =
  "id, group_id, title, description, description_json, priority, status, due_at, assigned_to, created_by, related_type, related_id, position, is_favorite, created_at, updated_at, completed_at";

/** Single dispatcher for resolving a display label for any relation entity
 * type — shared by the legacy related_type/related_id column, the new
 * task_relations join table, and the "Relacionar con" option lists, so the
 * per-type lookup logic (contact/conversation/opportunity/advisor_policy/
 * event/document) lives in exactly one place. */
async function resolveEntityLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  type: RelationEntityType,
  ids: string[],
): Promise<Map<string, string>> {
  const labelById = new Map<string, string>();
  if (!ids.length) return labelById;

  switch (type) {
    case "contact": {
      const { data } = await supabase.from("contacts").select("id, name, company").eq("workspace_id", workspaceId).in("id", ids);
      for (const c of data ?? []) {
        labelById.set(c.id as string, c.company ? `${c.name as string} (${c.company as string})` : (c.name as string));
      }
      break;
    }
    case "conversation": {
      const { data } = await supabase.from("conversations").select("id, contacts(name)").eq("workspace_id", workspaceId).in("id", ids);
      for (const row of data ?? []) {
        const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
        labelById.set(row.id as string, contact ? `Conversación con ${contact.name as string}` : "Conversación");
      }
      break;
    }
    case "opportunity": {
      const { data } = await supabase.from("opportunities").select("id, title").eq("workspace_id", workspaceId).in("id", ids);
      for (const o of data ?? []) labelById.set(o.id as string, o.title as string);
      break;
    }
    case "advisor_policy": {
      const { data } = await supabase
        .from("advisor_policies")
        .select("id, policy_type, opportunities(title)")
        .eq("workspace_id", workspaceId)
        .in("id", ids);
      for (const p of data ?? []) {
        const opp = Array.isArray(p.opportunities) ? p.opportunities[0] : p.opportunities;
        labelById.set(p.id as string, [p.policy_type as string | null, opp?.title as string | undefined].filter(Boolean).join(" — ") || "Póliza");
      }
      break;
    }
    case "event": {
      const { data } = await supabase.from("bookings").select("id, subject, start_time").eq("workspace_id", workspaceId).in("id", ids);
      for (const b of data ?? []) {
        const date = new Date(b.start_time as string).toLocaleDateString("es", { day: "numeric", month: "short" });
        labelById.set(b.id as string, `${(b.subject as string) || "Evento"} (${date})`);
      }
      break;
    }
    case "document": {
      const { data } = await supabase.from("documents").select("id, name").eq("workspace_id", workspaceId).in("id", ids);
      for (const d of data ?? []) labelById.set(d.id as string, d.name as string);
      break;
    }
  }

  return labelById;
}

async function resolveRelatedLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  rows: TaskRow[],
): Promise<Map<string, string>> {
  const byType = new Map<RelationEntityType, string[]>();
  for (const r of rows) {
    if (!r.related_id || !r.related_type) continue;
    const type = r.related_type as RelationEntityType;
    byType.set(type, [...(byType.get(type) ?? []), r.related_id]);
  }

  const labelById = new Map<string, string>();
  for (const [type, ids] of byType) {
    const labels = await resolveEntityLabels(supabase, workspaceId, type, ids);
    for (const [id, label] of labels) labelById.set(id, label);
  }
  return labelById;
}

interface TaskCounts {
  checklistTotal: number;
  checklistDone: number;
  commentCount: number;
  attachmentCount: number;
}

/** Batched per-task counts for the rich card (subtasks/comments/files) —
 * one query per source table across all task ids, never one query per card. */
async function resolveTaskCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskIds: string[],
): Promise<Map<string, TaskCounts>> {
  const counts = new Map<string, TaskCounts>();
  if (!taskIds.length) return counts;

  const [{ data: checklistRows }, { data: noteRows }, { data: documentRows }] = await Promise.all([
    supabase.from("task_checklist_items").select("task_id, is_completed").in("task_id", taskIds),
    supabase.from("notes").select("notable_id").eq("notable_type", "task").in("notable_id", taskIds),
    supabase.from("documents").select("related_id").eq("related_type", "task").eq("is_trashed", false).in("related_id", taskIds),
  ]);

  function get(id: string): TaskCounts {
    let entry = counts.get(id);
    if (!entry) {
      entry = { checklistTotal: 0, checklistDone: 0, commentCount: 0, attachmentCount: 0 };
      counts.set(id, entry);
    }
    return entry;
  }

  for (const r of checklistRows ?? []) {
    const entry = get(r.task_id as string);
    entry.checklistTotal += 1;
    if (r.is_completed) entry.checklistDone += 1;
  }
  for (const r of noteRows ?? []) get(r.notable_id as string).commentCount += 1;
  for (const r of documentRows ?? []) get(r.related_id as string).attachmentCount += 1;

  return counts;
}

async function resolveTaskTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskIds: string[],
): Promise<Map<string, TaskTagItem[]>> {
  const tagsByTask = new Map<string, TaskTagItem[]>();
  if (!taskIds.length) return tagsByTask;

  const { data } = await supabase.from("task_tags").select("task_id, tags(id, name, color)").in("task_id", taskIds);
  for (const row of data ?? []) {
    const tag = Array.isArray(row.tags) ? row.tags[0] : row.tags;
    if (!tag) continue;
    const list = tagsByTask.get(row.task_id as string) ?? [];
    list.push({ id: tag.id as string, name: tag.name as string, color: tag.color as string });
    tagsByTask.set(row.task_id as string, list);
  }
  return tagsByTask;
}

async function mapTaskRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  rows: TaskRow[],
): Promise<TaskItem[]> {
  const taskIds = rows.map((r) => r.id);
  const memberIds = [...new Set(rows.map((r) => r.assigned_to).filter((id): id is string => Boolean(id)))];
  const [{ data: memberNames }, relatedLabels, counts, tags] = await Promise.all([
    memberIds.length
      ? supabase.rpc("workspace_member_names", { ws_id: workspaceId })
      : Promise.resolve({ data: [] as { member_id: string; full_name: string; avatar_url: string | null }[] }),
    resolveRelatedLabels(supabase, workspaceId, rows),
    resolveTaskCounts(supabase, taskIds),
    resolveTaskTags(supabase, taskIds),
  ]);

  const nameByMember = new Map<string, { fullName: string; avatarUrl: string | null }>(
    (memberNames ?? []).map((m: { member_id: string; full_name: string; avatar_url: string | null }) => [
      m.member_id,
      { fullName: m.full_name, avatarUrl: m.avatar_url },
    ]),
  );

  return rows.map((r) => {
    const c = counts.get(r.id) ?? { checklistTotal: 0, checklistDone: 0, commentCount: 0, attachmentCount: 0 };
    return {
      id: r.id,
      groupId: r.group_id,
      title: r.title,
      description: r.description,
      descriptionJson: r.description_json,
      priority: r.priority as TaskPriority,
      status: r.status as TaskStatus,
      dueAt: r.due_at,
      assignedTo: r.assigned_to
        ? {
            memberId: r.assigned_to,
            fullName: nameByMember.get(r.assigned_to)?.fullName ?? "—",
            avatarUrl: nameByMember.get(r.assigned_to)?.avatarUrl ?? null,
          }
        : null,
      createdByMemberId: r.created_by,
      relatedType: (r.related_type as TaskRelatedType | null) ?? null,
      relatedId: r.related_id,
      relatedLabel: r.related_id ? (relatedLabels.get(r.related_id) ?? null) : null,
      position: r.position,
      isFavorite: r.is_favorite,
      tags: tags.get(r.id) ?? [],
      checklistTotal: c.checklistTotal,
      checklistDone: c.checklistDone,
      commentCount: c.commentCount,
      attachmentCount: c.attachmentCount,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      completedAt: r.completed_at,
    };
  });
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedMemberId?: string;
  search?: string;
  /** Cross-group Agenda page (Hoy/Esta semana) filters on due_at — task-level
   * favorites moved to group-level favorites with the Grupos redesign (see
   * task_groups.is_favorite), so this no longer needs a favoritesOnly flag. */
  dueRange?: "today" | "week";
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Full task list for the Workspace module (and CRM's legacy tab, kept
 * working unchanged) — filters applied server-side where cheap
 * (status/priority/assignee/is_favorite are indexed/simple columns), search
 * is a simple ilike. */
export async function getTasks(workspaceId: string, filters: TaskFilters = {}): Promise<TaskItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("workspace_id", workspaceId)
    .order("due_at", { ascending: true, nullsFirst: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.assignedMemberId) query = query.eq("assigned_to", filters.assignedMemberId);
  if (filters.search?.trim()) query = query.ilike("title", `%${filters.search.trim()}%`);
  if (filters.dueRange) {
    const todayStart = startOfDay(new Date());
    if (filters.dueRange === "today") {
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      query = query.gte("due_at", todayStart.toISOString()).lt("due_at", tomorrowStart.toISOString());
    } else {
      const weekEnd = new Date(todayStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      query = query.gte("due_at", todayStart.toISOString()).lt("due_at", weekEnd.toISOString());
    }
  }

  const { data } = await query;
  return mapTaskRows(supabase, workspaceId, (data ?? []) as TaskRow[]);
}

/** The Grupos redesign's primary read path — a group's page never browses
 * the whole workspace, only its own tasks. Same filter shape as getTasks. */
export async function getTasksByGroup(workspaceId: string, groupId: string, filters: TaskFilters = {}): Promise<TaskItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("group_id", groupId)
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
  const { data } = await supabase.from("tasks").select(TASK_SELECT).eq("workspace_id", workspaceId).eq("id", taskId).maybeSingle();

  if (!data) return null;
  const [item] = await mapTaskRows(supabase, workspaceId, [data as TaskRow]);
  return item;
}

/** Scoped list for CardDetailSheet's "Tareas" tab — same row shape as
 * getTasks, just pre-filtered instead of reusing the general list + a
 * client-side filter (this tab is opened often, keep it a light query). */
export async function getOpportunityTasks(workspaceId: string, opportunityId: string): Promise<TaskItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("related_type", "opportunity")
    .eq("related_id", opportunityId)
    .order("due_at", { ascending: true, nullsFirst: false });

  return mapTaskRows(supabase, workspaceId, (data ?? []) as TaskRow[]);
}

/** "Tareas relacionadas" section on a contact's detail panel (Inbox >
 * Contactos) — unions the legacy single-relation column
 * (tasks.related_type='contact') with the new multi-relation join table, so
 * both pre- and post-redesign tasks show up. */
export async function getContactRelatedTasks(workspaceId: string, contactId: string): Promise<TaskItem[]> {
  const supabase = await createClient();
  const [{ data: legacyRows }, { data: relationRows }] = await Promise.all([
    supabase.from("tasks").select(TASK_SELECT).eq("workspace_id", workspaceId).eq("related_type", "contact").eq("related_id", contactId),
    supabase.from("task_relations").select("task_id").eq("workspace_id", workspaceId).eq("related_type", "contact").eq("related_id", contactId),
  ]);

  const legacyTaskRows = (legacyRows ?? []) as TaskRow[];
  const legacyIds = new Set(legacyTaskRows.map((r) => r.id));
  const extraIds = (relationRows ?? []).map((r) => r.task_id as string).filter((id) => !legacyIds.has(id));

  const { data: extraRows } = extraIds.length
    ? await supabase.from("tasks").select(TASK_SELECT).eq("workspace_id", workspaceId).in("id", extraIds)
    : { data: [] as TaskRow[] };

  const items = await mapTaskRows(supabase, workspaceId, [...legacyTaskRows, ...((extraRows ?? []) as TaskRow[])]);
  return items.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
}

export interface TaskChecklistItem {
  id: string;
  title: string;
  isCompleted: boolean;
  position: number;
}

export async function getTaskChecklist(workspaceId: string, taskId: string): Promise<TaskChecklistItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_checklist_items")
    .select("id, title, is_completed, position")
    .eq("workspace_id", workspaceId)
    .eq("task_id", taskId)
    .order("position", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    isCompleted: r.is_completed as boolean,
    position: r.position as number,
  }));
}

export interface TaskRelationItem {
  id: string;
  type: RelationEntityType;
  relatedId: string;
  label: string;
}

/** Reads the new multi-relation join table only — the legacy single
 * related_type/related_id relation is already surfaced via
 * TaskItem.relatedLabel and stays that way (CardDetailSheet keeps reading
 * it exactly as before). The Workspace task page's relations panel shows
 * both: this list, plus the legacy relation rendered as its own chip. */
export async function getTaskRelations(workspaceId: string, taskId: string): Promise<TaskRelationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_relations")
    .select("id, related_type, related_id")
    .eq("workspace_id", workspaceId)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as { id: string; related_type: RelationEntityType; related_id: string }[];
  const byType = new Map<RelationEntityType, string[]>();
  for (const r of rows) byType.set(r.related_type, [...(byType.get(r.related_type) ?? []), r.related_id]);

  const labelByTypeAndId = new Map<RelationEntityType, Map<string, string>>();
  for (const [type, ids] of byType) {
    labelByTypeAndId.set(type, await resolveEntityLabels(supabase, workspaceId, type, ids));
  }

  return rows.map((r) => ({
    id: r.id,
    type: r.related_type,
    relatedId: r.related_id,
    label: labelByTypeAndId.get(r.related_type)?.get(r.related_id) ?? "—",
  }));
}

export interface TaskComment {
  id: string;
  authorMemberId: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

/** Comments tab — reuses public.notes (notable_type='task'), the same
 * generic primitive CardDetailSheet's "Notas" tab already uses for
 * opportunities, extended here with author name/avatar for a chat-like feel. */
export async function getTaskComments(workspaceId: string, taskId: string): Promise<TaskComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("id, author_id, body, created_at")
    .eq("workspace_id", workspaceId)
    .eq("notable_type", "task")
    .eq("notable_id", taskId)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as { id: string; author_id: string | null; body: string; created_at: string }[];
  const memberIds = [...new Set(rows.map((r) => r.author_id).filter((id): id is string => Boolean(id)))];
  const { data: names } = memberIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string; avatar_url: string | null }[] };
  const nameByMember = new Map(
    ((names ?? []) as { member_id: string; full_name: string; avatar_url: string | null }[]).map((n) => [
      n.member_id,
      { fullName: n.full_name, avatarUrl: n.avatar_url },
    ]),
  );

  return rows.map((r) => ({
    id: r.id,
    authorMemberId: r.author_id,
    authorName: r.author_id ? (nameByMember.get(r.author_id)?.fullName ?? "—") : "—",
    authorAvatarUrl: r.author_id ? (nameByMember.get(r.author_id)?.avatarUrl ?? null) : null,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export interface TaskActivityEntry {
  id: string;
  action: string;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const TASK_ACTION_LABEL: Record<string, string> = {
  task_created: "Tarea creada",
  task_updated: "Tarea actualizada",
  task_status_changed: "Cambió de estado",
  task_priority_changed: "Cambió de prioridad",
  task_reassigned: "Reasignada",
  task_checklist_item_added: "Agregó un ítem al checklist",
  task_checklist_item_completed: "Completó un ítem del checklist",
  task_comment_added: "Agregó un comentario",
  task_document_uploaded: "Subió un archivo",
  task_relation_added: "Agregó una relación",
};

/** Actividad tab — audit_log (0020_agent_engine_core.sql), same generic
 * mechanism CardDetailSheet's "Historial" tab already reads for
 * opportunities, filtered to entity_type='task'. */
export async function getTaskActivity(workspaceId: string, taskId: string): Promise<TaskActivityEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, actor_id, metadata, created_at")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .order("created_at", { ascending: false });

  const actorIds = Array.from(new Set((data ?? []).map((r) => r.actor_id as string | null).filter((id): id is string => Boolean(id))));
  const { data: names } = actorIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map(((names ?? []) as { member_id: string; full_name: string }[]).map((n) => [n.member_id, n.full_name]));

  return (data ?? []).map((r) => ({
    id: r.id as string,
    action: TASK_ACTION_LABEL[r.action as string] ?? (r.action as string),
    actorName: r.actor_id ? (nameByMember.get(r.actor_id as string) ?? null) : null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  }));
}

export interface TaskDetail extends TaskItem {
  checklist: TaskChecklistItem[];
  relations: TaskRelationItem[];
}

/** Full detail for the Workspace's full-page task view (Resumen tab) —
 * Comentarios/Archivos/Actividad are fetched lazily per-tab instead (same
 * "load on first tab-open" convention CardDetailSheet already uses), via
 * getTaskComments/getTaskActivity/getDocumentsByRelated directly. */
export async function getTaskDetail(workspaceId: string, taskId: string): Promise<TaskDetail | null> {
  const item = await getTaskById(workspaceId, taskId);
  if (!item) return null;
  const [checklist, relations] = await Promise.all([getTaskChecklist(workspaceId, taskId), getTaskRelations(workspaceId, taskId)]);
  return { ...item, checklist, relations };
}

export interface TaskOption {
  id: string;
  label: string;
}

/** Lightweight options for the "Relacionar con" selects in TaskFormSheet and
 * the Workspace task page's relations panel — no dedicated search/autocomplete
 * component exists in this project yet, so these feed plain <select> lists
 * (kept small/simple by design, see the plan's explicit scope note). */
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

export async function getAdvisorPolicyOptions(workspaceId: string): Promise<TaskOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("advisor_policies")
    .select("id, policy_type, opportunities(title)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((p) => {
    const opp = Array.isArray(p.opportunities) ? p.opportunities[0] : p.opportunities;
    return {
      id: p.id as string,
      label: [p.policy_type as string | null, opp?.title as string | undefined].filter(Boolean).join(" — ") || "Póliza",
    };
  });
}

export async function getEventOptions(workspaceId: string): Promise<TaskOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, subject, start_time")
    .eq("workspace_id", workspaceId)
    .order("start_time", { ascending: false })
    .limit(200);
  return (data ?? []).map((b) => {
    const date = new Date(b.start_time as string).toLocaleDateString("es", { day: "numeric", month: "short" });
    return { id: b.id as string, label: `${(b.subject as string) || "Evento"} (${date})` };
  });
}

export async function getDocumentOptions(workspaceId: string): Promise<TaskOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("is_trashed", false)
    .order("name", { ascending: true })
    .limit(200);
  return (data ?? []).map((d) => ({ id: d.id as string, label: d.name as string }));
}
