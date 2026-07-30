"use client";

import { FileText, ListChecks, ListTodo, MessageCircle, Sparkles, TextCursorInput, Wand2, X } from "lucide-react";

const ACTIONS: { label: string; icon: typeof Sparkles }[] = [
  { label: "Resumir", icon: FileText },
  { label: "Crear checklist", icon: ListChecks },
  { label: "Crear tareas", icon: ListTodo },
  { label: "Generar documentación", icon: FileText },
  { label: "Extraer acciones", icon: Wand2 },
  { label: "Mejorar texto", icon: TextCursorInput },
  { label: "Crear SOP", icon: FileText },
  { label: "Analizar conversación", icon: MessageCircle },
];

/** Sección 9 del rediseño — "preparar un panel lateral de IA... no hace
 * falta implementar toda la lógica. Solo la estructura." Every action below
 * is visually complete but disabled — zero server calls happen from this
 * component, on purpose, until a real IA integration is scoped for the
 * Tasks module. */
export function TaskAiPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside className="hidden w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border-default bg-surface-1 p-4 lg:flex">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Sparkles size={15} className="text-accent-500" aria-hidden="true" />
          Asistente IA
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel de IA"
          className="flex size-6 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <p className="text-[12px] text-neutral-500">Próximamente — estas acciones todavía no están conectadas.</p>
      <div className="flex flex-col gap-1.5">
        {ACTIONS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            disabled
            title="Próximamente"
            className="flex cursor-not-allowed items-center gap-2 rounded-md border border-border-default px-3 py-2 text-left text-[13px] text-neutral-400"
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </aside>
  );
}
