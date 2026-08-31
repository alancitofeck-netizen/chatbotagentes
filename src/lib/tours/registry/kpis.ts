import type { TourConfig } from "../types";

/** Verificado contra KpisSection.tsx. Este módulo está todo-o-nada detrás
 * de una hoja de Google Sheets conectada: si no está conectada, solo existe
 * el prompt de conexión (sin tiles/filtros); si ya está conectada, el
 * prompt no existe. El primer paso apunta al prompt y se saltea solo si ya
 * está conectado (ver ProductTourHost) — nunca hace falta dos tours
 * distintos para el mismo módulo. */
export const kpisIntroTour: TourConfig = {
  key: "kpis-intro",
  moduleKey: "kpis",
  title: "Tus KPIs",
  steps: [
    {
      target: '[data-tour="kpis.connect-button"]',
      title: "🔗 Conectá tu hoja de KPIs",
      description: "Growth Link va a leer los números de tus setters directo desde tu Google Sheets, sin que tengas que abrirla.",
      placement: "top",
    },
    {
      target: '[data-tour="kpis.tiles"]',
      title: "📊 Los KPIs te muestran cómo está funcionando tu actividad",
      description: "Este número, por ejemplo, te muestra cuántas conexiones lograste este período.",
      placement: "bottom",
    },
    {
      target: '[data-tour="kpis.filters"]',
      title: "Filtrá por mes, setter o equipo",
      description: "Para ver el detalle exacto que necesitás.",
      placement: "bottom",
    },
  ],
};

export const kpisTours: TourConfig[] = [kpisIntroTour];
