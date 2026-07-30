"use client";

import Link from "next/link";
import { Folder, LayoutGrid, Lightbulb, ListTodo, Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type TasksQuickView = "all" | "favorites" | "mine" | "today" | "week";

const QUICK_VIEWS: { key: TasksQuickView; label: string; icon: typeof ListTodo }[] = [
  { key: "mine", label: "Mis tareas", icon: ListTodo },
  { key: "today", label: "Hoy", icon: ListTodo },
  { key: "week", label: "Esta semana", icon: ListTodo },
  { key: "favorites", label: "Favoritos", icon: Star },
];

/** Sidebar bundled inside the Tasks/Workspace module (not the app's global
 * Sidebar.tsx) — same structural pattern as CalendarSidebar.tsx: a flex
 * sibling of the main content, filters owned/controlled by the parent shell.
 * "Mis tareas"/"Hoy"/"Esta semana"/"Favoritos" are real client-side filters
 * over the already-fetched task list (TasksModuleShell). "Proyectos"/
 * "Documentación"/"Ideas"/"Plantillas" are deliberately inert — Sección 6
 * del rediseño explicitly scopes these as UI-only for now. */
export function TasksSidebar({
  isHome,
  activeQuickView,
  buildQuickHref,
}: {
  isHome: boolean;
  activeQuickView: TasksQuickView;
  buildQuickHref: (quick: TasksQuickView) => string;
}) {
  return (
    <aside className="hidden w-[240px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-border-default bg-surface-2/60 p-4 lg:flex">
      <div className="flex flex-col gap-1">
        <h3 className="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Workspace</h3>
        <Link
          href="/tasks"
          className={cn(
            "rounded-md px-2.5 py-1.5 text-[13px] font-medium",
            isHome ? "bg-accent-100 text-accent-700" : "text-foreground hover:bg-surface-3",
          )}
        >
          🏠 Inicio
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Vistas rápidas</h3>
        {QUICK_VIEWS.map(({ key, label }) => (
          <Link
            key={key}
            href={buildQuickHref(key)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[13px] font-medium",
              !isHome && activeQuickView === key ? "bg-accent-100 text-accent-700" : "text-foreground hover:bg-surface-3",
            )}
          >
            {key === "favorites" ? "⭐" : "📄"} {label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Espacio</h3>
        {[
          { label: "Proyectos", icon: LayoutGrid },
          { label: "Documentación", icon: Folder },
          { label: "Ideas", icon: Lightbulb },
          { label: "Plantillas", icon: Folder },
        ].map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            disabled
            title={`${label} — próximamente`}
            className="flex cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-neutral-400"
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </aside>
  );
}
