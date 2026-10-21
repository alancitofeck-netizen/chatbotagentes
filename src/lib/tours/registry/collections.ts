import type { TourConfig } from "../types";

/** Verificado contra FinanzasShell.tsx/FinanzasGastosTab.tsx — reescrito al
 * reemplazar Cobranza (Kanban + prioridad por IA) por Finanzas (Gastos +
 * Calendario). La `key` se mantiene ("collections-intro") para no perder el
 * progreso ya guardado de quien ya vio el tutorial viejo. */
export const collectionsIntroTour: TourConfig = {
  key: "collections-intro",
  moduleKey: "collections",
  title: "Finanzas",
  steps: [
    {
      target: '[data-tour="finanzas.tabs"]',
      title: "💰 Dos vistas de tu plata",
      description: "Gastos: lo que pagás. Calendario: lo que te deben y lo que tenés que pagar, día por día.",
      placement: "bottom",
    },
    {
      target: '[data-tour="finanzas.new-button"]',
      title: "Cargar un movimiento",
      description: "Registrá un gasto o un cobro — queda guardado acá, nunca en una planilla aparte.",
      placement: "bottom",
    },
    {
      target: '[data-tour="finanzas.kpis"]',
      title: "De un vistazo",
      description: "Cuánto gastaste, cuánto ya pagaste y qué te queda pendiente este mes.",
      placement: "bottom",
    },
  ],
};

export const collectionsTours: TourConfig[] = [collectionsIntroTour];
