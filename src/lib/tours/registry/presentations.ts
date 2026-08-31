import type { TourConfig } from "../types";

/** Cruza de /presentaciones a /presentaciones/[id] (la propia app navega
 * sola al crear, mismo patrón que Tareas) — verificado contra
 * PresentationsShell.tsx y el wizard real (constants.ts): los pasos reales
 * son Información/Fotos/Servicios/IA/Vista previa/Finalizar, no
 * "especialidad/experiencia/propuesta de valor" como conceptos separados
 * (esos viven dentro de los campos de Información/Servicios). */
export const presentationsIntroTour: TourConfig = {
  key: "presentations-intro",
  moduleKey: "presentations",
  title: "Crear mi Presentación",
  steps: [
    {
      target: '[data-tour="presentations.new-button"]',
      title: "🎤 Creá tu presentación paso a paso",
      description: "Empecemos una nueva.",
      action: "click",
      placement: "bottom",
    },
    {
      target: '[data-tour="presentations.step-rail"]',
      title: "El camino completo",
      description: "Información → Fotos → Servicios → IA → Vista previa → Finalizar. Podés ir y volver entre pasos cuando quieras.",
      placement: "right",
    },
  ],
};

export const presentationsTours: TourConfig[] = [presentationsIntroTour];
