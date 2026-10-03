"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Inbox, Kanban, LayoutDashboard, Menu, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { isNavItemActive } from "@/lib/navigation/sidebarConfig";
import { MOBILE_NAV_OPEN_EVENT } from "./mobileNavEvent";

interface BottomItem {
  label: string;
  href: string;
  icon: LucideIcon;
  moduleKey?: string;
}

const ITEMS: BottomItem[] = [
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "CRM", href: "/crm", icon: Kanban, moduleKey: "crm" },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/agenda", icon: CalendarClock, moduleKey: "agenda" },
];

/** Barra inferior sólo en mobile (md:hidden). Respeta los módulos habilitados
 * del workspace: un módulo apagado no aparece. "Más" abre el MobileNav
 * existente (drawer completo) vía un evento, para no tocar su estado interno. */
export function MobileBottomNav({ enabledModules }: { enabledModules: string[] }) {
  const pathname = usePathname();
  const enabled = new Set(enabledModules);
  const visible = ITEMS.filter((item) => !item.moduleKey || enabled.has(item.moduleKey));

  return (
    <nav
      data-mobile-bottom-nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-surface-1 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-16" style={{ gridTemplateColumns: `repeat(${visible.length + 1}, minmax(0, 1fr))` }}>
        {visible.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-accent-600" : "text-neutral-500",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
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
