"use client";

import { useMemo, useState } from "react";
import { Search, Gauge } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { MetricCard } from "@/components/responseSummary/MetricCard";
import { StatusBadge } from "@/components/responseSummary/StatusBadge";
import type { MiniAppDetail, MiniAppLeadRow } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getResultFieldSpec, getLeadResultValue, formatResultValue } from "@/lib/miniApps/resultField";
import { LeadDetailDrawer } from "./LeadDetailDrawer";
import { LEAD_STATUS_LABEL, LEAD_STATUS_VARIANT } from "./leadStatus";

const BUCKET_COUNT = 5;

function buildBuckets(values: number[], format: "currency" | "percent") {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ label: formatResultValue(min, format), count: values.length }];

  const width = (max - min) / BUCKET_COUNT;
  const buckets = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(BUCKET_COUNT - 1, Math.floor((v - min) / width));
    buckets[idx].count += 1;
  }
  return buckets.map((b) => ({ label: `${formatResultValue(b.from, format)} – ${formatResultValue(b.to, format)}`, count: b.count }));
}

/** "Simulaciones" (Fase 3) — misma info que Leads pero centrada en el
 * RESULTADO numérico de cada uno, no en su etapa. Reutiliza el mismo array
 * `leads` que ya trae LeadsTab (sin fetch propio) y el mismo campo
 * "principal" por plantilla que ya usan Resumen y el kanban
 * (getResultFieldSpec) — así no hace falta ninguna tabla ni acción nueva. */
export function SimulacionesTab({
  miniApp,
  leads,
  members,
  canManage,
  ownMemberId,
  onChanged,
}: {
  miniApp: MiniAppDetail;
  leads: MiniAppLeadRow[];
  members: WorkspaceMemberOption[];
  canManage: boolean;
  ownMemberId: string | null;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const spec = getResultFieldSpec(miniApp.templateKey);

  const withResult = useMemo(() => {
    if (!spec) return [];
    return leads
      .map((l) => ({ lead: l, value: getLeadResultValue(miniApp.templateKey, l.data) }))
      .filter((r): r is { lead: MiniAppLeadRow; value: number } => r.value !== null)
      .sort((a, b) => b.value - a.value);
  }, [leads, miniApp.templateKey, spec]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return withResult;
    return withResult.filter((r) => r.lead.nombre.toLowerCase().includes(q) || r.lead.whatsapp.includes(q));
  }, [withResult, search]);

  const stats = useMemo(() => {
    const values = withResult.map((r) => r.value);
    if (values.length === 0) return null;
    return {
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
    };
  }, [withResult]);

  const buckets = useMemo(() => (spec ? buildBuckets(withResult.map((r) => r.value), spec.format) : []), [withResult, spec]);

  if (!spec) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border-default bg-surface-2 p-10 text-center">
        <Gauge className="size-6 text-neutral-400" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Esta plantilla no tiene un resultado numérico</p>
        <p className="text-xs text-neutral-500">No hay un campo único (como un ahorro estimado o un puntaje) para mostrar acá.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard icon={Gauge} label="Con resultado" value={String(stats.count)} />
          <MetricCard icon={Gauge} label={`${spec.label} promedio`} value={formatResultValue(stats.avg, spec.format)} />
          <MetricCard icon={Gauge} label={`${spec.label} más alto`} value={formatResultValue(stats.max, spec.format)} />
          <MetricCard icon={Gauge} label={`${spec.label} más bajo`} value={formatResultValue(stats.min, spec.format)} />
        </div>
      )}

      {buckets.length > 1 && (
        <Card>
          <CardHeader title={`Distribución por ${spec.label.toLowerCase()}`} />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={buckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--color-accent-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="relative max-w-xs">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o WhatsApp…"
          className="w-full rounded-full border border-border-default bg-surface-1 py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-neutral-400 outline-none focus:border-accent-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border-default bg-surface-2 p-10 text-center">
          <Gauge className="size-6 text-neutral-400" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{withResult.length === 0 ? "Todavía no hay simulaciones con resultado" : "Ningún lead coincide con la búsqueda"}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-2 text-left text-xs font-medium tracking-wide text-neutral-400 uppercase">
                <th className="p-3">Lead</th>
                <th className="p-3">Origen</th>
                <th className="p-3">Etapa</th>
                <th className="p-3 text-right">{spec.label}</th>
                <th className="p-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ lead, value }) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className="cursor-pointer border-b border-border-default/60 last:border-0 hover:bg-surface-2"
                >
                  <td className="p-3">
                    <p className="font-medium text-foreground">{lead.nombre}</p>
                    <p className="text-xs text-neutral-500">{lead.whatsapp}</p>
                  </td>
                  <td className="p-3 text-neutral-500">{lead.origenApp}</td>
                  <td className="p-3">
                    <StatusBadge variant={LEAD_STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</StatusBadge>
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-foreground">{formatResultValue(value, spec.format)}</td>
                  <td className="p-3 text-neutral-500">{new Date(lead.fecha).toLocaleDateString("es", { day: "2-digit", month: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLeadId && (
        <LeadDetailDrawer
          leadId={selectedLeadId}
          members={members}
          canManage={canManage}
          ownMemberId={ownMemberId}
          onClose={() => setSelectedLeadId(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
