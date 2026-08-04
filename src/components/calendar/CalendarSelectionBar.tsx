"use client";

import { Trash2 } from "lucide-react";

/** Bulk-selection bar for the Calendar — mirrors CRM's BoardActionBar bulk
 * row (same "count pill + text actions" language), but renders as soon as
 * selection mode is on (not only once something is selected), so
 * "Seleccionar todos visibles" stays discoverable at 0 selected. */
export function CalendarSelectionBar({
  selectedCount,
  onSelectAllVisible,
  onDeselectAll,
  onBulkDelete,
}: {
  selectedCount: number;
  onSelectAllVisible: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border-default bg-blue-50 px-6 py-2.5 text-sm">
      <span className="font-medium text-blue-700">{selectedCount} seleccionado(s)</span>
      <button type="button" onClick={onSelectAllVisible} className="text-xs font-medium text-blue-700 hover:underline">
        Seleccionar todos visibles
      </button>
      <button
        type="button"
        onClick={onDeselectAll}
        disabled={selectedCount === 0}
        className="text-xs font-medium text-neutral-500 hover:underline disabled:pointer-events-none disabled:opacity-40"
      >
        Deseleccionar todos
      </button>
      {selectedCount > 0 && (
        <button
          type="button"
          onClick={onBulkDelete}
          className="ml-auto flex items-center gap-1 text-xs font-medium text-error-strong hover:underline"
        >
          <Trash2 size={14} aria-hidden="true" />
          Eliminar
        </button>
      )}
    </div>
  );
}
