"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SquareCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import { GroupFormDialog } from "@/components/tasks/GroupFormDialog";
import { TaskFormSheet } from "@/components/tasks/TaskFormSheet";
import { PRIORITY_META, STATUS_META } from "@/components/tasks/priorityMeta";
import { GROUP_COLOR_META } from "@/components/tasks/groupColorMeta";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { TaskItem, TaskOption } from "@/lib/tasks/queries";
import { bulkAssignTasks, bulkCompleteTasks, bulkDeleteTasks, completeTask, deleteTask, getTasksByGroupAction } from "@/lib/tasks/actions";
import type { GroupStats, TaskGroup } from "@/lib/tasks/groups/queries";
import { archiveGroup, duplicateGroup, getGroupStatsAction, toggleGroupFavorite, unarchiveGroup, updateTaskGroup } from "@/lib/tasks/groups/actions";
import { TasksViewSwitcher, type TasksView } from "../../TasksViewSwitcher";
import { GroupTopBar } from "./GroupTopBar";
import { TaskListView } from "../../views/TaskListView";
import { TaskTableView } from "../../views/TaskTableView";
import { TaskKanbanView } from "../../views/TaskKanbanView";
import { TaskCalendarView } from "../../views/TaskCalendarView";

const VIEW_KEYS: TasksView[] = ["list", "table", "kanban", "calendar"];

function computeStatsFromTasks(list: TaskItem[]): GroupStats {
  const pending = list.filter((t) => t.status === "pending").length;
  const inProgress = list.filter((t) => t.status === "in_progress").length;
  const completed = list.filter((t) => t.status === "completed").length;
  const total = list.length;
  return { pending, inProgress, completed, total, progressPct: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

/** The page of a single Grupo de Tareas — header (portada/ícono/nombre/
 * descripción editables) + progreso derivado + GroupTopBar, then the exact
 * same board (filtros/selección/4 vistas) the old workspace-wide
 * TasksModuleShell used to render, now scoped to this group's own tasks via
 * getTasksByGroup instead of getTasks. */
export function GroupDetailShell({
  group: initialGroup,
  stats: initialStats,
  initialTasks,
  members,
  contactOptions,
  conversationOptions,
  canAssignOthers,
  ownMemberId,
}: {
  group: TaskGroup;
  stats: GroupStats;
  initialTasks: TaskItem[];
  members: WorkspaceMemberOption[];
  contactOptions: TaskOption[];
  conversationOptions: TaskOption[];
  canAssignOthers: boolean;
  ownMemberId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const view: TasksView = (VIEW_KEYS as string[]).includes(viewParam ?? "") ? (viewParam as TasksView) : "list";

  const [group, setGroup] = useState(initialGroup);
  const [stats, setStats] = useState(initialStats);
  const [tasks, setTasks] = useState(initialTasks);
  const [nameDraft, setNameDraft] = useState(initialGroup.name);
  const [descDraft, setDescDraft] = useState(initialGroup.description ?? "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sheetState, setSheetState] = useState<{ mode: "create" } | { mode: "edit"; task: TaskItem } | null>(null);
  const [showConfigure, setShowConfigure] = useState(false);
  const [isPending, startTransition] = useTransition();

  function buildViewHref(v: TasksView) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    return `/tasks/groups/${group.id}?${params.toString()}`;
  }

  // Deliberately not wrapped in startTransition — a mutating action's own
  // revalidatePath("/tasks") (shared by every task/group action, since it
  // also refreshes the sidebar's Grupos list from layout.tsx) appears to
  // trigger Next.js's own router-refresh transition, which can supersede a
  // manual startTransition still in flight and silently drop whatever
  // setState was scheduled inside it (confirmed live — the DB write always
  // lands, only this same-session refetch was getting lost). Plain state
  // updates aren't subject to that.
  async function refetch() {
    const [freshTasks, freshStats] = await Promise.all([getTasksByGroupAction(group.id), getGroupStatsAction(group.id)]);
    setTasks(freshTasks);
    setStats(freshStats);
  }

  function toggleSelectionMode() {
    setSelectionMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleOpen(task: TaskItem) {
    router.push(`/tasks/${task.id}`);
  }

  /** Optimistic — updates local state immediately instead of waiting on a
   * post-mutation refetch(). Confirmed live that the refetch-after-mutation
   * round trip can get silently dropped here: `completeTask`'s
   * `revalidatePath("/tasks")` invalidates the shared /tasks/layout.tsx data
   * (the sidebar's Grupos list), which appears to interrupt this route's
   * own in-flight client update before its `setTasks`/`setStats` ever runs —
   * the DB write itself always lands correctly (verified directly), only
   * the same-session visual refresh was affected. Server truth is still
   * fetched on the next full navigation/reload regardless. */
  function handleToggleComplete(task: TaskItem) {
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === task.id ? { ...t, status: "completed" as const, completedAt: new Date().toISOString() } : t));
      setStats(computeStatsFromTasks(next));
      return next;
    });
    startTransition(async () => {
      try {
        await completeTask(task.id);
      } catch {
        toast.error("No se pudo completar la tarea.");
        refetch();
      }
    });
  }

  async function handleBulkComplete() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const ids = new Set(selectedIds);
    setTasks((prev) => {
      const next = prev.map((t) => (ids.has(t.id) ? { ...t, status: "completed" as const, completedAt: new Date().toISOString() } : t));
      setStats(computeStatsFromTasks(next));
      return next;
    });
    setSelectedIds(new Set());
    try {
      await bulkCompleteTasks(Array.from(ids));
      toast.success(`${count} tarea(s) completada(s).`);
    } catch {
      toast.error("No se pudieron completar las tareas.");
      refetch();
    }
  }

  /** Single-task delete — for the mobile swipe-left gesture (SwipeableTaskCard),
   * which has no multi-select context to piggyback bulkDeleteTasks on. Same
   * optimistic pattern as handleToggleComplete above; deleteTask itself
   * already relies on RLS to reject a non-owner/admin (see its own comment),
   * so this surfaces the exact same permission error a desktop delete would. */
  function handleDeleteSingle(task: TaskItem) {
    const previousTasks = tasks;
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== task.id);
      setStats(computeStatsFromTasks(next));
      return next;
    });
    startTransition(async () => {
      try {
        await deleteTask(task.id);
        toast.success("Tarea eliminada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar la tarea.");
        setTasks(previousTasks);
        setStats(computeStatsFromTasks(previousTasks));
      }
    });
  }

  async function handleBulkDelete() {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!window.confirm(`¿Eliminar ${count} tarea(s)? Esta acción no se puede deshacer.`)) return;
    const ids = new Set(selectedIds);
    const previousTasks = tasks;
    setTasks((prev) => {
      const next = prev.filter((t) => !ids.has(t.id));
      setStats(computeStatsFromTasks(next));
      return next;
    });
    setSelectedIds(new Set());
    setSelectionMode(false);
    try {
      await bulkDeleteTasks(Array.from(ids));
      toast.success(`${count} tarea(s) eliminada(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron eliminar las tareas.");
      setTasks(previousTasks);
      setStats(computeStatsFromTasks(previousTasks));
    }
  }

  async function handleBulkAssign(memberId: string) {
    if (!memberId || selectedIds.size === 0) return;
    const ids = new Set(selectedIds);
    const member = members.find((m) => m.memberId === memberId);
    setTasks((prev) =>
      prev.map((t) =>
        ids.has(t.id) && member ? { ...t, assignedTo: { memberId: member.memberId, fullName: member.fullName, avatarUrl: member.avatarUrl } } : t,
      ),
    );
    try {
      await bulkAssignTasks(Array.from(ids), memberId);
      toast.success("Tareas reasignadas.");
    } catch {
      toast.error("No se pudieron reasignar las tareas.");
      refetch();
    }
  }

  async function handleNameBlur() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === group.name) {
      setNameDraft(group.name);
      return;
    }
    await updateTaskGroup(group.id, {
      name: trimmed,
      description: group.description ?? "",
      icon: group.icon,
      color: group.color,
      coverImageUrl: group.coverImageUrl,
    });
    setGroup((prev) => ({ ...prev, name: trimmed }));
  }

  async function handleDescriptionBlur() {
    if (descDraft === (group.description ?? "")) return;
    await updateTaskGroup(group.id, {
      name: group.name,
      description: descDraft,
      icon: group.icon,
      color: group.color,
      coverImageUrl: group.coverImageUrl,
    });
    setGroup((prev) => ({ ...prev, description: descDraft || null }));
  }

  async function handleToggleFavorite() {
    const next = !group.isFavorite;
    setGroup((prev) => ({ ...prev, isFavorite: next }));
    await toggleGroupFavorite(group.id, next);
  }

  async function handleArchiveToggle() {
    const archiving = !group.isArchived;
    setGroup((prev) => ({ ...prev, isArchived: archiving }));
    if (archiving) {
      await archiveGroup(group.id);
      toast.success("Grupo archivado.");
      router.push("/tasks");
    } else {
      await unarchiveGroup(group.id);
      toast.success("Grupo restaurado.");
    }
  }

  async function handleDuplicate() {
    try {
      const { id } = await duplicateGroup(group.id);
      toast.success("Grupo duplicado.");
      router.push(`/tasks/groups/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar el grupo.");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter && t.assignedTo?.memberId !== assigneeFilter) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, assigneeFilter, search]);

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8">
      {group.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- remote Storage URL, dimensions dynamic
        <img src={group.coverImageUrl} alt="" className="h-40 w-full rounded-xl object-cover" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-[22px] ${GROUP_COLOR_META[group.color].bg}`}>
            {group.icon}
          </span>
          <div className="min-w-0 flex-1">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full border-none bg-transparent text-[22px] font-semibold tracking-[-0.02em] text-foreground outline-none focus:ring-0"
              aria-label="Nombre del grupo"
            />
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Descripción del proyecto…"
              rows={1}
              className="mt-1 w-full resize-none border-none bg-transparent text-sm text-neutral-500 outline-none placeholder:text-neutral-400 focus:ring-0"
            />
          </div>
        </div>
        <GroupTopBar
          group={group}
          onToggleFavorite={handleToggleFavorite}
          onArchiveToggle={handleArchiveToggle}
          onDuplicate={handleDuplicate}
          onConfigure={() => setShowConfigure(true)}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Progreso general</span>
          <span className="font-semibold text-foreground">{stats.progressPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${stats.progressPct}%` }} />
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
          <span>Pendientes: {stats.pending}</span>
          <span>En progreso: {stats.inProgress}</span>
          <span>Completadas: {stats.completed}</span>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-[38px] text-neutral-400" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Buscar</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título…"
                className="w-full rounded-sm border border-border-strong bg-surface-1 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
            </div>
          </div>
          <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} containerClassName="w-40">
            <option value="">Todas</option>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
          <Select label="Prioridad" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} containerClassName="w-40">
            <option value="">Todas</option>
            {Object.entries(PRIORITY_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
          <Select label="Asignado" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} containerClassName="w-48">
            <option value="">Todos</option>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.fullName}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSheetState({ mode: "create" })}
            className="rounded-md bg-accent-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-600"
          >
            Nueva tarea
          </button>
          <button
            type="button"
            onClick={toggleSelectionMode}
            className={
              selectionMode
                ? "flex items-center gap-1.5 rounded-md bg-accent-100 px-3.5 py-2 text-sm font-medium text-accent-700"
                : "flex items-center gap-1.5 rounded-md border border-border-strong px-3.5 py-2 text-sm font-medium text-foreground hover:bg-surface-2"
            }
          >
            <SquareCheck size={15} aria-hidden="true" />
            Acciones masivas
          </button>
        </div>
        <TasksViewSwitcher view={view} buildHref={buildViewHref} />
      </div>

      {selectionMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-accent-50 px-3 py-2 text-sm">
          <span className="font-medium text-accent-700">{selectedIds.size} seleccionado(s)</span>
          <button
            type="button"
            onClick={handleBulkComplete}
            disabled={selectedIds.size === 0}
            className="text-xs font-medium text-accent-700 hover:underline disabled:opacity-40"
          >
            Marcar completadas
          </button>
          <select
            value=""
            disabled={selectedIds.size === 0}
            onChange={(e) => handleBulkAssign(e.target.value)}
            className="rounded-sm border border-border-strong bg-surface-1 px-2 py-1 text-xs disabled:opacity-40"
          >
            <option value="">Reasignar a…</option>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.fullName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0}
            className="ml-auto text-xs font-medium text-error-strong hover:underline disabled:opacity-40"
          >
            Eliminar
          </button>
        </div>
      )}

      {view === "list" && (
        <TaskListView
          tasks={filtered}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpen={handleOpen}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDeleteSingle}
        />
      )}
      {view === "table" && (
        <TaskTableView tasks={filtered} selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} onOpen={handleOpen} />
      )}
      {view === "kanban" && (
        <TaskKanbanView
          tasks={filtered}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpen={handleOpen}
          onChanged={refetch}
        />
      )}
      {view === "calendar" && <TaskCalendarView tasks={filtered} onOpen={handleOpen} />}

      {isPending && <span className="sr-only">Actualizando…</span>}

      {sheetState && (
        <TaskFormSheet
          current={sheetState.mode === "edit" ? sheetState.task : null}
          groupId={group.id}
          members={members}
          contactOptions={contactOptions}
          conversationOptions={conversationOptions}
          canAssignOthers={canAssignOthers}
          ownMemberId={ownMemberId}
          onClose={() => setSheetState(null)}
          onSaved={() => {
            setSheetState(null);
            refetch();
          }}
        />
      )}

      {showConfigure && (
        <GroupFormDialog
          current={group}
          onClose={() => setShowConfigure(false)}
          onSaved={() => {
            setShowConfigure(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
