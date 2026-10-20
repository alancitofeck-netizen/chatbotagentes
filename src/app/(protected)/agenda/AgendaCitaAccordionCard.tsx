"use client";

import { useTransition } from "react";
import { ChevronDown, MessageCircle, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import type { AgendaAppointment, EstadoCita } from "@/lib/agenda/queries";
import { ESTADO_CITA_META } from "@/lib/agenda/estadoMeta";
import { updateEstadoCitaAction } from "@/lib/agenda/actions";
import type { SheetWriteBackStatus } from "@/lib/advisorSync/writeBack";

const SOURCE_LABELS: Record<string, string> = {
  agenda_sheet: "Agenda de setters",
  google_sheets: "Hoja del asesor",
  manual: "Cargado a mano",
  mini_app: "Mini App",
  whatsapp: "WhatsApp",
  manychat: "ManyChat",
  instagram: "Instagram",
  asesoria: "Asesoría",
  asesoria_referral: "Referido",
};

function notifySheetResult(sheet: SheetWriteBackStatus) {
  if (sheet === "written") return toast.success("Guardado", "También se actualizó en la hoja.");
  if (sheet === "no_token") return toast.info("Guardado en el CRM", "Para escribirlo en la hoja, conectá la cuenta de Google en Configurar.");
  if (sheet === "row_moved") return toast.info("Guardado en el CRM", "La fila de la hoja cambió de lugar: tocá Sincronizar ahora y volvé a intentar.");
  if (sheet === "no_estado_column") return toast.info("Guardado en el CRM", "La hoja no tiene una columna mapeada para este campo.");
  if (sheet === "error") return toast.error("Guardado en el CRM", "No se pudo escribir en la hoja.");
  return toast.success("Guardado");
}

function needsResultado(cita: AgendaAppointment): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(cita.startTime) < today && (cita.estadoCita === "agendada" || cita.estadoCita === "propuesta");
}

/** Tarjeta expandible de una cita (look del mockup agenda-movil.html): encabezado compacto
 * (hora/estado/nombre/setter-asesor) que al tocarlo despliega el detalle en el lugar — nada de
 * panel aparte ni hoja inferior para esto. "Editar" abre el formulario compartido
 * (AgendaRecordForm) con estado/notas editables siempre, y el resto solo si la cita no vino de una
 * hoja conectada (ver `cita.fromSheet`). */
export function AgendaCitaAccordionCard({
  cita,
  expanded,
  onToggle,
  onEstadoChanged,
  onEditar,
}: {
  cita: AgendaAppointment;
  expanded: boolean;
  onToggle: () => void;
  onEstadoChanged: (id: string, estado: EstadoCita) => void;
  onEditar: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const meta = ESTADO_CITA_META[cita.estadoCita];
  const channelLabel = cita.contactSource ? (SOURCE_LABELS[cita.contactSource] ?? cita.contactSource) : null;

  function changeEstado(next: EstadoCita) {
    const previous = cita.estadoCita;
    onEstadoChanged(cita.id, next);
    startTransition(async () => {
      try {
        const { sheet } = await updateEstadoCitaAction(cita.id, cita.workspaceId, next);
        notifySheetResult(sheet);
      } catch (err) {
        onEstadoChanged(cita.id, previous);
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
      }
    });
  }

  return (
    <article className={`overflow-hidden rounded-xl border bg-surface-1 transition-colors ${expanded ? "border-accent-500 shadow-[var(--elevation-sm)]" : "border-border-default"}`}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full flex-col gap-2.5 p-3.5 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[13px] font-semibold tabular-nums ${cita.sinHora ? "bg-warning-bg text-warning-strong" : "bg-[#0F1B22] text-white"}`}>
            {cita.sinHora ? "Sin hora" : new Date(cita.startTime).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <div className="flex items-center gap-1.5">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <ChevronDown size={16} className={`shrink-0 text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Avatar name={cita.contactName ?? "—"} size={38} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-foreground">{cita.contactName ?? "Sin nombre"}</p>
            <p className="truncate text-[12.5px] text-neutral-500">
              {cita.appointmentType ?? "Cita"}
              {channelLabel ? ` · ${channelLabel}` : ""}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-md bg-surface-2 px-2 py-1.5">
            <span className="block text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">Setter</span>
            <span className="truncate font-medium text-foreground">{cita.setterName ?? "—"}</span>
          </div>
          <div className="rounded-md bg-surface-2 px-2 py-1.5">
            <span className="block text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">Asesor</span>
            <span className="truncate font-medium text-foreground">{cita.advisorName || "—"}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border-default p-3.5">
          {needsResultado(cita) && (
            <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-bg p-3">
              <p className="text-[12.5px] font-semibold text-warning-strong">¿Cómo salió esta cita?</p>
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" disabled={isPending} onClick={() => changeEstado("realizada")} className="h-10 rounded-md bg-success-strong text-[12.5px] font-semibold text-white disabled:opacity-60">
                  Asistió
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => changeEstado("no_show")}
                  className="h-10 rounded-md border border-border-strong bg-surface-1 text-[12.5px] font-medium text-foreground disabled:opacity-60"
                >
                  No asistió
                </button>
                <button type="button" onClick={onEditar} className="h-10 rounded-md border border-border-strong bg-surface-1 text-[12.5px] font-medium text-foreground">
                  Reprogramar
                </button>
              </div>
            </div>
          )}

          <dl className="flex flex-col gap-1.5 rounded-lg border border-border-default p-3 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-500">Teléfono</dt>
              <dd className="truncate font-medium text-foreground">{cita.contactPhone ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-500">Email</dt>
              <dd className="truncate font-medium text-foreground">{cita.contactEmail ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-500">Producto</dt>
              <dd className="truncate font-medium text-foreground">{cita.producto ?? "—"}</dd>
            </div>
          </dl>

          <div className={`rounded-lg bg-surface-2 p-3 text-[13px] ${cita.notes ? "text-neutral-600" : "text-neutral-400 italic"}`}>{cita.notes || 'Sin notas. Tocá "Editar" para agregar una.'}</div>

          <div className="flex gap-2">
            {cita.contactPhone && (
              <a
                href={`https://wa.me/${cita.contactPhone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-accent-500 text-[13px] font-medium text-white hover:bg-accent-600"
              >
                <MessageCircle size={14} aria-hidden="true" /> WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditar();
              }}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-border-default text-[13px] font-medium text-foreground hover:bg-surface-2"
            >
              <Pencil size={14} aria-hidden="true" /> Editar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
