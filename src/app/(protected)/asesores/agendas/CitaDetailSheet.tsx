"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Phone, Mail, StickyNote, User, UserCog, Clock, Tag } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import type { AgendaAppointment, EstadoCita } from "@/lib/agenda/queries";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";
import { updateEstadoCitaAction } from "@/lib/agenda/actions";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-MX", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(startIso: string, endIso: string) {
  const minutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function Row({ icon: Icon, label, children }: { icon: typeof User; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-neutral-500">{label}</p>
        <div className="text-[13px] text-foreground">{children}</div>
      </div>
    </div>
  );
}

/** Detalle de una cita — muestra todo lo que realmente existe en
 * agenda_appointments/contacts. NO incluye "Asesoría relacionada" ni
 * "Operación relacionada": no hay FK real entre agenda_appointments y
 * asesorias/policies (investigado a fondo antes de este plan) — mostrar esas
 * secciones sería inventar una relación que no existe. El lead asociado se
 * muestra inline (teléfono/email/notas) en vez de linkear a una ruta de
 * detalle de contacto, porque el CRM no tiene una ruta así hoy (`/crm`,
 * `/inbox` no aceptan un contactId por query param). */
export function CitaDetailSheet({ cita, canEditEstado, onClose }: { cita: AgendaAppointment; canEditEstado: boolean; onClose: () => void }) {
  const [estado, setEstado] = useState<EstadoCita>(cita.estadoCita);
  const [isPending, startTransition] = useTransition();
  const meta = ESTADO_CITA_META[estado];

  function handleEstadoChange(next: EstadoCita) {
    const previous = estado;
    setEstado(next);
    startTransition(async () => {
      try {
        await updateEstadoCitaAction(cita.id, cita.workspaceId, next);
      } catch (err) {
        setEstado(previous);
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title={cita.contactName ?? "Cita"} className="max-w-md">
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-500">{cita.appointmentType ?? "Cita"}</span>
          {canEditEstado ? (
            <Select label="" value={estado} disabled={isPending} containerClassName="w-auto" onChange={(e) => handleEstadoChange(e.target.value as EstadoCita)}>
              {ESTADO_CITA_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {ESTADO_CITA_META[o].label}
                </option>
              ))}
            </Select>
          ) : (
            <Badge variant={meta.variant}>{meta.label}</Badge>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Row icon={Clock} label="Fecha y hora">
            {formatDateTime(cita.startTime)} · {formatDuration(cita.startTime, cita.endTime)}
          </Row>
          <Row icon={UserCog} label="Asesor">
            {cita.advisorName}
          </Row>
          <Row icon={User} label="Setter">
            {cita.setterName ?? "—"}
          </Row>
          {cita.appointmentType && (
            <Row icon={Tag} label="Tipo de cita">
              {cita.appointmentType}
            </Row>
          )}
        </div>

        {(cita.contactName || cita.contactPhone || cita.contactEmail) && (
          <div className="flex flex-col gap-3 border-t border-border-default pt-4">
            <p className="text-xs font-medium text-neutral-500">Lead asociado</p>
            {cita.contactName && <p className="text-[13px] font-medium text-foreground">{cita.contactName}</p>}
            {cita.contactPhone && (
              <div className="flex items-center gap-2.5 text-[13px]">
                <Phone size={14} className="shrink-0 text-neutral-400" aria-hidden="true" />
                <a href={`https://wa.me/${cita.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-accent-600 hover:underline">
                  {cita.contactPhone}
                </a>
              </div>
            )}
            {cita.contactEmail && (
              <div className="flex items-center gap-2.5 text-[13px]">
                <Mail size={14} className="shrink-0 text-neutral-400" aria-hidden="true" />
                <a href={`mailto:${cita.contactEmail}`} className="text-accent-600 hover:underline">
                  {cita.contactEmail}
                </a>
              </div>
            )}
          </div>
        )}

        {cita.notes && (
          <div className="flex items-start gap-2.5 border-t border-border-default pt-4 text-[13px]">
            <StickyNote size={14} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden="true" />
            <span className="whitespace-pre-wrap text-neutral-600">{cita.notes}</span>
          </div>
        )}
      </div>
    </Sheet>
  );
}
