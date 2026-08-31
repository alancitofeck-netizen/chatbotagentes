import type { TourConfig } from "../types";

/** Verificado contra CollectionsActionBar.tsx/CollectionsTable.tsx. La
 * vista por defecto es "calendar" (CollectionsShell.tsx) — por eso el tour
 * primero cambia a la vista de tabla antes de abrir un cobro, en vez de
 * asumir que la tabla ya está visible. */
export const collectionsIntroTour: TourConfig = {
  key: "collections-intro",
  moduleKey: "collections",
  title: "Cobranza",
  steps: [
    {
      target: '[data-tour="collections.search"]',
      title: "💰 Desde acá controlás tus cobros",
      description: "Buscá por cliente, aseguradora, póliza o ejecutivo.",
      placement: "bottom",
    },
    {
      target: '[data-tour="collections.new-button"]',
      title: "Cargar un cobro",
      description: "Registrá un nuevo cobro manualmente cuando lo necesites.",
      placement: "bottom",
    },
    {
      target: '[data-tour="collections.priority-view"]',
      title: "✨ Prioridad (IA)",
      description: "Esta vista ordena tus cobros por urgencia real, para saber a quién contactar primero.",
      placement: "bottom",
    },
    {
      target: '[data-tour="collections.table-view"]',
      title: "Vista de tabla",
      description: "Para ver todos tus cobros en una lista.",
      action: "click",
      placement: "bottom",
    },
    {
      target: '[data-tour="collections.open-row"]',
      title: "Abrí un cobro",
      description: "Desde acá vas a ver el estado, vencimiento, y las acciones disponibles.",
      action: "click",
      placement: "top",
    },
  ],
};

export const collectionsTours: TourConfig[] = [collectionsIntroTour];
