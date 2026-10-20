"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Phone, Mail, CalendarClock, Tag, UserRound, FileSpreadsheet } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import type { AgendaLead } from "@/lib/agenda/sheetPanelTypes";
import type { EstadoCita } from "@/lib/agenda/queries";
import { ETAPA_META, computeEtapa } from "@/lib/agenda/etapa";
import { updateEstadoCitaAction, updateCitaNotasAction } from "@/lib/agenda/actions";
import type { SheetWriteBackStatus } from "@/lib/advisorSync/writeBack";
import { titleCaseName, formatPhoneDisplay, extractEmailFromText } from "@/lib/utils/format";

const SOURCE_LABELS: Record<string, string> = {
  agenda_sheet: "Agenda de setters",
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

function formatCitaFecha(iso: string) {
  const label = new Date(iso).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "Ficha del lead" — contenido compartido por el panel fijo de escritorio y la pantalla completa
 * de mobile (el contenedor y el botón de volver los decide cada uno de esos, esto es solo el
 * adentro). Todo lo que escribe pasa por los mismos Server Actions que ya usa la ficha de citas,
 * apuntando a la cita "relevante" del lead (appointmentId/appointmentWorkspaceId).
 *
 * El llamador SIEMPRE tiene que pasar `key={lead.contactId}` — así React remonta el componente
 * (en vez de un efecto/ref comparando el id anterior, que el linter de hooks de este proyecto
 * rechaza) cuando cambia el lead seleccionado, y el borrador de "nota" nunca queda pegado del
 * lead anterior. */
export function AgendaLeadDetailPanel({
  lead,
  onEstadoChanged,
  onNotasChanged,
  showHistorial = false,
  showLlamar = false,
}: {
  lead: AgendaLead;
  onEstadoChanged: (contactId: string, estado: EstadoCita) => void;
  onNotasChanged: (contactId: string, notas: string) => void;
  showHistorial?: boolean;
  showLlamar?: boolean;
}) {
  const etapa = computeEtapa(lead);
  const etapaMeta = ETAPA_META[etapa];
  const displayName = titleCaseName(lead.name);
  const displayPhone = lead.phone ? formatPhoneDisplay(lead.phone) : null;
  const displayEmail = lead.email ?? extractEmailFromText(lead.notas);
  const sourceLabel = lead.source ? (SOURCE_LABELS[lead.source] ?? lead.source) : "—";

  const [isPending, startTransition] = useTransition();
  const [nota, setNota] = useState("");
  const [savingNota, setSavingNota] = useState(false);

  function changeEstado(next: EstadoCita) {
    if (!lead.appointmentId || !lead.appointmentWorkspaceId) return;
    const previous = lead.lastEstado;
    onEstadoChanged(lead.contactId, next);
    startTransition(async () => {
      try {
        const { sheet } = await updateEstadoCitaAction(lead.appointmentId!, lead.appointmentWorkspaceId!, next);
        notifySheetResult(sheet);
      } catch (err) {
        if (previous) onEstadoChanged(lead.contactId, previous);
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
      }
    });
  }

  function saveNota() {
    const trimmed = nota.trim();
    if (!trimmed || !lead.appointmentId || !lead.appointmentWorkspaceId) return;
    const nextNotas = lead.notas ? `${lead.notas}\n${trimmed}` : trimmed;
    setSavingNota(true);
    updateCitaNotasAction(lead.appointmentId, lead.appointmentWorkspaceId, nextNotas)
      .then(({ sheet }) => {
        onNotasChanged(lead.contactId, nextNotas);
        setNota("");
        notifySheetResult(sheet);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo guardar la nota."))
      .finally(() => setSavingNota(false));
  }

  function handleAgendar() {
    toast.info("Las citas vienen de tu hoja", "Cargá la cita en tu hoja de Google Sheets conectada y tocá Sincronizar ahora.");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
        <Avatar name={displayName} size={64} />
        <div>
          <p className="text-[18px] font-semibold text-foreground">{displayName}</p>
          <p className="text-[13px] text-neutral-500">
            {lead.producto ?? "Sin producto"} · {sourceLabel}
          </p>
        </div>
        <Badge variant={etapaMeta.variant}>{etapaMeta.label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {displayPhone && (
          <a
            href={`https://wa.me/${lead.phone!.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-accent-500 px-3.5 text-[13px] font-medium text-white hover:bg-accent-600"
          >
            <MessageCircle size={15} aria-hidden="true" /> WhatsApp
          </a>
        )}
        {showLlamar && displayPhone && (
          <a
            href={`tel:${lead.phone}`}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border-default px-3.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
          >
            <Phone size={15} aria-hidden="true" /> Llamar
          </a>
        )}
        <button
          type="button"
          onClick={handleAgendar}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border-default px-3.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
        >
          <CalendarClock size={15} aria-hidden="true" /> Agendar
        </button>
      </div>

      {etapa === "sin_resultado" && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-warning/30 bg-warning-bg p-3.5">
          <div>
            <p className="text-[13px] font-semibold text-warning-strong">{lead.lastCitaAt ? `¿Cómo salió la cita del ${formatCitaFecha(lead.lastCitaAt)}?` : "¿Cómo salió la cita?"}</p>
            <p className="text-[12px] text-warning-strong/80">Cargalo para que se actualice el embudo.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={isPending}
              onClick={() => changeEstado("realizada")}
              className="flex h-12 flex-1 items-center justify-center rounded-md bg-success-strong text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              Asistió
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => changeEstado("no_show")}
              className="flex h-12 flex-1 items-center justify-center rounded-md border border-border-strong bg-surface-1 text-[13px] font-medium text-foreground hover:bg-surface-2 disabled:opacity-60"
            >
              No asistió
            </button>
            <button
              type="button"
              onClick={() => toast.info("Para reprogramar", "Actualizá la fecha en tu hoja de agendas y tocá Sincronizar ahora.")}
              className="flex h-12 flex-1 items-center justify-center rounded-md border border-border-strong bg-surface-1 text-[13px] font-medium text-foreground hover:bg-surface-2"
            >
              Reprogramar
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Datos</p>
        <dl className="flex flex-col gap-2 rounded-lg border border-border-default p-3.5 text-[13px]">
          {[
            { icon: Phone, label: "Teléfono", value: displayPhone },
            { icon: Mail, label: "Email", value: displayEmail },
            { icon: Tag, label: "Producto", value: lead.producto },
            { icon: CalendarClock, label: "Cita", value: lead.nextCitaAt ? formatCitaFecha(lead.nextCitaAt) : lead.lastCitaAt ? formatCitaFecha(lead.lastCitaAt) : null },
            { icon: UserRound, label: "Setter", value: lead.setterName },
            { icon: FileSpreadsheet, label: "Fuente", value: sourceLabel },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border-default pb-2 last:border-b-0 last:pb-0">
              <dt className="flex items-center gap-1.5 text-neutral-500">
                <row.icon size={13} aria-hidden="true" /> {row.label}
              </dt>
              <dd className="truncate text-right font-medium text-foreground">{row.value || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Notas</p>
        {lead.notas && <div className="mb-2 rounded-lg bg-surface-2 p-3 text-[13px] whitespace-pre-wrap text-neutral-600">{lead.notas}</div>}
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Agregar una nota…"
          rows={3}
          className="w-full resize-y rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-[15px] text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
        <button
          type="button"
          onClick={saveNota}
          disabled={savingNota || !nota.trim() || !lead.appointmentId}
          className="mt-2 h-10 rounded-md bg-accent-500 px-4 text-[13px] font-medium text-white hover:bg-accent-600 disabled:opacity-50"
        >
          {savingNota ? "Guardando…" : "Guardar nota"}
        </button>
      </div>

      {showHistorial && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Historial</p>
          <ul className="flex flex-col gap-2.5 border-l border-border-default pl-3.5">
            {lead.createdAt && (
              <li className="relative text-[12.5px]">
                <span className="absolute top-1 -left-[18px] size-2 rounded-full bg-neutral-400" aria-hidden="true" />
                <p className="font-medium text-foreground">Lead creado{sourceLabel !== "—" ? ` desde ${sourceLabel}` : ""}</p>
                <p className="text-neutral-500">{formatCitaFecha(lead.createdAt)}</p>
              </li>
            )}
            {(lead.nextCitaAt ?? lead.lastCitaAt) && (
              <li className="relative text-[12.5px]">
                <span className="absolute top-1 -left-[18px] size-2 rounded-full bg-accent-500" aria-hidden="true" />
                <p className="font-medium text-foreground">Cita {lead.nextCitaAt ? "agendada" : "registrada"}</p>
                <p className="text-neutral-500">{formatCitaFecha((lead.nextCitaAt ?? lead.lastCitaAt)!)}</p>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
