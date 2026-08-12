import { Card, CardHeader } from "@/components/ui/Card";
import type { ClientAppointment } from "@/lib/clients/queries";

const WEEKDAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"];

/** Calendario mensual real: un punto por día que tiene al menos una cita
 * (derivado de startTime), no decorativo. Server component — no necesita
 * interactividad, solo lectura. */
export function MiniCalendar({ appointments, now }: { appointments: ClientAppointment[]; now: Date }) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // lunes=0
  const today = now.getDate();

  const countByDay = new Map<number, number>();
  for (const a of appointments) {
    const d = new Date(a.startTime);
    if (d.getFullYear() === year && d.getMonth() === month) {
      countByDay.set(d.getDate(), (countByDay.get(d.getDate()) ?? 0) + 1);
    }
  }

  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <Card>
      <CardHeader title={now.toLocaleDateString("es", { month: "long", year: "numeric" })} />
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_HEADERS.map((w, i) => (
          <span key={`${w}-${i}`} className="text-[11px] font-medium text-neutral-400">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`empty-${i}`} />;
          const count = countByDay.get(day) ?? 0;
          const isToday = day === today;
          return (
            <div
              key={day}
              className={`flex flex-col items-center gap-0.5 rounded-md py-1 text-xs ${isToday ? "bg-accent-500/15 font-semibold text-accent-700" : "text-foreground"}`}
            >
              {day}
              <span className={`size-1 rounded-full ${count > 0 ? "bg-accent-500" : "bg-transparent"}`} aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
