import type { TourConfig } from "../types";

/** Verificado contra AdvisorsBoardShell.tsx/DealCardView.tsx. Sin
 * buscador/filtros — el propio código lo aclara explícitamente
 * ("deliberately narrower than the CRM board... no advanced filters"), así
 * que el tour no inventa un paso de filtros que no existe. */
export const advisorsIntroTour: TourConfig = {
  key: "advisors-intro",
  moduleKey: "advisors",
  title: "Prospectos",
  steps: [
    {
      target: '[data-tour="advisors.new-button"]',
      title: "👤 Empecemos por crear tu primer prospecto",
      description: "Acá vas a cargar la información de tus pólizas y clientes.",
      placement: "bottom",
    },
    {
      target: '[data-tour="advisors.import-link"]',
      title: "¿Ya tenés una cartera armada?",
      description: "Importala de una sola vez en vez de cargarla a mano.",
      placement: "bottom",
    },
    {
      target: '[data-tour="advisors.open-card"]',
      title: "Abrí un prospecto",
      description: "Para ver y editar su información completa.",
      action: "click",
      placement: "top",
    },
  ],
};

export const advisorsTours: TourConfig[] = [advisorsIntroTour];
