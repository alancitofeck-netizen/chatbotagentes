"use client";

import { Search, Plus, Zap, KanbanSquare, Table as TableIcon, CalendarDays, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type CollectionsView = "table" | "kanban" | "calendar" | "priority";

export function CollectionsActionBar({
  view,
  onViewChange,
  search,
  onSearchChange,
  onNewCollection,
  onOpenAutomations,
}: {
  view: CollectionsView;
  onViewChange: (v: CollectionsView) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onNewCollection: () => void;
  onOpenAutomations: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative basis-full md:min-w-[220px] md:flex-1 md:basis-auto" data-tour="collections.search">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por cliente, aseguradora, póliza o ejecutivo…"
          className="w-full rounded-sm border border-border-strong bg-surface-1 py-2.5 pl-9 pr-3 text-base outline-none md:py-2 md:text-sm focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
      </div>

      <Button size="sm" onClick={onNewCollection} data-tour="collections.new-button" className="max-md:min-h-11">
        <Plus className="size-4" aria-hidden="true" />
        Nuevo cobro
      </Button>
      <Button size="sm" variant="secondary" onClick={onOpenAutomations} className="max-md:min-h-11">
        <Zap className="size-4" aria-hidden="true" />
        Automatizaciones
      </Button>

      <div className="ml-auto flex items-center gap-1 rounded-md border border-border-default bg-surface-1 p-1">
        <button
          type="button"
          data-tour="collections.table-view"
          onClick={() => onViewChange("table")}
          title="Tabla"
          className={`flex size-8 items-center justify-center rounded max-md:size-11 ${view === "table" ? "bg-accent-100 text-accent-700" : "text-neutral-400 hover:text-foreground"}`}
        >
          <TableIcon className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("kanban")}
          title="Kanban"
          className={`flex size-8 items-center justify-center rounded max-md:size-11 ${view === "kanban" ? "bg-accent-100 text-accent-700" : "text-neutral-400 hover:text-foreground"}`}
        >
          <KanbanSquare className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("calendar")}
          title="Calendario"
          className={`flex size-8 items-center justify-center rounded max-md:size-11 ${view === "calendar" ? "bg-accent-100 text-accent-700" : "text-neutral-400 hover:text-foreground"}`}
        >
          <CalendarDays className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          data-tour="collections.priority-view"
          onClick={() => onViewChange("priority")}
          title="Prioridad (IA)"
          className={`flex size-8 items-center justify-center rounded max-md:size-11 ${view === "priority" ? "bg-accent-100 text-accent-700" : "text-neutral-400 hover:text-foreground"}`}
        >
          <Sparkles className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
