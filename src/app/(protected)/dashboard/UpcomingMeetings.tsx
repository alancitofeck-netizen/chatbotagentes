import { CalendarClock } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import type { CalendarEvent } from "@/lib/calendar/queries";
import { EVENT_TYPE_META } from "@/components/calendar/eventTypeMeta";

function formatWhen(iso: string) {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return isToday ? `Hoy, ${time}` : `${date.toLocaleDateString("es", { day: "2-digit", month: "short" })}, ${time}`;
}

/** Server component (no interactivity needed) — data already resolved by
 * getUpcomingEvents (src/lib/calendar/queries.ts). */
export function UpcomingMeetings({ events }: { events: CalendarEvent[] }) {
  return (
    <Card>
      <CardHeader title="Próximas reuniones" />
      {events.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Sin reuniones próximas" description="Tu agenda está libre por ahora." />
      ) : (
        <ul className="flex flex-col divide-y divide-border-default">
          {events.map((event) => {
            const meta = EVENT_TYPE_META[event.eventType] ?? EVENT_TYPE_META.other;
            return (
              <li key={event.id} className="flex items-center gap-3 py-2.5">
                <span className={`size-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                  <p className="truncate text-[12px] text-neutral-500">
                    {formatWhen(event.startTime)}
                    {event.contactName && ` · ${event.contactName}`}
                    {event.assignedTo && ` · ${event.assignedTo.fullName}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <LinkButton href="/calendar" variant="secondary" size="sm" className="mt-3 w-full justify-center">
        Ver calendario
      </LinkButton>
    </Card>
  );
}
