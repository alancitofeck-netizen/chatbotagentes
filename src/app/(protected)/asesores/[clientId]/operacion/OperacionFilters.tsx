"use client";

import { Search, Download } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { PERIOD_OPTIONS, type OperacionPeriod } from "./operacionHelpers";

export function OperacionFilters({
  period,
  onPeriodChange,
  search,
  onSearchChange,
  searchPlaceholder,
  onExport,
}: {
  period: OperacionPeriod;
  onPeriodChange: (period: OperacionPeriod) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select label="Período" value={period} onChange={(e) => onPeriodChange(e.target.value as OperacionPeriod)} containerClassName="w-auto">
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </Select>

      <div className="relative flex-1 min-w-[200px]">
        <label className="mb-1.5 block text-[13px] font-medium text-foreground">Buscar</label>
        <Search size={14} className="pointer-events-none absolute top-[38px] left-2.5 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-md border border-border-strong bg-surface-1 py-2 pr-3 pl-8 text-[13px] text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
      </div>

      <button
        type="button"
        onClick={onExport}
        className="flex h-[38px] items-center gap-1.5 rounded-full border border-border-default px-4 text-[13px] font-medium text-foreground hover:bg-surface-2"
      >
        <Download className="size-4" aria-hidden="true" />
        Exportar
      </button>
    </div>
  );
}
