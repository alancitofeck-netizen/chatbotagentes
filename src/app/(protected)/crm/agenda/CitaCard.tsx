"use client";

import { useTransition } from "react";
import { UserRound, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import type { AgendaAppointment } from "@/lib/agenda/queries";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";
import { updateEstadoCitaAction } from "@/lib/agenda/actions";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

/** Tarjeta de cita del pedido original — hora, cliente, tipo, asesor,
 * setter, estado, fácil de identificar de un vistazo. `canEditEstado`
 * (owner/admin) muestra el estado como un select en vez de solo un badge. */
export function CitaCard({ cita, canEditEstado }: { cita: AgendaAppointment; canEditEstado: boolean }) {
  const [isPending, startTransition] = useTransition();
  const estado = cita.estadoCita ?? "agendada";
  const meta = ESTADO_CITA_META[estado];

  function handleEstadoChange(next: string) {
    startTransition(async () => {
      try {
        await updateEstadoCitaAction(cita.id, cita.bookingWorkspaceId, next as (typeof ESTADO_CITA_OPTIONS)[number]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-border-default bg-surface-1 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-semibold text-foreground">{formatTime(cita.startTime)}</span>
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

      <div>
        <p className="text-[14px] font-medium text-foreground">{cita.contactName ?? "Sin nombre"}</p>
        <p className="text-[12.5px] text-neutral-500">{cita.subject}</p>
      </div>

      <div className="mt-1 flex flex-col gap-1 border-t border-border-default pt-2.5 text-[12.5px] text-neutral-500">
        <span className="flex items-center gap-1.5">
          <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
          Asesor: <span className="font-medium text-foreground">{cita.advisorName}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Users2 className="size-3.5 shrink-0" aria-hidden="true" />
          Setter: <span className="font-medium text-foreground">{cita.setterName ?? "—"}</span>
        </span>
      </div>
    </div>
  );
}
