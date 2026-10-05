"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, Search, Settings, UserCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { signOut } from "@/app/(protected)/actions";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import { cn } from "@/lib/utils/cn";
import { getSidebarNavItems, groupNavItems, isNavItemActive } from "@/lib/navigation/sidebarConfig";
import { MOBILE_NAV_OPEN_EVENT } from "./mobileNavEvent";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GL";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Pantalla "Más" de mobile (md:hidden): perfil y workspace, todos los módulos
 * en grilla de 3 agrupados por sección, y abajo modo oscuro, perfil,
 * configuración y cerrar sesión. Se abre desde la pestaña "Más" de la barra
 * inferior (evento) o desde el botón de menú del header. */
export function MobileNav({
  enabledModules,
  userName,
  workspaceName,
}: {
  enabledModules: string[];
  userName: string;
  workspaceName: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const groups = groupNavItems(getSidebarNavItems(new Set(enabledModules)));
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shownGroups = q
    ? groups.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) })).filter((g) => g.items.length > 0)
    : groups;

  useEffect(() => {
    const openDrawer = () => setOpen(true);
    window.addEventListener(MOBILE_NAV_OPEN_EVENT, openDrawer);
    return () => window.removeEventListener(MOBILE_NAV_OPEN_EVENT, openDrawer);
  }, []);

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="flex size-9 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground max-md:size-11"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {/* Siempre montado (no `{open && ...}`) para que la transición tenga
       * de dónde animar. `inert` saca la pantalla cerrada del foco y del tacto. */}
      <div
        inert={!open}
        className={cn(
          "fixed inset-0 z-50 flex flex-col overflow-y-auto bg-surface-1 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]",
          "transition-[opacity,transform] duration-300 ease-[var(--ease-out)]",
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <h2 className="text-xl font-semibold text-foreground">Más</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="flex size-11 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="navy-card mx-4 flex shrink-0 items-center gap-3 rounded-lg p-3 text-white">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-600 text-sm font-semibold text-[var(--on-accent)]">
            {initials(userName || workspaceName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{userName || "Tu cuenta"}</p>
            <p className="truncate text-xs text-white/60">{workspaceName}</p>
          </div>
          <Link href="/select-workspace" onClick={() => setOpen(false)} className="flex min-h-10 shrink-0 items-center rounded-md border border-white/20 px-3 text-sm font-medium text-white hover:bg-white/10">
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

        <nav className="flex flex-col px-4">
          {shownGroups.map((group) => (
            <div key={group.category} className="flex flex-col">
              <p role="presentation" className="pb-2 pt-5 text-[13px] font-medium text-neutral-500">
                {group.category}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {group.items.map((item) => {
                  const isActive = isNavItemActive(pathname, item.href);
                  const Icon = item.icon;
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
                        "relative flex min-h-[92px] flex-col items-start justify-between rounded-2xl border border-border-default p-3 text-left",
                        item.comingSoon ? "cursor-default opacity-60" : "active:bg-surface-2",
                        isActive && "border-accent-500 bg-accent-50",
                      )}
                    >
                      <span className="flex size-9 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                        <Icon className="size-[18px]" aria-hidden="true" />
                      </span>
                      <span className="text-[13px] font-medium leading-tight text-foreground">
                        {item.label}
                        {item.isAI && !item.comingSoon && (
                          <Badge variant="success" className="ml-1 px-1 py-0 text-[9px]">
                            IA
                          </Badge>
                        )}
                      </span>
                      {item.comingSoon && (
                        <Badge variant="neutral" className="absolute right-2 top-2">
                          Pronto
                        </Badge>
                      )}
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
