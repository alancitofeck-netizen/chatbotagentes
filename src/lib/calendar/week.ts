/** Monday-start week helpers, shared by the server page (initial fetch) and
 * the client shell (week navigation) so both compute the same range. */

export function getMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Parses a "YYYY-MM-DD" string as a local-midnight Date. `new Date(str)`
 * parses date-only strings as UTC midnight, which in negative-UTC-offset
 * timezones (e.g. America/Argentina/Buenos_Aires, UTC-3) reads back one
 * calendar day earlier once local getters (getDate/getMonth) are used —
 * shifting week/month ranges off by a day. */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** ISO timestamp → the local "YYYY-MM-DDTHH:mm" value <input type="datetime-local">
 * expects. Converting back is just `new Date(value).toISOString()`. */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const startLabel = weekStart.toLocaleDateString("es", { day: "2-digit", month: sameMonth ? undefined : "short" });
  const endLabel = weekEnd.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}
