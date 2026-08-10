"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Presentation, CheckCircle2, Clock, Users, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { HorizontalCardScroller } from "@/components/ui/HorizontalCardScroller";
import type { AsesoriaListItem, ReferralActivityPoint } from "@/lib/asesorias/queries";

interface DayPoint {
  label: string;
  total: number;
  finalizadas: number;
  enProgreso: number;
  referidos: number;
}

/** Serie real de los últimos 14 días para los sparklines — cuenta asesorías
 * por `startedAt` y referidos por `updatedAt` de cada fila de
 * asesoria_responses (question_key='referrals'), nunca data ficticia. Se
 * calcula acá (no en el server) porque ya recibimos las listas completas vía
 * props; evita un round-trip nuevo a Supabase solo para esto. */
function buildActivitySeries(asesorias: AsesoriaListItem[], referralActivity: ReferralActivityPoint[], days: number, todayMs: number): DayPoint[] {
  const points: DayPoint[] = [];
  const today = new Date(todayMs);

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayItems = asesorias.filter((a) => {
      const started = new Date(a.startedAt);
      return started >= dayStart && started < dayEnd;
    });
    const dayReferrals = referralActivity.filter((r) => {
      const updated = new Date(r.updatedAt);
      return updated >= dayStart && updated < dayEnd;
    });

    points.push({
      label: dayStart.toLocaleDateString("es", { day: "2-digit", month: "short" }),
      total: dayItems.length,
      finalizadas: dayItems.filter((a) => a.status === "finalizada").length,
      enProgreso: dayItems.filter((a) => a.status === "en_progreso").length,
      referidos: dayReferrals.reduce((sum, r) => sum + r.count, 0),
    });
  }
  return points;
}

function Sparkline({ data, dataKey, color }: { data: DayPoint[]; dataKey: keyof DayPoint; color: string }) {
  return (
    <div className="h-10 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  footnote,
  sparklineColor,
  sparklineData,
  sparklineKey,
  href,
}: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  footnote?: string;
  sparklineColor: string;
  sparklineData: DayPoint[];
  sparklineKey: keyof DayPoint;
  /** Si viene, la card entera navega ahí — usada por "Referidos" para
   * llevar a /asesorias/referidos. Las demás cards quedan solo informativas. */
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between">
        <span className={`flex size-10 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>{icon}</span>
        {href && (
          <span className="flex items-center gap-1 text-xs font-medium text-accent-600 opacity-0 transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out)] group-hover:opacity-100">
            Ver detalle
            <ArrowRight className="size-3" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
          <p className="mt-1.5 text-[13px] text-neutral-500">{label}</p>
          {footnote && <p className="mt-1 text-xs text-neutral-500">{footnote}</p>}
        </div>
        <Sparkline data={sparklineData} dataKey={sparklineKey} color={sparklineColor} />
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group flex cursor-pointer flex-col gap-3 rounded-lg border border-transparent bg-surface-1 p-5 shadow-[var(--elevation-sm)] transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-accent-300 hover:shadow-[var(--elevation-md)]"
      >
        {content}
      </Link>
    );
  }

  return <Card className="flex flex-col gap-3">{content}</Card>;
}

export function AsesoriaKpiCards({ asesorias, referralActivity }: { asesorias: AsesoriaListItem[]; referralActivity: ReferralActivityPoint[] }) {
  const [todayMs] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });

  const total = asesorias.length;
  const finalizadas = asesorias.filter((a) => a.status === "finalizada").length;
  const enProgreso = asesorias.filter((a) => a.status === "en_progreso").length;
  const referidos = referralActivity.reduce((sum, r) => sum + r.count, 0);
  const activity = buildActivitySeries(asesorias, referralActivity, 14, todayMs);

  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 1000) / 10}% del total` : "Sin asesorías todavía");

  return (
    <HorizontalCardScroller desktopClassName="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={<Presentation className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={String(total)}
        label="Total de asesorías"
        footnote="Este mes"
        sparklineColor="var(--color-accent-500)"
        sparklineData={activity}
        sparklineKey="total"
      />
      <KpiCard
        icon={<CheckCircle2 className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-green-100"
        iconColor="text-green-700"
        value={String(finalizadas)}
        label="Finalizadas"
        footnote={pct(finalizadas)}
        sparklineColor="#2E9563"
        sparklineData={activity}
        sparklineKey="finalizadas"
      />
      <KpiCard
        icon={<Clock className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-orange-100"
        iconColor="text-orange-700"
        value={String(enProgreso)}
        label="En progreso"
        footnote={pct(enProgreso)}
        sparklineColor="#F5A524"
        sparklineData={activity}
        sparklineKey="enProgreso"
      />
      <KpiCard
        icon={<Users className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-blue-100"
        iconColor="text-blue-700"
        value={String(referidos)}
        label="Referidos"
        footnote={referidos > 0 ? "Compartidos en asesorías" : "Todavía ninguno"}
        sparklineColor="#3B82F6"
        sparklineData={activity}
        sparklineKey="referidos"
        href="/asesorias/referidos"
      />
    </HorizontalCardScroller>
  );
}
