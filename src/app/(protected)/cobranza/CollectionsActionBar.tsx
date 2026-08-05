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
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por cliente, aseguradora, póliza o ejecutivo…"
          className="w-full rounded-sm border border-border-strong bg-surface-1 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
      </div>

      <Button size="sm" onClick={onNewCollection}>
        <Plus className="size-4" aria-hidden="true" />
        Nuevo cobro
      </Button>
      <Button size="sm" variant="secondary" onClick={onOpenAutomations}>
        <Zap className="size-4" aria-hidden="true" />
        Automatizaciones
      </Button>

      <div className="ml-auto flex items-center gap-1 rounded-md border border-border-default bg-surface-1 p-1">
        <button
          type="button"
          onClick={() => onViewChange("table")}
          title="Tabla"
          className={`flex size-8 items-center justify-center rounded ${view === "table" ? "bg-accent-100 text-accent-700" : "text-neutral-400 hover:text-foreground"}`}
        >
          <TableIcon className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("kanban")}
          title="Kanban"
          className={`flex size-8 items-center justify-center rounded ${view === "kanban" ? "bg-accent-100 text-accent-700" : "text-neutral-400 hover:text-foreground"}`}
        >
          <KanbanSquare className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("calendar")}
          title="Calendario"
          className={`flex size-8 items-center justify-center rounded ${view === "calendar" ? "bg-accent-100 text-accent-700" : "text-neutral-400 hover:text-foreground"}`}
        >
          <CalendarDays className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("priority")}
          title="Prioridad (IA)"
          className={`flex size-8 items-center justify-center rounded ${view === "priority" ? "bg-accent-100 text-accent-700" : "text-neutral-400 hover:text-foreground"}`}
        >
          <Sparkles className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
