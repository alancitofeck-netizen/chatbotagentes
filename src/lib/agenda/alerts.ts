/** Alertas de "Asesores → Agendas" — puramente determinísticas sobre
 * AgendaAppointment[] ya cargadas (sin IA, sin fetch propio, sin texto
 * genérico): cada función devuelve solo lo que realmente encuentra, nunca
 * un placeholder. La UI solo muestra una alerta cuando su lista no está
 * vacía — nunca "0 citas sin confirmar" como si fuera información. */

import type { AgendaAppointment } from "./queries";

export interface UnconfirmedTodayAlert {
  type: "sin_confirmar_hoy";
  count: number;
}

/** Citas de HOY que siguen en 'agendada' (todavía no confirmadas). */
export function citasSinConfirmarHoy(citas: AgendaAppointment[]): UnconfirmedTodayAlert | null {
  const now = new Date();
  const count = citas.filter((c) => {
    if (c.estadoCita !== "agendada") return false;
    const d = new Date(c.startTime);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }).length;
  return count > 0 ? { type: "sin_confirmar_hoy", count } : null;
}

export interface ConsecutiveNoShowAlert {
  type: "no_shows_consecutivos";
  setterId: string;
  setterName: string;
  streak: number;
}

/** Setters con 3+ No Show consecutivos (los más recientes primero, sin que
 * se interrumpa la racha por otro estado) — umbral elegido para no generar
 * ruido con 1-2 no-shows sueltos. */
export function noShowsConsecutivosPorSetter(citas: AgendaAppointment[], threshold = 3): ConsecutiveNoShowAlert[] {
  const bySetter = new Map<string, AgendaAppointment[]>();
  for (const c of citas) {
    if (!c.setterId) continue;
    bySetter.set(c.setterId, [...(bySetter.get(c.setterId) ?? []), c]);
  }

  const alerts: ConsecutiveNoShowAlert[] = [];
  for (const [setterId, rows] of bySetter) {
    const sorted = [...rows].sort((a, b) => b.startTime.localeCompare(a.startTime));
    let streak = 0;
    for (const c of sorted) {
      if (c.estadoCita !== "no_show") break;
      streak += 1;
    }
    if (streak >= threshold) {
      alerts.push({ type: "no_shows_consecutivos", setterId, setterName: sorted[0].setterName ?? "—", streak });
    }
  }
  return alerts.sort((a, b) => b.streak - a.streak);
}

export interface UpcomingUnconfirmedAlert {
  type: "proximas_sin_confirmar";
  count: number;
  withinHours: number;
}

/** Citas 'agendada' (sin confirmar) que arrancan dentro de las próximas N
 * horas — default 48h, mismo criterio de "requiere atención pronto". */
export function citasProximasSinConfirmar(citas: AgendaAppointment[], withinHours = 48): UpcomingUnconfirmedAlert | null {
  const now = Date.now();
  const limit = now + withinHours * 60 * 60 * 1000;
  const count = citas.filter((c) => {
    if (c.estadoCita !== "agendada") return false;
    const t = new Date(c.startTime).getTime();
    return t >= now && t <= limit;
  }).length;
  return count > 0 ? { type: "proximas_sin_confirmar", count, withinHours } : null;
}

export type AgendaAlert = UnconfirmedTodayAlert | ConsecutiveNoShowAlert | UpcomingUnconfirmedAlert;

/** Junta las tres detecciones en una sola lista, orden fijo (hoy sin
 * confirmar → no-shows consecutivos → próximas sin confirmar) — el orden
 * importa poco acá porque siempre son pocas, pero se fija igual para que la
 * UI no “salte” entre renders. */
export function buildAgendaAlerts(citas: AgendaAppointment[]): AgendaAlert[] {
  const alerts: AgendaAlert[] = [];
  const today = citasSinConfirmarHoy(citas);
  if (today) alerts.push(today);
  alerts.push(...noShowsConsecutivosPorSetter(citas));
  const upcoming = citasProximasSinConfirmar(citas);
  if (upcoming) alerts.push(upcoming);
  return alerts;
}
