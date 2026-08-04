import type { PolicyListItem } from "@/lib/policies/queries";
import { parseLocalDate } from "@/lib/calendar/week";

export interface PolicyCalendarEntry {
  id: string;
  /** "YYYY-MM-DD" — always parsed with parseLocalDate, never `new Date(iso)`
   * directly (see week.ts's comment on UTC-offset day-shift bugs). */
  date: string;
  kind: "renewal" | "payment";
  policy: PolicyListItem;
}

const FREQUENCY_STEP_MONTHS: Record<string, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

function dateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Steps a date-only value forward by N months without the JS Date rollover
 * bug (e.g. Jan 31 + 1 month must clamp to Feb 28, not silently become
 * Mar 3) — clamps the day-of-month to the target month's actual length. */
function addMonthsClamped(d: Date, months: number): Date {
  const targetMonthIndex = d.getMonth() + months;
  const daysInTargetMonth = new Date(d.getFullYear(), targetMonthIndex + 1, 0).getDate();
  return new Date(d.getFullYear(), targetMonthIndex, Math.min(d.getDate(), daysInTargetMonth));
}

/** Deriva marcadores de calendario puramente del lado del cliente — nada se
 * persiste. Cada póliza aporta un marcador de "Renovación" en su
 * `endDate`, más N marcadores de "Cobro" calculados entre `startDate` y
 * `endDate` según `paymentFrequency` (mensual/trimestral/semestral/anual;
 * "unico" no genera cobros recurrentes más allá del propio inicio). Vista
 * Calendario de Pólizas: autocontenida, sin sincronizar a /calendar ni
 * tocar `bookings` — decisión explícita para mantener esta entrega acotada
 * (ver alternativa de sync global evaluada y descartada por ahora). */
export function buildPolicyCalendarEntries(policies: PolicyListItem[]): PolicyCalendarEntry[] {
  const entries: PolicyCalendarEntry[] = [];

  for (const policy of policies) {
    if (policy.endDate) {
      entries.push({ id: `${policy.id}-renewal`, date: policy.endDate, kind: "renewal", policy });
    }

    if (!policy.startDate || !policy.endDate || !policy.paymentFrequency) continue;
    const stepMonths = FREQUENCY_STEP_MONTHS[policy.paymentFrequency];
    if (!stepMonths) continue; // "unico" u otro valor sin cadencia recurrente.

    const start = parseLocalDate(policy.startDate);
    const end = parseLocalDate(policy.endDate);
    let cursor = start;
    let index = 0;
    const MAX_PAYMENTS = 60; // tope defensivo — nunca debería alcanzarse con fechas reales.
    while (cursor <= end && index < MAX_PAYMENTS) {
      entries.push({ id: `${policy.id}-payment-${index}`, date: dateOnly(cursor), kind: "payment", policy });
      cursor = addMonthsClamped(start, stepMonths * (index + 1));
      index += 1;
    }
  }

  return entries;
}
