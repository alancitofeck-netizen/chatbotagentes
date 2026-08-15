"use client";

import { useTransition } from "react";
import { UserRound, Phone } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/toast/toast";
import type { AgendaAppointment } from "@/lib/agenda/queries";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";
import { updateEstadoCitaAction } from "@/lib/agenda/actions";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

/** Tarjeta de cita — hora, cliente, tipo, asesor, setter, estado, fácil de
 * identificar de un vistazo. Los 3 roles pueden editar el estado (muestra
 * un select en vez de solo un badge) — la autorización real de a qué citas
 * puede tocar cada rol vive server-side en updateEstadoCita
 * (agenda/queries.ts), no acá. */
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
        {cita.contactPhone && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-neutral-500">
            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
            {cita.contactPhone}
          </p>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-border-default pt-2.5 text-[12.5px] text-neutral-500">
        <span className="flex items-center gap-1.5">
          <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
          Asesor: <span className="font-medium text-foreground">{cita.advisorName}</span>
        </span>
        {cita.setterName && (
          <span className="flex items-center gap-1.5">
            <Avatar name={cita.setterName} src={cita.setterAvatarUrl} size={18} />
            <span className="font-medium text-foreground">{cita.setterName}</span>
          </span>
        )}
      </div>
    </div>
  );
}
