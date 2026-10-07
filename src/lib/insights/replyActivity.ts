/** Actividad de respuesta del día: cuántos contactos respondiste hoy y cuántos
 * días seguidos llevás respondiendo. Son mensajes salientes reales; el día se
 * cuenta en hora de Buenos Aires para que "hoy" sea el día del usuario. */

export const DAILY_REPLY_GOAL = 5;

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const DAY_MS = 24 * 60 * 60 * 1000;

export interface OutboundMessage {
  conversationId: string;
  createdAt: string;
}

export interface ReplyActivity {
  /** Contactos distintos a los que les escribiste hoy. */
  answeredToday: number;
  /** Días seguidos con al menos un mensaje saliente. Si hoy todavía no respondiste,
   * la racha sigue viva hasta el cierre de ayer. */
  streakDays: number;
}

export function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function computeReplyActivity(messages: OutboundMessage[], now: Date): ReplyActivity {
  const today = dayKey(now);
  const days = new Set<string>();
  const contactsToday = new Set<string>();

  for (const message of messages) {
    const key = dayKey(new Date(message.createdAt));
    days.add(key);
    if (key === today) contactsToday.add(message.conversationId);
  }

  // Si hoy no hay respuestas, la racha cuenta desde ayer; si tampoco, arranca en 0.
  const start = days.has(today) ? now : new Date(now.getTime() - DAY_MS);
  let streakDays = 0;
  for (let day = start; days.has(dayKey(day)); day = new Date(day.getTime() - DAY_MS)) {
    streakDays += 1;
  }

  return { answeredToday: contactsToday.size, streakDays };
}
