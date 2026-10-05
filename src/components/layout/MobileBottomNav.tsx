"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppWindow, CalendarClock, House, Menu, MessageCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { isNavItemActive } from "@/lib/navigation/sidebarConfig";
import { MOBILE_NAV_OPEN_EVENT } from "./mobileNavEvent";

interface BottomItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  moduleKey?: string;
}

/** Barra inferior del móvil: ManyChat, Mini apps, Inicio (orbe central), Agenda y
 * Más a la derecha. Si un módulo de la barra está apagado en el workspace, su
 * ítem se oculta; Más siempre queda. Inbox, CRM y el resto viven dentro de Más. */
const PRIMARY: BottomItem[] = [
  { key: "manychat", label: "ManyChat", href: "/manychat", icon: MessageCircle, moduleKey: "manychat" },
  { key: "mini-apps", label: "Mini apps", href: "/mini-apps", icon: AppWindow, moduleKey: "mini_apps" },
  { key: "dashboard", label: "Inicio", href: "/dashboard", icon: House },
  { key: "agenda", label: "Agenda", href: "/agenda", icon: CalendarClock, moduleKey: "agenda" },
];

/** Barra inferior sólo en mobile (md:hidden). "Más" abre el MobileNav existente
 * (drawer completo) vía un evento, para no tocar su estado interno. */
export function MobileBottomNav({ enabledModules }: { enabledModules: string[] }) {
  const pathname = usePathname();
  const enabled = new Set(enabledModules);
  const items = PRIMARY.filter((item) => !item.moduleKey || enabled.has(item.moduleKey));

  return (
    <nav
      data-mobile-bottom-nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-16" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          if (item.key === "dashboard") {
            // Inicio es el orbe central: sobresale de la barra, como en el prototipo.
            return (
              <li key={item.key} className="relative">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex h-full flex-col items-center justify-end gap-0.5 pb-1 text-[11px] font-semibold text-white/70"
                >
                  <span
                    className={cn(
                      "-mt-7 flex size-16 items-center justify-center rounded-full border-[5px] border-navy shadow-[0_10px_24px_-6px_rgba(0,0,0,0.5)] transition-colors",
                      active ? "bg-accent-500 text-navy" : "bg-white/10 text-white",
                    )}
                  >
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <span className={active ? "text-accent-500" : undefined}>{item.label}</span>
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
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-accent-500" : "text-white/60",
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
            className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-white/60"
          >
            <Menu className="size-5" aria-hidden="true" />
            Más
          </button>
        </li>
      </ul>
    </nav>
  );
}
