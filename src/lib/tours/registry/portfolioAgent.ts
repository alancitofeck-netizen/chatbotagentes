import type { TourConfig } from "../types";

/** Verificado contra PortfolioAgentShell.tsx — a propósito NO menciona
 * "detección de oportunidades" ni "priorización de clientes": el propio
 * código las marca como placeholders explícitos ("todavía no está
 * construido... próxima pasada de este feature"), así que el tour describe
 * solo lo que hoy es real: sincronizar un portal y ver el resumen de
 * cartera resultante. Dos entradas mutuamente excluyentes según haya o no
 * portal conectado — la que no aplica se saltea sola. */
export const portfolioAgentIntroTour: TourConfig = {
  key: "portfolio-agent-intro",
  moduleKey: "portfolio_agent",
  title: "Agente IA de Cartera",
  steps: [
    {
      target: '[data-tour="portfolio-agent.connect-empty-link"]',
      title: "🔗 Conectá un portal para empezar",
      description: "Sincronizá el portal de una aseguradora y Growth Link organiza tu cartera automáticamente.",
      placement: "top",
    },
    {
      target: '[data-tour="portfolio-agent.sync-button"]',
      title: "Sincronizar ahora",
      description: "Volvé a traer los datos más recientes de tu portal cuando quieras.",
      placement: "bottom",
    },
  ],
};

export const portfolioAgentTours: TourConfig[] = [portfolioAgentIntroTour];
