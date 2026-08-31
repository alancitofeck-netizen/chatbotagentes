import type { TourConfig } from "../types";

/** Verificado contra ChatColumn.tsx/SmartCardsColumn.tsx. Los ejemplos de
 * prompts en la descripción son el texto real y exacto que ya muestra el
 * estado vacío del chat (ChatColumn.tsx) — no se inventó ninguno nuevo. */
export const assistantIntroTour: TourConfig = {
  key: "assistant-intro",
  moduleKey: "ai_assistant",
  title: "Tu Asistente IA",
  steps: [
    {
      target: '[data-tour="assistant.chat-input"]',
      title: "✨ Este es tu asistente de IA",
      description: 'Pedile ayuda en lenguaje natural — por ejemplo: "¿cómo va mi día?", "creá una tarea para llamar a Pedro", o "mové a María a Cerrado".',
      placement: "top",
    },
    {
      target: '[data-tour="assistant.generate-recommendations"]',
      title: "Recomendaciones automáticas",
      description: "También puede analizar tu actividad y sugerirte qué hacer, sin que tengas que preguntarle nada.",
      placement: "left",
    },
  ],
};

export const assistantTours: TourConfig[] = [assistantIntroTour];
