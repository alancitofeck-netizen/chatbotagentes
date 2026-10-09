import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, ListTodo } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";
import { cn } from "@/lib/utils/cn";
import type { TaskGroup, GroupStats } from "@/lib/tasks/groups/queries";
import type { TaskItem, TaskOption } from "@/lib/tasks/queries";
import { PendingTasksList } from "./PendingTasksList";
import { TasksHomeActions } from "./TasksHomeMobile";

export interface TasksHomeStats {
  greetingName: string;
  pending: number;
  highPriority: number;
  dueToday: number;
  completedThisWeek: number;
}

type StatTone = "accent" | "critical" | "warning" | "success";

// Tinte translúcido del tono medio: los "strong" están pensados para fondo claro
// y el modo oscuro no los redefine, así que sobre la tarjeta oscura quedaban apagados.
const STAT_TONE: Record<StatTone, string> = {
  accent: "bg-accent-500/15 text-accent-500",
  critical: "bg-error/15 text-error",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
};

// Mismo criterio para el cuadrado del ícono de cada grupo (GROUP_COLOR_META.bg son
// fondos pastel claros, que en oscuro se ven como manchas blancas).
const GROUP_TILE: Record<TaskGroup["color"], string> = {
  neutral: "bg-neutral-400/15",
  accent: "bg-accent-500/15",
  success: "bg-success/15",
  warning: "bg-warning/15",
  error: "bg-error/15",
  info: "bg-info/15",
};

function StatChip({ icon: Icon, label, value, tone }: { icon: typeof ListTodo; label: string; value: number; tone: StatTone }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-1 p-3.5 shadow-[var(--elevation-sm)]">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", STAT_TONE[tone])}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <p className="text-[13px] leading-tight text-foreground/80">{label}</p>
      </div>
      <p className="mt-2.5 font-display text-[24px] leading-none font-semibold tracking-[-0.02em] tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** Exported so Favoritos (`/tasks/favorites`) reuses the identical card
 * instead of a near-duplicate. Archivados uses its own variant since it
 * needs a "Desarchivar" action button, not a plain link-through. */
export function GroupCard({ group, stats }: { group: TaskGroup; stats: GroupStats }) {
  return (
    <Link
      href={`/tasks/groups/${group.id}`}
      className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-border-default bg-surface-1 p-3 shadow-[var(--elevation-xs)] transition-shadow hover:shadow-[var(--elevation-sm)] sm:p-4"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[15px] sm:size-9 sm:text-[17px] ${GROUP_TILE[group.color]}`}>
          {group.icon}
        </span>
        <p className="truncate text-[15px] font-semibold text-foreground sm:text-sm">{group.name}</p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent-500" style={{ width: `${stats.progressPct}%` }} />
      </div>
      <p className="text-[11.5px] leading-tight text-neutral-500 sm:text-xs">
        {stats.progressPct}% · {stats.completed}/{stats.total} completadas
      </p>
    </Link>
  );
}

const HELP = "Las tareas te ayudan a saber qué tenés que hacer y cuándo. Organizalas en grupos y asignaselas a vos o a tu equipo.";

/** Inicio de Tareas — solo información de tareas, nunca métricas de
 * Inbox/CRM/Calendario/Pólizas (esas viven en sus propios módulos). Todos los
 * stats vienen del mismo getTasks(workspaceId) ya usado en el resto del módulo.
 *
 * Mobile sigue la referencia: encabezado "Tareas" con volver y "¿Qué hago acá?",
 * indicadores, "Nueva tarea" / "Sugerencias IA", grupos en grilla de 3, chips de
 * filtro y la lista; el FAB crea tareas, grupos o plantillas. En escritorio el
 * saludo y la barra del módulo (Nuevo / IA) siguen como estaban. */
export function TasksWorkspaceHome({
  stats,
  tasks,
  groupsById,
  recentGroups,
  ownMemberId,
  members,
  contactOptions,
  conversationOptions,
  canAssignOthers,
}: {
  stats: TasksHomeStats;
  tasks: TaskItem[];
  groupsById: Map<string, TaskGroup>;
  recentGroups: { group: TaskGroup; stats: GroupStats }[];
  ownMemberId: string | null;
  members: { memberId: string; fullName: string }[];
  contactOptions: TaskOption[];
  conversationOptions: TaskOption[];
  canAssignOthers: boolean;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  // La lista guarda su propio estado (completar es optimista): se vuelve a montar
  // cuando cambian las tareas del servidor, p. ej. después de crear una.
  const listKey = `${tasks.length}-${tasks.reduce((max, t) => (t.updatedAt > max ? t.updatedAt : max), "")}`;

  return (
    <div className="flex flex-col gap-5 p-4 sm:gap-6 sm:p-6 lg:p-8">
      <PageHeader
        back
        icon={ListTodo}
        title="Tareas"
        description="Lo que tenés pendiente vos y tu equipo."
        help={<ModuleHelp description={HELP} tourKey="tasks-create-task" />}
        className="md:hidden"
      />
      <PageHeader
        icon={ListTodo}
        title={`${greeting}, ${stats.greetingName} 👋`}
        description="Esto es lo que tenés pendiente en tu Workspace."
        className="max-md:hidden"
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <StatChip icon={ListTodo} label="Tareas pendientes" value={stats.pending} tone="accent" />
        <StatChip icon={AlertTriangle} label="Alta prioridad" value={stats.highPriority} tone="critical" />
        <StatChip icon={Clock} label="Vencen hoy" value={stats.dueToday} tone="warning" />
        <StatChip icon={CheckCircle2} label="Completadas esta semana" value={stats.completedThisWeek} tone="success" />
      </div>

      <TasksHomeActions
        ownMemberId={ownMemberId}
        members={members}
        contactOptions={contactOptions}
        conversationOptions={conversationOptions}
        canAssignOthers={canAssignOthers}
      />

      <section>
        <h2 className="mb-2.5 text-[13.5px] font-semibold text-neutral-500 md:text-[13px] md:text-foreground">Grupos</h2>
        {recentGroups.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Todavía no creaste ningún grupo — <span className="md:hidden">tocá &ldquo;+&rdquo; para crear uno.</span>
            <span className="max-md:hidden">usá &ldquo;Nuevo&rdquo; para empezar.</span>
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {recentGroups.map(({ group, stats: gStats }) => (
              <GroupCard key={group.id} group={group} stats={gStats} />
            ))}
          </div>
        )}
      </section>

      <section className="lg:max-w-3xl">
        <h2 className="mb-2.5 text-[13px] font-semibold text-foreground max-md:sr-only">Tus tareas</h2>
        <PendingTasksList key={listKey} tasks={tasks} groupsById={groupsById} ownMemberId={ownMemberId} />
      </section>
    </div>
  );
}
