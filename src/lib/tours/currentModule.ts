import { SIDEBAR_MODULES } from "@/lib/navigation/sidebarConfig";

/** Resuelve qué módulo del sidebar corresponde a la ruta actual — usado por
 * HelpCenter/ModuleHelp para saber "¿qué tutorial ofrezco acá?" sin que
 * cada página tenga que declarar su propio moduleKey a mano. Coincidencia
 * por prefijo más largo (p. ej. /tasks/groups/abc123 -> "tasks"). */
export function getModuleIdForPathname(pathname: string): string | null {
  let best: { id: string; route: string } | null = null;
  for (const mod of SIDEBAR_MODULES) {
    if (pathname === mod.route || pathname.startsWith(`${mod.route}/`)) {
      if (!best || mod.route.length > best.route.length) best = { id: mod.id, route: mod.route };
    }
  }
  return best?.id ?? null;
}
