import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, ListTodo } from "lucide-react";
import type { TaskGroup, GroupStats } from "@/lib/tasks/groups/queries";
import { GROUP_COLOR_META } from "@/components/tasks/groupColorMeta";

export interface TasksHomeStats {
  greetingName: string;
  pending: number;
  highPriority: number;
  dueToday: number;
  completedThisWeek: number;
}

function StatChip({ icon: Icon, label, value, tone }: { icon: typeof ListTodo; label: string; value: number; tone: "critical" | "neutral" }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-1 p-4 shadow-[var(--elevation-xs)]">
      <span
        className={
          tone === "critical"
            ? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-error-bg text-error-strong"
            : "flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-700"
        }
      >
        <Icon size={17} aria-hidden="true" />
      </span>
      <div>
        <p className="text-lg font-semibold text-foreground">{value}</p>
        <p className="text-xs text-neutral-500">{label}</p>
      </div>
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
      className="flex flex-col gap-2.5 rounded-xl border border-border-default bg-surface-1 p-4 shadow-[var(--elevation-xs)] transition-shadow hover:shadow-[var(--elevation-sm)]"
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-[17px] ${GROUP_COLOR_META[group.color].bg}`}>
          {group.icon}
        </span>
        <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent-500" style={{ width: `${stats.progressPct}%` }} />
      </div>
      <p className="text-xs text-neutral-500">
        {stats.progressPct}% · {stats.completed}/{stats.total} completadas
      </p>
    </Link>
  );
}

/** "Buenos días" home screen — Sección "Dashboard principal" del rediseño
 * Grupos: solo información de tareas, nunca métricas de Inbox/CRM/Calendario/
 * Pólizas (esas viven en sus propios módulos). Todos los stats vienen del
 * mismo getTasks(workspaceId) ya usado en el resto del módulo. */
export function TasksWorkspaceHome({
  stats,
  recentGroups,
}: {
  stats: TasksHomeStats;
  recentGroups: { group: TaskGroup; stats: GroupStats }[];
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.02em] text-foreground">
          {greeting}, {stats.greetingName} 👋
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Esto es lo que tenés pendiente en tu Workspace.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip icon={ListTodo} label="Tareas pendientes" value={stats.pending} tone="neutral" />
        <StatChip icon={AlertTriangle} label="Alta prioridad" value={stats.highPriority} tone={stats.highPriority > 0 ? "critical" : "neutral"} />
        <StatChip icon={Clock} label="Vencen hoy" value={stats.dueToday} tone={stats.dueToday > 0 ? "critical" : "neutral"} />
        <StatChip icon={CheckCircle2} label="Completadas esta semana" value={stats.completedThisWeek} tone="neutral" />
      </div>

      <div>
        <h2 className="mb-3 text-[13px] font-semibold text-foreground">Grupos recientes</h2>
        {recentGroups.length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía no creaste ningún grupo — usá &ldquo;Nuevo&rdquo; para empezar.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentGroups.map(({ group, stats: gStats }) => (
              <GroupCard key={group.id} group={group} stats={gStats} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
