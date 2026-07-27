import { diceCoefficient, normalizeForMatch } from "./fuzzyMatch";

/** Fase 1 field set only — Cliente/Póliza/Fechas/Comercial from the
 * request. Vehículos/Viviendas/Vida are explicitly deferred to a later
 * phase (confirmed with the user); adding them later means appending more
 * descriptors with `entity: 'vehicle'|'home'|'life'` below, no structural
 * change to this registry or to detectColumnMapping. */
export type ImportFieldEntity = "client" | "policy" | "dates" | "commercial";

export interface ImportFieldDescriptor {
  key: string;
  label: string;
  entity: ImportFieldEntity;
  /** Known header spellings, matched after normalizeForMatch (accents/case/
   * punctuation-insensitive) — this is the "rules" half of "reglas +
   * diccionario de sinónimos" (confirmed with the user instead of an LLM
   * call). Keep each field's list disjoint from every other field's so an
   * exact match is never ambiguous (e.g. "company" only lists under
   * `polizaAseguradora`, never under `clienteRazonSocial`, matching the
   * request's own example: "Company → Aseguradora"). */
  synonyms: string[];
}

export const FIELD_DICTIONARY: ImportFieldDescriptor[] = [
  // Cliente
  { key: "clienteNombre", label: "Nombre", entity: "client", synonyms: ["nombre", "cliente", "nombre cliente", "nombre del cliente", "first name", "name", "nombre y apellido"] },
  { key: "clienteApellido", label: "Apellido", entity: "client", synonyms: ["apellido", "apellidos", "last name", "surname"] },
  { key: "clienteRazonSocial", label: "Razón social", entity: "client", synonyms: ["razon social", "empresa", "company name", "business name", "denominacion"] },
  { key: "clienteDni", label: "DNI", entity: "client", synonyms: ["dni", "documento", "cedula", "national id", "numero de documento"] },
  { key: "clienteCuit", label: "CUIT", entity: "client", synonyms: ["cuit", "cuil", "tax id"] },
  { key: "clienteEmail", label: "Email", entity: "client", synonyms: ["email", "correo", "correo electronico", "e-mail", "mail"] },
  { key: "clienteTelefono", label: "Teléfono", entity: "client", synonyms: ["telefono", "tel", "phone", "telefono fijo"] },
  { key: "clienteCelular", label: "Celular", entity: "client", synonyms: ["celular", "movil", "cell", "mobile", "whatsapp", "telefono celular"] },
  { key: "clienteDireccion", label: "Dirección", entity: "client", synonyms: ["direccion", "domicilio", "address"] },
  { key: "clienteCiudad", label: "Ciudad", entity: "client", synonyms: ["ciudad", "localidad", "city"] },
  { key: "clienteProvincia", label: "Provincia", entity: "client", synonyms: ["provincia", "estado", "state", "province"] },
  { key: "clienteCodigoPostal", label: "Código Postal", entity: "client", synonyms: ["codigo postal", "cp", "zip", "zip code", "postal code"] },
  { key: "clienteFechaNacimiento", label: "Fecha de nacimiento", entity: "client", synonyms: ["fecha nacimiento", "fecha de nacimiento", "nacimiento", "birth date", "date of birth", "dob"] },

  // Póliza
  { key: "polizaNumero", label: "Número de póliza", entity: "policy", synonyms: ["numero de poliza", "n poliza", "n poliza numero", "nro poliza", "policy number", "poliza", "numero poliza", "numero"] },
  { key: "polizaEstado", label: "Estado", entity: "policy", synonyms: ["estado", "status", "estado poliza", "estado de la poliza"] },
  { key: "polizaProducto", label: "Producto", entity: "policy", synonyms: ["producto", "product"] },
  { key: "polizaRamo", label: "Ramo", entity: "policy", synonyms: ["ramo", "branch", "line of business", "linea de negocio", "rama"] },
  { key: "polizaSubramo", label: "Subramo", entity: "policy", synonyms: ["subramo", "sub ramo", "subbranch", "sub rama"] },
  { key: "polizaAseguradora", label: "Aseguradora", entity: "policy", synonyms: ["aseguradora", "compania", "company", "insurance company", "insurer", "compania de seguros"] },
  { key: "polizaMoneda", label: "Moneda", entity: "policy", synonyms: ["moneda", "currency"] },
  { key: "polizaPrima", label: "Prima", entity: "policy", synonyms: ["prima", "premium net", "net premium", "prima neta"] },
  { key: "polizaPremio", label: "Premio", entity: "policy", synonyms: ["premio", "premium", "premium total", "total premium", "premio total"] },
  { key: "polizaSumaAsegurada", label: "Suma asegurada", entity: "policy", synonyms: ["suma asegurada", "sum insured", "capital asegurado", "insured amount"] },
  { key: "polizaFormaPago", label: "Forma de pago", entity: "policy", synonyms: ["forma de pago", "forma pago", "payment method", "metodo de pago"] },
  { key: "polizaFrecuencia", label: "Frecuencia", entity: "policy", synonyms: ["frecuencia", "frequency", "frecuencia de pago", "payment frequency"] },
  { key: "polizaObservaciones", label: "Observaciones", entity: "policy", synonyms: ["observaciones", "notas", "comentarios", "notes", "comments", "remarks"] },

  // Fechas
  { key: "fechaEmision", label: "Fecha emisión", entity: "dates", synonyms: ["fecha emision", "fecha de emision", "issue date", "emision"] },
  { key: "fechaInicio", label: "Fecha inicio", entity: "dates", synonyms: ["fecha inicio", "fecha de inicio", "start date", "inicio vigencia"] },
  { key: "fechaVigencia", label: "Fecha vigencia", entity: "dates", synonyms: ["fecha vigencia", "fecha de vigencia", "effective date", "vigencia desde"] },
  { key: "fechaVencimiento", label: "Fecha vencimiento", entity: "dates", synonyms: ["fecha vencimiento", "fecha de vencimiento", "expiration date", "expiration", "vencimiento", "expiry"] },
  { key: "proximaRenovacion", label: "Próxima renovación", entity: "dates", synonyms: ["proxima renovacion", "renovacion", "renewal date", "next renewal", "fecha renovacion"] },

  // Comercial
  { key: "comercialProductor", label: "Productor", entity: "commercial", synonyms: ["productor", "producer"] },
  { key: "comercialAsesor", label: "Asesor", entity: "commercial", synonyms: ["asesor", "advisor", "agente", "agent"] },
  { key: "comercialEjecutivo", label: "Ejecutivo", entity: "commercial", synonyms: ["ejecutivo", "executive", "account executive"] },
  { key: "comercialOficina", label: "Oficina", entity: "commercial", synonyms: ["oficina", "office", "sucursal", "branch office"] },
];

export const FIELD_BY_KEY: Record<string, ImportFieldDescriptor> = Object.fromEntries(
  FIELD_DICTIONARY.map((f) => [f.key, f]),
);

const COLUMN_MATCH_THRESHOLD = 0.6;

export interface ColumnMappingSuggestion {
  header: string;
  fieldKey: string | null;
  score: number;
}

/** Paso 2/3's "lectura inteligente": maps every file header onto at most one
 * internal field key. Two-pass, greedy: (1) exact match against a field's
 * synonym list wins immediately and removes both the header and the field
 * from further consideration; (2) remaining headers are scored against
 * remaining fields' synonym lists via Dice's coefficient, assigned in
 * descending score order, only above COLUMN_MATCH_THRESHOLD. Anything left
 * unmapped comes back with `fieldKey: null` — Paso 3's manual selector
 * handles those; import is never blocked by an unmapped column. */
export function detectColumnMapping(headers: string[]): ColumnMappingSuggestion[] {
  const results = new Map<string, ColumnMappingSuggestion>(headers.map((h) => [h, { header: h, fieldKey: null, score: 0 }]));
  const claimedFields = new Set<string>();
  const unmatchedHeaders = new Set<string>(headers);

  // Pass 1: exact match.
  for (const header of headers) {
    const normalizedHeader = normalizeForMatch(header);
    const exact = FIELD_DICTIONARY.find(
      (field) => !claimedFields.has(field.key) && field.synonyms.some((syn) => normalizeForMatch(syn) === normalizedHeader),
    );
    if (exact) {
      results.set(header, { header, fieldKey: exact.key, score: 1 });
      claimedFields.add(exact.key);
      unmatchedHeaders.delete(header);
    }
  }

  // Pass 2: greedy best-score assignment among what's left.
  type Candidate = { header: string; fieldKey: string; score: number };
  const candidates: Candidate[] = [];
  for (const header of unmatchedHeaders) {
    for (const field of FIELD_DICTIONARY) {
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
