import { diceCoefficient, normalizeForMatch } from "@/lib/advisors/import/fuzzyMatch";

/** Target fields a Google Sheets column can map to for the appointment sync
 * engine (Sistema de Agendas) — mismo shape/motor de matching que
 * src/lib/leadSync/fieldDictionary.ts (que a su vez reusa los mismos
 * primitivos genéricos de src/lib/advisors/import/fuzzyMatch.ts), pero un
 * registro separado: acá se resuelven Asesor/Setter contra `clients`/
 * `workspace_members`, no un pipeline/etapa. */
export type AppointmentSyncFieldKey =
  | "leadName"
  | "phone"
  | "advisorName"
  | "setterName"
  | "date"
  | "time"
  | "appointmentType"
  | "estado"
  | "externalId";

export interface AppointmentSyncFieldDescriptor {
  key: AppointmentSyncFieldKey;
  label: string;
  required: boolean;
  hint: string;
  synonyms: string[];
}

export const APPOINTMENT_SYNC_FIELD_DICTIONARY: AppointmentSyncFieldDescriptor[] = [
  { key: "leadName", label: "Cliente / Lead", required: true, hint: "Obligatorio — identifica a la persona prospectada.", synonyms: ["cliente", "lead", "nombre", "nombre completo", "prospecto"] },
  { key: "phone", label: "Teléfono", required: true, hint: "Obligatorio — es la clave para no duplicar contactos.", synonyms: ["telefono", "celular", "whatsapp", "phone", "numero", "tel"] },
  {
    key: "advisorName",
    label: "Asesor",
    required: true,
    hint: "Obligatorio — el asesor/agente que recibe la cita. Se resuelve contra el alias configurado en su ficha o su nombre real.",
    synonyms: ["asesor", "agente", "advisor"],
  },
  {
    key: "setterName",
    label: "Setter",
    required: true,
    hint: "Obligatorio — quién consiguió la cita. Se resuelve por nombre entre los miembros del workspace.",
    synonyms: ["setter", "vendedor", "prospectador"],
  },
  { key: "date", label: "Fecha", required: true, hint: "Obligatorio — junto con Hora arma la fecha/hora de la cita.", synonyms: ["fecha", "date"] },
  { key: "time", label: "Hora", required: false, hint: "Junto con Fecha arma la fecha/hora de la cita.", synonyms: ["hora", "time", "horario"] },
  { key: "appointmentType", label: "Tipo de cita", required: false, hint: "Ej. 'Cita inicial' — se guarda como texto libre.", synonyms: ["tipo", "tipo de cita", "tipo cita"] },
  {
    key: "estado",
    label: "Estado",
    required: false,
    hint: "Agendada/Confirmada/Realizada/No Show/Cancelada/Venta — si no matchea ninguno, queda 'Agendada'.",
    synonyms: ["estado", "status"],
  },
  { key: "externalId", label: "ID externo", required: false, hint: "Recomendado — identifica la fila de forma estable aunque se reordene la hoja.", synonyms: ["id", "id externo", "external id", "codigo"] },
];

const COLUMN_MATCH_THRESHOLD = 0.6;

export interface AppointmentSyncColumnSuggestion {
  header: string;
  fieldKey: AppointmentSyncFieldKey | null;
  score: number;
}

/** Mismo algoritmo de dos pasadas (sinónimo exacto primero, luego mejor
 * puntaje Dice greedy) que detectLeadSyncColumnMapping — duplicado en vez
 * de importado porque el original está acoplado a su propio diccionario. */
export function detectAppointmentSyncColumnMapping(headers: string[]): AppointmentSyncColumnSuggestion[] {
  const results = new Map<string, AppointmentSyncColumnSuggestion>(headers.map((h) => [h, { header: h, fieldKey: null, score: 0 }]));
  const claimedFields = new Set<AppointmentSyncFieldKey>();
  const unmatchedHeaders = new Set<string>(headers);

  for (const header of headers) {
    const normalizedHeader = normalizeForMatch(header);
    const exact = APPOINTMENT_SYNC_FIELD_DICTIONARY.find(
      (field) => !claimedFields.has(field.key) && field.synonyms.some((syn) => normalizeForMatch(syn) === normalizedHeader),
    );
    if (exact) {
      results.set(header, { header, fieldKey: exact.key, score: 1 });
      claimedFields.add(exact.key);
      unmatchedHeaders.delete(header);
    }
  }

  type Candidate = { header: string; fieldKey: AppointmentSyncFieldKey; score: number };
  const candidates: Candidate[] = [];
  for (const header of unmatchedHeaders) {
    for (const field of APPOINTMENT_SYNC_FIELD_DICTIONARY) {
      if (claimedFields.has(field.key)) continue;
      const best = Math.max(...field.synonyms.map((syn) => diceCoefficient(header, syn)));
      if (best >= COLUMN_MATCH_THRESHOLD) candidates.push({ header, fieldKey: field.key, score: best });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const assignedHeaders = new Set<string>();
  for (const candidate of candidates) {
    if (assignedHeaders.has(candidate.header) || claimedFields.has(candidate.fieldKey)) continue;
    results.set(candidate.header, { header: candidate.header, fieldKey: candidate.fieldKey, score: candidate.score });
    claimedFields.add(candidate.fieldKey);
    assignedHeaders.add(candidate.header);
  }

  return headers.map((h) => results.get(h)!);
}

/** Mapeo texto libre (columna Estado) → los 6 valores de bookings.estado_cita.
 * Sin match reconocido → 'agendada' (default seguro: nunca inventa una
 * "venta" ni un "no_show" a partir de texto ambiguo). */
const ESTADO_ALIASES: Record<string, string> = {
  agendada: "agendada",
  agendado: "agendada",
  confirmada: "confirmada",
  confirmado: "confirmada",
  realizada: "realizada",
  realizado: "realizada",
  asistio: "realizada",
  "no show": "no_show",
  noshow: "no_show",
  "no asistio": "no_show",
  cancelada: "cancelada",
  cancelado: "cancelada",
  venta: "venta",
  vendido: "venta",
  vendida: "venta",
};

export function resolveEstadoCita(value: string | undefined): "agendada" | "confirmada" | "realizada" | "no_show" | "cancelada" | "venta" {
  if (!value) return "agendada";
  const normalized = normalizeForMatch(value);
  return (ESTADO_ALIASES[normalized] as ReturnType<typeof resolveEstadoCita>) ?? "agendada";
}
