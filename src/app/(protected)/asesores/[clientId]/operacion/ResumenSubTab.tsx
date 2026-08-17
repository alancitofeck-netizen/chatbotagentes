"use client";

import { useState } from "react";
import { CalendarDays, Presentation, Users2, LayoutGrid, Sparkles, CheckCircle2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { ClientAppointment } from "@/lib/clients/queries";
import type { AsesoriaListItem } from "@/lib/asesorias/queries";
import type { ReferralRow } from "@/lib/asesorias/referrals";
import type { MiniAppListItem } from "@/lib/miniApps/queries";
import type { ClientRecentMiniAppLead } from "@/lib/clients/operacion";
import { ASESORIA_STATUS_LABEL, ASESORIA_STATUS_VARIANT, formatAsesoriaDuration } from "./operacionHelpers";
import { AsesoriaDetailSheet } from "./AsesoriaDetailSheet";
import { REFERRAL_STATUS_LABEL, REFERRAL_STATUS_VARIANT } from "../../../asesorias/referidos/referralStatus";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return "Hace instantes";
  if (hours < 24) return `Hace ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface ActivityItem {
  id: string;
  icon: typeof CalendarDays;
  action: string;
  name: string;
  source: string;
  time: string;
}

/** No hay audit_log para Asesorías/Referidos/Mini Apps — feed sintético
 * armado en memoria a partir de datos ya cargados (mismo criterio que
 * ContactInfoPanel.tsx: "Real activity feed built only from data already
 * fetched, no invented audit trail"). */
function buildActivity(
  appointments: ClientAppointment[],
  asesorias: AsesoriaListItem[],
  referrals: ReferralRow[],
  recentLeads: ClientRecentMiniAppLead[],
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...appointments.slice(0, 10).map((a) => ({
      id: `cita-${a.id}`,
      icon: CalendarDays,
      action: "Nueva cita agendada",
      name: a.contactName ?? "Sin nombre",
      source: "Citas",
      time: a.startTime,
    })),
    ...asesorias.slice(0, 10).map((a) => ({
      id: `asesoria-${a.id}`,
      icon: Presentation,
      action: a.status === "finalizada" ? "Asesoría finalizada" : "Asesoría en progreso",
      name: a.contactName ?? a.name,
      source: a.templateName ?? "Asesoría",
      time: a.updatedAt,
    })),
    ...referrals.slice(0, 10).map((r) => ({
      id: `referido-${r.id}`,
      icon: Users2,
      action: "Nuevo referido",
      name: r.name,
      source: r.asesoriaName,
      time: r.createdAt,
    })),
    ...recentLeads.map((l) => ({
      id: `lead-${l.id}`,
      icon: LayoutGrid,
      action: `Nuevo lead desde ${l.miniAppName}`,
      name: l.nombre,
      source: l.miniAppName,
      time: l.receivedAt,
    })),
  ];
  return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);
}

export function ResumenSubTab({
  clientId,
  appointments,
  asesorias,
  referrals,
  miniApps,
  recentMiniAppLeads,
}: {
  clientId: string;
  appointments: ClientAppointment[];
  asesorias: AsesoriaListItem[];
  referrals: ReferralRow[];
  miniApps: MiniAppListItem[];
  recentMiniAppLeads: ClientRecentMiniAppLead[];
}) {
  const [selectedAsesoria, setSelectedAsesoria] = useState<AsesoriaListItem | null>(null);

  const shows = appointments.filter((a) => a.attended === true).length;
  const noShows = appointments.filter((a) => a.attended === false).length;
  const showRate = shows + noShows > 0 ? Math.round((shows / (shows + noShows)) * 100) : 0;

  const asesoriasFinalizadas = asesorias.filter((a) => a.status === "finalizada").length;
  const asesoriasEnProgreso = asesorias.filter((a) => a.status === "en_progreso").length;
  const referidosNuevos = referrals.filter((r) => r.status === "nuevo").length;
  const referidosContactados = referrals.filter((r) => r.status === "contactado").length;
  const leadsTotal = miniApps.reduce((sum, a) => sum + a.leadsCount, 0);
  const leadsConvertidos = miniApps.reduce((sum, a) => sum + a.convertedLeadsCount, 0);
  const leadsConversion = leadsTotal > 0 ? Math.round((leadsConvertidos / leadsTotal) * 100) : 0;

  const activity = buildActivity(appointments, asesorias, referrals, recentMiniAppLeads);
  const ultimaAsesoria = asesorias[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-neutral-500">Citas</p>
          <p className="text-lg font-semibold text-foreground">{appointments.length}</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-neutral-500">Asesorías</p>
          <p className="text-lg font-semibold text-foreground">{asesorias.length}</p>
          <p className="text-[11px] text-neutral-500">
            {asesoriasFinalizadas} finalizadas · {asesoriasEnProgreso} en progreso
          </p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-neutral-500">Referidos</p>
          <p className="text-lg font-semibold text-foreground">{referrals.length}</p>
          <p className="text-[11px] text-neutral-500">
            {referidosNuevos} nuevos · {referidosContactados} contactados
          </p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-neutral-500">Mini Apps</p>
          <p className="text-lg font-semibold text-foreground">{miniApps.length}</p>
          <p className="text-[11px] text-neutral-500">{leadsTotal} leads captados</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-neutral-500">Leads captados</p>
          <p className="text-lg font-semibold text-foreground">{leadsTotal}</p>
          <p className="text-[11px] text-neutral-500">{leadsConversion}% conversión</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-neutral-500">Show rate</p>
          <p className="text-lg font-semibold text-foreground">{showRate}%</p>
          <p className="text-[11px] text-neutral-500">
            {shows} shows · {noShows} no-shows
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Actividad reciente" />
        {activity.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin actividad todavía.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border-default overflow-x-auto sm:flex-row sm:divide-x sm:divide-y-0">
            {activity.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex min-w-0 shrink-0 items-start gap-2.5 py-2.5 sm:w-52 sm:px-3 sm:py-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground">{item.action}</p>
                    <p className="truncate text-xs text-neutral-500">{item.name}</p>
                    <p className="truncate text-[11px] text-neutral-400">
                      {item.source} · {timeAgo(item.time)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Asesorías" action={<span className="text-xs text-neutral-500">{asesorias.length}</span>} />
          {asesorias.length === 0 ? (
            <p className="text-sm text-neutral-500">Sin asesorías todavía.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {asesorias.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-foreground">{a.contactName ?? a.name}</span>
                  <Badge variant={ASESORIA_STATUS_VARIANT[a.status]}>{ASESORIA_STATUS_LABEL[a.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Referidos" action={<span className="text-xs text-neutral-500">{referrals.length}</span>} />
          {referrals.length === 0 ? (
            <p className="text-sm text-neutral-500">Sin referidos todavía.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {referrals.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-foreground">{r.name}</span>
                  <Badge variant={REFERRAL_STATUS_VARIANT[r.status]}>{REFERRAL_STATUS_LABEL[r.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={ultimaAsesoria ? `Última asesoría: ${ultimaAsesoria.contactName ?? ultimaAsesoria.name}` : "Última asesoría"}
            action={ultimaAsesoria && <Badge variant={ASESORIA_STATUS_VARIANT[ultimaAsesoria.status]}>{ASESORIA_STATUS_LABEL[ultimaAsesoria.status]}</Badge>}
          />
          {!ultimaAsesoria ? (
            <p className="text-sm text-neutral-500">Este asesor todavía no registró ninguna asesoría.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-neutral-500">Fecha</p>
                  <p className="font-medium text-foreground">{formatDateTime(ultimaAsesoria.startedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Duración</p>
                  <p className="font-medium text-foreground">{formatAsesoriaDuration(ultimaAsesoria.startedAt, ultimaAsesoria.completedAt, ultimaAsesoria.updatedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Asesor</p>
                  <p className="font-medium text-foreground">{ultimaAsesoria.advisorName ?? "Sin asignar"}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Sesión</p>
                  <p className="font-medium text-foreground">{ultimaAsesoria.templateName ?? "—"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAsesoria(ultimaAsesoria)}
                className="flex w-fit items-center gap-1.5 rounded-full border border-border-default px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                Ver respuestas y próximo paso
              </button>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Mini Apps" action={<span className="text-xs text-neutral-500">{miniApps.length}</span>} />
          {miniApps.length === 0 ? (
            <p className="text-sm text-neutral-500">Sin Mini Apps todavía.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {miniApps.slice(0, 5).map((app) => (
                <li key={app.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-foreground">{app.name}</span>
                  <span className="flex items-center gap-1 text-xs text-neutral-500">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    {app.leadsCount} leads
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {selectedAsesoria && <AsesoriaDetailSheet key={selectedAsesoria.id} clientId={clientId} asesoria={selectedAsesoria} onClose={() => setSelectedAsesoria(null)} />}
    </div>
  );
}
