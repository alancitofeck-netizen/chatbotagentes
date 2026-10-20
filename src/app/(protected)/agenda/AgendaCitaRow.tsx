"use client";

import { MessageCircle, CheckCircle2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { AgendaAppointment } from "@/lib/agenda/queries";
import { ESTADO_CITA_META } from "@/lib/agenda/estadoMeta";

/** Canal de contacto — se infiere de contacts.source (whatsapp/instagram/manychat), el único dato
 * real disponible hoy; no hay una columna "canal" en agenda_appointments ni en la hoja de agendas.
 * Para un lead creado directo desde la hoja (source "agenda_sheet") no hay canal que mostrar, así
 * que el chip no se renderiza — nunca se inventa un WhatsApp/Instagram por defecto. */
const CHANNEL_META: Partial<Record<string, { label: string; className: string }>> = {
  whatsapp: { label: "WhatsApp", className: "bg-success-bg text-success-strong" },
  manychat: { label: "ManyChat", className: "bg-success-bg text-success-strong" },
  instagram: { label: "Instagram", className: "bg-accent-100 text-accent-700" },
};

function formatDayShort(iso: string) {
  const label = new Date(iso).toLocaleDateString("es-MX", { weekday: "short", day: "numeric" }).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export function AgendaCitaRow({ cita, selected, onSelect }: { cita: AgendaAppointment; selected: boolean; onSelect: () => void }) {
  const meta = ESTADO_CITA_META[cita.estadoCita];
  const channel = cita.contactSource ? CHANNEL_META[cita.contactSource] : undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`flex cursor-pointer items-center gap-3 border-b border-border-default px-3 py-3 transition-colors duration-150 last:border-b-0 ${
        selected ? "bg-accent-50 shadow-[inset_3px_0_0_0_var(--color-accent-500)]" : "hover:bg-surface-2"
      }`}
    >
      <div className="flex w-12 shrink-0 flex-col items-start">
        {cita.sinHora ? (
          <span className="text-[13px] font-semibold text-warning-strong">sin hora</span>
        ) : (
          <span className="font-display text-[16px] leading-none font-semibold tabular-nums text-foreground">{formatTime(cita.startTime)}</span>
        )}
        <span className="mt-0.5 text-[11px] text-neutral-500">{formatDayShort(cita.startTime)}</span>
      </div>

      <Avatar name={cita.contactName ?? "—"} size={34} className="shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-foreground">{cita.contactName ?? "Sin nombre"}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-neutral-500">
          {channel && <span className={`rounded px-1.5 py-px text-[11px] font-medium ${channel.className}`}>{channel.label}</span>}
          <span>{cita.appointmentType ?? "Cita"}</span>
          <span className="text-neutral-300">·</span>
          <span>
            Setter: <span className="font-medium text-foreground">{cita.setterName ?? "Sin setter"}</span>
          </span>
          <span className="text-neutral-300">·</span>
          <span>
            Asesor: <span className="font-medium text-foreground">{cita.advisorName || "Sin asignar"}</span>
          </span>
        </div>
      </div>

      <Badge variant={meta.variant} className="shrink-0">
        {meta.label}
      </Badge>

      <div className="flex shrink-0 items-center gap-1.5">
        {cita.contactPhone && (
          <a
            href={`https://wa.me/${cita.contactPhone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Abrir WhatsApp con ${cita.contactName ?? "el lead"}`}
            className="flex size-9 items-center justify-center rounded-md border border-border-default text-neutral-500 hover:bg-surface-2 hover:text-foreground"
          >
            <MessageCircle size={16} aria-hidden="true" />
          </a>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          aria-label="Marcar resultado de la cita"
          className="flex size-9 items-center justify-center rounded-md border border-border-default text-neutral-500 hover:bg-surface-2 hover:text-foreground"
        >
          <CheckCircle2 size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
