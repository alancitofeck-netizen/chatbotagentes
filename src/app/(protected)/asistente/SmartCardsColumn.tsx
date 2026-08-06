"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sun, AlertTriangle, TrendingUp, ArrowUpRight, CalendarClock, Sparkles, ListChecks, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import type { AssistantDashboard } from "@/lib/assistant/actions";
import { generateRecommendationsAction } from "@/lib/assistant/actions";
import { formatCurrency } from "@/lib/utils/format";

function CardShell({ icon, title, children, delay = 0 }: { icon: React.ReactNode; title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay, ease: "easeOut" }}>
      <Card>
        <div className="mb-4 flex items-center gap-1.5">
          {icon}
          <h3 className="text-[15px] font-medium text-foreground">{title}</h3>
        </div>
        {children}
      </Card>
    </motion.div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

export function SmartCardsColumn({ dashboard }: { dashboard: AssistantDashboard }) {
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  function handleGenerateRecommendations() {
    setGenerating(true);
    generateRecommendationsAction()
      .then(setRecommendations)
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo generar."))
      .finally(() => setGenerating(false));
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      <CardShell icon={<Sun className="size-4 text-warning-strong" aria-hidden="true" />} title="Resumen del día" delay={0}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-mono text-xl font-semibold text-foreground">{dashboard.today.meetingsCount}</p>
            <p className="text-[11px] text-neutral-500">Reuniones</p>
          </div>
          <div>
            <p className="font-mono text-xl font-semibold text-foreground">{dashboard.today.pendingTasksCount}</p>
            <p className="text-[11px] text-neutral-500">Tareas</p>
          </div>
          <div>
            <p className="font-mono text-xl font-semibold text-error-strong">{dashboard.today.overdueCollectionsCount}</p>
            <p className="text-[11px] text-neutral-500">Vencidos</p>
          </div>
        </div>
        {dashboard.today.meetingsPreview.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5 border-t border-border-default pt-3">
            {dashboard.today.meetingsPreview.map((m, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="truncate text-foreground">{m.subject}</span>
                <span className="shrink-0 text-neutral-500">{formatTime(m.startTime)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardShell>

      <CardShell icon={<Sparkles className="size-4 text-accent-500" aria-hidden="true" />} title="Prioridades" delay={0.03}>
        {dashboard.priorities.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin urgencias por ahora.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-default">
            {dashboard.priorities.slice(0, 5).map((p, i) => (
              <li key={i} className="py-2 text-sm">
                <p className="truncate font-medium text-foreground">{p.label}</p>
                <p className="truncate text-xs text-neutral-500">{p.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </CardShell>

      <CardShell icon={<AlertTriangle className="size-4 text-error-strong" aria-hidden="true" />} title="Alertas" delay={0.06}>
        <div className="flex flex-col gap-2">
          {dashboard.alerts.overdueCollectionsCount > 0 && (
            <div className="flex items-center justify-between rounded-md bg-error-bg px-3 py-2 text-sm text-error-strong">
              <span>Cobros vencidos</span>
              <Badge variant="error">{dashboard.alerts.overdueCollectionsCount}</Badge>
            </div>
          )}
          {dashboard.alerts.expiringPoliciesCount > 0 && (
            <div className="flex items-center justify-between rounded-md bg-warning-bg px-3 py-2 text-sm text-warning-strong">
              <span>Pólizas por vencer (30 días)</span>
              <Badge variant="warning">{dashboard.alerts.expiringPoliciesCount}</Badge>
            </div>
          )}
          {dashboard.alerts.overdueCollectionsCount === 0 && dashboard.alerts.expiringPoliciesCount === 0 && <p className="text-sm text-neutral-500">Sin alertas activas.</p>}
        </div>
      </CardShell>

      <CardShell icon={<ArrowUpRight className="size-4 text-success-strong" aria-hidden="true" />} title="Oportunidades de venta" delay={0.09}>
        {dashboard.crossSell.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin candidatos de cross-sell detectados.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-default">
            {dashboard.crossSell.slice(0, 5).map((c) => (
              <li key={c.contactId} className="py-2 text-sm">
                <p className="truncate font-medium text-foreground">{c.contactName}</p>
                <p className="text-xs text-neutral-500">Tiene {c.hasTypes.join(", ")} — podría interesarle {c.missingTypes.slice(0, 2).join(", ")}</p>
              </li>
            ))}
          </ul>
        )}
      </CardShell>

      <CardShell icon={<TrendingUp className="size-4 text-info-strong" aria-hidden="true" />} title="Rendimiento semanal" delay={0.12}>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-2xl font-semibold text-foreground">{formatCurrency(dashboard.weeklyPerformance.premiumThisWeek)}</p>
            <p className="text-xs text-neutral-500">{dashboard.weeklyPerformance.policiesThisWeek} pólizas esta semana</p>
          </div>
          {dashboard.weeklyPerformance.changePct !== null && (
            <Badge variant={dashboard.weeklyPerformance.changePct >= 0 ? "success" : "error"}>
              {dashboard.weeklyPerformance.changePct >= 0 ? "+" : ""}
              {dashboard.weeklyPerformance.changePct}%
            </Badge>
          )}
        </div>
      </CardShell>

      <CardShell icon={<CalendarClock className="size-4 text-accent-500" aria-hidden="true" />} title="Próximas reuniones" delay={0.15}>
        {dashboard.upcomingMeetings.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin reuniones agendadas.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-default">
            {dashboard.upcomingMeetings.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{m.subject}</p>
                  {m.contactName && <p className="truncate text-xs text-neutral-500">{m.contactName}</p>}
                </div>
                <span className="shrink-0 text-xs text-neutral-500">{new Date(m.startTime).toLocaleDateString("es", { day: "2-digit", month: "short" })}</span>
              </li>
            ))}
          </ul>
        )}
      </CardShell>

      <CardShell icon={<ListChecks className="size-4 text-success-strong" aria-hidden="true" />} title="Recomendaciones" delay={0.18}>
        {recommendations ? (
          <p className="whitespace-pre-wrap text-sm text-foreground">{recommendations}</p>
        ) : (
          <button
            type="button"
            onClick={handleGenerateRecommendations}
            disabled={generating}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-600 hover:text-accent-700 disabled:opacity-50"
          >
            {generating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
            Generar recomendaciones
          </button>
        )}
      </CardShell>
    </div>
  );
}
