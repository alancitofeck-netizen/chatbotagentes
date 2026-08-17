"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Phone, Mail, StickyNote } from "lucide-react";
import type { AgendaAppointment } from "@/lib/agenda/queries";

/** Envuelve el nombre del lead/cliente — clic abre un popover con
 * teléfono/email/notas (los datos que ya vienen de la hoja del asesor, ver
 * advisorSync/runner.ts). Se cierra solo al clickear afuera; sin nada que
 * mostrar, el nombre queda como texto plano (no engaña con un cursor de
 * link que no hace nada). Vive en components/ (no dentro de un módulo
 * puntual) porque se reutiliza tanto en /agenda como en la ficha de
 * Asesores (SyncedAgendaCard). */
export function CitaContactDetails({ cita, children }: { cita: AgendaAppointment; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasDetails = Boolean(cita.contactPhone || cita.contactEmail || cita.notes);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (!hasDetails) return <div className="min-w-0">{children}</div>;

  return (
    <div className="relative min-w-0" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="block min-w-0 max-w-full text-left hover:underline">
        {children}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1.5 w-72 rounded-lg border border-border-default bg-surface-1 p-3.5 shadow-[var(--elevation-md)]">
          <ul className="flex flex-col gap-2.5">
            {cita.contactPhone && (
              <li className="flex items-center gap-2.5 text-[13px]">
                <Phone size={14} className="shrink-0 text-neutral-400" aria-hidden="true" />
                <a href={`https://wa.me/${cita.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="truncate text-accent-600 hover:underline">
                  {cita.contactPhone}
                </a>
              </li>
            )}
            {cita.contactEmail && (
              <li className="flex items-center gap-2.5 text-[13px]">
                <Mail size={14} className="shrink-0 text-neutral-400" aria-hidden="true" />
                <a href={`mailto:${cita.contactEmail}`} className="truncate text-accent-600 hover:underline">
                  {cita.contactEmail}
                </a>
              </li>
            )}
            {cita.notes && (
              <li className="flex items-start gap-2.5 text-[13px]">
                <StickyNote size={14} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden="true" />
                <span className="whitespace-pre-wrap text-neutral-600">{cita.notes}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
