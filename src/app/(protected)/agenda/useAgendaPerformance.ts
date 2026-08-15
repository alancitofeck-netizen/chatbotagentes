"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { getAgendaPerformanceAction } from "@/lib/agenda/actions";
import type { AgendaPerformance } from "@/lib/agenda/queries";
import { getMonday } from "@/lib/calendar/week";

export type AgendaAnalyticsPreset = "week" | "month" | "year";
export const AGENDA_ANALYTICS_PRESETS: { key: AgendaAnalyticsPreset; label: string }[] = [
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
  { key: "year", label: "Este año" },
];

/** Mismo cálculo que AgendaKpisSection.tsx (kpis/), reimplementado acá
 * porque ese archivo es un panel de análisis distinto (KPIs → Agendas,
 * ruta separada) — este hook alimenta los 3 paneles embebidos en /agenda
 * mismo (tiles, donut, barras), con una sola llamada compartida. */
function rangeForPreset(preset: AgendaAnalyticsPreset): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start: Date;
  if (preset === "week") start = getMonday(now);
  else if (preset === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
  else start = new Date(now.getFullYear(), 0, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function useAgendaPerformance() {
  const [preset, setPreset] = useState<AgendaAnalyticsPreset>("month");
  const [data, setData] = useState<AgendaPerformance | null>(null);
  const [loading, startTransition] = useTransition();

  const range = useMemo(() => rangeForPreset(preset), [preset]);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const result = await getAgendaPerformanceAction(range);
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  return { preset, setPreset, data, loading };
}
