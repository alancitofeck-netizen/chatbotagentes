import { CalendarCheck2, ListChecks, ShieldCheck, Sparkles } from "lucide-react";
import type { ClientTimelineEvent, ClientTimelineEventType } from "@/lib/clients/queries";

const TIMELINE_ICON: Record<ClientTimelineEventType, typeof CalendarCheck2> = {
  booking: CalendarCheck2,
  task_completed: ListChecks,
  policy: ShieldCheck,
  activity: Sparkles,
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Timeline con íconos — extraído de Resumen (donde se construyó primero)
 * para reusarlo tal cual en "Historial del contrato" (Contrato), en vez de
 * duplicar el JSX. Puramente presentacional: recibe los eventos ya
 * resueltos (getClientTimeline) y el mapa de nombres de miembro ya
 * fetcheado por el caller (Setter/AM/TM lo necesitan igual, no hace falta
 * un segundo fetch acá). */
export function ClientTimelineList({ events, nameById, emptyMessage }: { events: ClientTimelineEvent[]; nameById: Map<string, string>; emptyMessage: string }) {
  if (events.length === 0) return <p className="text-sm text-neutral-500">{emptyMessage}</p>;

  return (
    <ul className="flex flex-col gap-4">
      {events.map((event) => {
        const Icon = TIMELINE_ICON[event.type];
        const actorName = event.actorId ? (nameById.get(event.actorId) ?? null) : null;
        return (
          <li key={event.id} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-medium text-foreground">{event.label}</p>
                <p className="text-xs text-neutral-400">{formatDateTime(event.at)}</p>
              </div>
              {event.detail && <p className="text-[13px] text-neutral-500">{event.detail}</p>}
              {actorName && <p className="text-xs text-neutral-400">Por {actorName}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
