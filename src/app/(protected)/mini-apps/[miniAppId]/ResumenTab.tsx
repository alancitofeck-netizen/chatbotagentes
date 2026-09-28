"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, UserPlus, MessageCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/responseSummary/StatusBadge";
import { formatRelativeTime } from "@/lib/utils/format";
import { getMiniAppResumenAction } from "@/lib/miniApps/actions";
import { getLeadResultValue, formatResultValue } from "@/lib/miniApps/resultField";
import { SDK_VERSION } from "@/lib/miniApps/linkedAppOptions";
import type { MiniAppDetail, MiniAppResumenData, MiniAppResumenPeriod } from "@/lib/miniApps/queries";
import { LEAD_STATUS_LABEL, LEAD_STATUS_VARIANT } from "./leadStatus";

const PERIODS: { value: MiniAppResumenPeriod; label: string }[] = [
  { value: 1, label: "Hoy" },
  { value: 7, label: "7 días" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
];

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null; // evita "+∞%" cuando no había nada en el período anterior
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const delta = pctChange(current, previous);
  if (delta === null) return null;
  const positive = delta >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${positive ? "text-success-strong" : "text-error-strong"}`}>
      <Icon className="size-3" aria-hidden="true" />
      {positive ? "+" : ""}
      {delta}% vs período anterior
    </span>
  );
}

function KpiCard({ label, value, current, previous }: { label: string; value: string; current: number; previous: number }) {
  return (
    <Card className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-neutral-400 uppercase">{label}</span>
      <span className="text-2xl font-semibold text-foreground">{value}</span>
      <Delta current={current} previous={previous} />
    </Card>
  );
}

function FunnelRows({ steps }: { steps: MiniAppResumenData["funnel"] }) {
  const max = Math.max(1, ...steps.map((s) => s.count ?? 0));
  let dropIdx = -1;
  let dropPct = 0;
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1].count;
    const cur = steps[i].count;
    if (prev === null || cur === null || prev === 0) continue;
    const pct = ((prev - cur) / prev) * 100;
    if (pct > dropPct) {
      dropPct = pct;
      dropIdx = i;
    }
  }
  return (
    <div className="flex flex-col gap-3">
      {dropIdx >= 0 && dropPct >= 15 && (
        <span className="self-start rounded-full bg-warning-bg px-3 py-1 text-xs font-medium text-warning-strong">
          Mayor caída: {steps[dropIdx - 1].label} → {steps[dropIdx].label} (−{Math.round(dropPct)}%)
        </span>
      )}
      {steps.map((s, i) => {
        const prevCount = i > 0 ? steps[i - 1].count : null;
        const widthPct = s.count !== null ? Math.max(3, (s.count / max) * 100) : 0;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-sm text-neutral-600">{s.label}</span>
            <div className="h-2.5 flex-1 rounded-full bg-surface-2">
              {s.count !== null && <div className="h-full rounded-full bg-accent-500" style={{ width: `${widthPct}%` }} />}
            </div>
            <span className="w-10 shrink-0 text-right text-sm font-semibold text-foreground">{s.count === null ? "—" : s.count.toLocaleString("es")}</span>
            <span className="w-12 shrink-0 text-right text-xs text-neutral-400">
              {s.count !== null && prevCount !== null && prevCount > 0 ? `${Math.round((s.count / prevCount) * 100)}%` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ResumenTab({ miniApp }: { miniApp: MiniAppDetail }) {
  const [period, setPeriod] = useState<MiniAppResumenPeriod>(30);
  const [data, setData] = useState<MiniAppResumenData | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMiniAppResumenAction(miniApp.id, period).then((r) => {
      if (!cancelled) setData(r);
    });
    return () => {
      cancelled = true;
    };
  }, [miniApp.id, period]);

  if (!data) return <div className="p-6 text-sm text-neutral-500">Cargando…</div>;

  return (
    <div className="flex flex-col gap-4">
      {miniApp.templateKey === "app_vinculada" && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Estado de conexión</span>
            <span className={`text-sm font-medium ${data.leads.current + data.leads.previous > 0 ? "text-success-strong" : "text-error-strong"}`}>
              {data.leads.current + data.leads.previous > 0 ? "🟢 Conectada" : "🔴 Sin conectar"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-neutral-400 uppercase">Última sincronización</p>
              <p className="text-sm text-foreground">
                {data.recentLeads[0] ? new Date(data.recentLeads[0].fecha).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-neutral-400 uppercase">Estado de la API</p>
              <p className="text-sm text-foreground">Operativa</p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-neutral-400 uppercase">Versión del SDK</p>
              <p className="text-sm text-foreground">{SDK_VERSION}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
              period === p.value ? "bg-accent-500 text-white" : "bg-surface-2 text-neutral-600 hover:bg-surface-3"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Visitas" value={data.visits.current.toLocaleString("es")} current={data.visits.current} previous={data.visits.previous} />
        <KpiCard label="Leads captados" value={data.leads.current.toLocaleString("es")} current={data.leads.current} previous={data.leads.previous} />
        <KpiCard label="Convertidos" value={data.converted.current.toLocaleString("es")} current={data.converted.current} previous={data.converted.previous} />
        {data.resultField && (
          <KpiCard
            label={`${data.resultField.label} (promedio)`}
            value={data.resultField.current !== null ? formatResultValue(data.resultField.current, data.resultField.format) : "—"}
            current={data.resultField.current ?? 0}
            previous={data.resultField.previous ?? 0}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader title="Embudo de conversión" />
          <p className="-mt-2 mb-4 text-xs text-neutral-500">Dónde se quedan tus prospectos</p>
          <FunnelRows steps={data.funnel} />
          {!data.hasStepTracking && (
            <p className="mt-4 text-xs text-neutral-400">
              &ldquo;Iniciaron el cálculo&rdquo; y &ldquo;Completaron el cálculo&rdquo; todavía no están instrumentados para esta plantilla — van a mostrar datos reales en cuanto se active el tracking de pasos.
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <CardHeader title="Pendientes de hoy" />
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-2 p-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
                <UserPlus className="size-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Leads sin contactar</p>
                <p className="text-xs text-neutral-500">
                  {data.pending.uncontactedCount === 0
                    ? "Ninguno pendiente"
                    : data.pending.oldestUncontactedAt
                      ? `El más antiguo: ${formatRelativeTime(data.pending.oldestUncontactedAt)}`
                      : ""}
                </p>
              </div>
            </div>
            <Link
              href={`/mini-apps/${miniApp.id}?tab=leads`}
              className="shrink-0 rounded-full bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
            >
              {data.pending.uncontactedCount}
            </Link>
          </div>
          <p className="text-xs text-neutral-400">
            Citas agendadas para hoy y seguimientos vencidos se suman acá cuando esas funciones estén disponibles.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Leads recientes" action={<Link href={`/mini-apps/${miniApp.id}?tab=leads`} className="text-xs font-medium text-accent-600 hover:underline">Ver todos →</Link>} />
        {data.recentLeads.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">Todavía no hay leads en este período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-xs font-medium tracking-wide text-neutral-400 uppercase">
                  <th className="pb-2">Lead</th>
                  <th className="pb-2">Origen</th>
                  <th className="pb-2">Resultado</th>
                  <th className="pb-2">Etapa</th>
                  <th className="pb-2">Fecha</th>
                  <th className="pb-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLeads.map((lead) => {
                  const resultValue = getLeadResultValue(miniApp.templateKey, lead.data);
                  const digits = lead.whatsapp.replace(/\D/g, "");
                  return (
                    <tr key={lead.id} className="border-b border-border-default/60 last:border-0">
                      <td className="py-2.5 font-medium text-foreground">{lead.nombre}</td>
                      <td className="py-2.5 text-neutral-500">{lead.origenApp}</td>
                      <td className="py-2.5 text-neutral-500">
                        {resultValue !== null && data.resultField ? formatResultValue(resultValue, data.resultField.format) : "—"}
                      </td>
                      <td className="py-2.5">
                        <StatusBadge variant={LEAD_STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</StatusBadge>
                      </td>
                      <td className="py-2.5 text-neutral-500">{new Date(lead.fecha).toLocaleDateString("es", { day: "2-digit", month: "short" })}</td>
                      <td className="py-2.5 text-right">
                        {digits.length >= 8 ? (
                          <a
                            href={`https://wa.me/${digits}`}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex size-8 items-center justify-center rounded-full border border-border-default text-neutral-500 hover:bg-surface-2"
                            title="Contactar por WhatsApp"
                          >
                            <MessageCircle className="size-4" aria-hidden="true" />
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Leads por día" />
          {data.leadsByDay.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">Sin datos en este período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.leadsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-accent-500)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <CardHeader title="¿De dónde llegan?" />
          {data.leadsByOrigin.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">Sin datos en este período.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.leadsByOrigin.map((o) => {
                const max = Math.max(...data.leadsByOrigin.map((x) => x.count));
                const conv = o.count > 0 ? Math.round((o.converted / o.count) * 100) : 0;
                return (
                  <div key={o.origin} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{o.origin}</span>
                      <span className="text-neutral-500">
                        {o.count.toLocaleString("es")} leads · {conv}% conv.
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent-500" style={{ width: `${Math.max(4, (o.count / max) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
