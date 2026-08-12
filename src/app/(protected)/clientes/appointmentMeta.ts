import type { BadgeVariant } from "@/components/ui/Badge";
import type { BookingFuente, BookingResultado, ClientAppointment } from "@/lib/clients/queries";

/** Compartido por Agenda/Operación/KPIs — mismas citas (bookings.client_id),
 * mismas etiquetas, tres vistas distintas. */

export const FUENTE_LABEL: Record<BookingFuente, string> = {
  linkedin: "LinkedIn",
  referido: "Referido",
  meta_ads: "Meta Ads",
  otro: "Otro",
};

export const RESULTADO_LABEL: Record<BookingResultado, string> = {
  interesado: "Interesado",
  calificado: "Calificado",
  sin_respuesta: "Sin respuesta",
  no_interesado: "No interesado",
};

export const RESULTADO_VARIANT: Record<BookingResultado, BadgeVariant> = {
  interesado: "success",
  calificado: "success",
  sin_respuesta: "neutral",
  no_interesado: "error",
};

/** "Estado" = Show/No-show/Cancelada/Reagendada/Pendiente — deriva de
 * attended/status (ya existentes), nunca de fuente/resultado (que son
 * campos independientes cargados a mano). */
export function getEstadoMeta(a: Pick<ClientAppointment, "attended" | "status">): { label: string; variant: BadgeVariant } {
  if (a.status === "cancelled") return { label: "Cancelada", variant: "neutral" };
  if (a.status === "rescheduled") return { label: "Reagendada", variant: "warning" };
  if (a.attended === true) return { label: "Show", variant: "success" };
  if (a.attended === false) return { label: "No-show", variant: "error" };
  return { label: "Pendiente", variant: "info" };
}
