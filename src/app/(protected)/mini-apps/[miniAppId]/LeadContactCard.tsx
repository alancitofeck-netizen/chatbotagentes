import { Phone, CalendarDays, UserRound } from "lucide-react";

export function LeadContactCard({ whatsapp, fecha, agente }: { whatsapp: string; fecha: string; agente?: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-border-default bg-surface-2 p-3.5">
        <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">WhatsApp</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
          <Phone className="size-3.5 text-accent-600" aria-hidden="true" />
          {whatsapp}
        </p>
      </div>
      <div className="rounded-xl border border-border-default bg-surface-2 p-3.5">
        <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Fecha</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
          <CalendarDays className="size-3.5 text-accent-600" aria-hidden="true" />
          {new Date(fecha).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      </div>
      {agente && (
        <div className="col-span-2 rounded-xl border border-border-default bg-surface-2 p-3.5">
          <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Agente</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
            <UserRound className="size-3.5 text-accent-600" aria-hidden="true" />
            {agente}
          </p>
        </div>
      )}
    </div>
  );
}
