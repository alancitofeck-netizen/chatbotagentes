import type { TourConfig } from "../types";

/** Solo cubre el dashboard de nivel superior (/asesorias) — verificado
 * contra AsesoriaStageOverview.tsx. La pantalla de la reunión en sí
 * (/asesorias/[id]) es un iframe mismo-origen que sirve un SPA verbatim del
 * usuario (Meeting OS) — el tour no puede ni debe apuntar a nada dentro de
 * ese árbol de DOM separado, así que el recorrido se queda acá, en la
 * puerta de entrada real. */
export const asesoriasIntroTour: TourConfig = {
  key: "asesorias-intro",
  moduleKey: "asesorias",
  title: "Asesorías",
  steps: [
    {
      target: '[data-tour="asesorias.create-link"]',
      title: "🤝 Gestioná tus reuniones comerciales",
      description: "Presentación y Cita de Cierre son el mismo proceso guiado — empezá creando una Asesoría.",
      placement: "bottom",
    },
    {
      target: '[data-tour="asesorias.details-link"]',
      title: "Ver el detalle",
      description: "Desde acá accedés al listado completo de esta etapa.",
      placement: "bottom",
    },
  ],
};

export const asesoriasTours: TourConfig[] = [asesoriasIntroTour];
