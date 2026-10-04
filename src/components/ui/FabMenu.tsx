"use client";

import { useState, type ReactNode } from "react";
import { Fab } from "./Fab";
import { Sheet } from "./Sheet";

export interface FabMenuAction {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
}

/** FAB que abre un bottom sheet con las acciones de crear de la pantalla
 * (ej. "Nuevo lead / Nueva cita / Nueva tarea"). Solo mobile, como el Fab base. */
export function FabMenu({ title = "Crear", actions }: { title?: string; actions: FabMenuAction[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Fab aria-label={title} onClick={() => setOpen(true)} />
      {open && (
        <Sheet open onClose={() => setOpen(false)} title={title} className="max-w-md">
          <div className="flex flex-col gap-1 p-3">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-foreground hover:bg-surface-2"
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
