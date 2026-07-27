import "server-only";
import { createClient } from "@/lib/supabase/server";
import { findBestMatch, normalizeForMatch } from "./fuzzyMatch";
import type { ParsedTable } from "./parseFile";
import { EMPTY_ANALYSIS, type ImportJobAnalysis, type MappedRowData } from "./types";

/** Applies Paso 3's confirmed header→field mapping to every parsed row.
 * Empty cells and unmapped headers are simply absent from the result — the
 * importer never blocks on missing data here, only flags it later in
 * validateRows/Paso 4. */
export function applyColumnMapping(table: ParsedTable, mapping: Record<string, string | null>): MappedRowData[] {
  return table.rows.map((row) => {
    const mapped: MappedRowData = {};
    for (const [header, fieldKey] of Object.entries(mapping)) {
      if (!fieldKey) continue;
      const value = row[header]?.trim();
      if (value) mapped[fieldKey] = value;
    }
    return mapped;
  });
}

const OPTIONAL_FIELD_COUNT_FOR_COMPLETE = 3;

/** Paso 4's per-row checks — a row missing a client name/razón social can't
 * become a contact at all (hard error, that row is excluded from import);
 * everything else is a soft warning/incomplete flag, never blocks. */
export function validateRows(rows: MappedRowData[]): Pick<ImportJobAnalysis, "errors" | "warnings" | "incomplete"> {
  const errors: { row: number; message: string }[] = [];
  const warnings: { row: number; message: string }[] = [];
  const incomplete: { row: number; message: string }[] = [];

  rows.forEach((row, i) => {
    const rowNumber = i + 1;
    const hasClientIdentity = Boolean(row.clienteNombre || row.clienteRazonSocial);
    if (!hasClientIdentity) {
      errors.push({ row: rowNumber, message: "Falta el nombre del cliente (o razón social) — esta fila no se puede importar." });
      return;
    }
    if (!row.polizaAseguradora) {
      warnings.push({ row: rowNumber, message: "Falta la aseguradora." });
    }
    if (!row.polizaNumero) {
      warnings.push({ row: rowNumber, message: "Falta el número de póliza." });
    }
    const filledCount = Object.values(row).filter(Boolean).length;
    if (filledCount < OPTIONAL_FIELD_COUNT_FOR_COMPLETE) {
      incomplete.push({ row: rowNumber, message: `Solo ${filledCount} campo(s) reconocido(s) en esta fila.` });
    }
  });

  return { errors, warnings, incomplete };
}

export type LookupEntityType = "insurer" | "branch" | "subbranch" | "product";

export interface DistinctLookupCandidate {
  entityType: LookupEntityType;
  fileValue: string;
  normalizedValue: string;
  parentInsurerFileValue: string | null;
  parentBranchFileValue: string | null;
}

/** Extracts every distinct insurer/branch/subbranch/product name across all
 * rows — realistically dozens of values even at 10,000 rows (real
 * portfolios reuse the same handful of insurers/products constantly), which
 * is exactly why Paso 5 can afford to review each one individually instead
 * of needing a bulk strategy the way contact/policy duplicates do. */
export function collectDistinctLookups(rows: MappedRowData[]): DistinctLookupCandidate[] {
  const seen = new Map<string, DistinctLookupCandidate>();

  function add(entityType: LookupEntityType, fileValue: string | undefined, parentInsurer?: string, parentBranch?: string) {
    if (!fileValue) return;
    const normalizedValue = normalizeForMatch(fileValue);
    if (!normalizedValue) return;
    const key = [entityType, normalizedValue, parentInsurer ? normalizeForMatch(parentInsurer) : "", parentBranch ? normalizeForMatch(parentBranch) : ""].join("|");
    if (seen.has(key)) return;
    seen.set(key, {
      entityType,
      fileValue,
      normalizedValue,
      parentInsurerFileValue: parentInsurer ?? null,
      parentBranchFileValue: parentBranch ?? null,
    });
  }

  for (const row of rows) {
    add("insurer", row.polizaAseguradora);
    add("branch", row.polizaRamo);
    if (row.polizaSubramo) add("subbranch", row.polizaSubramo, undefined, row.polizaRamo);
    // A product's branch is whichever is more specific for that row —
    // Subramo when given, otherwise Ramo.
    if (row.polizaProducto) add("product", row.polizaProducto, row.polizaAseguradora, row.polizaSubramo || row.polizaRamo);
  }

  return [...seen.values()];
}

/** Same key shape used for both the existing-catalog match map
 * (suggestLookupMatches) and the intra-file merge map (suggestIntraFileMerges)
 * — keeps the two lookups aligned to the same DistinctLookupCandidate. */
export function candidateKey(c: DistinctLookupCandidate): string {
  return `${c.entityType}|${c.normalizedValue}|${c.parentInsurerFileValue ?? ""}|${c.parentBranchFileValue ?? ""}`;
}

interface CatalogRow {
  id: string;
  name: string;
}

const ENTITY_MATCH_THRESHOLD = 0.72;

/** Suggests an existing catalog row to merge into for each distinct value
 * found in the file — never auto-applied, always a suggestion the user
 * confirms/rejects in Paso 5 (a false-positive merge is far costlier than
 * a missed suggestion). */
export async function suggestLookupMatches(
  workspaceId: string,
  candidates: DistinctLookupCandidate[],
): Promise<Map<string, { candidateId: string; score: number } | null>> {
  const supabase = await createClient();
  const [{ data: insurers }, { data: branches }, { data: products }] = await Promise.all([
    supabase.from("insurers").select("id, name").eq("workspace_id", workspaceId),
    supabase.from("insurance_branches").select("id, name").eq("workspace_id", workspaceId),
    supabase.from("insurance_products").select("id, name").eq("workspace_id", workspaceId),
  ]);

  const catalogByType: Record<LookupEntityType, CatalogRow[]> = {
    insurer: (insurers ?? []) as CatalogRow[],
    branch: (branches ?? []) as CatalogRow[],
    subbranch: (branches ?? []) as CatalogRow[],
    product: (products ?? []) as CatalogRow[],
  };

  const results = new Map<string, { candidateId: string; score: number } | null>();
  for (const candidate of candidates) {
    const pool = catalogByType[candidate.entityType];
    const best = pool.length ? findBestMatch(candidate.fileValue, pool, (row) => row.name) : null;
    const key = candidateKey(candidate);
    results.set(key, best && best.score >= ENTITY_MATCH_THRESHOLD ? { candidateId: (best.item as CatalogRow).id, score: best.score } : null);
  }
  return results;
}

export interface IntraFileMergeSuggestion {
  targetNormalizedValue: string;
  targetFileValue: string;
  score: number;
}

/** Real-world portfolios often carry the SAME insurer/branch/product under
 * two distinct spellings within one file (e.g. "Federacion Patronal" vs
 * "Federación Patronal S.A." — normalizeForMatch's accent-stripping alone
 * already collapses pure-accent variants like "San Cristobal"/"San
 * Cristóbal" into one DistinctLookupCandidate, but this pair differs by more
 * than accents). suggestLookupMatches only compares against the workspace's
 * EXISTING catalog — this compares NEW candidates (no catalog match) against
 * EACH OTHER within the same batch, same 0.72 threshold, same "always a
 * suggestion, never auto-applied" principle: Paso 5 still shows it as a
 * "Unificar con…" choice the user must confirm. Only candidates that didn't
 * already match the real catalog are considered, since those are already
 * correctly anchored. */
export function suggestIntraFileMerges(
  candidates: DistinctLookupCandidate[],
  catalogMatchByKey: Map<string, { candidateId: string; score: number } | null>,
): Map<string, IntraFileMergeSuggestion> {
  const suggestions = new Map<string, IntraFileMergeSuggestion>();
  const canonicalsByGroup = new Map<string, DistinctLookupCandidate[]>();

  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    if (catalogMatchByKey.get(key)) continue;

    const groupKey = [
      candidate.entityType,
      candidate.parentInsurerFileValue ? normalizeForMatch(candidate.parentInsurerFileValue) : "",
      candidate.parentBranchFileValue ? normalizeForMatch(candidate.parentBranchFileValue) : "",
    ].join("|");
    const canonicals = canonicalsByGroup.get(groupKey) ?? [];

    const best = canonicals.length ? findBestMatch(candidate.fileValue, canonicals, (c) => c.fileValue) : null;
    if (best && best.score >= ENTITY_MATCH_THRESHOLD) {
      const target = best.item as DistinctLookupCandidate;
      suggestions.set(key, { targetNormalizedValue: target.normalizedValue, targetFileValue: target.fileValue, score: best.score });
    } else {
      canonicals.push(candidate);
      canonicalsByGroup.set(groupKey, canonicals);
    }
  }

  return suggestions;
}

export interface ContactDedupeResult {
  matchedContactId: string | null;
}

const CONTACT_FUZZY_FALLBACK_CAP = 500;

/** Paso 5's contact-duplicate detection: exact key match (DNI/CUIT/Email/
 * Teléfono) first via real indexed queries — cheap and reliable regardless
 * of row count. Fuzzy name matching is only a fallback for rows that miss
 * every exact key, and only up to CONTACT_FUZZY_FALLBACK_CAP rows, to keep
 * this analysis step inside a single request's time budget at 10,000-row
 * scale; rows beyond the cap default to "create" with a warning already
 * recorded by validateRows-adjacent logic in analyzeImportJobAction. */
export async function detectContactDuplicates(workspaceId: string, rows: MappedRowData[]): Promise<(ContactDedupeResult | null)[]> {
  const supabase = await createClient();

  const dnis = [...new Set(rows.map((r) => r.clienteDni).filter((v): v is string => Boolean(v)))];
  const cuits = [...new Set(rows.map((r) => r.clienteCuit).filter((v): v is string => Boolean(v)))];
  const emails = [...new Set(rows.map((r) => r.clienteEmail).filter((v): v is string => Boolean(v)))];
  const phones = [...new Set(rows.flatMap((r) => [r.clienteTelefono, r.clienteCelular]).filter((v): v is string => Boolean(v)))];

  const [{ data: byDni }, { data: byCuit }, { data: byEmail }, { data: byPhone }] = await Promise.all([
    dnis.length ? supabase.from("contacts").select("id, dni").eq("workspace_id", workspaceId).in("dni", dnis) : Promise.resolve({ data: [] }),
    cuits.length ? supabase.from("contacts").select("id, cuit").eq("workspace_id", workspaceId).in("cuit", cuits) : Promise.resolve({ data: [] }),
    emails.length ? supabase.from("contacts").select("id, email").eq("workspace_id", workspaceId).in("email", emails) : Promise.resolve({ data: [] }),
    phones.length ? supabase.from("contacts").select("id, phone").eq("workspace_id", workspaceId).in("phone", phones) : Promise.resolve({ data: [] }),
  ]);

  const idByDni = new Map((byDni ?? []).map((c) => [c.dni as string, c.id as string]));
  const idByCuit = new Map((byCuit ?? []).map((c) => [c.cuit as string, c.id as string]));
  const idByEmail = new Map((byEmail ?? []).map((c) => [c.email as string, c.id as string]));
  const idByPhone = new Map((byPhone ?? []).map((c) => [c.phone as string, c.id as string]));

  let fuzzyBudget = CONTACT_FUZZY_FALLBACK_CAP;
  let fuzzyPool: CatalogRow[] | null = null;

  const results: (ContactDedupeResult | null)[] = [];
  for (const row of rows) {
    const exact =
      (row.clienteDni && idByDni.get(row.clienteDni)) ||
      (row.clienteCuit && idByCuit.get(row.clienteCuit)) ||
      (row.clienteEmail && idByEmail.get(row.clienteEmail)) ||
      (row.clienteTelefono && idByPhone.get(row.clienteTelefono)) ||
      (row.clienteCelular && idByPhone.get(row.clienteCelular)) ||
      null;

    if (exact) {
      results.push({ matchedContactId: exact });
      continue;
    }

    const name = row.clienteNombre || row.clienteRazonSocial;
    if (!name || fuzzyBudget <= 0) {
      results.push(null);
      continue;
    }
    if (fuzzyPool === null) {
      const { data } = await supabase.from("contacts").select("id, name").eq("workspace_id", workspaceId);
      fuzzyPool = (data ?? []) as CatalogRow[];
    }
    fuzzyBudget--;
    const best = fuzzyPool.length ? findBestMatch(name, fuzzyPool, (c) => c.name) : null;
    results.push(best && best.score >= ENTITY_MATCH_THRESHOLD ? { matchedContactId: (best.item as CatalogRow).id } : null);
  }

  return results;
}

/** Paso 5's policy-duplicate detection — exact match on policy_number
 * within this workspace only (never across workspaces). */
export async function detectPolicyDuplicates(workspaceId: string, rows: MappedRowData[]): Promise<(string | null)[]> {
  const supabase = await createClient();
  const numbers = [...new Set(rows.map((r) => r.polizaNumero).filter((v): v is string => Boolean(v)))];
  if (numbers.length === 0) return rows.map(() => null);

  const { data } = await supabase.from("advisor_policies").select("id, policy_number").eq("workspace_id", workspaceId).in("policy_number", numbers);
  const idByNumber = new Map((data ?? []).map((p) => [p.policy_number as string, p.id as string]));
  return rows.map((row) => (row.polizaNumero ? (idByNumber.get(row.polizaNumero) ?? null) : null));
}

export function buildAnalysisSummary(
  rows: MappedRowData[],
  lookupCandidates: DistinctLookupCandidate[],
  contactMatches: (ContactDedupeResult | null)[],
  policyMatches: (string | null)[],
): ImportJobAnalysis {
  const { errors, warnings, incomplete } = validateRows(rows);
  return {
    ...EMPTY_ANALYSIS,
    totalRows: rows.length,
    clientsFound: rows.filter((r) => r.clienteNombre || r.clienteRazonSocial).length,
    policiesFound: rows.length,
    insurersFound: lookupCandidates.filter((c) => c.entityType === "insurer").length,
    branchesFound: lookupCandidates.filter((c) => c.entityType === "branch" || c.entityType === "subbranch").length,
    productsFound: lookupCandidates.filter((c) => c.entityType === "product").length,
    contactDuplicates: contactMatches.filter(Boolean).length,
    policyDuplicates: policyMatches.filter(Boolean).length,
    errors,
    warnings,
    incomplete,
  };
}
