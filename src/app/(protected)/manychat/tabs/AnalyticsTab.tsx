"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { BarChart3 } from "lucide-react";
import type { ManychatDashboardSummary } from "@/lib/integrations/manychat";

const LEVEL_LABEL: Record<string, string> = { high: "Alta", medium: "Media", low: "Baja", none: "Ninguna" };

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-border-default py-2 text-sm last:border-b-0">
      <span className="text-neutral-500">{label}</span>
      <span className="font-mono font-medium text-foreground">{value}</span>
    </div>
  );
}

/** ManyChat → Analytics — mismos datos reales que Resumen (getManychatDashboardSummary,
 * un solo query, sin duplicar), presentados en más detalle/tabular en vez de
 * gráfico, para responder preguntas puntuales rápido. */
export function AnalyticsTab({ connected, dashboard, onGoToConfig }: { connected: boolean; dashboard: ManychatDashboardSummary | null; onGoToConfig: () => void }) {
  if (!connected || !dashboard) {
    return (
      <EmptyState icon={BarChart3} title="ManyChat todavía no está conectado" description="Conectalo desde Configuración para ver analytics reales." action={<Button onClick={onGoToConfig}>Ir a Configuración</Button>} />
    );
  }

  const pct = (n: number) => (dashboard.totalLeads > 0 ? `${Math.round((n / dashboard.totalLeads) * 100)}%` : "—");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Leads" />
        <StatRow label="Leads totales" value={dashboard.totalLeads} />
        <StatRow label="Nuevos (últimos 30 días)" value={dashboard.newLeadsInWindow} />
        <StatRow label="Con datos completos (tel. + email)" value={`${dashboard.withCompleteDataCount} (${pct(dashboard.withCompleteDataCount)})`} />
      </Card>

      <Card>
        <CardHeader title="Fuentes" />
        {dashboard.leadsBySource.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin datos de fuente todavía.</p>
        ) : (
          dashboard.leadsBySource.map((s) => <StatRow key={s.source} label={s.source} value={`${s.count} (${pct(s.count)})`} />)
        )}
      </Card>

      <Card>
        <CardHeader title="Interacción" />
        {(["high", "medium", "low", "none"] as const).map((level) => (
          <StatRow key={level} label={LEVEL_LABEL[level]} value={`${dashboard.leadsByLevel[level]} (${pct(dashboard.leadsByLevel[level])})`} />
        ))}
      </Card>

      <Card>
        <CardHeader title="Conversaciones" />
        <StatRow label="Con intercambio real (ambos lados)" value={dashboard.totalConversations} />
        <StatRow label="Solo iniciadas, sin respuesta" value={Math.max(0, dashboard.totalLeads - dashboard.totalConversations)} />
      </Card>
    </div>
  );
}
