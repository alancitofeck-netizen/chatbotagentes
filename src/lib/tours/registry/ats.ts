import type { TourConfig } from "../types";

/** Cruza de /ats a /ats/[vacancyId] (la propia app navega sola al abrir una
 * vacante) — verificado contra VacancyList.tsx/VacancyBoardView.tsx. Sin
 * búsqueda/filtros en el listado — el código real no tiene ninguno acá. */
export const atsIntroTour: TourConfig = {
  key: "ats-intro",
  moduleKey: "ats",
  title: "ATS",
  steps: [
    {
      target: '[data-tour="ats.new-vacancy-button"]',
      title: "💼 Empecemos por crear tu primera vacante",
      description: "Cada vacante tiene su propio tablero de candidatos.",
      placement: "bottom",
    },
    {
      target: '[data-tour="ats.open-vacancy"]',
      title: "Abrí una vacante",
      description: "Para ver su tablero de candidatos.",
      action: "click",
      placement: "top",
    },
    {
      target: '[data-tour="ats.add-candidate-button"]',
      title: "Agregá un candidato",
      description: "Desde acá cargás candidatos y los movés por las etapas del proceso.",
      placement: "bottom",
    },
  ],
};

export const atsTours: TourConfig[] = [atsIntroTour];
