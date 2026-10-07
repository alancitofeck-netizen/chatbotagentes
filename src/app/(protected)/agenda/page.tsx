import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { AgendaShell } from "./AgendaShell";
import { AgendaMobileHome } from "./AgendaMobileHome";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

export const metadata: Metadata = {
  title: "Agenda — Growth Link",
};

/** Módulo independiente de primer nivel — fuente única es la hoja KPI
 * sincronizada (agenda_appointments, ver src/lib/appointmentSync/runner.ts),
 * nunca bookings/Calendar/Google Calendar. Visible tanto para la agencia
 * (vista agregada de todos los asesores gestionados) como para el
 * workspace real de cada asesor individual (solo sus propias citas) — el
 * branching vive server-side en getAgendaAppointments, no acá. */
export default async function AgendaPage() {
  const { workspaceId, role } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "agenda"))) return <ModuleDisabledState moduleName="Agenda" />;
  const isManager = role === "owner" || role === "admin";

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="hidden px-4 sm:px-6 lg:px-8 md:block">
        <PageHeader
          icon={CalendarClock}
          title="Agenda"
          description="Citas de tus asesores, generadas por tu equipo de setters."
          actions={<ModuleHelp description="La Agenda te permite organizar tus próximas citas y seguimientos — llegan solas desde tu hoja conectada, nunca se cargan a mano acá." tourKey="agenda-intro" />}
        />
      </div>
      <AgendaMobileHome />
      <div className="hidden px-4 sm:px-6 lg:px-8 md:block">
        <AgendaShell isManager={isManager} />
      </div>
    </div>
  );
}
