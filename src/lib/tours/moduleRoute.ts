import { SIDEBAR_MODULES } from "@/lib/navigation/sidebarConfig";

/** Módulos con tour registrado cuya página real no está en SIDEBAR_MODULES
 * — hoy solo ATS (se llega vía la pestaña "ATS" del CRM, no tiene entrada
 * propia en el sidebar; ver CrmAtsTabStrip.tsx). */
const EXTRA_ROUTES: Record<string, string> = { ats: "/ats" };

/** Resuelve a qué ruta hay que navegar antes de lanzar el tour de un
 * módulo — usado por LearningProgress.tsx al repetir/continuar un tour
 * desde fuera de su propia página (ej. desde el panel de Perfil). */
export function getModuleRoute(moduleKey: string): string | null {
  const sidebarMatch = SIDEBAR_MODULES.find((m) => m.id === moduleKey);
  if (sidebarMatch) return sidebarMatch.route;
  return EXTRA_ROUTES[moduleKey] ?? null;
}
