import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { AgendaShell } from "./AgendaShell";
import { AgendaMobileHome } from "./AgendaMobileHome";

export const metadata: Metadata = {
  title: "Agenda — Growth Link",
};

/** Módulo independiente de primer nivel — fuente única es la hoja KPI
 * sincronizada (agenda_appointments, ver src/lib/appointmentSync/runner.ts),
 * nunca bookings/Calendar/Google Calendar. Visible tanto para la agencia
 * (vista agregada de todos los asesores gestionados) como para el
 * workspace real de cada asesor individual (solo sus propias citas) — el
 * branching vive server-side en getAgendaAppointments, no acá.
 *
 * El encabezado (título "Agenda" + ¿Qué hago acá? + estado de sync) vive
 * DENTRO de AgendaShell/AgendaMobileHome desde el rediseño — ya no hay un
 * PageHeader acá arriba, para no duplicar el título. */
export default async function AgendaPage() {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "agenda"))) return <ModuleDisabledState moduleName="Agenda" />;

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <AgendaMobileHome />
      <div className="hidden px-4 sm:px-6 lg:px-8 md:block">
        <AgendaShell />
      </div>
    </div>
  );
}
