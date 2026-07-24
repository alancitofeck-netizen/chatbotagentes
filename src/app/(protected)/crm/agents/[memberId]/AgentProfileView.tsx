"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calendar, CheckCircle2, Circle, MessageSquare, Plus, StickyNote, Trophy, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { toast } from "@/components/toast/toast";
import type { AgentDetail } from "@/lib/agents/queries";
import { addAgentNote, getAgentWorkspacesAction, getMyManageableWorkspacesAction, assignMemberToWorkspace } from "@/lib/agents/actions";
import { completeTask, getTasksAction } from "@/lib/tasks/actions";
import type { TaskItem, TaskOption } from "@/lib/tasks/queries";
import type { WorkspaceMembership } from "@/lib/auth/session";
import { TaskFormSheet } from "@/components/tasks/TaskFormSheet";

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "neutral" }> = {
  active: { label: "Activo", variant: "success" },
  vacation: { label: "Vacaciones", variant: "warning" },
  inactive: { label: "Inactivo", variant: "neutral" },
};

const ACTIVITY_ICON: Record<string, typeof Users> = {
  conversation: Users,
  meeting: Calendar,
  note: StickyNote,
  opportunity: Trophy,
};

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", agent: "Agente" };

function scoreColor(score: number): string {
  if (score >= 85) return "var(--color-success-strong)";
  if (score >= 70) return "var(--color-warning-strong)";
  if (score >= 50) return "#C2650A";
  return "var(--color-error-strong)";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const chartTooltipStyle = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--elevation-md)",
};

const TABS = [
  { key: "general", label: "General" },
  { key: "rendimiento", label: "Rendimiento" },
  { key: "actividad", label: "Actividad" },
  { key: "tareas", label: "Tareas" },
  { key: "workspaces", label: "Workspaces" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function AgentProfileView({
  agent,
  initialTasks,
  members,
  contactOptions,
  conversationOptions,
  canAssignOthers,
  canManageWorkspaces,
}: {
  agent: AgentDetail;
  initialTasks: TaskItem[];
  members: { memberId: string; fullName: string }[];
  contactOptions: TaskOption[];
  conversationOptions: TaskOption[];
  canAssignOthers: boolean;
  canManageWorkspaces: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: TabKey = TABS.some((t) => t.key === requestedTab) ? (requestedTab as TabKey) : "general";

  const [notes, setNotes] = useState(agent.notes);
  const [noteBody, setNoteBody] = useState("");
  const [tasks, setTasks] = useState(initialTasks);
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[] | null>(null);
  const [manageableWorkspaces, setManageableWorkspaces] = useState<WorkspaceMembership[]>([]);
  const [assignTargetId, setAssignTargetId] = useState("");
  const [isPending, startTransition] = useTransition();
  const statusInfo = STATUS_LABEL[agent.status] ?? STATUS_LABEL.active;

  function selectTab(tab: TabKey) {
    router.replace(`?tab=${tab}`, { scroll: false });
  }

  useEffect(() => {
    if (activeTab !== "workspaces" || workspaces !== null) return;
    getAgentWorkspacesAction(agent.userId).then(setWorkspaces);
    if (canManageWorkspaces) getMyManageableWorkspacesAction().then(setManageableWorkspaces);
  }, [activeTab, workspaces, agent.userId, canManageWorkspaces]);

  function handleAddNote() {
    if (!noteBody.trim()) return;
    const body = noteBody.trim();
    setNoteBody("");
    startTransition(async () => {
      try {
        await addAgentNote(agent.memberId, body);
        setNotes((prev) => [{ id: crypto.randomUUID(), body, createdAt: new Date().toISOString() }, ...prev]);
        toast.success("Nota agregada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo agregar la nota.");
      }
    });
  }

  function refetchTasks() {
    startTransition(async () => {
      setTasks(await getTasksAction({ assignedMemberId: agent.memberId }));
    });
  }

  function handleCompleteTask(taskId: string) {
    startTransition(async () => {
      await completeTask(taskId);
      refetchTasks();
    });
  }

  function handleAssignWorkspace() {
    if (!assignTargetId) return;
    startTransition(async () => {
      try {
        await assignMemberToWorkspace(agent.userId, assignTargetId, "agent");
        toast.success("Workspace asignado.");
        const fresh = await getAgentWorkspacesAction(agent.userId);
        setWorkspaces(fresh);
        setAssignTargetId("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo asignar el workspace.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <span className="font-mono text-3xl font-semibold" style={{ color: scoreColor(agent.score) }}>
            {agent.score}
          </span>
          <p className="mt-1 text-[13px] text-neutral-500">Score general</p>
        </Card>
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">{agent.leadsAssigned}</span>
          <p className="mt-1 text-[13px] text-neutral-500">Leads asignados</p>
        </Card>
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">{agent.responseRate}%</span>
          <p className="mt-1 text-[13px] text-neutral-500">Tasa de respuesta</p>
        </Card>
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">
            {agent.meetingsCompleted}/{agent.meetingsScheduled}
          </span>
          <p className="mt-1 text-[13px] text-neutral-500">Reuniones realizadas</p>
        </Card>
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">{agent.conversionRate}%</span>
          <p className="mt-1 text-[13px] text-neutral-500">Conversión</p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => selectTab(v as TabKey)}>
        <TabsList className="overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="pt-4">
          <TabsContent value="general">
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader title="Información" />
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-neutral-500">Email</dt>
                    <dd className="text-foreground">{agent.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-neutral-500">Estado</dt>
                    <dd>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-neutral-500">Equipo</dt>
                    <dd className="text-foreground">{agent.teamName ?? "Sin equipo"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-neutral-500">Supervisor</dt>
                    <dd className="text-foreground">{agent.supervisorName ?? "Sin supervisor"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-neutral-500">Fecha de ingreso</dt>
                    <dd className="text-foreground">
                      {agent.hireDate ? new Date(agent.hireDate).toLocaleDateString("es") : "Sin datos"}
                    </dd>
                  </div>
                </dl>
              </Card>

              <Card>
                <CardHeader title="Notas internas" />
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                      placeholder="Ej. Excelente desempeño esta semana…"
                      className="flex-1 rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
                    />
                    <Button size="sm" onClick={handleAddNote} loading={isPending}>
                      Agregar
                    </Button>
                  </div>
                  {notes.length === 0 ? (
                    <p className="text-sm text-neutral-500">Sin notas todavía.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {notes.map((note) => (
                        <li key={note.id} className="rounded-md bg-surface-2 p-3">
                          <p className="text-sm text-foreground">{note.body}</p>
                          <p className="mt-1 text-xs text-neutral-500">{formatDate(note.createdAt)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rendimiento">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card>
                <CardHeader title="Actividad diaria (14 días)" />
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={agent.daily}>
                      <CartesianGrid vertical={false} stroke="var(--border-default)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} minTickGap={20} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} width={24} allowDecimals={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Line type="monotone" dataKey="messages" name="Mensajes" stroke="var(--color-accent-500)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <CardHeader title="Reuniones semanales (8 semanas)" />
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agent.weekly}>
                      <CartesianGrid vertical={false} stroke="var(--border-default)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} minTickGap={20} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} width={24} allowDecimals={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="meetings" name="Reuniones" fill="var(--color-accent-500)" radius={[4, 4, 4, 4]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <CardHeader title="Conversión mensual (6 meses)" />
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agent.monthly}>
                      <CartesianGrid vertical={false} stroke="var(--border-default)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} width={24} allowDecimals={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="won" name="Ganadas" fill="var(--color-success)" radius={[4, 4, 4, 4]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="actividad">
            <Card>
              <CardHeader title="Actividad reciente" />
              {agent.activity.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin actividad reciente.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {agent.activity.map((event) => {
                    const Icon = ACTIVITY_ICON[event.type] ?? MessageSquare;
                    return (
                      <li key={event.id} className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-neutral-500">
                          <Icon size={14} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{event.label}</p>
                          <p className="text-xs text-neutral-500">{formatDate(event.createdAt)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-xs text-neutral-400">
                Armado a partir de conversaciones/reuniones/oportunidades existentes — no es un registro de auditoría real.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="tareas">
            <Card>
              <CardHeader
                title="Tareas"
                action={
                  <Button size="sm" onClick={() => setTaskSheetOpen(true)}>
                    <Plus size={15} aria-hidden="true" />
                    Nueva tarea
                  </Button>
                }
              />
              {tasks.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin tareas todavía.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border-default">
                  {tasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => task.status !== "completed" && handleCompleteTask(task.id)}
                        className="shrink-0 text-neutral-400 hover:text-success-strong"
                        aria-label="Marcar completada"
                      >
                        {task.status === "completed" ? (
                          <CheckCircle2 size={17} className="text-success-strong" aria-hidden="true" />
                        ) : (
                          <Circle size={17} aria-hidden="true" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm ${task.status === "completed" ? "text-neutral-400 line-through" : "text-foreground"}`}>
                          {task.title}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {task.priority} {task.dueAt && `· Vence: ${formatDate(task.dueAt)}`}
                          {task.relatedLabel && ` · ${task.relatedLabel}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="workspaces">
            <Card>
              <CardHeader title="Workspaces asignados" />
              {workspaces === null ? (
                <p className="text-sm text-neutral-500">Cargando…</p>
              ) : workspaces.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin workspaces visibles.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border-default">
                  {workspaces.map((w) => (
                    <li key={w.workspaceId} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-foreground">{w.name}</span>
                      <Badge variant="neutral">{ROLE_LABEL[w.role] ?? w.role}</Badge>
                    </li>
                  ))}
                </ul>
              )}

              {canManageWorkspaces && manageableWorkspaces.length > 0 && (
                <div className="mt-4 flex items-end gap-2 border-t border-border-default pt-4">
                  <Select label="Agregar a otro workspace" value={assignTargetId} onChange={(e) => setAssignTargetId(e.target.value)} containerClassName="flex-1">
                    <option value="">Elegir workspace…</option>
                    {manageableWorkspaces
                      .filter((w) => !workspaces?.some((existing) => existing.workspaceId === w.workspaceId))
                      .map((w) => (
                        <option key={w.workspaceId} value={w.workspaceId}>
                          {w.name}
                        </option>
                      ))}
                  </Select>
                  <Button size="sm" onClick={handleAssignWorkspace} loading={isPending} disabled={!assignTargetId}>
                    Asignar
                  </Button>
                </div>
              )}
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      {taskSheetOpen && (
        // `ownMemberId` is the profiled agent here (not the viewer's own id) so a
        // task created from this tab defaults to THEM — TaskFormSheet also uses
        // it to render "(vos)" next to whoever it matches, which will point at
        // the profiled agent instead of the real viewer in this one context;
        // a minor mislabel, correct default assignee matters more.
        <TaskFormSheet
          current={null}
          members={members}
          contactOptions={contactOptions}
          conversationOptions={conversationOptions}
          canAssignOthers={canAssignOthers}
          ownMemberId={agent.memberId}
          onClose={() => setTaskSheetOpen(false)}
          onSaved={() => {
            refetchTasks();
            setTaskSheetOpen(false);
          }}
        />
      )}
    </div>
  );
}
