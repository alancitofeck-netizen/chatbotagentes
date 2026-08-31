import type { TourConfig } from "../types";

/** Verificado contra AutomationsShell.tsx/AutomationCard.tsx. El concepto
 * real acá es disparador → acción (no hay una "condición" separada en la
 * UI, confirmado en el código — CreateAutomationSheet.tsx solo tiene
 * "Cuándo" y "Acción"), así que la descripción no inventa un paso de
 * "condición" intermedio que no existe en el formulario real. */
export const automationsIntroTour: TourConfig = {
  key: "automations-intro",
  moduleKey: "automations",
  title: "Automatizaciones",
  steps: [
    {
      target: '[data-tour="automations.tabs"]',
      title: "⚡ Growth Link puede trabajar por vos",
      description: "Elegí una automatización lista para usar en la Biblioteca, o mirá las que ya activaste en Mis automatizaciones.",
      placement: "bottom",
    },
    {
      target: '[data-tour="automations.configure-button"]',
      title: "Cuándo → Acción",
      description: 'Cada automatización define un disparador (ej. "nuevo lead") y una acción que Growth Link ejecuta sola (crear tarea, enviar mensaje, cambiar de etapa).',
      action: "click",
      placement: "top",
    },
    {
      target: '[data-tour="automations.new-button"]',
      title: "Creá la tuya",
      description: "También podés armar una automatización propia desde cero.",
      placement: "bottom",
    },
  ],
};

export const automationsTours: TourConfig[] = [automationsIntroTour];
