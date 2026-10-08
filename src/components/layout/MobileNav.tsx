"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, CircleDollarSign, Inbox, Kanban, ListTodo, Search, Settings, ShieldCheck, UserCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { signOut } from "@/app/(protected)/actions";
import { getInboxUnreadTotalAction } from "@/lib/inbox/actions";
import { getCollectionsKpisAction } from "@/lib/collections/actions";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import { cn } from "@/lib/utils/cn";
import { getSidebarNavItems, groupNavItems, isNavItemActive } from "@/lib/navigation/sidebarConfig";
import { MOBILE_NAV_CLOSE_EVENT, MOBILE_NAV_OPEN_EVENT, MOBILE_NAV_STATE_EVENT } from "./mobileNavEvent";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GL";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Etiqueta del rol para el perfil del menú, como en la referencia ("Administrador"). */
function roleLabel(role: string) {
  if (role === "owner" || role === "admin") return "Administrador";
  if (role === "agent") return "Agente";
  return "Miembro";
}

/** Descripción corta de cada módulo en el menú "Más". Los que no tienen entrada
 * muestran sólo el nombre. */
const DESCRIPTIONS: Record<string, string> = {
  inbox: "Conversaciones de todos los canales",
  crm: "Tu cartera y oportunidades",
  advisors: "Personas a contactar",
  mini_apps: "Calculadoras y formularios para captar leads",
  asesorias: "Sesiones con clientes",
  policies: "Emitidas y en proceso",
  policy_extraction: "Cargá pólizas desde un PDF",
  insurance_providers: "Conexión con aseguradoras",
  portfolio_agent: "Tu cartera sincronizada",
  calendar: "Eventos y reuniones",
  agenda: "Citas y disponibilidad",
  collections: "Pagos y vencimientos",
  goals: "Objetivos y ranking",
  tasks: "Pendientes y seguimientos",
  documents: "Archivos del CRM",
  kpis: "Números de tus setters",
  ai_assistant: "Preguntas en lenguaje natural",
  automations: "Acciones automáticas",
  presentations: "Presentaciones con IA",
  ai_agents: "Asistentes especializados",
  manychat: "Leads desde Instagram",
  classroom: "Capacitaciones",
  asesores: "Equipo y rendimiento",
  operaciones: "Herramientas internas",
  data_transfer: "Importá y exportá tus datos",
};

/** Pantalla "Más" de mobile (md:hidden): perfil con rol, búsqueda, accesos rápidos
 * con contador real y, por sección, la lista de módulos. Abajo: modo oscuro,
 * perfil, configuración y cerrar sesión. Se abre desde la pestaña "Más" de la
 * barra inferior (evento); el header de mobile ya no tiene botón de menú. */
export function MobileNav({
  enabledModules,
  userName,
  workspaceName,
  role,
  isPlatformAdmin = false,
}: {
  enabledModules: string[];
  userName: string;
  workspaceName: string;
  role: string;
  /** "Workspaces de clientes" — en mobile solo está acá (antes, en el menú del avatar del header). */
  isPlatformAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Principal (Inicio e Inbox) ya está en la barra inferior y en los accesos rápidos.
  const groups = groupNavItems(getSidebarNavItems(new Set(enabledModules))).filter((g) => g.category !== "Principal");
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState<{ inbox: number; overdue: number }>({ inbox: 0, overdue: 0 });
  const q = query.trim().toLowerCase();
  // Accesos rápidos: sólo los módulos encendidos, con contador real (no leídos del
  // inbox y cobros vencidos) cargado al abrir el menú.
  const quick = [
    { href: "/inbox", label: "Inbox", icon: Inbox, count: counts.inbox, module: null },
    { href: "/crm", label: "CRM", icon: Kanban, count: 0, module: "crm" },
    { href: "/cobranza", label: "Cobranza", icon: CircleDollarSign, count: counts.overdue, module: "collections" },
    { href: "/tasks", label: "Tareas", icon: ListTodo, count: 0, module: "tasks" },
  ].filter((t) => !t.module || enabledModules.includes(t.module));
  const shownGroups = q
    ? groups.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) })).filter((g) => g.items.length > 0)
    : groups;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Cada contador llega por su lado: una acción lenta no retrasa a la otra.
    getInboxUnreadTotalAction()
      .catch(() => 0)
      .then((inbox) => {
        if (!cancelled) setCounts((c) => ({ ...c, inbox }));
      });
    getCollectionsKpisAction()
      .then((k) => k.overdueCount)
      .catch(() => 0)
      .then((overdue) => {
        if (!cancelled) setCounts((c) => ({ ...c, overdue }));
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const openDrawer = () => setOpen(true);
    const closeDrawer = () => setOpen(false);
    window.addEventListener(MOBILE_NAV_OPEN_EVENT, openDrawer);
    window.addEventListener(MOBILE_NAV_CLOSE_EVENT, closeDrawer);
    return () => {
      window.removeEventListener(MOBILE_NAV_OPEN_EVENT, openDrawer);
      window.removeEventListener(MOBILE_NAV_CLOSE_EVENT, closeDrawer);
    };
  }, []);

  // La barra inferior queda visible encima del menú y marca "Más" mientras está abierto.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(MOBILE_NAV_STATE_EVENT, { detail: open }));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">

      {/* Siempre montado (no `{open && ...}`) para que la transición tenga
       * de dónde animar. `inert` saca la pantalla cerrada del foco y del tacto. */}
      <div
        inert={!open}
        className={cn(
          // El pie deja libre la altura de la barra inferior (h-16), que queda visible encima.
          "fixed inset-0 z-50 flex flex-col overflow-y-auto bg-surface-1 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]",
          "transition-[opacity,transform] duration-300 ease-[var(--ease-out)]",
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
          className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 z-10 flex size-10 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        <div className="navy-card mx-4 mt-[calc(env(safe-area-inset-top)+3.5rem)] flex shrink-0 items-center gap-3 rounded-xl p-3.5 pr-14 text-white max-sm:pr-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-600 text-sm font-semibold text-[var(--on-accent)]">
            {initials(userName || workspaceName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-white">{userName || "Tu cuenta"}</p>
            <p className="truncate text-xs text-white/70">{roleLabel(role)}</p>
          </div>
          <Link
            href="/select-workspace"
            onClick={() => setOpen(false)}
            className="flex min-h-10 shrink-0 items-center rounded-md border border-white/20 px-3 text-sm font-medium text-white hover:bg-white/10"
          >
            Cambiar
          </Link>
        </div>

        <div className="relative mx-4 mt-4 shrink-0">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar sección"
            aria-label="Buscar sección"
            className="w-full rounded-full border border-border-default bg-surface-1 py-2.5 pr-3 pl-9 text-sm text-foreground placeholder:text-neutral-400 outline-none focus:border-accent-500"
          />
        </div>

        {!q && (
          <div className="grid grid-cols-4 gap-2 px-4 pt-4">
            {quick.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setOpen(false)}
                className="relative flex flex-col items-center gap-2 rounded-xl border border-border-default bg-surface-1 px-2 py-3 text-[13px] font-medium text-foreground"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-navy text-white">
                  <t.icon className="size-[18px]" aria-hidden="true" />
                </span>
                {t.label}
                {t.count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-error px-1.5 text-center text-[11px] leading-5 font-semibold text-white tabular-nums">
                    {t.count > 99 ? "99+" : t.count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        <nav className="flex flex-col px-4">
          {shownGroups.map((group) => (
            <div key={group.category} className="flex flex-col">
              <p role="presentation" className="pt-5 pb-2 text-[13px] font-medium text-neutral-500">
                {group.category}
              </p>
              <div className="divide-y divide-border-default overflow-hidden rounded-xl border border-border-default bg-surface-1">
                {group.items.map((item) => {
                  const isActive = isNavItemActive(pathname, item.href);
                  const Icon = item.icon;
                  const count = item.id === "inbox" ? counts.inbox : item.id === "collections" ? counts.overdue : 0;
                  const description = DESCRIPTIONS[item.id];
                  return (
                    <Link
                      key={item.id}
                      href={item.comingSoon ? "#" : item.href}
                      onClick={(e) => {
                        if (item.comingSoon) e.preventDefault();
                        else setOpen(false);
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 p-3.5",
                        item.comingSoon ? "cursor-default opacity-60" : "active:bg-surface-2",
                        isActive && "bg-accent-50",
                      )}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy text-white">
                        <Icon className="size-[18px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
                          <span className="truncate">{item.label}</span>
                          {item.isAI && !item.comingSoon && (
                            <Badge variant="success" className="px-1 py-0 text-[9px]">
                              IA
                            </Badge>
                          )}
                        </span>
                        {description && <span className="block truncate text-xs text-neutral-500">{description}</span>}
                      </span>
                      {item.comingSoon ? (
                        <Badge variant="neutral">Pronto</Badge>
                      ) : (
                        count > 0 && (
                          <span className="min-w-6 rounded-full bg-error px-2 text-center text-xs leading-6 font-semibold text-white tabular-nums">
                            {count > 99 ? "99+" : count}
                          </span>
                        )
                      )}
                      {!item.comingSoon && <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {shownGroups.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">No encontramos esa sección.</p>}
        </nav>

        <div className="mt-6 flex flex-col border-t border-border-default px-4 pt-2">
          <div className="flex min-h-12 items-center justify-between">
            <span className="text-sm text-foreground">Modo oscuro</span>
            <ThemeToggle />
          </div>
          <Link href="/profile" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 text-sm text-foreground">
            <UserCircle className="size-5 text-neutral-500" aria-hidden="true" />
            <span className="flex-1">Perfil</span>
            <ChevronRight className="size-4 text-neutral-400" aria-hidden="true" />
          </Link>
          <Link href="/settings" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 text-sm text-foreground">
            <Settings className="size-5 text-neutral-500" aria-hidden="true" />
            <span className="flex-1">Configuración</span>
            <ChevronRight className="size-4 text-neutral-400" aria-hidden="true" />
          </Link>
          {isPlatformAdmin && (
            <Link href="/crm?tab=agents" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 text-sm text-foreground">
              <ShieldCheck className="size-5 text-neutral-500" aria-hidden="true" />
              <span className="flex-1">Workspaces de clientes</span>
              <ChevronRight className="size-4 text-neutral-400" aria-hidden="true" />
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className="flex min-h-12 w-full items-center text-sm font-medium text-error-strong">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
