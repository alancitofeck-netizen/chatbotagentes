import type { TourConfig } from "../types";

/** Explicativo, no interactivo (a diferencia de CRM/Tareas) — coherente con
 * el pedido: Classroom debe sentirse como una plataforma de aprendizaje, no
 * un formulario para completar. Verificado contra ClassroomHomeShell.tsx —
 * si el workspace todavía no tiene contenido, CategoryGrid/ContinueLearning
 * no se renderizan y esos pasos se saltean solos (ver ProductTour, nunca
 * queda "colgado" esperando algo que no existe). */
export const classroomIntroTour: TourConfig = {
  key: "classroom-intro",
  moduleKey: "classroom",
  title: "Bienvenido al Classroom",
  steps: [
    {
      target: '[data-tour="classroom.search"]',
      title: "🎓 Bienvenido al Classroom",
      description: "Acá vas a encontrar las capacitaciones para aprender a usar Growth Link y mejorar tu trabajo. Buscá cualquier curso desde acá.",
      placement: "bottom",
    },
    {
      target: '[data-tour="classroom.categories"]',
      title: "Categorías",
      description: "Los cursos están organizados por categoría — elegí la que te interese para ver todo su contenido.",
      placement: "top",
    },
    {
      target: '[data-tour="classroom.continue-learning"]',
      title: "Continuá donde quedaste",
      description: "Acá siempre vas a ver el curso que dejaste a medias, con tu progreso guardado.",
      placement: "bottom",
    },
  ],
};

export const classroomTours: TourConfig[] = [classroomIntroTour];
