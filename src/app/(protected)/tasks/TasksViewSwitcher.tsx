"use client";

import Link from "next/link";
import { CalendarDays, GalleryVerticalEnd, GanttChartSquare, KanbanSquare, List, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type TasksView = "list" | "table" | "kanban" | "calendar";

const VIEWS: { key: TasksView; label: string; icon: typeof List }[] = [
  { key: "list", label: "Lista", icon: List },
  { key: "table", label: "Tabla", icon: TableIcon },
  { key: "kanban", label: "Kanban", icon: KanbanSquare },
  { key: "calendar", label: "Calendario", icon: CalendarDays },
];

/** Timeline/Galería — same "visible but disabled, título con 'próximamente'"
 * pattern already established by CRM board's BoardActionBar.tsx DISABLED_VIEWS,
 * for future implementation per the redesign's explicit scope. */
const DISABLED_VIEWS: { label: string; icon: typeof List }[] = [
  { label: "Timeline", icon: GanttChartSquare },
  { label: "Galería", icon: GalleryVerticalEnd },
];

/** URL-driven view state (?view=), same convention as Calendar/CRM board —
 * a real <Link> instead of a client-side setState so deep links land
 * correctly and back/forward navigation works. */
export function TasksViewSwitcher({ view, buildHref }: { view: TasksView; buildHref: (view: TasksView) => string }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border-default bg-surface-1 p-1">
      {VIEWS.map(({ key, label, icon: Icon }) => (
        <Link
          key={key}
          href={buildHref(key)}
          title={label}
          className={cn(
            "flex size-8 items-center justify-center rounded",
            view === key ? "bg-accent-100 text-accent-700" : "text-neutral-400 hover:text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </Link>
      ))}
      {DISABLED_VIEWS.map(({ label, icon: Icon }) => (
        <button
          key={label}
          type="button"
          disabled
          title={`${label} — próximamente`}
          className="flex size-8 cursor-not-allowed items-center justify-center rounded text-neutral-300"
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
