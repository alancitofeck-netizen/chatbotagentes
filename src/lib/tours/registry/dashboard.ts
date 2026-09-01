import type { TourConfig } from "../types";

/** Verificado contra DashboardHomeSection.tsx/PriorityInsights.tsx. El
 * Dashboard es una vista de solo lectura (insights/KPIs) — no hay botón de
 * "crear" ni búsqueda real acá, así que el tour se queda en 2 pasos
 * honestos. El segundo paso apunta a un insight real; si el workspace no
 * tiene ninguno activo (EmptyState "Sin novedades importantes"), se saltea
 * solo. */
export const dashboardIntroTour: TourConfig = {
  key: "dashboard-intro",
  moduleKey: "dashboard",
  title: "Tu Dashboard",
  steps: [
    {
      target: '[data-tour="dashboard.period-selector"]',
      title: "📊 Tu resumen del día",
      description: "Cambiá el período para ver tu actividad de hoy, esta semana, este mes o este año.",
      placement: "bottom",
    },
    {
      target: '[data-tour="dashboard.insight-link"]',
      title: "Insights prioritarios",
      description: "Growth Link te avisa solo cuándo hay algo que necesita tu atención — conversaciones sin responder, oportunidades estancadas, tendencias.",
      placement: "top",
    },
  ],
};

export const dashboardTours: TourConfig[] = [dashboardIntroTour];
