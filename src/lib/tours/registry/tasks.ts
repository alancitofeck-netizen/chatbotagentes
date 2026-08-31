import type { TourConfig } from "../types";

/** Tour real de dos pantallas: crear un grupo de tareas en /tasks y, recién
 * adentro de ese grupo (/tasks/groups/[groupId], a donde la propia app
 * navega sola tras crear el grupo — ver TasksModuleShell.tsx), crear la
 * primera tarea. Verificado contra NewItemMenu.tsx, GroupFormDialog.tsx y
 * TaskFormSheet.tsx (Título/Prioridad/Fecha límite/Asignar a/Crear tarea) —
 * "Estado" no aparece en el formulario de creación (solo al editar), por
 * eso no forma parte del tour. El motor de tours no necesita saber que hay
 * un cambio de ruta en el medio: cada paso espera a que su propio target
 * exista, sin importar qué haya pasado mientras tanto (ver ProductTour). */
export const tasksCreateTaskTour: TourConfig = {
  key: "tasks-create-task",
  moduleKey: "tasks",
  title: "Organizá tus pendientes",
  steps: [
    {
      target: '[data-tour="tasks.new-menu-trigger"]',
      title: "✅ Las tareas te ayudan a saber qué tenés que hacer y cuándo",
      description: "Empecemos creando un grupo de tareas — es donde vas a organizar tus pendientes.",
      action: "click",
    },
    {
      target: '[data-tour="tasks.new-group-item"]',
      title: "Grupo de tareas",
      description: 'Elegí "Nuevo grupo de tareas".',
      action: "click",
    },
    {
      target: '[data-tour="tasks.group-name-input"]',
      title: "Nombralo",
      description: 'Por ejemplo: "Llamar a Juan mañana" — o cualquier nombre que te sirva para agrupar tareas relacionadas.',
      placement: "bottom",
    },
    {
      target: '[data-tour="tasks.create-group-submit"]',
      title: "Creá el grupo",
      description: "Al guardarlo, entrás directo adentro.",
      action: "click",
    },
    {
      target: '[data-tour="tasks.new-task-button"]',
      title: "Ahora sí, tu primera tarea",
      description: "Hacé clic acá para cargarla.",
      action: "click",
    },
    {
      target: '[data-tour="tasks.task-title-input"]',
      title: "Título",
      description: "Escribí de qué se trata la tarea.",
      placement: "bottom",
    },
    {
      target: '[data-tour="tasks.task-priority-select"]',
      title: "Prioridad",
      description: "Elegí qué tan urgente es.",
      placement: "bottom",
    },
    {
      target: '[data-tour="tasks.task-assignee-select"]',
      title: "Responsable",
      description: "¿Quién la va a hacer?",
      placement: "bottom",
    },
    {
      target: '[data-tour="tasks.task-save-button"]',
      title: "Perfecto",
      description: "Guardá la tarea.",
      action: "click",
      placement: "top",
    },
  ],
  completionTitle: "🎉 Perfecto",
  completionDescription: "Ya sabés cómo organizar tus pendientes.",
};

export const tasksTours: TourConfig[] = [tasksCreateTaskTour];
