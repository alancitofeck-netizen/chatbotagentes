import "server-only";
import type { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeForMatch } from "./fuzzyMatch";
import type { ImportJobConfig, MappedRowData } from "./types";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/** Every per-row step here does 1-3 sequential network round trips to
 * Supabase — at 10,000-row scale, processing a batch one row at a time
 * (measured: ~0.6-1s/row against a real hosted project) turns a single
 * client/policy batch into minutes, and the full import into hours. Fixed
 * by running a bounded number of rows concurrently instead — each row's own
 * try/catch still isolates its own failure, so this only changes wall-clock
 * time, not error semantics. 20 was chosen as comfortably inside Supabase's
 * pooled-connection headroom (PostgREST/HTTP requests, not raw Postgres
 * connections) while still cutting batch time by roughly 20x. */
const ROW_CONCURRENCY = 20;

async function processConcurrently<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(ROW_CONCURRENCY, items.length) }, worker));
}

/** Accepts the file's own free-text date spelling — already ISO when it
 * came from an xlsx Date cell (parseFile.ts's cellToString), otherwise
 * commonly dd/mm/yyyy or dd-mm-yyyy in real Argentine portfolios. Returns
 * null (never throws) for anything unrecognized — a date the importer
 * can't parse is a lost field on that row, not a reason to fail it. */
function parseFlexibleDate(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseNumeric(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9,.-]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

async function markError(service: ServiceClient, table: "import_job_lookups" | "import_job_rows", id: string, err: unknown) {
  await service
    .from(table)
    .update({ status: "error", error_message: err instanceof Error ? err.message : "Error desconocido." })
    .eq("id", id);
}

// ---------------------------------------------------------------------------
// Lookups phase — resolve or create insurers/branches/subbranches/products.
// ---------------------------------------------------------------------------

export interface ClaimedLookup {
  id: string;
  job_id: string;
  workspace_id: string;
  entity_type: "insurer" | "branch" | "subbranch" | "product";
  file_value: string;
  normalized_value: string;
  parent_insurer_file_value: string | null;
  parent_branch_file_value: string | null;
  resolution: "pending" | "create_new" | "use_existing" | "skip";
  match_candidate_id: string | null;
  merge_target_normalized_value: string | null;
}

async function findSiblingResolvedId(service: ServiceClient, jobId: string, entityTypes: string[], normalizedValue: string): Promise<string | null> {
  const { data } = await service
    .from("import_job_lookups")
    .select("resolved_entity_id")
    .eq("job_id", jobId)
    .in("entity_type", entityTypes)
    .eq("normalized_value", normalizedValue)
    .eq("status", "done")
    .limit(1)
    .maybeSingle();
  return (data?.resolved_entity_id as string | null) ?? null;
}

/** True when a sibling with this normalized_value exists in this job but
 * has NOT reached a terminal state yet (still pending/processing) — the
 * caller should defer (not error) rather than give up. False also covers
 * "sibling errored" or "no such sibling", both of which are real failures
 * the caller should surface as an error, not retry forever. */
async function siblingStillPending(service: ServiceClient, jobId: string, entityType: string, normalizedValue: string): Promise<boolean> {
  const { data } = await service
    .from("import_job_lookups")
    .select("status")
    .eq("job_id", jobId)
    .eq("entity_type", entityType)
    .eq("normalized_value", normalizedValue)
    .limit(1)
    .maybeSingle();
  return data?.status === "pending" || data?.status === "processing";
}

/** Thrown by resolveLookup when a same-file merge target (Paso 5's
 * "Unificar con…" pointing at ANOTHER new value in this same file, not a
 * real catalog row — suggestIntraFileMerges) hasn't resolved yet. Caught by
 * processLookupBatch, which reverts the row to 'pending' instead of
 * 'error' so a later tick retries it once the sibling is done. */
class LookupNotReadyError extends Error {}

async function findOrCreateInsurer(service: ServiceClient, workspaceId: string, name: string, normalizedName: string): Promise<string> {
  const { data: existing } = await service.from("insurers").select("id").eq("workspace_id", workspaceId).eq("normalized_name", normalizedName).maybeSingle();
  if (existing) return existing.id as string;
  const { data: created, error } = await service.from("insurers").insert({ workspace_id: workspaceId, name, normalized_name: normalizedName }).select("id").single();
  if (error?.code === "23505") {
    const { data: retry } = await service.from("insurers").select("id").eq("workspace_id", workspaceId).eq("normalized_name", normalizedName).maybeSingle();
    if (retry) return retry.id as string;
  }
  if (error || !created) throw new Error("No se pudo crear la aseguradora.");
  return created.id as string;
}

/** insurance_branches dedupes via two PARTIAL unique indexes (Ramo: parent
 * is null; Subramo: parent is a specific branch) — a plain `.upsert()` with
 * onConflict can't target a partial index, so this does the check-then-
 * insert by hand instead (same style as ensureCrmPipeline/ensurePipeline
 * elsewhere in this codebase), with a race-retry on a unique violation. */
async function findOrCreateBranch(service: ServiceClient, workspaceId: string, name: string, normalizedName: string, parentBranchId: string | null): Promise<string> {
  const select = () => {
    const q = service.from("insurance_branches").select("id").eq("workspace_id", workspaceId).eq("normalized_name", normalizedName);
    return parentBranchId ? q.eq("parent_branch_id", parentBranchId) : q.is("parent_branch_id", null);
  };
  const { data: existing } = await select().maybeSingle();
  if (existing) return existing.id as string;
  const { data: created, error } = await service
    .from("insurance_branches")
    .insert({ workspace_id: workspaceId, parent_branch_id: parentBranchId, name, normalized_name: normalizedName })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: retry } = await select().maybeSingle();
    if (retry) return retry.id as string;
  }
  if (error || !created) throw new Error("No se pudo crear el ramo/subramo.");
  return created.id as string;
}

async function findOrCreateProduct(service: ServiceClient, workspaceId: string, insurerId: string, branchId: string | null, name: string, normalizedName: string): Promise<string> {
  const { data: existing } = await service
    .from("insurance_products")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("insurer_id", insurerId)
    .eq("normalized_name", normalizedName)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data: created, error } = await service
    .from("insurance_products")
    .insert({ workspace_id: workspaceId, insurer_id: insurerId, branch_id: branchId, name, normalized_name: normalizedName })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: retry } = await service
      .from("insurance_products")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("insurer_id", insurerId)
      .eq("normalized_name", normalizedName)
      .maybeSingle();
    if (retry) return retry.id as string;
  }
  if (error || !created) throw new Error("No se pudo crear el producto.");
  return created.id as string;
}

async function resolveLookup(service: ServiceClient, jobId: string, lookup: ClaimedLookup): Promise<string | null> {
  if (lookup.resolution === "skip") return null;
  if (lookup.resolution === "use_existing") {
    if (lookup.match_candidate_id) return lookup.match_candidate_id;
    if (lookup.merge_target_normalized_value) {
      const resolvedId = await findSiblingResolvedId(service, jobId, [lookup.entity_type], lookup.merge_target_normalized_value);
      if (resolvedId) return resolvedId;
      if (await siblingStillPending(service, jobId, lookup.entity_type, lookup.merge_target_normalized_value)) {
        throw new LookupNotReadyError();
      }
      throw new Error("No se pudo resolver la fusión con el valor equivalente de este archivo.");
    }
    throw new Error("Sin coincidencia seleccionada para fusionar.");
  }

  switch (lookup.entity_type) {
    case "insurer":
      return findOrCreateInsurer(service, lookup.workspace_id, lookup.file_value, lookup.normalized_value);
    case "branch":
      return findOrCreateBranch(service, lookup.workspace_id, lookup.file_value, lookup.normalized_value, null);
    case "subbranch": {
      const parentId = lookup.parent_branch_file_value
        ? await findSiblingResolvedId(service, jobId, ["branch"], normalizeForMatch(lookup.parent_branch_file_value))
        : null;
      return findOrCreateBranch(service, lookup.workspace_id, lookup.file_value, lookup.normalized_value, parentId);
    }
    case "product": {
      const insurerId = lookup.parent_insurer_file_value
        ? await findSiblingResolvedId(service, jobId, ["insurer"], normalizeForMatch(lookup.parent_insurer_file_value))
        : null;
      const branchId = lookup.parent_branch_file_value
        ? await findSiblingResolvedId(service, jobId, ["branch", "subbranch"], normalizeForMatch(lookup.parent_branch_file_value))
        : null;
      if (!insurerId) throw new Error("No se pudo resolver la aseguradora de este producto.");
      return findOrCreateProduct(service, lookup.workspace_id, insurerId, branchId, lookup.file_value, lookup.normalized_value);
    }
    default:
      throw new Error(`Tipo de entidad desconocido: ${lookup.entity_type}`);
  }
}

export async function processLookupBatch(service: ServiceClient, jobId: string, lookups: ClaimedLookup[]): Promise<void> {
  await processConcurrently(lookups, async (lookup) => {
    try {
      const resolvedId = await resolveLookup(service, jobId, lookup);
      await service.from("import_job_lookups").update({ status: "done", resolved_entity_id: resolvedId }).eq("id", lookup.id);
    } catch (err) {
      if (err instanceof LookupNotReadyError) {
        await service.from("import_job_lookups").update({ status: "pending" }).eq("id", lookup.id);
        return;
      }
      await markError(service, "import_job_lookups", lookup.id, err);
    }
  });
}

// ---------------------------------------------------------------------------
// Clients phase.
// ---------------------------------------------------------------------------

export interface ClaimedRow {
  id: string;
  job_id: string;
  workspace_id: string;
  row_number: number;
  data: MappedRowData;
  contact_action: "create" | "update" | "skip" | null;
  matched_contact_id: string | null;
  /** Set when this row shares a real-world client (DNI/CUIT/Email/Teléfono)
   * with another row in the SAME file — see contactDedupeKey (analysis.ts)
   * and confirmImportConfigAction (actions.ts). Only actually consulted
   * when contact_action='update' and matched_contact_id is null (i.e. the
   * "duplicate" is intra-file only, not a real existing DB contact yet). */
  contact_dedupe_key: string | null;
  contact_id: string | null;
  policy_action: "create" | "update" | "skip" | "duplicate" | null;
  matched_policy_id: string | null;
  policy_id: string | null;
}

function buildContactName(data: MappedRowData): string {
  const full = [data.clienteNombre, data.clienteApellido].filter(Boolean).join(" ").trim();
  return full || data.clienteRazonSocial || "";
}

/** Only recorded separately from `name` when the person's own name (not
 * their razón social) was used as the contact's name — otherwise `company`
 * would just duplicate what's already in `name`. */
function buildContactCompany(data: MappedRowData): string | null {
  const usedPersonName = Boolean([data.clienteNombre, data.clienteApellido].filter(Boolean).join(" ").trim());
  return usedPersonName ? data.clienteRazonSocial || null : null;
}

function buildCustomFields(data: MappedRowData): Record<string, string> {
  const fields: Record<string, string> = {};
  if (data.clienteDireccion) fields.address = data.clienteDireccion;
  if (data.clienteCiudad) fields.city = data.clienteCiudad;
  if (data.clienteProvincia) fields.province = data.clienteProvincia;
  if (data.clienteCodigoPostal) fields.postalCode = data.clienteCodigoPostal;
  const birthDate = parseFlexibleDate(data.clienteFechaNacimiento);
  if (birthDate) fields.birthDate = birthDate;
  return fields;
}

/** Thrown by resolveContactId when a row is waiting on ANOTHER row in this
 * same file to finish creating the shared contact first (contact_dedupe_key
 * — see actions.ts/analysis.ts). Mirrors LookupNotReadyError exactly: caught
 * by processClientRowBatch, which reverts the row to 'pending' instead of
 * 'error' so a later tick retries it once the sibling is done. */
class ContactNotReadyError extends Error {}

async function findSiblingContactId(service: ServiceClient, jobId: string, dedupeKey: string, excludeRowId: string): Promise<string | null> {
  const { data } = await service
    .from("import_job_rows")
    .select("contact_id")
    .eq("job_id", jobId)
    .eq("contact_dedupe_key", dedupeKey)
    .not("contact_id", "is", null)
    .neq("id", excludeRowId)
    .limit(1)
    .maybeSingle();
  return (data?.contact_id as string | null) ?? null;
}

/** True when a sibling sharing this dedupe key exists but hasn't reached a
 * terminal state yet — the caller should defer (ContactNotReadyError)
 * rather than give up. False also covers "sibling errored/skipped" or "no
 * such sibling", both real failures the caller should surface as an error
 * (e.g. the first occurrence was configured to skip client creation
 * entirely, so no contact will ever exist for this key). */
async function siblingContactStillPending(service: ServiceClient, jobId: string, dedupeKey: string, excludeRowId: string): Promise<boolean> {
  const { data } = await service
    .from("import_job_rows")
    .select("status")
    .eq("job_id", jobId)
    .eq("contact_dedupe_key", dedupeKey)
    .is("contact_id", null)
    .neq("id", excludeRowId)
    .in("status", ["pending", "processing"])
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function resolveContactId(service: ServiceClient, row: ClaimedRow): Promise<string> {
  // A real, already-existing DB contact — the pre-0060 path, unchanged.
  if (row.contact_action === "update" && row.matched_contact_id) {
    const data = row.data;
    const payload = {
      workspace_id: row.workspace_id,
      name: buildContactName(data),
      email: data.clienteEmail || null,
      company: buildContactCompany(data),
      dni: data.clienteDni || null,
      cuit: data.clienteCuit || null,
      custom_fields: buildCustomFields(data),
    };
    const { error } = await service.from("contacts").update(payload).eq("id", row.matched_contact_id);
    if (error) throw new Error("No se pudo actualizar el cliente.");
    return row.matched_contact_id;
  }

  // An intra-file duplicate (same DNI/CUIT/Email/Teléfono as another row in
  // THIS file, no real DB match) — reuse whatever contact the first
  // occurrence creates, waiting for it if it hasn't finished yet.
  if (row.contact_action === "update" && !row.matched_contact_id && row.contact_dedupe_key) {
    const siblingId = await findSiblingContactId(service, row.job_id, row.contact_dedupe_key, row.id);
    if (siblingId) return siblingId;
    if (await siblingContactStillPending(service, row.job_id, row.contact_dedupe_key, row.id)) {
      throw new ContactNotReadyError();
    }
    throw new Error("No se pudo vincular con el cliente duplicado de este mismo archivo.");
  }

  // First occurrence of a new client (or contactDuplicateStrategy:'create_new').
  const data = row.data;
  const payload = {
    workspace_id: row.workspace_id,
    name: buildContactName(data),
    email: data.clienteEmail || null,
    company: buildContactCompany(data),
    dni: data.clienteDni || null,
    cuit: data.clienteCuit || null,
    custom_fields: buildCustomFields(data),
  };
  const phone = data.clienteTelefono || data.clienteCelular || null;
  const { data: created, error } = phone
    ? await service.from("contacts").upsert({ ...payload, phone }, { onConflict: "workspace_id,phone" }).select("id").single()
    : await service.from("contacts").insert(payload).select("id").single();
  if (error || !created) throw new Error("No se pudo crear el cliente.");
  return created.id as string;
}

export async function processClientRowBatch(service: ServiceClient, rows: ClaimedRow[]): Promise<void> {
  await processConcurrently(rows, async (row) => {
    try {
      const contactId = await resolveContactId(service, row);
      const nextStatus = row.policy_action === "skip" ? "policies_done" : "clients_done";
      await service.from("import_job_rows").update({ contact_id: contactId, status: nextStatus }).eq("id", row.id);
    } catch (err) {
      if (err instanceof ContactNotReadyError) {
        await service.from("import_job_rows").update({ status: "pending" }).eq("id", row.id);
        return;
      }
      await markError(service, "import_job_rows", row.id, err);
    }
  });
}

// ---------------------------------------------------------------------------
// Policies phase.
// ---------------------------------------------------------------------------

async function findLookupResolvedId(service: ServiceClient, jobId: string, entityTypes: string[], normalizedValue: string): Promise<string | null> {
  return findSiblingResolvedId(service, jobId, entityTypes, normalizedValue);
}

function buildPolicyTitle(data: MappedRowData): string {
  if (data.polizaNumero) return `Póliza ${data.polizaNumero}`;
  return data.polizaProducto || data.polizaAseguradora || "Póliza importada";
}

export interface ImportJobForPolicies {
  workspaceId: string;
  pipelineId: string;
  defaultStageId: string | null;
  config: ImportJobConfig;
  ownerId: string | null;
}

export async function processPolicyRowBatch(service: ServiceClient, job: ImportJobForPolicies, rows: ClaimedRow[]): Promise<void> {
  const updateIds = rows.filter((r) => r.policy_action === "update" && r.matched_policy_id).map((r) => r.matched_policy_id as string);
  const { data: existingPolicies } = updateIds.length
    ? await service.from("advisor_policies").select("id, opportunity_id").in("id", updateIds)
    : { data: [] };
  const opportunityIdByPolicyId = new Map((existingPolicies ?? []).map((p) => [p.id as string, p.opportunity_id as string]));

  await processConcurrently(rows, async (row) => {
    try {
      if (row.policy_action === "skip") {
        await service.from("import_job_rows").update({ status: "policies_done" }).eq("id", row.id);
        return;
      }

      const data = row.data;
      const jobId = row.job_id;
      const insurerId = data.polizaAseguradora ? await findLookupResolvedId(service, jobId, ["insurer"], normalizeForMatch(data.polizaAseguradora)) : null;
      const branchFileValue = data.polizaSubramo || data.polizaRamo;
      const branchId = branchFileValue ? await findLookupResolvedId(service, jobId, ["branch", "subbranch"], normalizeForMatch(branchFileValue)) : null;
      const productId = data.polizaProducto ? await findLookupResolvedId(service, jobId, ["product"], normalizeForMatch(data.polizaProducto)) : null;

      const policyFields = {
        insurer_id: insurerId,
        branch_id: branchId,
        product_id: productId,
        policy_number: data.polizaNumero || null,
        policy_status: data.polizaEstado || null,
        premium_net: parseNumeric(data.polizaPrima),
        premium_total: parseNumeric(data.polizaPremio),
        sum_insured: parseNumeric(data.polizaSumaAsegurada),
        payment_method: data.polizaFormaPago || null,
        payment_frequency: data.polizaFrecuencia || null,
        issue_date: parseFlexibleDate(data.fechaEmision),
        start_date: parseFlexibleDate(data.fechaInicio),
        effective_date: parseFlexibleDate(data.fechaVigencia),
        expiration_date: parseFlexibleDate(data.fechaVencimiento),
        renewal_date: parseFlexibleDate(data.proximaRenovacion),
        productor: data.comercialProductor || null,
        ejecutivo: data.comercialEjecutivo || null,
        oficina: data.comercialOficina || null,
      };
      const value = policyFields.premium_total ?? policyFields.premium_net ?? 0;
      const ownerId = job.config.assignToCurrentAdvisor ? job.ownerId : null;

      let policyId: string;
      let opportunityId: string;

      if (row.policy_action === "update" && row.matched_policy_id && opportunityIdByPolicyId.has(row.matched_policy_id)) {
        policyId = row.matched_policy_id;
        opportunityId = opportunityIdByPolicyId.get(row.matched_policy_id) as string;
        await service.from("opportunities").update({ title: buildPolicyTitle(data), value, currency: data.polizaMoneda || "USD" }).eq("id", opportunityId);
        await service.from("advisor_policies").update(policyFields).eq("id", policyId);
      } else {
        const { data: opp, error: oppErr } = await service
          .from("opportunities")
          .insert({
            workspace_id: job.workspaceId,
            contact_id: row.contact_id,
            title: buildPolicyTitle(data),
            value,
            currency: data.polizaMoneda || "USD",
            owner_id: ownerId,
          })
          .select("id")
          .single();
        if (oppErr || !opp) throw new Error("No se pudo crear la oportunidad.");
        opportunityId = opp.id as string;

        const { data: item, error: itemErr } = await service
          .from("pipeline_items")
          .insert({ pipeline_id: job.pipelineId, stage_id: job.defaultStageId, item_type: "opportunity", item_id: opportunityId, position: 0 })
          .select("id")
          .single();
        if (itemErr || !item) throw new Error("No se pudo agregar la póliza al tablero.");
        await service.from("opportunities").update({ pipeline_item_id: item.id }).eq("id", opportunityId);

        const { data: policy, error: policyErr } = await service
          .from("advisor_policies")
          .insert({ workspace_id: job.workspaceId, opportunity_id: opportunityId, ...policyFields })
          .select("id")
          .single();
        if (policyErr || !policy) throw new Error("No se pudo crear la póliza.");
        policyId = policy.id as string;
      }

      if (job.config.importObservations && data.polizaObservaciones) {
        await service.from("notes").insert({ workspace_id: job.workspaceId, notable_type: "opportunity", notable_id: opportunityId, body: data.polizaObservaciones });
      }

      await service.from("import_job_rows").update({ policy_id: policyId, status: "policies_done" }).eq("id", row.id);
    } catch (err) {
      await markError(service, "import_job_rows", row.id, err);
    }
  });
}

// ---------------------------------------------------------------------------
// Renewals phase — a real (if simple) pass, not a fake progress step: notes
// a policy whose vencimiento is already past or due within 30 days. No
// renewals/tasks table exists yet (confirmed with the user), so this reuses
// the existing polymorphic `notes` table exactly like addDealNote
// (src/lib/advisors/actions.ts).
// ---------------------------------------------------------------------------

const RENEWAL_WINDOW_DAYS = 30;

export async function processRenewalsForJob(service: ServiceClient, workspaceId: string, jobId: string, createRenewals: boolean): Promise<void> {
  if (!createRenewals) return;

  const { data: rows } = await service
    .from("import_job_rows")
    .select("data, policy_id")
    .eq("job_id", jobId)
    .eq("status", "policies_done")
    .not("policy_id", "is", null);
  if (!rows || rows.length === 0) return;

  const policyIds = rows.map((r) => r.policy_id as string);
  const opportunityIdByPolicyId = new Map<string, string>();
  const POLICY_LOOKUP_CHUNK = 500;
  for (let i = 0; i < policyIds.length; i += POLICY_LOOKUP_CHUNK) {
    const { data: policies } = await service
      .from("advisor_policies")
      .select("id, opportunity_id")
      .in("id", policyIds.slice(i, i + POLICY_LOOKUP_CHUNK));
    for (const p of policies ?? []) opportunityIdByPolicyId.set(p.id as string, p.opportunity_id as string);
  }

  const soonThreshold = new Date(Date.now() + RENEWAL_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);

  await processConcurrently(rows, async (row) => {
    const data = row.data as MappedRowData;
    const expiration = parseFlexibleDate(data.fechaVencimiento) || parseFlexibleDate(data.proximaRenovacion);
    if (!expiration || expiration > soonThreshold) return;
    const opportunityId = opportunityIdByPolicyId.get(row.policy_id as string);
    if (!opportunityId) return;
    await service.from("notes").insert({
      workspace_id: workspaceId,
      notable_type: "opportunity",
      notable_id: opportunityId,
      body: `Renovación próxima o vencida (${expiration}) — importada desde cartera.`,
    });
  });
}
