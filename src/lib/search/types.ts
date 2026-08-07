/** Client-safe — tipos compartidos entre el servicio de búsqueda
 * (server-only, service.ts) y el componente de UI (GlobalSearch.tsx). */

export type SearchResultType = "contact" | "conversation" | "policy" | "task" | "event" | "company" | "automation" | "document";

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string | null;
  type: SearchResultType;
  /** Nombre de ícono lucide-react — resuelto a componente en la UI
   * (GlobalSearch.tsx), igual que el patrón ya usado en Automatizaciones. */
  icon: string;
  route: string;
}

export const SEARCH_TYPE_LABEL: Record<SearchResultType, string> = {
  contact: "Clientes",
  conversation: "Conversaciones",
  policy: "Pólizas",
  task: "Tareas",
  event: "Eventos",
  company: "Empresas",
  automation: "Automatizaciones",
  document: "Documentos",
};

/** Orden fijo en que se muestran los grupos en el dropdown — no alfabético,
 * prioriza lo que más se busca (clientes/pólizas) primero. */
export const SEARCH_TYPE_ORDER: SearchResultType[] = ["contact", "policy", "task", "conversation", "event", "automation", "company", "document"];

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  route: string;
}

/** Comandos estáticos — "no crear un buscador por módulo" también aplica acá:
 * es una lista plana que cualquier módulo nuevo puede sumar una entrada a,
 * no un builder de comandos por módulo. Cada ruta lee `?crear=1` en el
 * módulo destino para auto-abrir su propio formulario de alta (ver
 * ContactsShell/PoliciesBoardShell/AutomationsShell) — "Nueva tarea" no
 * tiene ese soporte todavía porque Tareas no tiene un punto de alta a nivel
 * global (las tareas viven dentro de un grupo/lista), así que solo navega. */
export const QUICK_ACTIONS: QuickAction[] = [
  { id: "new-contact", label: "Nuevo cliente", icon: "UserPlus", route: "/inbox/contactos?crear=1" },
  { id: "new-policy", label: "Nueva póliza", icon: "FileCheck2", route: "/polizas?crear=1" },
  { id: "new-automation", label: "Nueva automatización", icon: "Zap", route: "/automatizaciones?crear=1" },
  { id: "new-task", label: "Nueva tarea", icon: "ListTodo", route: "/tasks" },
];
