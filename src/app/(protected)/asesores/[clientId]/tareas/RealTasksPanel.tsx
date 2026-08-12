import { ListChecks } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PRIORITY_META } from "@/components/tasks/priorityMeta";
import type { ClientRealTask } from "@/lib/clients/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { formatDueLabel, getTaskEstadoMeta } from "./taskStatusMeta";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

/** Solo lectura a propósito — es el CRM del asesor, no el tuyo. Mismo
 * lenguaje visual que la tabla interna (Badge/PRIORITY_META/taskStatusMeta)
 * pero sin buscador, filtros, paginación ni acciones. */
export function RealTasksPanel({ tasks, members }: { tasks: ClientRealTask[]; members: WorkspaceMemberOption[] }) {
  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));
  const avatarById = new Map(members.map((m) => [m.memberId, m.avatarUrl]));

  return (
    <Card>
      <CardHeader title="Tareas del asesor" />
      {tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="Sin tareas cargadas" description="Este asesor todavía no tiene tareas en su propio CRM." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-default text-xs text-neutral-500">
                <th className="py-2 pr-3 font-medium">Tarea</th>
                <th className="py-2 pr-3 font-medium">Prioridad</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 pr-3 font-medium">Responsable</th>
                <th className="py-2 pr-3 font-medium">Fecha límite</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const estado = getTaskEstadoMeta(task);
                const due = formatDueLabel(task);
                const priorityMeta = PRIORITY_META[task.priority as keyof typeof PRIORITY_META];
                return (
                  <tr key={task.id} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 pr-3">
                      <p className={`text-sm font-medium ${task.status === "completed" ? "text-neutral-400 line-through" : "text-foreground"}`}>{task.title}</p>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={priorityMeta?.badgeVariant ?? "neutral"}>{priorityMeta?.label ?? task.priority}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={estado.variant}>{estado.label}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {task.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={nameById.get(task.assignedTo) ?? "?"} src={avatarById.get(task.assignedTo)} size={22} />
                          <span className="text-neutral-500">{nameById.get(task.assignedTo) ?? "—"}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-400">Sin asignar</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {task.dueAt && <p className="text-neutral-500">{formatDate(task.dueAt)}</p>}
                      <p className={`text-xs ${due.tone === "error" ? "text-error-strong" : due.tone === "success" ? "text-success-strong" : "text-warning-strong"}`}>{due.text}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
