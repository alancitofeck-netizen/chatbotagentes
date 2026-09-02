"use client";

import { useState } from "react";
import {
  Search,
  Plus,
  Upload,
  Download,
  ListChecks,
  SlidersHorizontal,
  KanbanSquare,
  Table as TableIcon,
  Rows3,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { OpportunityTag, PipelineStage } from "@/lib/crm/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { ContextualHint } from "@/components/onboarding/ContextualHint";

export interface BoardFilters {
  agentId: string;
  stageId: string;
  priority: string;
  source: string;
  company: string;
  tagId: string;
  supervisorId: string;
  valueMin: string;
  valueMax: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: BoardFilters = {
  agentId: "",
  stageId: "",
  priority: "",
  source: "",
  company: "",
  tagId: "",
  supervisorId: "",
  valueMin: "",
  valueMax: "",
  dateFrom: "",
  dateTo: "",
};

export type SortOption = "date_desc" | "value_desc" | "probability_desc" | "name_asc";
export type BoardView = "kanban" | "table" | "list";

const VIEW_OPTIONS: { key: BoardView; label: string; icon: typeof TableIcon }[] = [
  { key: "kanban", label: "Kanban", icon: KanbanSquare },
  { key: "table", label: "Tabla", icon: TableIcon },
  { key: "list", label: "Lista", icon: Rows3 },
];

const pillButton =
  "flex items-center gap-1.5 rounded-full border border-border-default bg-surface-1 px-3 py-1.5 text-[13px] font-medium text-foreground hover:border-border-strong";

export function BoardActionBar({
  view,
  onViewChange,
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  filters,
  onFiltersChange,
  stages,
  members,
  supervisors,
  tags,
  sources,
  companies,
  selectionMode,
  onToggleSelectionMode,
  selectedCount,
  onNewLead,
  onImport,
  onExport,
  onBulkMoveStage,
  onBulkAssignOwner,
  onBulkAddTag,
  onBulkDelete,
}: {
  view: BoardView;
  onViewChange: (v: BoardView) => void;
  search: string;
  onSearchChange: (v: string) => void;
  sortBy: SortOption;
  onSortChange: (v: SortOption) => void;
  filters: BoardFilters;
  onFiltersChange: (f: BoardFilters) => void;
  stages: PipelineStage[];
  members: WorkspaceMemberOption[];
  supervisors: WorkspaceMemberOption[];
  tags: OpportunityTag[];
  sources: string[];
  companies: string[];
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  selectedCount: number;
  onNewLead: () => void;
  onImport: () => void;
  onExport: () => void;
  onBulkMoveStage: (stageId: string) => void;
  onBulkAssignOwner: (ownerId: string | null) => void;
  onBulkAddTag: (tagId: string) => void;
  onBulkDelete: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  function setFilter<K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar leads…"
            className="w-full rounded-full border border-border-default bg-surface-1 py-1.5 pl-9 pr-3 text-[13px] outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>

        <Button size="sm" onClick={onNewLead} data-tour="crm.new-lead-button">
          <Plus className="size-4" aria-hidden="true" />
          Nuevo lead
        </Button>

        <ContextualHint
          hintKey="crm-filters-first-use"
          title="🔎 ¿Primera vez usando filtros?"
          description="Te mostramos rápidamente cómo funcionan."
          onShowMe={() => setFiltersOpen(true)}
        >
          <button type="button" onClick={() => setFiltersOpen((v) => !v)} className={`${pillButton} ${filtersOpen ? "border-accent-500 bg-accent-50 text-accent-700" : ""}`}>
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </button>
        </ContextualHint>

        <button type="button" onClick={onImport} className={pillButton} title="Importar leads desde CSV">
          <Upload className="size-3.5" aria-hidden="true" />
          Importar
        </button>
        <button type="button" onClick={onExport} className={pillButton} title="Exportar leads a CSV">
          <Download className="size-3.5" aria-hidden="true" />
          Exportar
        </button>
        <button
          type="button"
          onClick={onToggleSelectionMode}
          className={`${pillButton} ${selectionMode ? "border-accent-500 bg-accent-50 text-accent-700" : ""}`}
        >
          <ListChecks className="size-3.5" aria-hidden="true" />
          Acciones masivas
        </button>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="rounded-full border border-border-default bg-surface-1 px-3 py-1.5 text-[13px] text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          >
            <option value="date_desc">Más recientes</option>
            <option value="value_desc">Mayor valor</option>
            <option value="probability_desc">Mayor probabilidad</option>
            <option value="name_asc">Nombre (A-Z)</option>
          </select>

          <div className="flex items-center gap-0.5 rounded-full border border-border-default bg-surface-1 p-0.5">
            {VIEW_OPTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => onViewChange(key)}
                title={label}
                aria-label={label}
                aria-pressed={view === key}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium ${
                  view === key ? "bg-accent-100 text-accent-700" : "text-neutral-500 hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectionMode && selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-sm shadow-[var(--elevation-xs)]">
          <span className="font-semibold text-accent-700">{selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}</span>
          <div className="h-4 w-px bg-accent-200" />
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onBulkMoveStage(e.target.value);
              e.target.value = "";
            }}
            className="rounded-full border border-border-strong bg-surface-1 px-2.5 py-1 text-xs outline-none"
          >
            <option value="" disabled>
              Mover a etapa…
            </option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={(e) => {
              onBulkAssignOwner(e.target.value || null);
              e.target.value = "";
            }}
            className="rounded-full border border-border-strong bg-surface-1 px-2.5 py-1 text-xs outline-none"
          >
            <option value="" disabled>
              Asignar agente…
            </option>
            <option value="">Sin asignar</option>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.fullName}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onBulkAddTag(e.target.value);
              e.target.value = "";
            }}
            className="rounded-full border border-border-strong bg-surface-1 px-2.5 py-1 text-xs outline-none"
          >
            <option value="" disabled>
              Etiquetar…
            </option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={onBulkDelete} className="ml-auto flex items-center gap-1 text-xs font-medium text-error-strong hover:underline">
            <Trash2 className="size-3.5" aria-hidden="true" />
            Eliminar
          </button>
        </div>
      )}

      {filtersOpen && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border-default bg-surface-1 p-3 sm:grid-cols-3 xl:grid-cols-5">
          <Select label="Etapa" value={filters.stageId} onChange={(e) => setFilter("stageId", e.target.value)}>
            <option value="">Todas</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select label="Agente" value={filters.agentId} onChange={(e) => setFilter("agentId", e.target.value)}>
            <option value="">Todos</option>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.fullName}
              </option>
            ))}
          </Select>
          <Select label="Supervisor" value={filters.supervisorId} onChange={(e) => setFilter("supervisorId", e.target.value)}>
            <option value="">Todos</option>
            {supervisors.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.fullName}
              </option>
            ))}
          </Select>
          <Select label="Prioridad" value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)}>
            <option value="">Todas</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </Select>
          <Select label="Empresa" value={filters.company} onChange={(e) => setFilter("company", e.target.value)}>
            <option value="">Todas</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select label="Origen" value={filters.source} onChange={(e) => setFilter("source", e.target.value)}>
            <option value="">Todos</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select label="Etiqueta" value={filters.tagId} onChange={(e) => setFilter("tagId", e.target.value)}>
            <option value="">Todas</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Input label="Valor mín." type="number" value={filters.valueMin} onChange={(e) => setFilter("valueMin", e.target.value)} />
          <Input label="Valor máx." type="number" value={filters.valueMax} onChange={(e) => setFilter("valueMax", e.target.value)} />
          <Input label="Desde" type="date" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} />
          <Input label="Hasta" type="date" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} />
          <div className="flex items-end">
            <Button size="sm" variant="ghost" onClick={() => onFiltersChange(EMPTY_FILTERS)}>
              Limpiar filtros
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
