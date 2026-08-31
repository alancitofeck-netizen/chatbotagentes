import type { TourConfig } from "../types";

/** Explicativo (mismo criterio que Calendario/Classroom) — verificado contra
 * PoliciesActionBar.tsx (búsqueda/filtros) y PolicyTable.tsx (fila
 * clickeable). El paso final abre una póliza real de la lista, no una de
 * ejemplo — si el workspace no tiene pólizas todavía, ese paso se saltea
 * solo (ver ProductTourHost). */
export const policiesListTour: TourConfig = {
  key: "policies-list",
  moduleKey: "policies",
  title: "Tus pólizas",
  steps: [
    {
      target: '[data-tour="policies.list"]',
      title: "📋 Acá podés consultar y administrar tus pólizas",
      description: "Este es el listado completo de tu cartera.",
      placement: "top",
    },
    {
      target: '[data-tour="policies.search"]',
      title: "Buscá por cliente o número de póliza",
      description: "También podés buscar por aseguradora, ramo, ejecutivo o teléfono.",
      placement: "bottom",
    },
    {
      target: '[data-tour="policies.filters"]',
      title: "🔎 Usá los filtros",
      description: "Para encontrar rápidamente pólizas por estado, ramo, aseguradora o ejecutivo.",
      placement: "bottom",
    },
    {
      target: '[data-tour="policies.open-row"]',
      title: "👤 Abrí una póliza",
      description: "Desde acá vas a consultar toda la información relacionada — editar, descargar documentos y más.",
      action: "click",
      placement: "top",
    },
  ],
};

export const policiesTours: TourConfig[] = [policiesListTour];
