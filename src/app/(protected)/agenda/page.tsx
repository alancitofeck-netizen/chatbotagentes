import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { AgendaShell } from "./AgendaShell";
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
  await assertModuleEnabled(workspaceId, "agenda");
  const isManager = role === "owner" || role === "admin";

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Agenda</h1>
          <ModuleHelp description="La Agenda te permite organizar tus próximas citas y seguimientos — llegan solas desde tu hoja conectada, nunca se cargan a mano acá." tourKey="agenda-intro" />
        </div>
        <p className="text-sm text-neutral-500">Citas de tus asesores, generadas por tu equipo de setters.</p>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <AgendaShell isManager={isManager} />
      </div>
    </div>
  );
}
