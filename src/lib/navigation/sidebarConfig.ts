import {
  AppWindow,
  BarChart3,
  Bot,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  Presentation,
  FileCheck2,
  Folder,
  GraduationCap,
  Inbox,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Plug,
  ScanText,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCog,
  Users,
  Workflow,
  Zap,
  ArrowLeftRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Configuración centralizada del Sidebar (y de MobileNav, que renderiza el
 * mismo listado en su propio drawer) — reemplaza el array hardcodeado que
 * vivía antes directo en Sidebar.tsx. Agregar/quitar/reordenar un módulo es
 * editar SIDEBAR_MODULES; ningún componente de UI necesita tocarse.
 *
 * Sigue habiendo una sola fuente real de items (esta constante) — Sidebar.tsx
 * y MobileNav.tsx solo la consumen vía getSidebarNavItems()/groupNavItems(),
 * igual que antes.
 */
export interface SidebarModuleConfig {
  id: string;
  name: string;
  icon: LucideIcon;
  route: string;
  /** Encabezado de sección (mayúsculas al renderizar) bajo el que agrupa. */
  section: string;
  /** Clave de workspace_modules que gatea este item detrás de "Pronto"
   * hasta que el workspace lo tenga activado — sin esta clave, el item
   * siempre es un link real (Inbox/Calendario/Documentos/KPIs/Classroom/
   * Automatizaciones: no dependen de ningún módulo activable). */
  moduleKey?: string;
  /** Pill verde "IA" — solo para módulos que dependen de IA de verdad, no
   * una bandera decorativa (ver la nota en cada entrada de IA abajo). */
  badge?: "IA";
  /** Orden relativo dentro de su sección — mismo valor entre dos items
   * rompe empate por orden de aparición en el array (Array.sort estable). */
  order: number;
  /** Reservado para un futuro filtro de nav por rol — hoy NINGÚN item lo
   * usa todavía (los gates por rol existentes viven dentro de cada página,
   * no ocultan la entrada del menú). Se deja tipado para no tener que
   * migrar la forma de SidebarModuleConfig el día que sí haga falta. */
  permissions?: string[];
  /** Apagado estático a nivel código — a diferencia de `moduleKey`
   * (dinámico, por workspace), un item con enabled:false no se renderiza
   * para NADIE hasta que se vuelva a poner en true. Default true. */
  enabled?: boolean;
}

export const SIDEBAR_MODULES: SidebarModuleConfig[] = [
  { id: "dashboard", name: "Dashboard", icon: LayoutDashboard, route: "/dashboard", section: "Principal", order: 0 },
  { id: "inbox", name: "Inbox", icon: Inbox, route: "/inbox", section: "Principal", order: 1 },

  { id: "crm", name: "CRM", icon: Kanban, route: "/crm", section: "Clientes", moduleKey: "crm", order: 0 },
  { id: "advisors", name: "Prospectos", icon: ShieldCheck, route: "/advisors", section: "Clientes", moduleKey: "advisors", order: 1 },
  { id: "mini_apps", name: "Mini Apps", icon: AppWindow, route: "/mini-apps", section: "Clientes", moduleKey: "mini_apps", order: 2 },
  { id: "asesorias", name: "Asesorías", icon: Presentation, route: "/asesorias", section: "Clientes", moduleKey: "asesorias", order: 3 },

  { id: "policies", name: "Pólizas", icon: FileCheck2, route: "/polizas", section: "Pólizas", moduleKey: "policies", order: 0 },

  { id: "calendar", name: "Calendario", icon: CalendarDays, route: "/calendar", section: "Operación", order: 0 },
  // Módulo independiente, NO anidado en CRM — su fuente es la hoja KPI
  // sincronizada (agenda_appointments), nunca bookings/Google Calendar (ver
  // src/lib/appointmentSync/runner.ts). Ícono deliberadamente distinto de
  // Calendario para no confundir los dos conceptos en el sidebar colapsado.
  { id: "agenda", name: "Agenda", icon: CalendarClock, route: "/agenda", section: "Operación", moduleKey: "agenda", order: 1 },
  { id: "collections", name: "Cobranza", icon: CircleDollarSign, route: "/cobranza", section: "Operación", moduleKey: "collections", order: 2 },
  { id: "goals", name: "Metas y Bonos", icon: Trophy, route: "/metas", section: "Operación", moduleKey: "goals", order: 3 },
  { id: "tasks", name: "Tareas", icon: ListTodo, route: "/tasks", section: "Operación", moduleKey: "tasks", order: 4 },
  { id: "documents", name: "Documentos", icon: Folder, route: "/documents", section: "Operación", order: 5 },
  // KPIs no es una feature de IA (sincroniza planillas, no genera nada con
  // un modelo) — vuelve a Operación en vez de quedarse en Inteligencia solo
  // porque compartía categoría con Presentaciones por comodidad.
  { id: "kpis", name: "KPIs", icon: BarChart3, route: "/kpis", section: "Operación", order: 6 },

  // --- Inteligencia — todo lo que depende de IA vive acá, agrupado, listo
  // para sumar Agentes IA / Voz IA / Análisis IA / Chat IA / Predicciones IA
  // más adelante con solo una entrada nueva en este array. ---
  {
    id: "policy_extraction",
    name: "Extracción IA",
    icon: ScanText,
    route: "/extraccion-polizas",
    section: "Inteligencia",
    moduleKey: "policy_extraction",
    badge: "IA",
    order: 0,
  },
  {
    id: "ai_assistant",
    name: "Asistente IA",
    icon: Bot,
    route: "/asistente",
    section: "Inteligencia",
    moduleKey: "ai_assistant",
    badge: "IA",
    order: 1,
  },
  {
    id: "insurance_providers",
    name: "Aseguradoras",
    icon: Plug,
    route: "/aseguradoras",
    section: "Inteligencia",
    moduleKey: "insurance_providers",
    badge: "IA",
    order: 2,
  },
  {
    // Mismo moduleKey que "Aseguradoras" a propósito — es una vista nueva
    // (dashboard) sobre los mismos datos/conexiones, no un módulo aparte
    // que necesite su propio toggle en Configuración → Módulos.
    id: "portfolio_agent",
    name: "Analizador de Cartera",
    icon: Bot,
    route: "/analizador-cartera",
    section: "Inteligencia",
    moduleKey: "insurance_providers",
    badge: "IA",
    order: 3,
  },
  {
    // Sin badge "IA" a propósito — combina reglas/recordatorios/flujos que
    // no dependen de un modelo, no sería honesto marcarla como IA.
    id: "automations",
    name: "Automatizaciones",
    icon: Zap,
    route: "/automatizaciones",
    section: "Inteligencia",
    order: 4,
  },
  {
    id: "presentations",
    name: "Crear mi Presentación",
    icon: Sparkles,
    route: "/presentaciones",
    section: "Inteligencia",
    moduleKey: "presentations",
    badge: "IA",
    order: 5,
  },
  // Promovido fuera de /crm (era la pestaña "Agentes IA", ?tab=agentes-ia)
  // a módulo propio — un agente puede ser de module_key='crm'/'ats'/
  // 'referrals', no era realmente una sub-sección exclusiva del CRM. Sin
  // moduleKey a propósito (como Automatizaciones): no hay un toggle de
  // workspace_modules para esto, siempre es un link real.
  {
    id: "ai_agents",
    name: "Agentes IA",
    icon: UserCog,
    route: "/agentes-ia",
    section: "Inteligencia",
    badge: "IA",
    order: 6,
  },

  { id: "classroom", name: "Classroom", icon: GraduationCap, route: "/classroom", section: "Aprendizaje", order: 0 },

  // "Asesores" es el panel administrativo del Owner global sobre las
  // cuentas reales de asesores de Growth Link — deliberadamente en su
  // propia sección "Administración", separada de "Clientes" (que agrupa
  // el CRM propio de CADA workspace) para que no se confundan los dos
  // conceptos. moduleEnabled sigue viniendo de workspace_modules como
  // cualquier otro módulo — el gate real de "quién puede verlo" vive en la
  // página (isPlatformAdmin), no acá.
  { id: "asesores", name: "Asesores", icon: Users, route: "/asesores", section: "Administración", moduleKey: "asesores", order: 0 },
  // Solo owner/admin — mismo motivo que "Asesores": el gate real vive en
  // src/app/(protected)/operaciones/layout.tsx (no acá, ver comentario de
  // `permissions` arriba), moduleEnabled sigue siendo el mecanismo genérico.
  { id: "operaciones", name: "Operaciones", icon: Workflow, route: "/operaciones", section: "Administración", moduleKey: "operaciones", order: 1 },

  {
    id: "data_transfer",
    name: "Importar / Exportar",
    icon: ArrowLeftRight,
    route: "/importar-exportar",
    section: "Cuenta",
    moduleKey: "data_transfer",
    order: 0,
  },
];

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Uppercase section header the item groups under when the sidebar is
   * expanded (Sidebar.tsx) or in MobileNav's drawer — see groupNavItems(). */
  category: string;
  comingSoon?: boolean;
  /** Shows a small green "IA" pill next to the label when expanded. */
  isAI?: boolean;
}

/** Resolves SIDEBAR_MODULES (static config) into the flat, ordered NavItem[]
 * both Sidebar.tsx and MobileNav.tsx render — the one place that turns a
 * `moduleKey` into a real comingSoon boolean for THIS workspace. Items with
 * `enabled: false` are dropped entirely, before any workspace-specific
 * resolution.
 *
 * `order` is scoped PER SECTION (see its doc comment on SidebarModuleConfig)
 * — sorting the flat array by `order` alone would interleave items across
 * sections whenever two different sections both happen to use the same
 * number. Sections themselves are ordered by first appearance in
 * SIDEBAR_MODULES (same rule groupNavItems already documents), items within
 * a section by `order`. */
export function getSidebarNavItems(enabledModules: ReadonlySet<string>): NavItem[] {
  const sectionFirstIndex = new Map<string, number>();
  SIDEBAR_MODULES.forEach((m, i) => {
    if (!sectionFirstIndex.has(m.section)) sectionFirstIndex.set(m.section, i);
  });

  return SIDEBAR_MODULES.filter((m) => m.enabled !== false)
    .slice()
    .sort((a, b) => {
      const sectionDiff = sectionFirstIndex.get(a.section)! - sectionFirstIndex.get(b.section)!;
      return sectionDiff !== 0 ? sectionDiff : a.order - b.order;
    })
    .map((m) => ({
      id: m.id,
      label: m.name,
      href: m.route,
      icon: m.icon,
      category: m.section,
      comingSoon: m.moduleKey ? !enabledModules.has(m.moduleKey) : false,
      isAI: m.badge === "IA",
    }));
}

/** Groups a flat NavItem[] by `category`, preserving first-seen order —
 * kept separate from getSidebarNavItems() itself (which stays flat) so a
 * future consumer that doesn't want grouping isn't forced into the nested
 * shape. Both Sidebar.tsx and MobileNav.tsx call this on top of the same
 * flat list. */
export function groupNavItems(items: NavItem[]): { category: string; items: NavItem[] }[] {
  const order: string[] = [];
  const grouped = new Map<string, NavItem[]>();
  for (const item of items) {
    if (!grouped.has(item.category)) {
      grouped.set(item.category, []);
      order.push(item.category);
    }
    grouped.get(item.category)!.push(item);
  }
  return order.map((category) => ({ category, items: grouped.get(category)! }));
}

/** ATS pages (/ats, /ats/[vacancyId]) live outside /crm but should still
 * highlight the CRM sidebar icon, since ATS is now reached exclusively via
 * CRM's tab strip. Exported so MobileNav.tsx shares the exact same rule
 * instead of re-deriving it. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  if (href === "/crm" && pathname.startsWith("/ats")) return true;
  return false;
}
