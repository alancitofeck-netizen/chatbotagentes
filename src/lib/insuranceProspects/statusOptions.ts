/**
 * Status list + age calculation for "Posibles Pólizas" — deliberately
 * client-safe (no "server-only" import, unlike queries.ts) so list/detail
 * client components can import the option labels and the age helper
 * directly, same split as templateCatalog.ts/linkedAppOptions.ts already
 * use for Mini Apps.
 */

export type ProspectStatus =
  | "nuevo"
  | "pendiente_contacto"
  | "informacion_incompleta"
  | "en_analisis"
  | "cotizacion_enviada"
  | "negociacion"
  | "poliza_emitida"
  | "rechazada"
  | "archivada";

export const PROSPECT_STATUS_OPTIONS: { value: ProspectStatus; label: string }[] = [
  { value: "nuevo", label: "Nuevo" },
  { value: "pendiente_contacto", label: "Pendiente de contacto" },
  { value: "informacion_incompleta", label: "Información incompleta" },
  { value: "en_analisis", label: "En análisis" },
  { value: "cotizacion_enviada", label: "Cotización enviada" },
  { value: "negociacion", label: "Negociación" },
  { value: "poliza_emitida", label: "Póliza emitida" },
  { value: "rechazada", label: "Rechazada" },
  { value: "archivada", label: "Archivada" },
];

export function prospectStatusLabel(status: ProspectStatus): string {
  return PROSPECT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

/** Never persisted — computed from date_of_birth at read time, same
 * "don't store a derived, time-mutable value" principle already used
 * elsewhere in this codebase (see src/lib/classroom/video.ts's duration
 * comment). */
export function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}
