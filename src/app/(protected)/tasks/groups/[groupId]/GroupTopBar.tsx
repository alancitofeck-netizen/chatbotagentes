"use client";

import { Archive, ArchiveRestore, Copy, Download, Settings, Share2, Star } from "lucide-react";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { cn } from "@/lib/utils/cn";
import type { TaskGroup } from "@/lib/tasks/groups/queries";

/** Barra superior de la página de grupo — Favorito/Duplicar/Archivar son
 * acciones reales; Compartir queda deshabilitado a propósito (no existe
 * sistema de permisos/colaboración todavía, ver nota de Escalabilidad). */
export function GroupTopBar({
  group,
  onToggleFavorite,
  onArchiveToggle,
  onDuplicate,
  onConfigure,
}: {
  group: TaskGroup;
  onToggleFavorite: () => void;
  onArchiveToggle: () => void;
  onDuplicate: () => void;
  onConfigure: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onToggleFavorite}
        title={group.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
        className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-2 hover:text-warning-strong"
      >
        <Star size={16} className={cn(group.isFavorite && "fill-warning-strong text-warning-strong")} aria-hidden="true" />
      </button>

      <button
        type="button"
        disabled
        title="Compartir — próximamente"
        className="flex size-8 cursor-not-allowed items-center justify-center rounded-md text-neutral-300"
      >
        <Share2 size={16} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onDuplicate}
        title="Duplicar grupo"
        className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
      >
        <Copy size={16} aria-hidden="true" />
      </button>

      <DropdownMenu
        trigger={<Download size={16} aria-hidden="true" />}
        triggerLabel="Exportar"
        triggerClassName="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
        items={[
          { label: "Exportar CSV", onSelect: () => window.open(`/api/tasks/groups/${group.id}/export?format=csv`, "_blank") },
          { label: "Exportar Excel", onSelect: () => window.open(`/api/tasks/groups/${group.id}/export?format=xlsx`, "_blank") },
          { label: "Exportar PDF", onSelect: () => window.open(`/api/tasks/groups/${group.id}/export?format=pdf`, "_blank") },
        ]}
      />

      <button
        type="button"
        onClick={onArchiveToggle}
        title={group.isArchived ? "Desarchivar" : "Archivar"}
        className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
      >
        {group.isArchived ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
      </button>

      <button
        type="button"
        onClick={onConfigure}
        title="Configuración"
        className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
      >
        <Settings size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
