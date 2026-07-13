import { Bell, Search } from "lucide-react";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import { MobileNav } from "./MobileNav";

interface NavbarProps {
  workspaceName: string;
  enabledModules: string[];
}

/** Search + notifications are decorative for now (docs/blueprint/14-design-system.md
 * §10 update, 2026-07-09) — neither global search nor a notifications system
 * exists yet, same "don't fake it" posture as the rest of the app's
 * not-yet-connected features (Inbox's WhatsApp banner, Automatizaciones,
 * Prompt Builder). `UserMenu` moved to the Sidebar's floating dock footer. */
export function Navbar({ workspaceName, enabledModules }: NavbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <MobileNav enabledModules={enabledModules} />
        <span className="truncate text-sm font-medium text-neutral-500">{workspaceName}</span>
      </div>
      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="relative w-full max-w-xs" title="Búsqueda global — próximamente">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="search"
            placeholder="Buscar…"
            className="w-full rounded-full border border-border-default bg-surface-2 py-2 pl-9 pr-4 text-sm outline-none transition-colors duration-[var(--duration-fast)] focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>
        <button
          type="button"
          title="Notificaciones — próximamente"
          aria-label="Notificaciones"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors duration-[var(--duration-fast)] hover:bg-surface-2 hover:text-foreground"
        >
          <Bell size={17} aria-hidden="true" />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
