"use client";

import { useState } from "react";
import { Search, Plus, FileUp, Upload, Download, SlidersHorizontal, KanbanSquare, Table as TableIcon, CalendarDays, Zap } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { POLICY_STAGES, type InsuranceType } from "@/lib/policies/constants";
import { EMPTY_POLICIES_FILTERS, type PoliciesFilters } from "@/lib/policies/boardFilters";

const INSURANCE_TYPE_LABEL: Record<InsuranceType, string> = { auto: "Auto", hogar: "Hogar", vida: "Vida", otro: "Otro" };

export function PoliciesActionBar({
  view,
  onViewChange,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  companies,
  members,
  onNewPolicy,
  onUploadPdf,
  onOpenAutomations,
}: {
  view: "kanban" | "table" | "calendar";
  onViewChange: (v: "kanban" | "table" | "calendar") => void;
  search: string;
  onSearchChange: (v: string) => void;
  filters: PoliciesFilters;
  onFiltersChange: (f: PoliciesFilters) => void;
  companies: string[];
  members: WorkspaceMemberOption[];
  onNewPolicy: () => void;
  onUploadPdf: () => void;
  onOpenAutomations: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  function setFilter<K extends keyof PoliciesFilters>(key: K, value: PoliciesFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por número, cliente, aseguradora, ramo, ejecutivo o teléfono…"
            className="w-full rounded-sm border border-border-strong bg-surface-1 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>

        <Button size="sm" onClick={onNewPolicy}>
          <Plus className="size-4" aria-hidden="true" />
          Nueva póliza
        </Button>
        <Button size="sm" variant="secondary" onClick={onUploadPdf}>
          <FileUp className="size-4" aria-hidden="true" />
          Subir PDF
        </Button>
        <Button size="sm" variant="secondary" disabled title="Importar Excel — próximamente">
          <Upload className="size-4" aria-hidden="true" />
          Importar Excel
        </Button>
        <Button size="sm" variant="secondary" disabled title="Exportar — próximamente">
          <Download className="size-4" aria-hidden="true" />
          Exportar
        </Button>
        <Button size="sm" variant={filtersOpen ? "primary" : "secondary"} onClick={() => setFiltersOpen((v) => !v)}>
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
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
        </div>
      </div>

      {filtersOpen && (
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border-default bg-surface-1 p-3 sm:grid-cols-4">
          <Select label="Estado" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">Todos</option>
            {POLICY_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select label="Ramo" value={filters.insuranceType} onChange={(e) => setFilter("insuranceType", e.target.value as InsuranceType | "")}>
            <option value="">Todos</option>
            {(Object.keys(INSURANCE_TYPE_LABEL) as InsuranceType[]).map((t) => (
              <option key={t} value={t}>
                {INSURANCE_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select label="Aseguradora" value={filters.company} onChange={(e) => setFilter("company", e.target.value)}>
            <option value="">Todas</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select label="Ejecutivo" value={filters.ownerName} onChange={(e) => setFilter("ownerName", e.target.value)}>
            <option value="">Todos</option>
            {members.map((m) => (
              <option key={m.memberId} value={m.fullName}>
                {m.fullName}
              </option>
            ))}
          </Select>
          <div className="col-span-full flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => onFiltersChange(EMPTY_POLICIES_FILTERS)}>
              Limpiar filtros
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
