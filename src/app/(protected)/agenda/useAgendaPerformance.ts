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
 * mismo (tiles, donut, barras), con una sola llamada compartida.
 *
 * El rango cubre el período COMPLETO (hasta el final de la semana/mes/año),
 * no solo "hasta hoy" — Agenda mira hacia adelante (citas ya agendadas para
 * más adelante en el período), así que cortar en "hoy" dejaba afuera la
 * mayoría de las citas reales y mostraba KPIs artificialmente bajos. */
function rangeForPreset(preset: AgendaAnalyticsPreset): { start: string; end: string } {
  const now = new Date();
  let start: Date;
  let end: Date;
  if (preset === "week") {
    start = getMonday(now);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  } else if (preset === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear() + 1, 0, 1);
  }
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
