"use client";

import { CheckSquare, ChevronDown, FileText, Folder, Layout, Plus, StickyNote } from "lucide-react";
import { DropdownMenu } from "@/components/ui/DropdownMenu";

/** "Nuevo" button (Sección 8 del rediseño) — first use of DropdownMenu as a
 * creation menu in this project (its other call sites are all "⋮" context
 * menus). Only "Nueva tarea" is wired to real logic today; the rest are
 * disabled per the redesign's explicit scope. */
export function NewItemMenu({ onNewTask }: { onNewTask: () => void }) {
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
        { label: "Nueva tarea", icon: <CheckSquare size={15} aria-hidden="true" />, onSelect: onNewTask },
        { label: "Nueva nota", icon: <StickyNote size={15} aria-hidden="true" />, onSelect: () => {}, disabled: true },
        { label: "Nuevo documento", icon: <FileText size={15} aria-hidden="true" />, onSelect: () => {}, disabled: true },
        { label: "Nuevo proyecto", icon: <Layout size={15} aria-hidden="true" />, onSelect: () => {}, disabled: true },
        { label: "Nueva carpeta", icon: <Folder size={15} aria-hidden="true" />, onSelect: () => {}, disabled: true },
        { label: "Nueva plantilla", icon: <FileText size={15} aria-hidden="true" />, onSelect: () => {}, disabled: true },
      ]}
    />
  );
}
