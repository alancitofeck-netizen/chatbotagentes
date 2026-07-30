import Link from "next/link";
import { FileSpreadsheet, Inbox, LayoutDashboard, MessageCircle, ShieldAlert, Sparkles, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";

export interface TasksHomeStats {
  greetingName: string;
  criticalTasksToday: number;
  meetingsToday: number;
  pendingConversations: number;
  policiesToReview: number;
}

function StatChip({ icon: Icon, label, value, tone }: { icon: typeof Zap; label: string; value: number; tone: "critical" | "neutral" }) {
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

const QUICK_ACTIONS = [
  { label: "Ver Dashboard general", href: "/dashboard", icon: LayoutDashboard },
  { label: "Importador de Cartera", href: "/advisors/import", icon: FileSpreadsheet },
  { label: "Ir al Inbox", href: "/inbox", icon: Inbox },
  { label: "Configurar WhatsApp", href: "/profile?tab=integrations", icon: MessageCircle },
];

/** "Buenos días {nombre}" home screen (Sección 7 del rediseño) — the
 * Workspace module's landing page, before drilling into any of the 4 task
 * views. Every stat below comes from a real query (page.tsx), reusing
 * getDashboardKpis' meetingsToday (already excludes event_type='task') and
 * insights' getUnansweredConversations rather than recomputing either. The
 * quick-actions row only links to features that actually exist today — the
 * "Enviar propuesta" example from the brief has no real counterpart in the
 * product yet, so it's replaced with real shortcuts instead of a fake one. */
export function TasksWorkspaceHome({ stats }: { stats: TasksHomeStats }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.02em] text-foreground">
          {greeting}, {stats.greetingName} 👋
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Esto es lo que tenés hoy en tu Workspace.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip icon={Zap} label="Tareas críticas" value={stats.criticalTasksToday} tone={stats.criticalTasksToday > 0 ? "critical" : "neutral"} />
        <StatChip icon={LayoutDashboard} label="Reuniones hoy" value={stats.meetingsToday} tone="neutral" />
        <StatChip icon={MessageCircle} label="Conversaciones pendientes" value={stats.pendingConversations} tone="neutral" />
        <StatChip icon={ShieldAlert} label="Pólizas para revisar" value={stats.policiesToReview} tone="neutral" />
      </div>

      <Card>
        <div className="flex items-center gap-2 pb-3">
          <Sparkles size={15} className="text-accent-500" aria-hidden="true" />
          <h2 className="text-[13px] font-semibold text-foreground">Accesos rápidos</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg border border-border-default px-3.5 py-2.5 text-sm text-foreground hover:border-accent-500 hover:bg-surface-2"
            >
              <Icon size={16} className="text-neutral-500" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </Card>

      <div>
        <Link href="/tasks?view=list" className="text-sm font-medium text-accent-600 hover:underline">
          Ver todas mis tareas →
        </Link>
      </div>
    </div>
  );
}
