"use client";

import { ChevronDown, FolderPlus, LayoutTemplate, Plus, FolderClosed } from "lucide-react";
import { DropdownMenu } from "@/components/ui/DropdownMenu";

/** "Nuevo" button (Sección "Crear un Grupo" del rediseño Grupos) — at the
 * Workspace-root level this creates organizational containers, not tasks
 * directly. Task creation now happens inside a group's own board (Sección
 * "Primero entra al grupo, y recién ahí gestiona sus tareas"). */
export function NewItemMenu({ onNewGroup, onNewTemplate }: { onNewGroup: () => void; onNewTemplate: () => void }) {
  return (
    <DropdownMenu
      align="start"
      trigger={
        <>
          <Plus size={15} aria-hidden="true" />
          Nuevo
          <ChevronDown size={14} aria-hidden="true" />
        </>
      }
      triggerClassName="flex items-center gap-1.5 rounded-md bg-accent-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-600"
      items={[
        { label: "Nuevo grupo de tareas", icon: <FolderPlus size={15} aria-hidden="true" />, onSelect: onNewGroup },
        { label: "Nueva plantilla", icon: <LayoutTemplate size={15} aria-hidden="true" />, onSelect: onNewTemplate },
        { label: "Nueva carpeta (a futuro)", icon: <FolderClosed size={15} aria-hidden="true" />, onSelect: () => {}, disabled: true },
      ]}
    />
  );
}
