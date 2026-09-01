import type { TourConfig } from "../types";

/** Verificado contra MiniAppsListShell.tsx/MiniAppCard.tsx/MiniAppListRow.tsx.
 * "Abrir un ítem" está etiquetado en las dos variantes reales (grid y
 * lista) — el layout se elige a mano (mismo ancho de pantalla), no por
 * breakpoint, así que el tour funciona sin importar cuál esté activa. */
export const miniAppsIntroTour: TourConfig = {
  key: "mini-apps-intro",
  moduleKey: "mini_apps",
  title: "Mini Apps",
  steps: [
    {
      target: '[data-tour="mini-apps.new-button"]',
      title: "✨ Creá tu primera Mini App",
      description: "Simuladores y formularios públicos que capturan leads directo para tu CRM.",
      placement: "bottom",
    },
    {
      target: '[data-tour="mini-apps.search"]',
      title: "Buscá y filtrá",
      description: "Por nombre o por estado (activas/inactivas).",
      placement: "bottom",
    },
    {
      target: '[data-tour="mini-apps.open-item"]',
      title: "Abrí una Mini App",
      description: "Para ver sus leads, editarla, o compartir su link público.",
      action: "click",
      placement: "top",
    },
  ],
};

export const miniAppsTours: TourConfig[] = [miniAppsIntroTour];
