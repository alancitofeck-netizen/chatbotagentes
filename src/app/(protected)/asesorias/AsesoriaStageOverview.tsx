"use client";

import Link from "next/link";
import { ArrowDown, Users, TrendingUp, CalendarClock, UserRound, MessageSquareText, Lock, ListChecks, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

function formatLastActivity(iso: string | null) {
  if (!iso) return "Sin actividad";
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return `Hoy, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Ayer, ${time}`;
  return `${date.toLocaleDateString("es", { day: "2-digit", month: "short" })}, ${time}`;
}

function StatItem({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/60">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
        <p className="text-xs text-neutral-500">{label}</p>
      </div>
    </div>
  );
}

function StageCard({
  accent,
  sessionLabel,
  number,
  icon,
  title,
  subtitle,
  description,
  statusBadge,
  stats,
  detailsHref,
  primaryAction,
  panelIcon,
}: {
  accent: "violet" | "blue";
  sessionLabel: string;
  number: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  statusBadge: React.ReactNode;
  stats: { icon: React.ReactNode; value: string; label: string }[];
  detailsHref: string;
  primaryAction: React.ReactNode;
  panelIcon: React.ReactNode;
}) {
  const isViolet = accent === "violet";
  return (
    <Card
      variant="default"
      className={`relative flex flex-col gap-5 overflow-hidden border-l-4 ${isViolet ? "border-l-accent-500 bg-gradient-to-br from-[var(--tint-violet-subtle)] to-surface-1" : "border-l-blue-500 bg-gradient-to-br from-[var(--tint-blue-subtle)] to-surface-1"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${isViolet ? "bg-accent-600" : "bg-blue-600"}`}>
            {number}
          </span>
          <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${isViolet ? "bg-accent-100 text-accent-700" : "bg-blue-100 text-blue-700"}`}>
            {icon}
          </span>
          <div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${isViolet ? "bg-accent-100 text-accent-700" : "bg-blue-100 text-blue-700"}`}
            >
              <span className={`size-1.5 rounded-full ${isViolet ? "bg-accent-500" : "bg-blue-500"}`} aria-hidden="true" />
              {sessionLabel}
            </span>
            <h3 className="mt-1.5 text-xl font-bold text-foreground">{title}</h3>
            <p className={`text-sm font-semibold ${isViolet ? "text-accent-700" : "text-blue-700"}`}>{subtitle}</p>
          </div>
        </div>
        {statusBadge}
      </div>

      <p className="max-w-xl text-sm text-neutral-600">{description}</p>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {stats.map((s, i) => (
          <StatItem key={i} icon={s.icon} value={s.value} label={s.label} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-default pt-4">
        <Link
          href={detailsHref}
          data-tour="asesorias.details-link"
          className={`flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
            isViolet ? "border-accent-200 text-accent-700 hover:bg-accent-50" : "border-blue-200 text-blue-700 hover:bg-blue-50"
          }`}
        >
          <ListChecks className="size-4" aria-hidden="true" />
          Ver detalles
        </Link>
        {primaryAction}
      </div>

      <span
        className={`pointer-events-none absolute -right-4 top-1/2 hidden size-28 -translate-y-1/2 items-center justify-center rounded-3xl sm:flex ${
          isViolet ? "bg-gradient-to-br from-accent-500 to-accent-700" : "bg-gradient-to-br from-blue-500 to-blue-700"
        }`}
      >
        {panelIcon}
      </span>
    </Card>
  );
}

export function AsesoriaStageOverview({
  referidos,
  lastActivityAt,
  advisorName,
}: {
  referidos: number;
  lastActivityAt: string | null;
  advisorName: string | null;
}) {
  useAutoStartTour("asesorias-intro");
  return (
    <div className="flex flex-col items-stretch">
      <StageCard
        accent="violet"
        sessionLabel="Primera sesión"
        number="01"
        icon={<UserRound className="size-6" aria-hidden="true" />}
        title="Presentación"
        subtitle="Cita Inicial"
        description="Primera reunión guiada con el prospecto para conocer sus necesidades y presentar la propuesta."
        statusBadge={
          <span className="flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success-strong">
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            Activa
          </span>
        }
        stats={[
          { icon: <Users className="size-4 text-accent-700" aria-hidden="true" />, value: String(referidos), label: "Referidos" },
          { icon: <CalendarClock className="size-4 text-accent-700" aria-hidden="true" />, value: formatLastActivity(lastActivityAt), label: "Última actividad" },
          { icon: <UserRound className="size-4 text-accent-700" aria-hidden="true" />, value: advisorName ?? "Sin asignar", label: "Asesor asignado" },
        ]}
        detailsHref="/asesorias/presentacion"
        primaryAction={
          <Link
            href="/asesorias/presentacion?crear=1"
            data-tour="asesorias.create-link"
            className="flex items-center gap-1.5 rounded-md bg-accent-600 px-3.5 py-2 text-sm font-medium text-white transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-accent-700"
          >
            <Plus className="size-4" aria-hidden="true" />
            Crear Asesoría
          </Link>
        }
        panelIcon={<MessageSquareText className="size-10 text-white/90" aria-hidden="true" />}
      />

      <div className="flex items-center justify-center py-2">
        <span className="flex size-8 items-center justify-center rounded-full border border-border-default bg-surface-1 text-neutral-400">
          <ArrowDown className="size-4" aria-hidden="true" />
        </span>
      </div>

      <StageCard
        accent="blue"
        sessionLabel="Segunda sesión"
        number="02"
        icon={<TrendingUp className="size-6" aria-hidden="true" />}
        title="Cita de Cierre"
        subtitle="Segunda Reunión"
        description="Segunda reunión para avanzar con el cierre y definir los próximos pasos."
        statusBadge={
          <span className="flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning-strong">
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            Pendiente
          </span>
        }
        stats={[
          { icon: <Users className="size-4 text-blue-700" aria-hidden="true" />, value: "0", label: "Referidos" },
          { icon: <CalendarClock className="size-4 text-blue-700" aria-hidden="true" />, value: "Sin actividad", label: "Última actividad" },
          { icon: <UserRound className="size-4 text-blue-700" aria-hidden="true" />, value: "Sin asignar", label: "Asesor asignado" },
        ]}
        detailsHref="/asesorias/cierre"
        primaryAction={
          <span className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-blue-200 px-3.5 py-2 text-sm font-medium text-blue-400">
            <Lock className="size-4" aria-hidden="true" />
            Preparar sesión
          </span>
        }
        panelIcon={<CalendarClock className="size-10 text-white/90" aria-hidden="true" />}
      />
    </div>
  );
}
