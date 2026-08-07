import "server-only";
import type { CalendarEvent } from "@/lib/calendar/queries";

/** Generador de .ics (RFC 5545) — no hay ninguna librería de calendario en
 * el proyecto (exceljs/pdfkit cubren Excel/PDF, nada cubre ICS todavía) y el
 * formato es texto plano simple, así que se arma a mano en vez de sumar una
 * dependencia nueva solo para esto. Sin line-folding a 75 octetos (la
 * mayoría de los clientes de calendario reales lo toleran igual) — la única
 * simplificación real frente al RFC completo. */

function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcsCalendar(events: CalendarEvent[]): string {
  const now = toIcsDate(new Date().toISOString());
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GrowthLink CRM//Calendario//ES", "CALSCALE:GREGORIAN"];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@growthlink.uk`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${toIcsDate(event.startTime)}`);
    lines.push(`DTEND:${toIcsDate(event.endTime)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
