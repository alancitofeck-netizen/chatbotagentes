"use client";

import { useRef, useState, useTransition } from "react";
import { ExternalLink, MessageCircle, Phone, Mail, AtSign, CalendarClock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import type { AgendaAppointment, EstadoCita } from "@/lib/agenda/queries";
import { ESTADO_CITA_META } from "@/lib/agenda/estadoMeta";
import { updateEstadoCitaAction, updateCitaNotasAction } from "@/lib/agenda/actions";
import type { SheetWriteBackStatus } from "@/lib/advisorSync/writeBack";

const SOURCE_LABELS: Record<string, string> = {
  agenda_sheet: "Hoja de agendas",
  google_sheets: "Hoja del asesor",
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

function formatFecha(iso: string) {
  const label = new Date(iso).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}
function formatHistorialFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function needsResultado(cita: AgendaAppointment): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(cita.startTime) < today && (cita.estadoCita === "agendada" || cita.estadoCita === "propuesta");
}

/** Panel "Detalle de la cita" — en escritorio es la columna derecha persistente de AgendaShell; en
 * mobile, el mismo componente se monta dentro de un <Sheet> (hoja inferior) al tocar una fila. Todo
 * lo que escribe (estado, notas) pasa por los Server Actions existentes/nuevos, que ya intentan
 * escribir de vuelta en la hoja (writeBack.ts) cuando corresponde — acá solo se avisa el resultado. */
export function AgendaCitaDetailPanel({ cita, canEdit, onEstadoChanged, sheetUrl }: { cita: AgendaAppointment | null; canEdit: boolean; onEstadoChanged: (id: string, estado: EstadoCita) => void; sheetUrl: string | null }) {
  const [notas, setNotas] = useState(cita?.notes ?? "");
  const [isPending, startTransition] = useTransition();
  const [savingNotas, setSavingNotas] = useState(false);

  // Resetea el borrador de notas cuando cambia la cita seleccionada — ajuste de estado durante el
  // render (no un efecto) porque es una respuesta directa a que cambió una prop, mismo patrón que
  // ya usa Sheet.tsx (ver su comentario sobre hasFinishedExpanding).
  const lastCitaIdRef = useRef(cita?.id);
  if (cita?.id !== lastCitaIdRef.current) {
    lastCitaIdRef.current = cita?.id;
    setNotas(cita?.notes ?? "");
  }

  if (!cita) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-border-default bg-surface-1 p-6">
        <EmptyState icon={CalendarClock} title="Elegí una cita" description="Tocá una cita de la lista para ver su detalle acá." />
      </div>
    );
  }

  const meta = ESTADO_CITA_META[cita.estadoCita];
  const channelLabel = cita.contactSource ? (SOURCE_LABELS[cita.contactSource] ?? cita.contactSource) : null;

  function changeEstado(next: EstadoCita) {
    if (!cita) return;
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

  function saveNotas() {
    if (!cita || notas === (cita.notes ?? "")) return;
    setSavingNotas(true);
    updateCitaNotasAction(cita.id, cita.workspaceId, notas)
      .then(({ sheet }) => notifySheetResult(sheet))
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudieron guardar las notas."))
      .finally(() => setSavingNotas(false));
  }

  const editRowUrl = sheetUrl && cita.fromSheet && cita.sheetRowNumber ? `${sheetUrl}&range=A${cita.sheetRowNumber}` : sheetUrl;

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border-default bg-surface-1 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Detalle de la cita</span>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </div>

      <div className="flex items-center gap-3">
        <Avatar name={cita.contactName ?? "—"} size={48} />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold text-foreground">{cita.contactName ?? "Sin nombre"}</p>
          <p className="truncate text-[13px] text-neutral-500">
            {cita.appointmentType ?? "Cita"}
            {channelLabel ? ` · vía ${channelLabel}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-border-default p-2.5">
          <p className="text-[11px] text-neutral-500">Fecha</p>
          <p className="text-[13.5px] font-medium text-foreground">{formatFecha(cita.startTime)}</p>
        </div>
        <div className="rounded-lg border border-border-default p-2.5">
          <p className="text-[11px] text-neutral-500">Hora</p>
          <p className="text-[13.5px] font-medium text-foreground">{cita.sinHora ? "Sin hora" : `${formatHora(cita.startTime)} hs`}</p>
        </div>
      </div>

      {canEdit && needsResultado(cita) && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-warning/30 bg-warning-bg p-3.5">
          <p className="text-[13px] font-semibold text-warning-strong">¿Cómo salió esta cita?</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => changeEstado("realizada")}
              className="rounded-md bg-success-strong px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              Asistió
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => changeEstado("no_show")}
              className="rounded-md border border-border-strong bg-surface-1 px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2 disabled:opacity-60"
            >
              No asistió
            </button>
            <button
              type="button"
              onClick={() => toast.info("Para reprogramar", "Actualizá la fecha en tu hoja de agendas y tocá Sincronizar ahora.")}
              className="rounded-md border border-border-strong bg-surface-1 px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2"
            >
              Reprogramar
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Contacto</p>
        <dl className="flex flex-col gap-1.5 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-neutral-500">
              <Phone size={13} aria-hidden="true" /> Teléfono
            </dt>
            <dd className="truncate font-medium text-foreground">{cita.contactPhone ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-neutral-500">
              <AtSign size={13} aria-hidden="true" /> Instagram
            </dt>
            <dd className="truncate font-medium text-foreground">—</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-neutral-500">
              <Mail size={13} aria-hidden="true" /> Email
            </dt>
            <dd className="truncate font-medium text-foreground">{cita.contactEmail ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Equipo</p>
        <dl className="flex flex-col gap-1.5 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">Setter</dt>
            <dd className="font-medium text-foreground">{cita.setterName ?? "Sin setter"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">Asesor</dt>
            <dd className="font-medium text-foreground">{cita.advisorName || "Sin asignar"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">Origen</dt>
            <dd className="truncate font-medium text-foreground">{channelLabel ?? (cita.fromSheet ? "Hoja" : "CRM")}</dd>
          </div>
        </dl>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Notas del setter</p>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          onBlur={saveNotas}
          disabled={!canEdit}
          placeholder="Agregá contexto para el asesor: qué busca, objeciones, presupuesto…"
          rows={3}
          className="w-full resize-y rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100 disabled:opacity-60"
        />
        {savingNotas && <p className="mt-1 text-[11.5px] text-neutral-400">Guardando…</p>}
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Historial</p>
        <ul className="flex flex-col gap-2.5 border-l border-border-default pl-3.5">
          <li className="relative text-[12.5px]">
            <span className="absolute top-1 -left-[18px] size-2 rounded-full bg-accent-500" aria-hidden="true" />
            <p className="font-medium text-foreground">Cita cargada en la agenda</p>
            <p className="text-neutral-500">{formatHistorialFecha(cita.createdAt)}</p>
          </li>
          {cita.contactCreatedAt && (
            <li className="relative text-[12.5px]">
              <span className="absolute top-1 -left-[18px] size-2 rounded-full bg-neutral-400" aria-hidden="true" />
              <p className="font-medium text-foreground">Lead creado{channelLabel ? ` desde ${channelLabel}` : ""}</p>
              <p className="text-neutral-500">{formatHistorialFecha(cita.contactCreatedAt)}</p>
            </li>
          )}
        </ul>
      </div>

      <div className="flex gap-2 border-t border-border-default pt-3.5">
        {cita.contactPhone && (
          <a
            href={`https://wa.me/${cita.contactPhone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent-500 px-3.5 py-2.5 text-[13px] font-medium text-white hover:bg-accent-600"
          >
            <MessageCircle size={15} aria-hidden="true" /> WhatsApp
          </a>
        )}
        {editRowUrl && (
          <a
            href={editRowUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border-default px-3.5 py-2.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
          >
            Editar cita <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
