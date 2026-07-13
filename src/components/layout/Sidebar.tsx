"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookUser,
  CalendarDays,
  Inbox,
  Kanban,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  SquareUser,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { UserMenu } from "@/components/layout/UserMenu";
import { cn } from "@/lib/utils/cn";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}

/** CRM/ATS become real links once workspace_modules.enabled is true for that
 * workspace (docs/blueprint/03-modules.md) — the (protected) layout fetches
 * that server-side and passes it down, this is the only place that decides
 * comingSoon vs. a real href. */
export function getNavItems(enabledModules: ReadonlySet<string>): NavItem[] {
  return [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Inbox", href: "/inbox", icon: Inbox, comingSoon: false },
    { label: "Contactos", href: "/contacts", icon: BookUser, comingSoon: false },
    { label: "Calendario", href: "/calendar", icon: CalendarDays, comingSoon: false },
    { label: "CRM", href: "/crm", icon: Kanban, comingSoon: !enabledModules.has("crm") },
    { label: "ATS", href: "/ats", icon: SquareUser, comingSoon: !enabledModules.has("ats") },
    { label: "Asesores", href: "/advisors", icon: ShieldCheck, comingSoon: !enabledModules.has("advisors") },
    { label: "Automatizaciones", href: "/automations", icon: Workflow },
    { label: "Configuración", href: "/settings", icon: Settings },
  ];
}

/** Floating icon-only dock (docs/blueprint/14-design-system.md §10, updated
 * 2026-07-09) — permanently icon-only, no expand/collapse-to-text state
 * (the reference never shows labels in the rail); item labels are only
 * exposed via native `title` on hover. */
export function Sidebar({
  enabledModules,
  userName,
  userEmail,
}: {
  enabledModules: string[];
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const navItems = getNavItems(new Set(enabledModules));

  return (
    <aside className="hidden shrink-0 py-3 pl-3 md:flex">
      <div className="flex w-16 flex-col items-center gap-2 rounded-[28px] bg-neutral-950 py-4 shadow-[var(--elevation-md)]">
        <span
          className="flex size-8 items-center justify-center rounded-[8px] bg-accent-500 text-xs font-semibold text-white"
          aria-hidden="true"
        >
          G
        </span>

        <nav className="mt-4 flex flex-1 flex-col gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.comingSoon ? "#" : item.href}
                aria-disabled={item.comingSoon}
                aria-current={isActive ? "page" : undefined}
                title={item.comingSoon ? `${item.label} (Pronto)` : item.label}
                onClick={(e) => item.comingSoon && e.preventDefault()}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                  item.comingSoon
                    ? "cursor-default text-neutral-600"
                    : isActive
                      ? "bg-white text-neutral-950"
                      : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
                )}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
              </Link>
            );
          })}
        </nav>

        <UserMenu name={userName} email={userEmail} variant="sidebar" />
      </div>
    </aside>
  );
}
