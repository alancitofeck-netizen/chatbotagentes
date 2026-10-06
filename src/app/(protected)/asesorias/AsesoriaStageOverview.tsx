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
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
        <p className="text-xs text-neutral-500">{label}</p>
      </div>
    </div>
  );
}

/** Dos etapas con la paleta de la app: la primera en teal (acento), la segunda en navy. */
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
  accent: "teal" | "navy";
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
  const isTeal = accent === "teal";
  return (
    <Card variant="default" className={`relative flex flex-col gap-5 overflow-hidden border-l-4 ${isTeal ? "border-l-accent-500" : "border-l-navy"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${isTeal ? "bg-accent-600" : "bg-navy"}`}>
            {number}
          </span>
          <span className={`flex size-12 shrink-0 items-center justify-center rounded-full max-sm:hidden ${isTeal ? "bg-surface-3 text-accent-700" : "bg-surface-2 text-navy"}`}>
            {icon}
          </span>
          <div>
            <span
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${isTeal ? "bg-surface-3 text-accent-700" : "bg-surface-2 text-navy"}`}
            >
              <span className={`size-1.5 rounded-full ${isTeal ? "bg-accent-500" : "bg-navy"}`} aria-hidden="true" />
              {sessionLabel}
            </span>
            <h3 className="mt-1.5 font-display text-xl font-semibold text-foreground">{title}</h3>
            <p className={`text-sm font-semibold ${isTeal ? "text-accent-700" : "text-navy"}`}>{subtitle}</p>
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
          className="flex items-center gap-1.5 rounded-md border border-border-default px-3.5 py-2 text-sm font-medium text-foreground transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-2"
        >
          <ListChecks className="size-4" aria-hidden="true" />
          Ver detalles
        </Link>
        {primaryAction}
      </div>

      <span
        className={`pointer-events-none absolute -right-4 top-1/2 hidden size-28 -translate-y-1/2 items-center justify-center rounded-3xl sm:flex ${
          isTeal ? "bg-accent-600" : "bg-navy"
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
        accent="teal"
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
            className="flex items-center gap-1.5 rounded-md bg-accent-600 px-3.5 py-2 text-sm font-medium text-[var(--on-accent)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-accent-700"
          >
            <Plus className="size-4" aria-hidden="true" />
            Crear Asesoría
          </Link>
        }
        panelIcon={<MessageSquareText className="size-10 text-[var(--on-accent)]" aria-hidden="true" />}
      />

      <div className="flex items-center justify-center py-2">
        <span className="flex size-8 items-center justify-center rounded-full border border-border-default bg-surface-1 text-neutral-400">
          <ArrowDown className="size-4" aria-hidden="true" />
        </span>
      </div>

      <StageCard
        accent="navy"
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
          { icon: <Users className="size-4 text-navy" aria-hidden="true" />, value: "0", label: "Referidos" },
          { icon: <CalendarClock className="size-4 text-navy" aria-hidden="true" />, value: "Sin actividad", label: "Última actividad" },
          { icon: <UserRound className="size-4 text-navy" aria-hidden="true" />, value: "Sin asignar", label: "Asesor asignado" },
        ]}
        detailsHref="/asesorias/cierre"
        primaryAction={
          <span className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border-default px-3.5 py-2 text-sm font-medium text-neutral-400">
            <Lock className="size-4" aria-hidden="true" />
            Preparar sesión
          </span>
        }
        panelIcon={<CalendarClock className="size-10 text-white/90" aria-hidden="true" />}
      />
    </div>
  );
}
