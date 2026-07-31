/**
 * Recognized field dictionary for "Posibles Pólizas" — the ONE place a
 * future insurance-quote Mini App's payload field names map to
 * `insurance_prospects` columns. A submission triggers the module only when
 * it contains 1+ of these keys (see ingest.ts's syncInsuranceProspect) —
 * no per-template_key check, so any future Mini App (vida, retiro, salud,
 * accidentes, hogar, auto, ...) works automatically the moment it starts
 * sending recognized fields, same principle "Contactos de Apps" already
 * established for mini-app-origin contacts.
 *
 * `nombre`/`whatsapp` are deliberately NOT here — those are already
 * required top-level fields on every mini_app_leads submission (ingest.ts),
 * so they're read directly from there instead of duplicating a dictionary
 * entry for something already guaranteed to exist.
 */

export type FieldValueType = "string" | "number" | "boolean" | "date";

export interface FieldDictionaryEntry {
  /** The key a Mini App's submission payload is expected to use. */
  payloadKey: string;
  /** The insurance_prospects column it maps to. */
  column: string;
  type: FieldValueType;
}

export const INSURANCE_PROSPECT_FIELD_DICTIONARY: FieldDictionaryEntry[] = [
  { payloadKey: "fecha_nacimiento", column: "date_of_birth", type: "date" },
  { payloadKey: "lugar_nacimiento", column: "place_of_birth", type: "string" },
  { payloadKey: "sexo", column: "sex", type: "string" },
  { payloadKey: "estado_civil", column: "marital_status", type: "string" },
  { payloadKey: "profesion", column: "profession", type: "string" },
  { payloadKey: "ocupacion", column: "occupation", type: "string" },
  { payloadKey: "empresa", column: "employer", type: "string" },
  { payloadKey: "antiguedad_laboral", column: "employment_tenure_months", type: "number" },
  { payloadKey: "ingreso_mensual", column: "monthly_income", type: "number" },
  { payloadKey: "estatura", column: "height_cm", type: "number" },
  { payloadKey: "peso", column: "weight_kg", type: "number" },
  { payloadKey: "fuma", column: "smoker", type: "boolean" },
  { payloadKey: "alcohol", column: "drinks_alcohol", type: "boolean" },
  { payloadKey: "actividad_fisica", column: "exercises", type: "boolean" },
  { payloadKey: "estudios", column: "education", type: "string" },
  { payloadKey: "profesion_obtenida", column: "degree", type: "string" },
  { payloadKey: "especializaciones", column: "specializations", type: "string" },
  { payloadKey: "hobbies", column: "hobbies", type: "string" },
  { payloadKey: "deportes", column: "sports", type: "string" },
  { payloadKey: "intereses", column: "interests", type: "string" },
  { payloadKey: "email", column: "email", type: "string" },
  { payloadKey: "ciudad", column: "city", type: "string" },
  { payloadKey: "provincia", column: "province", type: "string" },
  { payloadKey: "pais", column: "country", type: "string" },
];

function coerce(value: unknown, type: FieldValueType): unknown {
  if (value === null || value === undefined || value === "") return null;
  switch (type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case "boolean":
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return ["true", "si", "sí", "1", "yes"].includes(value.toLowerCase());
      return null;
    case "date": {
      const d = new Date(value as string);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    default:
      return typeof value === "string" ? value : String(value);
  }
}

export interface ExtractedInsuranceFields {
  /** Column-name-keyed values, ready to spread into an insert/update. */
  columns: Record<string, unknown>;
  /** Anything else in the payload not covered by the dictionary — folds
   * into insurance_prospects.extra_fields, the flexible-schema escape hatch. */
  extra: Record<string, unknown>;
  /** True when at least one recognized field was present — this is the
   * gate that decides whether this submission is "about" an insurance
   * quote at all. */
  hasAny: boolean;
}

/** `data` here is whatever ingest.ts already isolated as "everything not a
 * KNOWN_TOP_LEVEL_FIELD" for this lead — i.e. the same object that ends up
 * in mini_app_leads.data. */
export function extractInsuranceProspectFields(data: Record<string, unknown>): ExtractedInsuranceFields {
  const recognizedKeys = new Set(INSURANCE_PROSPECT_FIELD_DICTIONARY.map((e) => e.payloadKey));
  const columns: Record<string, unknown> = {};
  let hasAny = false;

  for (const entry of INSURANCE_PROSPECT_FIELD_DICTIONARY) {
    if (!(entry.payloadKey in data)) continue;
    const coerced = coerce(data[entry.payloadKey], entry.type);
    if (coerced !== null) {
      columns[entry.column] = coerced;
      hasAny = true;
    }
  }

  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!recognizedKeys.has(key)) extra[key] = value;
  }

  return { columns, extra, hasAny };
}
