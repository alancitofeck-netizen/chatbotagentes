import type { Metadata } from "next";
import { Ban, CheckCircle2, ListTodo, ListChecks, CalendarClock, RefreshCw } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getClientTasks } from "@/lib/clients/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { StatTile } from "../../StatTile";
import { bucketByDay, monthCounts, monthOverMonthDelta } from "@/lib/clients/statsHelpers";
import { PRIORITY_META } from "@/components/tasks/priorityMeta";
import { estadoCategory, formatDueLabel } from "./taskStatusMeta";
import { TaskStatusDonutChart } from "./TaskStatusDonutChart";
import { HorizontalBarList } from "./HorizontalBarList";
import { TareasTable } from "./TareasTable";

export const metadata: Metadata = { title: "Tareas — Cliente — Growth Link" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

export default async function ClientTareasPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const [tasks, members] = await Promise.all([getClientTasks(workspaceId, clientId), getWorkspaceMembers(workspaceId)]);
  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));
  const avatarById = new Map(members.map((m) => [m.memberId, m.avatarUrl]));

  const pendientes = tasks.filter((t) => estadoCategory(t) === "pending");
  const enProgreso = tasks.filter((t) => estadoCategory(t) === "in_progress");
  const completadas = tasks.filter((t) => estadoCategory(t) === "completed");
  const vencidas = tasks.filter((t) => estadoCategory(t) === "overdue");

  const pendientesDates = pendientes.map((t) => t.dueAt).filter((d): d is string => !!d);
  const enProgresoDates = enProgreso.map((t) => t.dueAt).filter((d): d is string => !!d);
  const completadasDates = completadas.map((t) => t.completedAt).filter((d): d is string => !!d);
  const vencidasDates = vencidas.map((t) => t.dueAt).filter((d): d is string => !!d);
  const createdDates = tasks.map((t) => t.createdAt);
  const allDueDates = tasks.map((t) => t.dueAt).filter((d): d is string => !!d);
  const esteMesCount = monthCounts(allDueDates).thisMonth;

  const priorityCounts = new Map<string, number>();
  for (const t of tasks) priorityCounts.set(t.priority, (priorityCounts.get(t.priority) ?? 0) + 1);
  const priorityOrder: (keyof typeof PRIORITY_META)[] = ["urgent", "high", "medium", "low"];
  const priorityColor: Record<string, string> = {
    urgent: "var(--color-info-strong)",
    high: "var(--color-error-strong)",
    medium: "var(--color-warning-strong)",
    low: "var(--color-success-strong)",
  };
  const priorityItems = priorityOrder
    .filter((p) => (priorityCounts.get(p) ?? 0) > 0)
    .map((p) => ({ label: PRIORITY_META[p].label, value: priorityCounts.get(p) ?? 0, color: priorityColor[p] }));

  const assigneeCounts = new Map<string, number>();
  for (const t of tasks) {
    if (!t.assignedTo) continue;
    assigneeCounts.set(t.assignedTo, (assigneeCounts.get(t.assignedTo) ?? 0) + 1);
  }
  const responsableItems = [...assigneeCounts.entries()]
    .map(([id, count]) => ({ label: nameById.get(id) ?? "—", value: count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const proximasTareas = tasks
    .filter((t) => t.status !== "completed" && t.dueAt)
    .sort((a, b) => new Date(a.dueAt as string).getTime() - new Date(b.dueAt as string).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile icon={ListChecks} label="Tareas pendientes" value={String(pendientes.length)} sparklineData={bucketByDay(pendientesDates, 14)} deltaPct={monthOverMonthDelta(pendientesDates)} />
        <StatTile
          icon={RefreshCw}
          label="En progreso"
          value={String(enProgreso.length)}
          sparklineData={bucketByDay(enProgresoDates, 14)}
          deltaPct={monthOverMonthDelta(enProgresoDates)}
          color="var(--color-info-strong)"
        />
        <StatTile
          icon={CheckCircle2}
          label="Completadas"
          value={String(completadas.length)}
          sparklineData={bucketByDay(completadasDates, 14)}
          deltaPct={monthOverMonthDelta(completadasDates)}
          color="var(--color-success-strong)"
        />
        <StatTile
          icon={Ban}
          label="Vencidas"
          value={String(vencidas.length)}
          sparklineData={bucketByDay(vencidasDates, 14)}
          deltaPct={monthOverMonthDelta(vencidasDates)}
          color="var(--color-error-strong)"
        />
        <StatTile icon={ListTodo} label="Total tareas" value={String(tasks.length)} sparklineData={bucketByDay(createdDates, 14)} deltaPct={monthOverMonthDelta(createdDates)} />
        <StatTile icon={CalendarClock} label="Este mes" value={String(esteMesCount)} deltaPct={monthOverMonthDelta(allDueDates)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div id="tareas-table">
          <Card>
            <CardHeader title="Tareas" />
            <TareasTable clientId={clientId} initialTasks={tasks} members={members} />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <TaskStatusDonutChart pendientes={pendientes.length} enProgreso={enProgreso.length} completadas={completadas.length} vencidas={vencidas.length} />
          <HorizontalBarList title="Tareas por prioridad" items={priorityItems} />
          <HorizontalBarList title="Tareas por responsable" items={responsableItems} defaultColor="var(--color-accent-500)" />

          <Card>
            <CardHeader title="Próximas tareas" />
            {proximasTareas.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin tareas próximas.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {proximasTareas.map((t) => {
                  const due = formatDueLabel(t);
                  return (
                    <li key={t.id} className="flex items-center gap-2.5 text-sm">
                      {t.assignedTo ? (
                        <Avatar name={nameById.get(t.assignedTo) ?? "?"} src={avatarById.get(t.assignedTo)} size={24} />
                      ) : (
                        <div className="size-6 shrink-0 rounded-full bg-surface-3" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-foreground">{t.title}</span>
                      <span className="shrink-0 text-right text-xs text-neutral-500">
                        {formatDate(t.dueAt as string)}
                        <br />
                        <span className={due.tone === "error" ? "text-error-strong" : "text-warning-strong"}>{due.text}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <a href="#tareas-table" className="mt-3 inline-block text-[13px] font-medium text-accent-600 hover:underline">
              Ver todas las tareas →
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}
