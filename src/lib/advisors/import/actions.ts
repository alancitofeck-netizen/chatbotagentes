"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { requireNotSupervising } from "@/lib/auth/roles";
import { ensurePipeline } from "@/lib/advisors/actions";
import {
  isSupportedFileName,
  isXlsxFileName,
  listWorkbookSheets,
  parseCsvFile,
  parseExcelSheet,
  type ParsedTable,
  type SheetInfo,
} from "./parseFile";
import { detectColumnMapping, type ColumnMappingSuggestion } from "./fieldDictionary";
import {
  applyColumnMapping,
  buildAnalysisSummary,
  candidateKey,
  collectDistinctLookups,
  contactDedupeKey,
  detectContactDuplicates,
  detectPolicyDuplicates,
  suggestIntraFileMerges,
  suggestLookupMatches,
} from "./analysis";
import { downloadImportSourceFile, loadParsedTable, saveParsedTable, uploadImportSourceFile } from "./storage";
import { getImportJob, getImportJobErrors, getImportJobProgress, getImportLookups } from "./queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ImportJobConfig, MappedRowData } from "./types";

const MAX_IMPORT_ROWS = 10_000;
const SAMPLE_ROWS_PREVIEW = 20;

async function requireOwnWorkspace(jobId: string, workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("import_jobs").select("id").eq("id", jobId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) throw new Error("Importación no encontrada en este workspace.");
}

export type StartImportResult =
  | { jobId: string; needsSheetSelection: true; sheets: SheetInfo[]; fileName: string; fileSize: number }
  | {
      jobId: string;
      needsSheetSelection: false;
      headers: string[];
      suggestedMapping: ColumnMappingSuggestion[];
      sampleRows: Record<string, string>[];
      totalRows: number;
      fileName: string;
      fileSize: number;
    };

/** Paso 1: receives the uploaded file, uploads it to the cartera_imports
 * bucket, creates the draft import_jobs row, and either (a) returns the
 * workbook's sheet list for the user to pick one (multi-sheet .xlsx), or
 * (b) parses straight away (single-sheet .xlsx / .csv) and runs Paso 2's
 * automatic column detection immediately. */
export async function startImportJobAction(formData: FormData): Promise<StartImportResult> {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  const memberId = await getCurrentMemberId(workspaceId);

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Ningún archivo recibido.");
  if (!isSupportedFileName(file.name)) {
    throw new Error("Formato no soportado — subí un archivo .xlsx o .csv (los .xls antiguos, re-guardalos como .xlsx).");
  }

  const buffer = await file.arrayBuffer();
  const supabase = await createClient();
  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({
      workspace_id: workspaceId,
      created_by: memberId,
      source_file_name: file.name,
      source_file_size: file.size,
    })
    .select("id")
    .single();
  if (jobError || !job) throw new Error("No se pudo iniciar la importación.");
  const jobId = job.id as string;

  const storagePath = await uploadImportSourceFile(jobId, buffer, file.name);
  await supabase.from("import_jobs").update({ storage_path: storagePath }).eq("id", jobId);

  if (isXlsxFileName(file.name)) {
    const sheets = await listWorkbookSheets(buffer);
    if (sheets.length > 1) {
      return { jobId, needsSheetSelection: true, sheets, fileName: file.name, fileSize: file.size };
    }
    const table = await parseExcelSheet(buffer, sheets[0]?.name ?? "", MAX_IMPORT_ROWS);
    return finalizeUpload(jobId, sheets[0]?.name ?? null, table, file.name, file.size);
  }

  const table = parseCsvFile(await file.text(), MAX_IMPORT_ROWS);
  return finalizeUpload(jobId, null, table, file.name, file.size);
}

async function finalizeUpload(jobId: string, sheetName: string | null, table: ParsedTable, fileName: string, fileSize: number): Promise<StartImportResult> {
  await saveParsedTable(jobId, table);
  const supabase = await createClient();
  await supabase.from("import_jobs").update({ sheet_name: sheetName }).eq("id", jobId);

  return {
    jobId,
    needsSheetSelection: false,
    headers: table.headers,
    suggestedMapping: detectColumnMapping(table.headers),
    sampleRows: table.rows.slice(0, SAMPLE_ROWS_PREVIEW),
    totalRows: table.totalRows,
    fileName,
    fileSize,
  };
}

/** Paso 1's follow-up when the uploaded .xlsx has multiple sheets — parses
 * the chosen one from the already-uploaded original file (no second
 * upload from the client). */
export async function selectImportSheetAction(jobId: string, sheetName: string): Promise<StartImportResult> {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  await requireOwnWorkspace(jobId, workspaceId);

  const supabase = await createClient();
  const { data: job } = await supabase.from("import_jobs").select("storage_path, source_file_name, source_file_size").eq("id", jobId).single();
  const buffer = await downloadImportSourceFile(job!.storage_path as string);
  const table = await parseExcelSheet(buffer, sheetName, MAX_IMPORT_ROWS);
  return finalizeUpload(jobId, sheetName, table, job!.source_file_name as string, Number(job!.source_file_size));
}

/** Paso 3: persists the user-confirmed (or manually corrected) mapping. */
export async function confirmImportMappingAction(jobId: string, mapping: Record<string, string | null>): Promise<void> {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  await requireOwnWorkspace(jobId, workspaceId);

  const supabase = await createClient();
  await supabase.from("import_jobs").update({ column_mapping: mapping, status: "mapped" }).eq("id", jobId);
}

/** Paso 4/5's backend: applies the mapping, validates every row, extracts
 * every distinct insurer/branch/subbranch/product name with a fuzzy-merge
 * suggestion against this workspace's existing catalogs, and detects
 * contact/policy duplicates. Persists the per-row working data as
 * `{jobId}/analyzed.json` (read back by confirmImportConfigAction once the
 * user's Paso 5/6 decisions are known) and the lookup candidates as real
 * import_job_lookups rows (small list, reviewed individually in Paso 5). */
export async function analyzeImportJobAction(jobId: string) {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  await requireOwnWorkspace(jobId, workspaceId);

  const supabase = await createClient();
  await supabase.from("import_jobs").update({ status: "analyzing" }).eq("id", jobId);

  const job = await getImportJob(workspaceId, jobId);
  if (!job) throw new Error("Importación no encontrada.");

  const table = await loadParsedTable(jobId);
  const mappedRows = applyColumnMapping(table, job.columnMapping);
  const lookupCandidates = collectDistinctLookups(mappedRows);
  const [matchByKey, contactMatches, policyMatches] = await Promise.all([
    suggestLookupMatches(workspaceId, lookupCandidates),
    detectContactDuplicates(workspaceId, mappedRows),
    detectPolicyDuplicates(workspaceId, mappedRows),
  ]);

  const mergeSuggestions = suggestIntraFileMerges(lookupCandidates, matchByKey);

  if (lookupCandidates.length > 0) {
    await supabase.from("import_job_lookups").insert(
      lookupCandidates.map((c) => {
        const key = candidateKey(c);
        const match = matchByKey.get(key);
        const merge = mergeSuggestions.get(key);
        return {
          job_id: jobId,
          workspace_id: workspaceId,
          entity_type: c.entityType,
          file_value: c.fileValue,
          normalized_value: c.normalizedValue,
          parent_insurer_file_value: c.parentInsurerFileValue,
          parent_branch_file_value: c.parentBranchFileValue,
          match_candidate_id: match?.candidateId ?? null,
          match_score: match?.score ?? merge?.score ?? null,
          merge_target_normalized_value: !match && merge ? merge.targetNormalizedValue : null,
          resolution: match || merge ? "use_existing" : "create_new",
        };
      }),
    );
  }

  await saveAnalyzedRows(jobId, mappedRows, contactMatches, policyMatches);

  const analysis = buildAnalysisSummary(mappedRows, lookupCandidates, contactMatches, policyMatches);
  await supabase.from("import_jobs").update({ analysis, status: "analyzed" }).eq("id", jobId);
  return analysis;
}

interface AnalyzedRowsCache {
  mappedRows: MappedRowData[];
  contactMatches: ({ matchedContactId: string | null } | null)[];
  policyMatches: (string | null)[];
}

async function saveAnalyzedRows(jobId: string, mappedRows: MappedRowData[], contactMatches: AnalyzedRowsCache["contactMatches"], policyMatches: AnalyzedRowsCache["policyMatches"]) {
  const service = createServiceRoleClient();
  const payload: AnalyzedRowsCache = { mappedRows, contactMatches, policyMatches };
  const { error } = await service.storage
    .from("cartera_imports")
    .upload(`${jobId}/analyzed.json`, JSON.stringify(payload), { upsert: true, contentType: "application/json" });
  if (error) throw new Error("No se pudo guardar el análisis de la importación.");
}

async function loadAnalyzedRows(jobId: string): Promise<AnalyzedRowsCache> {
  const service = createServiceRoleClient();
  const { data, error } = await service.storage.from("cartera_imports").download(`${jobId}/analyzed.json`);
  if (error || !data) throw new Error("No se pudo leer el análisis de la importación — volvé a analizarla.");
  return JSON.parse(await data.text()) as AnalyzedRowsCache;
}

export interface LookupResolutionInput {
  lookupId: string;
  resolution: "create_new" | "use_existing" | "skip";
  useExistingId?: string;
}

/** Paso 5's per-item fuzzy-merge decisions (dozens of distinct insurer/
 * branch/product names, never thousands — reviewing these individually is
 * practical, unlike contact/policy duplicates). Only records the decision;
 * the actual create-or-reuse write happens in the background "lookups"
 * phase (rowProcessor.ts), after Paso 6 is confirmed. */
export async function resolveImportLookupsAction(jobId: string, resolutions: LookupResolutionInput[]): Promise<void> {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  await requireOwnWorkspace(jobId, workspaceId);

  const supabase = await createClient();
  for (const r of resolutions) {
    const update: Record<string, unknown> = { resolution: r.resolution };
    if (r.resolution === "use_existing" && r.useExistingId) update.match_candidate_id = r.useExistingId;
    await supabase.from("import_job_lookups").update(update).eq("id", r.lookupId).eq("job_id", jobId);
  }
}

function resolveContactAction(matched: boolean, config: ImportJobConfig): "create" | "update" | "skip" {
  if (!matched) return config.createClients ? "create" : "skip";
  if (config.skipDuplicates) return "skip";
  return config.contactDuplicateStrategy === "create_new" ? "create" : config.contactDuplicateStrategy;
}

function resolvePolicyAction(matched: boolean, config: ImportJobConfig): "create" | "update" | "skip" | "duplicate" {
  if (!matched) return "create";
  if (config.skipDuplicates) return "skip";
  return config.policyDuplicateStrategy;
}

const ROW_INSERT_BATCH_SIZE = 1000;

/** Paso 6: persists the checkboxes/strategy config, resolves (or
 * provisions, for a first-time Agent workspace) the Asesores pipeline ONCE
 * via the existing ensurePipeline (src/lib/advisors/actions.ts) — cached on
 * the job so the background row loop never re-queries it — computes every
 * row's final contact/policy action from Paso 4/5's dedupe results plus
 * this config, bulk-inserts the up-to-10,000-row queue, and marks the job
 * `queued` for the cron-driven background engine (jobRunner.ts) to pick up. */
export async function confirmImportConfigAction(jobId: string, config: ImportJobConfig): Promise<void> {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  await requireOwnWorkspace(jobId, workspaceId);

  const supabase = await createClient();
  const pipelineId = await ensurePipeline(workspaceId);
  const { data: firstStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { mappedRows, contactMatches, policyMatches } = await loadAnalyzedRows(jobId);
  const job = await getImportJob(workspaceId, jobId);
  // Rows Paso 4 flagged with a hard error (no client name/razón social at
  // all) can never produce a valid contact — force-skip them here rather
  // than let the background phase discover the same failure per row.
  const errorRowNumbers = new Set((job?.analysis.errors ?? []).map((e) => e.row));

  // Real portfolios routinely repeat the same client across several rows
  // (one per policy) — detectContactDuplicates only checked the DB, never
  // the file's own rows against each other, so every repeat became its own
  // brand-new contact (confirmed live). Fixed here: the FIRST row for a
  // given dedupe key (DNI>CUIT>Email>Teléfono, contactDedupeKey in
  // analysis.ts) that has no real DB match goes through the normal
  // resolveContactAction(false, ...) path unchanged; every LATER row
  // sharing that same key is treated as a duplicate (resolveContactAction
  // (true, ...), respecting the user's actual strategy — "create_new" still
  // creates a separate contact per row, on purpose). Both the first row and
  // its followers get `contact_dedupe_key` stamped so the background
  // "clients" phase (rowProcessor.ts's findSiblingContactId) can link a
  // follower to whatever contact the first occurrence ends up producing,
  // even though that contact doesn't exist yet at this point (Paso 6) —
  // same "resolve now, have dependents wait for it" pattern already proven
  // for insurer/branch/product intra-file merges (0058).
  const seenDedupeKeys = new Set<string>();

  const rowsToInsert = mappedRows.map((data, i) => {
    const rowNumber = i + 1;
    if (errorRowNumbers.has(rowNumber)) {
      return {
        job_id: jobId,
        workspace_id: workspaceId,
        row_number: rowNumber,
        data,
        contact_action: "skip" as const,
        matched_contact_id: null,
        contact_dedupe_key: null,
        policy_action: "skip" as const,
        matched_policy_id: null,
        status: "skipped" as const,
        error_message: "Falta el nombre del cliente (o razón social).",
      };
    }
    const contactMatch = contactMatches[i];
    const policyMatch = policyMatches[i];

    let dedupeKey: string | null = null;
    let isDbMatched = Boolean(contactMatch);
    if (!isDbMatched) {
      const key = contactDedupeKey(data);
      if (key) {
        dedupeKey = key;
        isDbMatched = seenDedupeKeys.has(key); // treat a repeat-in-file exactly like a DB match
        seenDedupeKeys.add(key);
      }
    }

    const contactAction = resolveContactAction(isDbMatched, config);
    const policyAction = contactAction === "skip" ? "skip" : resolvePolicyAction(Boolean(policyMatch), config);
    return {
      job_id: jobId,
      workspace_id: workspaceId,
      row_number: rowNumber,
      data,
      contact_action: contactAction,
      matched_contact_id: contactMatch?.matchedContactId ?? null,
      contact_dedupe_key: dedupeKey,
      policy_action: policyAction,
      matched_policy_id: policyMatch ?? null,
      status: contactAction === "skip" ? "skipped" : "pending",
    };
  });

  for (let i = 0; i < rowsToInsert.length; i += ROW_INSERT_BATCH_SIZE) {
    const batch = rowsToInsert.slice(i, i + ROW_INSERT_BATCH_SIZE);
    const { error } = await supabase.from("import_job_rows").insert(batch);
    if (error) throw new Error("No se pudo encolar la importación.");
  }

  const { count: pendingLookups } = await supabase
    .from("import_job_lookups")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("status", "pending");

  await supabase
    .from("import_jobs")
    .update({
      config,
      pipeline_id: pipelineId,
      default_stage_id: firstStage?.id ?? null,
      status: "queued",
      phase: pendingLookups && pendingLookups > 0 ? "lookups" : "clients",
    })
    .eq("id", jobId);

  revalidatePath("/advisors");
}

export async function getImportJobStatusAction(jobId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getImportJob(workspaceId, jobId);
}

export async function getImportLookupsAction(jobId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getImportLookups(workspaceId, jobId);
}

export async function getImportJobErrorsAction(jobId: string, page = 0) {
  const { workspaceId } = await requireActiveWorkspace();
  return getImportJobErrors(workspaceId, jobId, page);
}

export async function getImportJobProgressAction(jobId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getImportJobProgress(workspaceId, jobId);
}

export async function cancelImportJobAction(jobId: string): Promise<void> {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  requireNotSupervising(isSupervising);
  await requireOwnWorkspace(jobId, workspaceId);

  const supabase = await createClient();
  await supabase
    .from("import_jobs")
    .update({ status: "cancelled" })
    .eq("id", jobId)
    .in("status", ["draft", "mapped", "analyzing", "analyzed", "configuring", "queued", "processing"]);
}
