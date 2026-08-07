import { diceCoefficient, normalizeForMatch } from "@/lib/advisors/import/fuzzyMatch";
import type { FieldDescriptor } from "@/lib/dataTransfer/constants";

const MATCH_THRESHOLD = 0.6;

/** Versión parametrizada de detectColumnMapping (src/lib/advisors/import/
 * fieldDictionary.ts) — esa lee un diccionario fijo a nivel de módulo, esta
 * recibe cualquier FieldDescriptor[], así el mismo detector sirve para
 * Clientes/Tareas/Eventos/Cobros sin duplicar el algoritmo por tipo (mismas
 * dos pasadas: sinónimo exacto primero, después mejor puntaje por Dice's
 * coefficient — reusa diceCoefficient/normalizeForMatch tal cual). */
export function detectColumnMapping(headers: string[], dictionary: FieldDescriptor[]): { header: string; fieldKey: string | null }[] {
  const results = new Map<string, string | null>(headers.map((h) => [h, null]));
  const claimedFields = new Set<string>();
  const unmatched = new Set<string>(headers);

  for (const header of headers) {
    const normalized = normalizeForMatch(header);
    const exact = dictionary.find((f) => !claimedFields.has(f.key) && f.synonyms.some((syn) => normalizeForMatch(syn) === normalized));
    if (exact) {
      results.set(header, exact.key);
      claimedFields.add(exact.key);
      unmatched.delete(header);
    }
  }

  const candidates: { header: string; fieldKey: string; score: number }[] = [];
  for (const header of unmatched) {
    for (const field of dictionary) {
      if (claimedFields.has(field.key)) continue;
      const best = Math.max(...field.synonyms.map((syn) => diceCoefficient(header, syn)));
      if (best >= MATCH_THRESHOLD) candidates.push({ header, fieldKey: field.key, score: best });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const assigned = new Set<string>();
  for (const c of candidates) {
    if (assigned.has(c.header) || claimedFields.has(c.fieldKey)) continue;
    results.set(c.header, c.fieldKey);
    claimedFields.add(c.fieldKey);
    assigned.add(c.header);
  }

  return headers.map((h) => ({ header: h, fieldKey: results.get(h) ?? null }));
}
