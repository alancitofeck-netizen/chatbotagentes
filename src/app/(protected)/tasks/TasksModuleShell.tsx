"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Sparkles, SquareCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { TaskItem, TaskOption } from "@/lib/tasks/queries";
import { bulkAssignTasks, bulkCompleteTasks, bulkDeleteTasks, completeTask, getTasksAction } from "@/lib/tasks/actions";
import { TaskFormSheet } from "@/components/tasks/TaskFormSheet";
import { PRIORITY_META, STATUS_META } from "@/components/tasks/priorityMeta";
import { TasksSidebar, type TasksQuickView } from "./TasksSidebar";
import { TasksViewSwitcher, type TasksView } from "./TasksViewSwitcher";
import { NewItemMenu } from "./NewItemMenu";
import { TaskAiPanel } from "./TaskAiPanel";
import { TasksWorkspaceHome, type TasksHomeStats } from "./TasksWorkspaceHome";
import { TaskListView } from "./views/TaskListView";
import { TaskTableView } from "./views/TaskTableView";
import { TaskKanbanView } from "./views/TaskKanbanView";
import { TaskCalendarView } from "./views/TaskCalendarView";

const VIEW_KEYS: TasksView[] = ["list", "table", "kanban", "calendar"];
const QUICK_KEYS: TasksQuickView[] = ["all", "favorites", "mine", "today", "week"];

/** Orchestrator for the whole Workspace module — same "one shared filtered
 * array feeds every view, view state lives in the URL" convention already
 * established by Calendar/CRM board. Absence of `?view=` means the "Buenos
 * días" home screen (Sección 7); any valid `?view=` shows the board
 * (Sección 2) with TasksSidebar's quick views (`?quick=`) as an additional
 * client-side filter, same "real filter over an already-fetched list"
 * pattern the old TasksSection already used. */
export function TasksModuleShell({
  initialTasks,
  members,
  contactOptions,
  conversationOptions,
  canAssignOthers,
  ownMemberId,
  homeStats,
}: {
  initialTasks: TaskItem[];
  members: WorkspaceMemberOption[];
  contactOptions: TaskOption[];
  conversationOptions: TaskOption[];
  canAssignOthers: boolean;
  ownMemberId: string | null;
  homeStats: TasksHomeStats;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const viewParam = searchParams.get("view");
  const isHome = !viewParam;
  const view: TasksView = (VIEW_KEYS as string[]).includes(viewParam ?? "") ? (viewParam as TasksView) : "list";
  const quickParamRaw = searchParams.get("quick");
  const quick: TasksQuickView = (QUICK_KEYS as string[]).includes(quickParamRaw ?? "") ? (quickParamRaw as TasksQuickView) : "all";

  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sheetState, setSheetState] = useState<{ mode: "create" } | { mode: "edit"; task: TaskItem } | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [, startTransition] = useTransition();

  function buildViewHref(v: TasksView) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    return `/tasks?${params.toString()}`;
  }

  function buildQuickHref(q: TasksQuickView) {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.get("view")) params.set("view", "list");
    if (q === "all") params.delete("quick");
    else params.set("quick", q);
    return `/tasks?${params.toString()}`;
  }

  function refetch() {
    startTransition(async () => {
      setTasks(await getTasksAction());
    });
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

  function handleToggleComplete(task: TaskItem) {
    startTransition(async () => {
      await completeTask(task.id);
      refetch();
    });
  }

  async function handleBulkComplete() {
    const count = selectedIds.size;
    if (count === 0) return;
    await bulkCompleteTasks(Array.from(selectedIds));
    toast.success(`${count} tarea(s) completada(s).`);
    setSelectedIds(new Set());
    refetch();
  }

  async function handleBulkDelete() {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!window.confirm(`¿Eliminar ${count} tarea(s)? Esta acción no se puede deshacer.`)) return;
    try {
      await bulkDeleteTasks(Array.from(selectedIds));
      toast.success(`${count} tarea(s) eliminada(s).`);
      setSelectedIds(new Set());
      setSelectionMode(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron eliminar las tareas.");
    }
  }

  async function handleBulkAssign(memberId: string) {
    if (!memberId || selectedIds.size === 0) return;
    await bulkAssignTasks(Array.from(selectedIds), memberId);
    toast.success("Tareas reasignadas.");
    refetch();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return tasks.filter((t) => {
      if (quick === "mine" && t.assignedTo?.memberId !== ownMemberId) return false;
      if (quick === "favorites" && !t.isFavorite) return false;
      if (quick === "today") {
        if (!t.dueAt) return false;
        const d = new Date(t.dueAt);
        if (d < todayStart || d >= tomorrowStart) return false;
      }
      if (quick === "week") {
        if (!t.dueAt) return false;
        const d = new Date(t.dueAt);
        if (d < todayStart || d >= weekEnd) return false;
      }
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter && t.assignedTo?.memberId !== assigneeFilter) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, quick, statusFilter, priorityFilter, assigneeFilter, search, ownMemberId]);

  return (
    <div className="flex h-full">
      <TasksSidebar isHome={isHome} activeQuickView={quick} buildQuickHref={buildQuickHref} />

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between gap-3 border-b border-border-default px-4 py-3 sm:px-6 lg:px-8">
          <h1 className="text-[17px] font-semibold text-foreground">{isHome ? "Workspace" : "Tareas"}</h1>
          <div className="flex items-center gap-2">
            <NewItemMenu onNewTask={() => setSheetState({ mode: "create" })} />
            <button
              type="button"
              onClick={() => setAiPanelOpen((v) => !v)}
              title="Asistente IA"
              className="flex size-9 items-center justify-center rounded-md border border-border-strong text-neutral-500 hover:bg-surface-2 hover:text-foreground"
            >
              <Sparkles size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {isHome ? (
          <TasksWorkspaceHome stats={homeStats} />
        ) : (
          <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:p-8">
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
              <button
                type="button"
                onClick={toggleSelectionMode}
                className={
                  selectionMode
                    ? "flex items-center gap-1.5 rounded-md bg-accent-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-600"
                    : "flex items-center gap-1.5 rounded-md border border-border-strong px-3.5 py-2 text-sm font-medium text-foreground hover:bg-surface-2"
                }
              >
                <SquareCheck size={15} aria-hidden="true" />
                Acciones masivas
              </button>
              <TasksViewSwitcher view={view} buildHref={buildViewHref} />
            </div>

            {selectionMode && (
              <div className="flex flex-wrap items-center gap-3 rounded-md bg-accent-50 px-3 py-2 text-sm">
                <span className="font-medium text-accent-700">{selectedIds.size} seleccionado(s)</span>
                <button type="button" onClick={handleBulkComplete} disabled={selectedIds.size === 0} className="text-xs font-medium text-accent-700 hover:underline disabled:opacity-40">
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
          </div>
        )}
      </div>

      {aiPanelOpen && <TaskAiPanel onClose={() => setAiPanelOpen(false)} />}

      {sheetState && (
        <TaskFormSheet
          current={sheetState.mode === "edit" ? sheetState.task : null}
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
    </div>
  );
}
