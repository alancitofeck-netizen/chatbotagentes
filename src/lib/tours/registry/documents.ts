import type { TourConfig } from "../types";

/** Verificado contra DocumentsShell.tsx/DocumentsGrid.tsx. */
export const documentsIntroTour: TourConfig = {
  key: "documents-intro",
  moduleKey: "documents",
  title: "Documentos",
  steps: [
    {
      target: '[data-tour="documents.search"]',
      title: "📁 Organizá tus documentos",
      description: "Buscá cualquier archivo por nombre.",
      placement: "bottom",
    },
    {
      target: '[data-tour="documents.new-trigger"]',
      title: "Subir o crear",
      description: "Subí archivos, creá una carpeta, o importá contactos desde un archivo.",
      action: "click",
      placement: "bottom",
    },
    {
      target: '[data-tour="documents.open-item"]',
      title: "Abrí un documento",
      description: "Para verlo, descargarlo o moverlo de carpeta.",
      action: "click",
      placement: "top",
    },
  ],
};

export const documentsTours: TourConfig[] = [documentsIntroTour];
