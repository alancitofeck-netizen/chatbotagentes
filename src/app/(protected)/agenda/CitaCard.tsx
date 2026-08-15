"use client";

import { useTransition } from "react";
import { UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/toast/toast";
import type { AgendaAppointment, EstadoCita } from "@/lib/agenda/queries";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";
import { updateEstadoCitaAction } from "@/lib/agenda/actions";

const ESTADO_BORDER_COLOR: Record<EstadoCita, string> = {
  agendada: "var(--color-warning)",
  confirmada: "var(--color-info)",
  realizada: "var(--color-success)",
  no_show: "var(--color-error)",
  cancelada: "var(--color-neutral-400)",
  venta: "var(--color-accent-500)",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

/** Fila de cita — franja horizontal con borde izquierdo del color del
 * estado (mismo código de color que el donut "Citas por Estado", identidad
 * consistente en toda la pantalla), hora, cliente, setter, estado. Los 3
 * roles pueden editar el estado (muestra un select en vez de solo un
 * badge) — la autorización real de a qué citas puede tocar cada rol vive
 * server-side en updateEstadoCita (agenda/queries.ts), no acá. */
export function CitaCard({ cita, canEditEstado }: { cita: AgendaAppointment; canEditEstado: boolean }) {
  const [isPending, startTransition] = useTransition();
  const estado = cita.estadoCita;
  const meta = ESTADO_CITA_META[estado];

  function handleEstadoChange(next: string) {
    startTransition(async () => {
      try {
        await updateEstadoCitaAction(cita.id, cita.workspaceId, next as (typeof ESTADO_CITA_OPTIONS)[number]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
      }
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-r-xl rounded-l-sm border border-border-default bg-surface-1 py-3 pr-4 pl-3.5 sm:flex-nowrap"
      style={{ borderLeft: `4px solid ${ESTADO_BORDER_COLOR[estado]}` }}
    >
      <span className="w-14 shrink-0 text-[14px] font-semibold text-foreground">{formatTime(cita.startTime)}</span>

      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-500/10 text-accent-600">
        <UserRound className="size-4" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-[14px] font-medium text-foreground">{cita.contactName ?? "Sin nombre"}</p>
        <p className="truncate text-[12px] text-neutral-500">{cita.subject}</p>
      </div>

      {cita.setterName && (
        <div className="flex shrink-0 flex-col items-start gap-0.5">
          <span className="text-[10.5px] text-neutral-400">Setter</span>
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
            <Avatar name={cita.setterName} src={cita.setterAvatarUrl} size={18} />
            {cita.setterName}
          </span>
        </div>
      )}

      <div className="ml-auto shrink-0">
        {canEditEstado ? (
          <Select label="" value={estado} onChange={(e) => handleEstadoChange(e.target.value)} disabled={isPending} containerClassName="w-auto">
            {ESTADO_CITA_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {ESTADO_CITA_META[o].label}
              </option>
            ))}
          </Select>
        ) : (
          <Badge variant={meta.variant} dot>
            {meta.label}
          </Badge>
        )}
      </div>
    </div>
  );
}
