"use client";

import { useMemo } from "react";
import { KpiTile } from "@/components/ui/KpiTile";
import type { AgendaAppointment } from "@/lib/agenda/queries";

function pct(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "—";
}

/** KPIs del embudo de la agenda, calculados con las citas del período elegido (Hoy / Mañana /
 * Semana / Mes). Las citas "Eliminada en la hoja" no cuentan.
 * - Asistieron: realizada + propuesta + venta (llegó a la reunión); % sobre asistieron + no show.
 * - Propuestas: propuesta + venta (se le presentó una propuesta).
 * - Clientes: leads con al menos una cita en "venta"; % de conversión sobre leads en agenda. */
export function AgendaSheetKpis({ citas }: { citas: AgendaAppointment[] }) {
  const k = useMemo(() => {
    const live = citas.filter((c) => !c.deletedInSheet);
    const leads = new Set(live.map((c) => c.contactId ?? c.id));
    const fromSheet = new Set(live.filter((c) => c.fromSheet).map((c) => c.contactId ?? c.id));
    const contactados = new Set(live.filter((c) => c.contactado).map((c) => c.contactId ?? c.id));
    const agendados = live.filter((c) => c.estadoCita !== "cancelada").length;
    const asistieron = live.filter((c) => c.estadoCita === "realizada" || c.estadoCita === "propuesta" || c.estadoCita === "venta").length;
    const noShow = live.filter((c) => c.estadoCita === "no_show").length;
    const propuestas = live.filter((c) => c.estadoCita === "propuesta" || c.estadoCita === "venta").length;
    const clientes = new Set(live.filter((c) => c.estadoCita === "venta").map((c) => c.contactId ?? c.id));
    return { leads: leads.size, fromSheet: fromSheet.size, contactados: contactados.size, agendados, asistieron, noShow, propuestas, clientes: clientes.size };
  }, [citas]);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiTile label="Leads en agenda" value={k.leads} hint={`${k.fromSheet} desde la hoja`} />
      <KpiTile label="Contactados" value={k.contactados} hint={`${pct(k.contactados, k.leads)} de los leads`} />
      <KpiTile label="Agendados" value={k.agendados} hint="citas sin cancelar" />
      <KpiTile label="Asistieron" value={k.asistieron} hint={`${pct(k.asistieron, k.asistieron + k.noShow)} de asistencia`} />
      <KpiTile label="Propuestas" value={k.propuestas} hint={`${pct(k.propuestas, k.asistieron)} de los que asistieron`} />
      <KpiTile label="Clientes" value={k.clientes} hint={`${pct(k.clientes, k.leads)} de conversión`} />
    </div>
  );
}
