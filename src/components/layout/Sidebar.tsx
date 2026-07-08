"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  Kanban,
  LayoutDashboard,
  SquareUser,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";

const SIDEBAR_STORAGE_KEY = "gl-sidebar-collapsed";

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
    { label: "CRM", href: "/crm", icon: Kanban, comingSoon: !enabledModules.has("crm") },
    { label: "ATS", href: "/ats", icon: SquareUser, comingSoon: !enabledModules.has("ats") },
    { label: "Automatizaciones", href: "#", icon: Workflow, comingSoon: true },
  ];
}

const collapsedListeners = new Set<() => void>();

function subscribeCollapsed(callback: () => void) {
  collapsedListeners.add(callback);
  return () => collapsedListeners.delete(callback);
}

function getCollapsedSnapshot(): boolean {
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

// Same reasoning as ThemeProvider: the server always reports "expanded" (it
// has no localStorage to read), and useSyncExternalStore reconciles that
// against the real client value without a hydration mismatch.
function getCollapsedServerSnapshot(): boolean {
  return false;
}

export function Sidebar({ enabledModules }: { enabledModules: string[] }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );
  const navItems = getNavItems(new Set(enabledModules));

  function toggle() {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!collapsed));
    collapsedListeners.forEach((listener) => listener());
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col gap-1 border-r border-border-default bg-surface-1 py-4 transition-[width] duration-[var(--duration-base)] ease-[var(--ease-out)] md:flex",
        collapsed ? "w-[64px]" : "w-[240px]",
      )}
    >
      <div className={cn("mb-4 flex items-center px-4", collapsed && "justify-center px-0")}>
        {collapsed ? (
          <span className="flex size-6 items-center justify-center rounded-[6px] bg-accent-500 text-xs font-semibold text-white">
            G
          </span>
        ) : (
          <Logo />
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.comingSoon ? "#" : item.href}
              aria-disabled={item.comingSoon}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                collapsed && "justify-center px-0",
                item.comingSoon
                  ? "cursor-default text-neutral-400"
                  : isActive
                    ? "bg-surface-2 text-foreground"
                    : "text-neutral-500 hover:bg-surface-2 hover:text-foreground",
              )}
              onClick={(e) => item.comingSoon && e.preventDefault()}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && item.comingSoon && (
                <Badge variant="neutral" className="ml-auto">
                  Pronto
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn("px-2", collapsed && "flex justify-center px-0")}>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-500 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-2 hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-[18px]" aria-hidden="true" />
          ) : (
            <ChevronsLeft className="size-[18px]" aria-hidden="true" />
          )}
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
