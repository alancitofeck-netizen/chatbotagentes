import type { TourConfig } from "../types";

/** Explicativo — verificado contra GoalsShell.tsx/GoalsHeader.tsx. El click
 * en una tarjeta de meta hoy no hace nada (onOpen={() => {}} en el código
 * real), así que el tour nunca apunta a "abrir una meta" — solo señala el
 * grid como concepto visual, no como interacción. "Crear Meta" solo existe
 * para owner/admin (canManage) — si no existe, el paso se saltea solo. */
export const goalsIntroTour: TourConfig = {
  key: "goals-intro",
  moduleKey: "goals",
  title: "Metas y Bonificaciones",
  steps: [
    {
      target: '[data-tour="goals.grid"]',
      title: "🎯 Acá podés ver tus objetivos",
      description: "Cada tarjeta muestra tu progreso real hacia una meta, y lo que falta para cumplirla.",
      placement: "bottom",
    },
    {
      target: '[data-tour="goals.create-button"]',
      title: "Crear una meta o bono",
      description: "Definí un objetivo nuevo para vos o tu equipo.",
      placement: "bottom",
    },
    {
      target: '[data-tour="goals.history-button"]',
      title: "Historial",
      description: "Consultá metas y bonos de períodos anteriores.",
      placement: "bottom",
    },
  ],
};

export const goalsTours: TourConfig[] = [goalsIntroTour];
