import type { TourConfig } from "../types";

/** Explicativo — verificado contra AgendaShell.tsx. A diferencia de
 * Calendario, acá no existe un flujo de "crear cita": las citas llegan
 * solas desde una hoja de Google Sheets conectada (comentario real del
 * código, ver src/lib/appointmentSync/runner.ts) — el botón "Nueva cita" en
 * realidad abre un explicador de por qué no hay formulario, no un
 * formulario. El tour respeta eso: hace click ahí para revelar el
 * explicador real, en vez de fingir que crea algo. */
export const agendaIntroTour: TourConfig = {
  key: "agenda-intro",
  moduleKey: "agenda",
  title: "Tu Agenda",
  steps: [
    {
      target: '[data-tour="agenda.range-switcher"]',
      title: "📆 La Agenda te permite organizar tus próximas actividades",
      description: "Cambiá entre Hoy, Mañana, Semana o Mes para ver tus citas y seguimientos.",
      placement: "bottom",
    },
    {
      target: '[data-tour="agenda.filters-button"]',
      title: "Filtrá por setter o asesor",
      description: "Útil cuando gestionás la agenda de todo tu equipo.",
      placement: "bottom",
    },
    {
      target: '[data-tour="agenda.new-cita-button"]',
      title: "¿De dónde salen las citas?",
      description: "Tocá acá para ver cómo funciona.",
      action: "click",
      placement: "left",
    },
    {
      target: '[data-tour="agenda.sheet-connect-link"]',
      title: "🔗 Las citas se sincronizan solas",
      description: "Cargá o actualizá la cita en tu hoja de Google Sheets conectada — en minutos aparece acá. Nunca se cargan manualmente en Growth Link.",
      placement: "left",
    },
  ],
};

export const agendaTours: TourConfig[] = [agendaIntroTour];
