import { diceCoefficient, normalizeForMatch } from "@/lib/advisors/import/fuzzyMatch";

/** Target fields a Google Sheets column can map to for the lead sync engine
 * (Fase A — ver plan). Same shape/matching engine as
 * src/lib/advisors/import/fieldDictionary.ts, but a separate registry — this
 * reuses the generic fuzzy-matching primitives (diceCoefficient/
 * normalizeForMatch) without touching the Importador de Cartera module at
 * all. "Workspace"/"Pipeline" from the user's own example table aren't here
 * on purpose: those are connection-level settings (one sync = one workspace
 * + one pipeline), not a per-row value to map. */
export type LeadSyncFieldKey =
  | "contactName"
  | "phone"
  | "email"
  | "meetingDate"
  | "meetingTime"
  | "stage"
  | "notes"
  | "ownerAgent"
  | "country"
  | "tag"
  | "externalId";

export interface LeadSyncFieldDescriptor {
  key: LeadSyncFieldKey;
  label: string;
  required: boolean;
  /** Shown in the mapping wizard next to the field so the user understands
   * what mapping it enables (e.g. "sin esto no se crea el evento de
   * calendario"), same spirit as the field dictionary's own doc comments. */
  hint: string;
  synonyms: string[];
}

export const LEAD_SYNC_FIELD_DICTIONARY: LeadSyncFieldDescriptor[] = [
  { key: "contactName", label: "Nombre del contacto", required: true, hint: "Obligatorio — identifica al lead.", synonyms: ["nombre", "nombre completo", "cliente", "nombre y apellido", "name", "full name"] },
  { key: "phone", label: "Teléfono", required: true, hint: "Obligatorio — es la clave para no duplicar contactos.", synonyms: ["telefono", "celular", "whatsapp", "phone", "numero", "tel"] },
  { key: "email", label: "Email", required: false, hint: "Se usa además del teléfono para evitar duplicados.", synonyms: ["email", "correo", "mail", "correo electronico"] },
  { key: "meetingDate", label: "Fecha reunión", required: false, hint: "Junto con Hora reunión, crea el evento en el Calendario.", synonyms: ["fecha", "fecha agenda", "fecha reunion", "date", "fecha de reunion"] },
  { key: "meetingTime", label: "Hora reunión", required: false, hint: "Junto con Fecha reunión, crea el evento en el Calendario.", synonyms: ["hora", "hora reunion", "time", "horario"] },
  { key: "stage", label: "Estado Lead", required: false, hint: "Se busca por nombre entre las etapas del pipeline elegido — si no matchea ninguna, usa la etapa por defecto.", synonyms: ["estado", "status", "etapa", "estado lead"] },
  { key: "notes", label: "Notas", required: false, hint: "Se guarda como nota del lead.", synonyms: ["observaciones", "notas", "comentarios", "notes", "comments"] },
  { key: "ownerAgent", label: "Agente", required: false, hint: "Se busca por nombre/email entre los miembros del workspace — si no matchea a nadie, usa el agente por defecto.", synonyms: ["setter", "agente", "vendedor", "owner", "asignado", "agent"] },
  { key: "country", label: "País", required: false, hint: "Se guarda en el contacto.", synonyms: ["pais", "country"] },
  { key: "tag", label: "Etiqueta", required: false, hint: "Se aplica como etiqueta del lead (ej. la columna 'Mes').", synonyms: ["mes", "etiqueta", "tag", "categoria"] },
  { key: "externalId", label: "ID externo", required: false, hint: "Recomendado — identifica la fila de forma estable incluso si se reordena la hoja. Sin esto se usa el número de fila.", synonyms: ["id", "id externo", "external id", "codigo"] },
];

const COLUMN_MATCH_THRESHOLD = 0.6;

export interface LeadSyncColumnSuggestion {
  header: string;
  fieldKey: LeadSyncFieldKey | null;
  score: number;
}

/** Same two-pass greedy algorithm as detectColumnMapping in the Importador
 * de Cartera (exact synonym match first, then best-score Dice's-coefficient
 * assignment for what's left) — duplicated here instead of imported because
 * the original is hard-coupled to its own module-level FIELD_DICTIONARY,
 * not parameterized. */
export function detectLeadSyncColumnMapping(headers: string[]): LeadSyncColumnSuggestion[] {
  const results = new Map<string, LeadSyncColumnSuggestion>(headers.map((h) => [h, { header: h, fieldKey: null, score: 0 }]));
  const claimedFields = new Set<LeadSyncFieldKey>();
  const unmatchedHeaders = new Set<string>(headers);

  for (const header of headers) {
    const normalizedHeader = normalizeForMatch(header);
    const exact = LEAD_SYNC_FIELD_DICTIONARY.find(
      (field) => !claimedFields.has(field.key) && field.synonyms.some((syn) => normalizeForMatch(syn) === normalizedHeader),
    );
    if (exact) {
      results.set(header, { header, fieldKey: exact.key, score: 1 });
      claimedFields.add(exact.key);
      unmatchedHeaders.delete(header);
    }
  }

  type Candidate = { header: string; fieldKey: LeadSyncFieldKey; score: number };
  const candidates: Candidate[] = [];
  for (const header of unmatchedHeaders) {
    for (const field of LEAD_SYNC_FIELD_DICTIONARY) {
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
