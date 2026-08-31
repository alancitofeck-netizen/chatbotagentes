import type { TourConfig } from "../types";

/** Verificado contra CalendarShell.tsx (selector de vistas Día/Semana/Mes/
 * Agenda, botón "Nuevo evento") y CalendarSidebar.tsx (link "Conectar" de
 * Google Calendar, condicionado a googleCalendarConnected). El paso de
 * Google Calendar es explicativo, nunca fuerza la conexión (§8: "también
 * Omitir por ahora"). */
export const calendarIntroTour: TourConfig = {
  key: "calendar-intro",
  moduleKey: "calendar",
  title: "Tu calendario",
  steps: [
    {
      target: '[data-tour="calendar.view-switcher"]',
      title: "📅 Este es tu calendario",
      description: "Acá vas a organizar tus reuniones, citas y actividades. Cambiá entre Día, Semana, Mes o Agenda según lo que necesites ver.",
      placement: "bottom",
    },
    {
      target: '[data-tour="calendar.new-event-button"]',
      title: "Crear un evento",
      description: "Desde acá creás una reunión, llamada o cualquier actividad — arrastrando en la grilla también podés cambiar su fecha y horario.",
      placement: "bottom",
    },
    {
      target: '[data-tour="calendar.google-connect"]',
      title: "🔗 Conectá Google Calendar",
      description: "Si lo conectás, tus eventos se sincronizan automáticamente en ambos sentidos. Es totalmente opcional — podés omitirlo y conectarlo cuando quieras.",
      placement: "right",
    },
  ],
};

export const calendarTours: TourConfig[] = [calendarIntroTour];
