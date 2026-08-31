"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Camera, Users, MessagesSquare, TrendingUp, Sparkles } from "lucide-react";
import type { ManychatDashboardSummary } from "@/lib/integrations/manychat";

const chartTooltipStyle = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--elevation-md)",
};

const LEVEL_COLOR: Record<string, string> = {
  high: "var(--color-success-strong)",
  medium: "var(--color-info-strong)",
  low: "var(--color-warning-strong)",
  none: "var(--color-neutral-400)",
};
const LEVEL_LABEL: Record<string, string> = { high: "Alta", medium: "Media", low: "Baja", none: "Ninguna" };
const SOURCE_COLORS = ["var(--color-accent-500)", "var(--color-info-strong)", "var(--color-success-strong)", "var(--color-warning-strong)", "var(--color-neutral-400)"];

function KpiTile({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="font-mono text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-neutral-500">{label}</p>
      </div>
    </Card>
  );
}

/** ManyChat → Resumen. Todo dato viene de getManychatDashboardSummary
 * (conteos reales) — cuando source/content_name nunca se configuraron
 * (caso más común), esos gráficos igual muestran números reales, solo que
 * agrupados bajo "Sin especificar" en vez de una distribución fabricada. */
export function ResumenTab({ connected, dashboard, onGoToConfig }: { connected: boolean; dashboard: ManychatDashboardSummary | null; onGoToConfig: () => void }) {
  if (!connected || !dashboard) {
    return (
      <EmptyState
        icon={Camera}
        title="ManyChat todavía no está conectado"
        description="Conectá tu cuenta desde Configuración para empezar a ver el resumen real de tus leads de Instagram."
        action={<Button onClick={onGoToConfig}>Ir a Configuración</Button>}
      />
    );
  }

  const levelData = (["high", "medium", "low", "none"] as const).map((level) => ({ level, label: LEVEL_LABEL[level], value: dashboard.leadsByLevel[level] }));
  const hasLevelData = levelData.some((d) => d.value > 0);
  const hasSourceData = dashboard.leadsBySource.length > 0 && dashboard.totalLeads > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile icon={Users} label="Leads captados" value={dashboard.totalLeads} />
        <KpiTile icon={MessagesSquare} label="Conversaciones" value={dashboard.totalConversations} />
        <KpiTile icon={TrendingUp} label="Alta interacción" value={dashboard.highInteractionCount} />
        <KpiTile icon={Sparkles} label="Nuevos (30 días)" value={dashboard.newLeadsInWindow} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Leads por fuente" />
          {hasSourceData ? (
            <>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboard.leadsBySource} dataKey="count" nameKey="source" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {dashboard.leadsBySource.map((entry, i) => (
                        <Cell key={entry.source} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {dashboard.leadsBySource.map((s, i) => (
                  <li key={s.source} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 capitalize text-foreground">
                      <span className="size-2.5 rounded-full" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                      {s.source}
                    </span>
                    <span className="font-mono text-neutral-500">
                      {s.count} ({Math.round((s.count / dashboard.totalLeads) * 100)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-neutral-500">Todavía no hay leads.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Nivel de interacción" />
          {hasLevelData ? (
            <>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={levelData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {levelData.map((entry) => (
                        <Cell key={entry.level} fill={LEVEL_COLOR[entry.level]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {levelData.map((d) => (
                  <li key={d.level} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-foreground">
                      <span className="size-2.5 rounded-full" style={{ background: LEVEL_COLOR[d.level] }} />
                      {d.label}
                    </span>
                    <span className="font-mono text-neutral-500">{d.value}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-neutral-500">Todavía no hay leads.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Evolución de leads (30 días)" />
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashboard.evolution}>
              <CartesianGrid vertical={false} stroke="var(--border-default)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} width={24} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" name="Leads nuevos" fill="var(--color-accent-500)" radius={[4, 4, 4, 4]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {dashboard.topContent.length > 0 && (
        <Card>
          <CardHeader title="Contenido que más leads generó" />
          <div className="flex flex-col gap-2">
            {dashboard.topContent.slice(0, 5).map((c) => (
              <div key={c.contentName} className="flex items-center justify-between gap-3 rounded-md border border-border-default px-3 py-2">
                <p className="truncate text-sm text-foreground">{c.contentName}</p>
                <span className="shrink-0 font-mono text-sm font-semibold text-foreground">{c.leadCount} leads</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
