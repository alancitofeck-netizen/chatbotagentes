import "server-only";
import { createClient } from "@/lib/supabase/server";

export type GroupColor = "neutral" | "accent" | "success" | "warning" | "error" | "info";

export interface TaskGroup {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: GroupColor;
  coverImageUrl: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  isDefault: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface TaskGroupRow {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  cover_image_url: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  is_default: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

const GROUP_SELECT =
  "id, name, description, icon, color, cover_image_url, is_favorite, is_archived, is_default, position, created_at, updated_at";

function mapGroupRow(r: TaskGroupRow): TaskGroup {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    icon: r.icon,
    color: r.color as GroupColor,
    coverImageUrl: r.cover_image_url,
    isFavorite: r.is_favorite,
    isArchived: r.is_archived,
    isDefault: r.is_default,
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Active groups for the sidebar — `is_default` (the "General" catch-all)
 * always sorts last, real groups ordered by their drag-reorder `position`. */
export async function getTaskGroups(workspaceId: string): Promise<TaskGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_groups")
    .select(GROUP_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("is_archived", false)
    .order("is_default", { ascending: true })
    .order("position", { ascending: true });
  return (data ?? []).map((r) => mapGroupRow(r as TaskGroupRow));
}

export async function getTaskGroupById(workspaceId: string, groupId: string): Promise<TaskGroup | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("task_groups").select(GROUP_SELECT).eq("workspace_id", workspaceId).eq("id", groupId).maybeSingle();
  return data ? mapGroupRow(data as TaskGroupRow) : null;
}

export interface GroupStats {
  pending: number;
  inProgress: number;
  completed: number;
  total: number;
  progressPct: number;
}

function computeStats(rows: { status: string }[]): GroupStats {
  const pending = rows.filter((r) => r.status === "pending").length;
  const inProgress = rows.filter((r) => r.status === "in_progress").length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const total = rows.length;
  return { pending, inProgress, completed, total, progressPct: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

/** Derived live from `tasks` on every request — never a stored/cached
 * counter, same "no second source of truth" principle as the task
 * checklist's "N/M" counter. */
export async function getGroupStats(workspaceId: string, groupId: string): Promise<GroupStats> {
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select("status").eq("workspace_id", workspaceId).eq("group_id", groupId);
  return computeStats((data ?? []) as { status: string }[]);
}

/** Batched per-group stats for the home's "Grupos recientes" cards — one
 * query across all group ids, never one query per card. */
export async function getGroupStatsBatch(workspaceId: string, groupIds: string[]): Promise<Map<string, GroupStats>> {
  const map = new Map<string, GroupStats>();
  if (!groupIds.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select("group_id, status").eq("workspace_id", workspaceId).in("group_id", groupIds);

  const rowsByGroup = new Map<string, { status: string }[]>();
  for (const r of (data ?? []) as { group_id: string | null; status: string }[]) {
    if (!r.group_id) continue;
    const list = rowsByGroup.get(r.group_id) ?? [];
    list.push({ status: r.status });
    rowsByGroup.set(r.group_id, list);
  }
  for (const id of groupIds) map.set(id, computeStats(rowsByGroup.get(id) ?? []));
  return map;
}

/** Home's "Grupos recientes" — real projects only, excludes the "General"
 * catch-all (not something the user consciously created/organized). */
export async function getRecentGroups(workspaceId: string, limit = 5): Promise<TaskGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_groups")
    .select(GROUP_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("is_archived", false)
    .eq("is_default", false)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => mapGroupRow(r as TaskGroupRow));
}

export async function getFavoriteGroups(workspaceId: string): Promise<TaskGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_groups")
    .select(GROUP_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("is_archived", false)
    .eq("is_favorite", true)
    .order("position", { ascending: true });
  return (data ?? []).map((r) => mapGroupRow(r as TaskGroupRow));
}

export async function getArchivedGroups(workspaceId: string): Promise<TaskGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_groups")
    .select(GROUP_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("is_archived", true)
    .order("updated_at", { ascending: false });
  return (data ?? []).map((r) => mapGroupRow(r as TaskGroupRow));
}
