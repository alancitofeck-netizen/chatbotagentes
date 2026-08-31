import type { TourConfig } from "../types";

/** Verificado contra OperacionesOverview.tsx — módulo genuinamente simple:
 * 2 herramientas fijas (Growth Link OS / Growth Link Map), sin crear/
 * buscar/filtrar ni lista de instancias (comentario real del código: "acá
 * no hay stats/CTA de 'crear' porque Operaciones no tiene instancias
 * guardadas"). El tour no inventa nada más allá de esto. */
export const operationsIntroTour: TourConfig = {
  key: "operations-intro",
  moduleKey: "operaciones",
  title: "Operaciones",
  steps: [
    {
      target: '[data-tour="operations.open-tool"]',
      title: "⚙️ Dos herramientas internas de tu equipo",
      description: "Cada tarjeta te lleva directo a su herramienta — no hay nada más que crear o configurar acá.",
      placement: "top",
    },
  ],
};

export const operationsTours: TourConfig[] = [operationsIntroTour];
