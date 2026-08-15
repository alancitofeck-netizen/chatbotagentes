import { diceCoefficient, normalizeForMatch } from "@/lib/advisors/import/fuzzyMatch";

/** Target fields a Google Sheets column can map to for the unified
 * advisor-sheet sync engine (Leads + Agenda + KPIs de Agenda desde una sola
 * conexión por asesor) — fusiona los diccionarios que antes vivían
 * separados en leadSync/fieldDictionary.ts y appointmentSync/fieldDictionary.ts.
 * `advisorName` ya no es obligatorio: el asesor queda fijo en la conexión
 * (advisor_client_id), elegido de un dropdown al crearla — si el usuario
 * igual mapea la columna ASESOR de su hoja, se usa solo como chequeo blando
 * (ver resolveAdvisorMismatch en runner.ts), nunca para resolver identidad. */
export type AdvisorSyncFieldKey =
  | "leadName"
  | "phone"
  | "email"
  | "setterName"
  | "advisorName"
  | "date"
  | "time"
  | "appointmentType"
  | "estado"
  | "notes"
  | "externalId";

export interface AdvisorSyncFieldDescriptor {
  key: AdvisorSyncFieldKey;
  label: string;
  required: boolean;
  hint: string;
  synonyms: string[];
}

export const ADVISOR_SYNC_FIELD_DICTIONARY: AdvisorSyncFieldDescriptor[] = [
  { key: "leadName", label: "Nombre del lead", required: true, hint: "Obligatorio — identifica al lead.", synonyms: ["nombre del lead", "nombre", "cliente", "lead", "nombre completo", "prospecto"] },
  { key: "phone", label: "Teléfono", required: true, hint: "Obligatorio — es la clave para no duplicar contactos.", synonyms: ["telefono", "celular", "whatsapp", "phone", "numero", "tel"] },
  { key: "email", label: "Email", required: false, hint: "Se guarda en el contacto y se usa además del teléfono para evitar duplicados.", synonyms: ["email", "correo", "mail", "correo electronico"] },
  { key: "date", label: "Fecha", required: true, hint: "Obligatorio — junto con Hora arma la fecha/hora de la cita.", synonyms: ["fecha", "date"] },
  { key: "time", label: "Hora", required: false, hint: "Junto con Fecha arma la fecha/hora de la cita.", synonyms: ["hora", "time", "horario"] },
  { key: "setterName", label: "Setter", required: true, hint: "Obligatorio — quién consiguió la cita. Se resuelve por nombre entre los miembros del workspace.", synonyms: ["setter", "vendedor", "prospectador"] },
  {
    key: "advisorName",
    label: "Asesor (opcional)",
    required: false,
    hint: "El asesor ya está fijado por esta conexión — mapeá esta columna solo si querés un chequeo extra de que la fila coincide.",
    synonyms: ["asesor", "agente", "advisor"],
  },
  { key: "appointmentType", label: "Tipo de cita", required: false, hint: "Ej. 'Cita inicial' — se guarda como texto libre.", synonyms: ["tipo", "tipo de cita", "tipo cita"] },
  {
    key: "estado",
    label: "Estado",
    required: false,
    hint: "Agendada/Confirmada/Realizada/No Show/Cancelada/Venta — si no matchea ninguno, queda 'Agendada'.",
    synonyms: ["estado", "status"],
  },
  { key: "notes", label: "Notas", required: false, hint: "Se guarda como nota del lead en el CRM.", synonyms: ["observaciones", "notas", "comentarios", "notes", "comments"] },
  { key: "externalId", label: "ID externo", required: false, hint: "Recomendado — identifica la fila de forma estable aunque se reordene la hoja.", synonyms: ["id", "id externo", "external id", "codigo"] },
];

const COLUMN_MATCH_THRESHOLD = 0.6;

export interface AdvisorSyncColumnSuggestion {
  header: string;
  fieldKey: AdvisorSyncFieldKey | null;
  score: number;
}

/** Mismo algoritmo de dos pasadas (sinónimo exacto primero, luego mejor
 * puntaje Dice greedy) que leadSync/appointmentSync usaban por separado. */
export function detectAdvisorSyncColumnMapping(headers: string[]): AdvisorSyncColumnSuggestion[] {
  const results = new Map<string, AdvisorSyncColumnSuggestion>(headers.map((h) => [h, { header: h, fieldKey: null, score: 0 }]));
  const claimedFields = new Set<AdvisorSyncFieldKey>();
  const unmatchedHeaders = new Set<string>(headers);

  for (const header of headers) {
    const normalizedHeader = normalizeForMatch(header);
    const exact = ADVISOR_SYNC_FIELD_DICTIONARY.find(
      (field) => !claimedFields.has(field.key) && field.synonyms.some((syn) => normalizeForMatch(syn) === normalizedHeader),
    );
    if (exact) {
      results.set(header, { header, fieldKey: exact.key, score: 1 });
      claimedFields.add(exact.key);
      unmatchedHeaders.delete(header);
    }
  }

  type Candidate = { header: string; fieldKey: AdvisorSyncFieldKey; score: number };
  const candidates: Candidate[] = [];
  for (const header of unmatchedHeaders) {
    for (const field of ADVISOR_SYNC_FIELD_DICTIONARY) {
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

/** Mapeo texto libre (columna Estado) → los 6 valores de agenda_appointments.estado_cita.
 * Sin match reconocido → 'agendada' (default seguro). */
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
