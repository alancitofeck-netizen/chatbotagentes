"use client";

import { createContext, useContext } from "react";

/** Acciones del chrome del módulo (TasksModuleShell) que una página de /tasks
 * puede disparar desde su propio contenido — p. ej. el inicio de Tareas en
 * mobile, que no muestra la barra superior y ofrece estas acciones en sus
 * propios botones y en el FAB. */
export interface TasksShellActions {
  openNewGroup: () => void;
  openNewTemplate: () => void;
  openAiPanel: () => void;
}

export const TasksShellContext = createContext<TasksShellActions | null>(null);

export function useTasksShell(): TasksShellActions {
  const ctx = useContext(TasksShellContext);
  if (!ctx) throw new Error("useTasksShell debe usarse dentro de TasksModuleShell.");
  return ctx;
}
