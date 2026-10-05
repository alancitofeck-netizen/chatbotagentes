"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, CircleDollarSign, Inbox, Kanban, LayoutDashboard, ListTodo, Menu, FileCheck2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { isNavItemActive } from "@/lib/navigation/sidebarConfig";
import { getInboxUnreadTotalAction } from "@/lib/inbox/actions";
import { MOBILE_NAV_OPEN_EVENT } from "./mobileNavEvent";

interface BottomItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  moduleKey?: string;
}

const PRIMARY: BottomItem[] = [
  { key: "inbox", label: "Inbox", href: "/inbox", icon: Inbox },
  { key: "crm", label: "CRM", href: "/crm", icon: Kanban, moduleKey: "crm" },
  { key: "dashboard", label: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { key: "agenda", label: "Agenda", href: "/agenda", icon: CalendarClock, moduleKey: "agenda" },
];

/** Si un módulo de la barra está apagado en el workspace, se reemplaza por el
 * siguiente disponible de esta lista, hasta completar 4 ítems. */
const FALLBACK: BottomItem[] = [
  { key: "tasks", label: "Tareas", href: "/tasks", icon: ListTodo, moduleKey: "tasks" },
  { key: "policies", label: "Pólizas", href: "/polizas", icon: FileCheck2, moduleKey: "policies" },
  { key: "collections", label: "Cobranza", href: "/cobranza", icon: CircleDollarSign, moduleKey: "collections" },
];

const SLOTS = 4;

function pickItems(enabled: Set<string>): BottomItem[] {
  const isOn = (item: BottomItem) => !item.moduleKey || enabled.has(item.moduleKey);
  const picked = PRIMARY.filter(isOn);
  for (const item of FALLBACK) {
    if (picked.length >= SLOTS) break;
    if (isOn(item)) picked.push(item);
  }
  return picked.slice(0, SLOTS);
}

/** Barra inferior sólo en mobile (md:hidden). "Más" abre el MobileNav existente
 * (drawer completo) vía un evento, para no tocar su estado interno. El badge de
 * Inbox es el total real de no leídos del workspace; se refresca al volver a
 * primer plano y cada minuto. */
export function MobileBottomNav({ enabledModules }: { enabledModules: string[] }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const items = pickItems(new Set(enabledModules));

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getInboxUnreadTotalAction()
        .then((n) => {
          if (!cancelled) setUnread(n);
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <nav
      data-mobile-bottom-nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-surface-1 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-16" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          if (item.key === "dashboard") {
            // Inicio es el orbe central del prototipo: sobresale de la barra.
            return (
              <li key={item.key} className="relative">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full flex-col items-center justify-end gap-0.5 pb-2 text-[11px] font-semibold",
                    active ? "text-accent-600" : "text-neutral-500",
                  )}
                >
                  <span
                    className={cn(
                      "-mt-7 flex size-16 items-center justify-center rounded-full border-[5px] border-background shadow-[0_10px_24px_-6px_rgba(14,22,48,0.45)] transition-colors",
                      active ? "bg-accent-600 text-[var(--on-accent)]" : "bg-navy text-white",
                    )}
                  >
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          }
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-accent-600" : "text-neutral-500",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
                {item.key === "inbox" && unread > 0 && (
                  <span className="absolute top-1.5 left-1/2 ml-2.5 min-w-4 rounded-full bg-accent-600 px-1 text-center text-[10px] leading-4 font-semibold text-[var(--on-accent)]">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(MOBILE_NAV_OPEN_EVENT))}
            className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-neutral-500"
          >
            <Menu className="size-5" aria-hidden="true" />
            Más
          </button>
        </li>
      </ul>
    </nav>
  );
}
