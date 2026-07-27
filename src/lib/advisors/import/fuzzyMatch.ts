/** Hand-rolled fuzzy string matching — no new dependency (this project's
 * established preference: neither a CSV parser nor a fuzzy-matching library
 * has ever been added just for an import feature, see src/lib/utils/csv.ts's
 * own history). Used for two distinct purposes in the Importador de Cartera:
 * (A) column-header detection against fieldDictionary.ts's synonym lists,
 * (B) entity-name dedupe in Paso 5 (e.g. "San Cristobal" file value vs a
 * "San Cristóbal" row already in insurers/insurance_branches/
 * insurance_products) — different callers, different thresholds, same two
 * functions below.
 *
 * Dice's coefficient (bigram overlap) was chosen over Levenshtein edit
 * distance: header/entity-name pairs commonly differ in word order and
 * length ("N° Póliza" vs "Numero de Poliza", "Federación Patronal" vs
 * "FEDERACION PATRONAL SEGUROS"), which edit distance over-penalizes
 * relative to bigram overlap. */

/** Lowercases, strips accents (NFD decomposition + drop combining marks),
 * and collapses punctuation/whitespace to single spaces, trimmed. Both
 * matching functions below normalize through this before comparing —
 * callers never need to pre-normalize their inputs. */
export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bigramCounts(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < value.length - 1; i++) {
    const bigram = value.slice(i, i + 2);
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }
  return counts;
}

/** Returns a 0-1 similarity score between two strings (1 = identical after
 * normalization). Falls back to an exact-equality check for strings too
 * short to have any bigrams (length < 2 once normalized). */
export function diceCoefficient(a: string, b: string): number {
  const normA = normalizeForMatch(a);
  const normB = normalizeForMatch(b);
  if (normA === normB) return normA.length > 0 ? 1 : 0;
  if (normA.length < 2 || normB.length < 2) return 0;

  const bigramsA = bigramCounts(normA);
  const bigramsB = bigramCounts(normB);
  let intersection = 0;
  for (const [bigram, countA] of bigramsA) {
    const countB = bigramsB.get(bigram);
    if (countB) intersection += Math.min(countA, countB);
  }
  const totalBigrams = normA.length - 1 + (normB.length - 1);
  return totalBigrams > 0 ? (2 * intersection) / totalBigrams : 0;
}

export interface FuzzyMatch<T> {
  item: T;
  score: number;
}

/** Best-scoring candidate for `query` out of `candidates`, or null if the
 * list is empty. Doesn't apply any threshold itself — callers decide what
 * score counts as "good enough" (0.6 for column detection, 0.72 for entity
 * merges — a false-positive merge is far costlier than a missed
 * column-header auto-map, see fieldDictionary.ts/Paso 5's resolution UI). */
export function findBestMatch<T>(query: string, candidates: T[], getText: (item: T) => string): FuzzyMatch<T> | null {
  let best: FuzzyMatch<T> | null = null;
  for (const item of candidates) {
    const score = diceCoefficient(query, getText(item));
    if (!best || score > best.score) best = { item, score };
  }
  return best;
}
