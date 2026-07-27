import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_IMPORT_CONFIG, EMPTY_ANALYSIS, EMPTY_TOTALS, type ImportJobRecord } from "./types";

function mapJobRow(row: Record<string, unknown>): ImportJobRecord {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    sourceFileName: row.source_file_name as string,
    sourceFileSize: Number(row.source_file_size),
    sheetName: (row.sheet_name as string | null) ?? null,
    status: row.status as ImportJobRecord["status"],
    phase: row.phase as ImportJobRecord["phase"],
    columnMapping: (row.column_mapping as Record<string, string | null>) ?? {},
    config: { ...DEFAULT_IMPORT_CONFIG, ...(row.config as object) },
    analysis: { ...EMPTY_ANALYSIS, ...(row.analysis as object) },
    totals: { ...EMPTY_TOTALS, ...(row.totals as object) },
    error: (row.error as string | null) ?? null,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

export async function getImportJob(workspaceId: string, jobId: string): Promise<ImportJobRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("import_jobs").select("*").eq("id", jobId).eq("workspace_id", workspaceId).maybeSingle();
  return data ? mapJobRow(data) : null;
}

export interface ImportLookupRow {
  id: string;
  entityType: "insurer" | "branch" | "subbranch" | "product";
  fileValue: string;
  matchCandidateId: string | null;
  matchCandidateName: string | null;
  matchScore: number | null;
  resolution: "pending" | "create_new" | "use_existing" | "skip";
  /** True when matchCandidateName refers to ANOTHER new value found in this
   * same file (suggestIntraFileMerges), not a real existing catalog row —
   * matchCandidateId stays null in that case (nothing to point to yet, the
   * background engine resolves it via the sibling's own resolved_entity_id
   * once that one finishes, see rowProcessor.ts's resolveLookup). */
  isIntraFileMerge: boolean;
}

/** Paso 5's fuzzy-merge review list — joined against whichever catalog
 * table the entity type points at, so the UI can show the existing name
 * being suggested, not just its id. Small list by nature (distinct
 * insurer/branch/product names in one file — realistically dozens, never
 * thousands), so no pagination. */
export async function getImportLookups(workspaceId: string, jobId: string): Promise<ImportLookupRow[]> {
  const supabase = await createClient();
  const { data: job } = await supabase.from("import_jobs").select("id").eq("id", jobId).eq("workspace_id", workspaceId).maybeSingle();
  if (!job) return [];

  const { data: lookups } = await supabase
    .from("import_job_lookups")
    .select("id, entity_type, file_value, normalized_value, match_candidate_id, match_score, resolution, merge_target_normalized_value")
    .eq("job_id", jobId)
    .order("entity_type")
    .order("file_value");
  if (!lookups || lookups.length === 0) return [];

  const fileValueByNormalized = new Map(lookups.map((l) => [`${l.entity_type}|${l.normalized_value as string}`, l.file_value as string]));

  const insurerIds = lookups.filter((l) => l.entity_type === "insurer" && l.match_candidate_id).map((l) => l.match_candidate_id as string);
  const branchIds = lookups
    .filter((l) => (l.entity_type === "branch" || l.entity_type === "subbranch") && l.match_candidate_id)
    .map((l) => l.match_candidate_id as string);
  const productIds = lookups.filter((l) => l.entity_type === "product" && l.match_candidate_id).map((l) => l.match_candidate_id as string);

  const [{ data: insurers }, { data: branches }, { data: products }] = await Promise.all([
    insurerIds.length ? supabase.from("insurers").select("id, name").in("id", insurerIds) : Promise.resolve({ data: [] }),
    branchIds.length ? supabase.from("insurance_branches").select("id, name").in("id", branchIds) : Promise.resolve({ data: [] }),
    productIds.length ? supabase.from("insurance_products").select("id, name").in("id", productIds) : Promise.resolve({ data: [] }),
  ]);

  const nameById = new Map<string, string>();
  for (const row of [...(insurers ?? []), ...(branches ?? []), ...(products ?? [])]) {
    nameById.set(row.id as string, row.name as string);
  }

  return lookups.map((l) => {
    const mergeTarget = l.merge_target_normalized_value as string | null;
    const mergeTargetFileValue = mergeTarget ? (fileValueByNormalized.get(`${l.entity_type}|${mergeTarget}`) ?? null) : null;
    return {
      id: l.id as string,
      entityType: l.entity_type as ImportLookupRow["entityType"],
      fileValue: l.file_value as string,
      matchCandidateId: (l.match_candidate_id as string | null) ?? null,
      matchCandidateName: l.match_candidate_id ? (nameById.get(l.match_candidate_id as string) ?? null) : mergeTargetFileValue,
      matchScore: l.match_score === null ? null : Number(l.match_score),
      resolution: l.resolution as ImportLookupRow["resolution"],
      isIntraFileMerge: Boolean(!l.match_candidate_id && mergeTarget),
    };
  });
}

export interface ImportErrorRow {
  rowNumber: number;
  errorMessage: string;
}

/** Paso 7's real (not animated) progress readout within the current phase —
 * how many of this job's rows have reached a terminal state so far. */
export async function getImportJobProgress(workspaceId: string, jobId: string): Promise<{ total: number; done: number }> {
  const supabase = await createClient();
  const { data: job } = await supabase.from("import_jobs").select("id").eq("id", jobId).eq("workspace_id", workspaceId).maybeSingle();
  if (!job) return { total: 0, done: 0 };

  const [{ count: total }, { count: done }] = await Promise.all([
    supabase.from("import_job_rows").select("id", { count: "exact", head: true }).eq("job_id", jobId),
    supabase
      .from("import_job_rows")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .in("status", ["policies_done", "skipped", "error"]),
  ]);
  return { total: total ?? 0, done: done ?? 0 };
}

const ERRORS_PAGE_SIZE = 100;

export async function getImportJobErrors(workspaceId: string, jobId: string, page = 0): Promise<{ errors: ImportErrorRow[]; total: number }> {
  const supabase = await createClient();
  const { data: job } = await supabase.from("import_jobs").select("id").eq("id", jobId).eq("workspace_id", workspaceId).maybeSingle();
  if (!job) return { errors: [], total: 0 };

  const { data, count } = await supabase
    .from("import_job_rows")
    .select("row_number, error_message", { count: "exact" })
    .eq("job_id", jobId)
    .eq("status", "error")
    .order("row_number")
    .range(page * ERRORS_PAGE_SIZE, page * ERRORS_PAGE_SIZE + ERRORS_PAGE_SIZE - 1);

  return {
    errors: (data ?? []).map((r) => ({ rowNumber: r.row_number as number, errorMessage: (r.error_message as string) ?? "Error desconocido." })),
    total: count ?? 0,
  };
}
