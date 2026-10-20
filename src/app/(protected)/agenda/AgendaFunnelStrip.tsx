"use client";

import { useMemo } from "react";
import type { AgendaAppointment } from "@/lib/agenda/queries";

function pct(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "0%";
}

/** Franja de embudo — una sola tarjeta, 5 celdas separadas por una línea fina (rediseño de Agenda).
 * Mismo cálculo que tenía AgendaSheetKpis (6 tiles en grilla), menos "Propuestas" — el rediseño pide
 * puntualmente Leads/Contactados/Agendados/Asistieron/Clientes acá; "Propuestas" sigue existiendo
 * como estado de cita (pill, tabs, filtros) pero no en este resumen. Las citas "Eliminada en la
 * hoja" no cuentan — mismo criterio de siempre. */
export function AgendaFunnelStrip({ citas }: { citas: AgendaAppointment[] }) {
  const k = useMemo(() => {
    const live = citas.filter((c) => !c.deletedInSheet);
    const leads = new Set(live.map((c) => c.contactId ?? c.id));
    const fromSheet = new Set(live.filter((c) => c.fromSheet).map((c) => c.contactId ?? c.id));
    const contactados = new Set(live.filter((c) => c.contactado).map((c) => c.contactId ?? c.id));
    const agendados = live.filter((c) => c.estadoCita !== "cancelada").length;
    const asistieron = live.filter((c) => c.estadoCita === "realizada" || c.estadoCita === "propuesta" || c.estadoCita === "venta").length;
    const noShow = live.filter((c) => c.estadoCita === "no_show").length;
    const clientes = new Set(live.filter((c) => c.estadoCita === "venta").map((c) => c.contactId ?? c.id));
    return { leads: leads.size, fromSheet: fromSheet.size, contactados: contactados.size, agendados, asistieron, noShow, clientes: clientes.size };
  }, [citas]);

  const cells = [
    { label: "Leads", value: k.leads, hint: `${k.fromSheet} desde la hoja` },
    { label: "Contactados", value: k.contactados, hint: `${pct(k.contactados, k.leads)} de los leads` },
    { label: "Agendados", value: k.agendados, hint: "sin cancelar" },
    { label: "Asistieron", value: k.asistieron, hint: `${pct(k.asistieron, k.asistieron + k.noShow)} de asistencia` },
    { label: "Clientes", value: k.clientes, hint: `${pct(k.clientes, k.leads)} de conversión` },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-border-default bg-surface-1 p-4 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-border-default lg:gap-0 lg:p-0">
      {cells.map((c) => (
        <div key={c.label} className="flex flex-col gap-1 lg:px-5 lg:py-4">
          <span className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">{c.label}</span>
          <span className="font-display text-[26px] leading-none font-semibold tabular-nums text-foreground">{c.value}</span>
          <span className="text-[12px] text-neutral-500">{c.hint}</span>
        </div>
      ))}
    </div>
  );
}
