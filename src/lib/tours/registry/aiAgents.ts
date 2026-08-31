import type { TourConfig } from "../types";

/** Verificado contra AiAgentsSection.tsx/AgentCard.tsx. Filtros y "Abrir
 * agente" solo existen cuando ya hay al menos un agente creado — se
 * saltean solos en un workspace nuevo (ver ProductTourHost). */
export const aiAgentsIntroTour: TourConfig = {
  key: "ai-agents-intro",
  moduleKey: "ai_agents",
  title: "Agentes IA",
  steps: [
    {
      target: '[data-tour="ai-agents.new-link"]',
      title: "🤖 Los Agentes IA son asistentes especializados",
      description: "Reciben información, la procesan, ejecutan una tarea puntual y te devuelven un resultado — creá el primero desde acá.",
      placement: "bottom",
    },
    {
      target: '[data-tour="ai-agents.filters"]',
      title: "Filtrá tus agentes",
      description: "Por módulo, estado, canal o modo.",
      placement: "bottom",
    },
    {
      target: '[data-tour="ai-agents.open-card"]',
      title: "Abrí un agente",
      description: "Para ver y ajustar su configuración.",
      action: "click",
      placement: "top",
    },
  ],
};

export const aiAgentsTours: TourConfig[] = [aiAgentsIntroTour];
