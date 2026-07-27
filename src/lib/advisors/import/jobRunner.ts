import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  processClientRowBatch,
  processLookupBatch,
  processPolicyRowBatch,
  processRenewalsForJob,
  type ClaimedLookup,
  type ClaimedRow,
} from "./rowProcessor";
import { DEFAULT_IMPORT_CONFIG, EMPTY_TOTALS, type ImportJobConfig } from "./types";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

const JOBS_PER_TICK = 5;
const LOOKUP_BATCH_SIZE = 50;
const CLIENT_BATCH_SIZE = 300;
const POLICY_BATCH_SIZE = 150;

// Dependency order: an insurer must resolve before a subbranch/product can
// look it up, a Ramo before its Subramo. Enforced here at the app level
// (not in SQL) — lookup counts per job are always small (distinct names in
// one file), so a cheap per-type existence check per tick is simpler and
// just as correct as a SQL-level dependency graph would be.
const LOOKUP_PHASE_ORDER = ["insurer", "branch", "subbranch", "product"] as const;

interface JobRow {
  id: string;
  workspace_id: string;
  created_by: string | null;
  status: string;
  phase: string;
  pipeline_id: string | null;
  default_stage_id: string | null;
  config: ImportJobConfig;
}

/** Called once per cron tick (src/app/api/cron/process-imports/route.ts).
 * Mirrors runKpiSyncForSetter/processClaimedBuffer's resilience convention:
 * per-job work never throws out of this function — Promise.allSettled at
 * the per-job level means one broken job can never stall every other
 * workspace's import. */
export async function runImportTick(): Promise<{ processedJobs: number }> {
  const service = createServiceRoleClient();
  const { data: jobs } = await service
    .from("import_jobs")
    .select("id, workspace_id, created_by, status, phase, pipeline_id, default_stage_id, config")
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: true })
    .limit(JOBS_PER_TICK);

  const rows = (jobs ?? []) as JobRow[];
  if (rows.length === 0) return { processedJobs: 0 };

  await Promise.allSettled(rows.map((job) => processOneJobTick(service, job)));
  return { processedJobs: rows.length };
}

async function processOneJobTick(service: ServiceClient, job: JobRow): Promise<void> {
  const config: ImportJobConfig = { ...DEFAULT_IMPORT_CONFIG, ...job.config };

  if (job.status === "queued") {
    await service.from("import_jobs").update({ status: "processing" }).eq("id", job.id);
  }

  switch (job.phase) {
    case "lookups": {
      const entityType = await currentPendingLookupType(service, job.id);
      if (!entityType) {
        await service.from("import_jobs").update({ phase: "clients" }).eq("id", job.id);
        return;
      }
      const { data: claimed } = await service.rpc("claim_pending_import_lookups", {
        p_job_id: job.id,
        p_entity_type: entityType,
        p_limit: LOOKUP_BATCH_SIZE,
      });
      const batch = (claimed ?? []) as ClaimedLookup[];
      if (batch.length > 0) await processLookupBatch(service, job.id, batch);
      return;
    }

    case "clients": {
      const { data: claimed } = await service.rpc("claim_pending_import_rows_for_clients", { p_job_id: job.id, p_limit: CLIENT_BATCH_SIZE });
      const batch = (claimed ?? []) as ClaimedRow[];
      if (batch.length > 0) {
        await processClientRowBatch(service, batch);
        return;
      }
      await service.from("import_jobs").update({ phase: "policies" }).eq("id", job.id);
      return;
    }

    case "policies": {
      const { data: claimed } = await service.rpc("claim_pending_import_rows_for_policies", { p_job_id: job.id, p_limit: POLICY_BATCH_SIZE });
      const batch = (claimed ?? []) as ClaimedRow[];
      if (batch.length > 0) {
        await processPolicyRowBatch(
          service,
          { workspaceId: job.workspace_id, pipelineId: job.pipeline_id as string, defaultStageId: job.default_stage_id, config, ownerId: job.created_by },
          batch,
        );
        return;
      }
      await service.from("import_jobs").update({ phase: "renewals" }).eq("id", job.id);
      return;
    }

    case "renewals": {
      await processRenewalsForJob(service, job.workspace_id, job.id, config.createRenewals);
      await service.from("import_jobs").update({ phase: "finalizing" }).eq("id", job.id);
      return;
    }

    case "finalizing": {
      await finalizeJob(service, job.id);
      return;
    }

    default:
      return;
  }
}

async function currentPendingLookupType(service: ServiceClient, jobId: string): Promise<ClaimedLookup["entity_type"] | null> {
  for (const entityType of LOOKUP_PHASE_ORDER) {
    const { count } = await service
      .from("import_job_lookups")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("entity_type", entityType)
      .eq("status", "pending");
    if (count && count > 0) return entityType;
  }
  return null;
}

async function finalizeJob(service: ServiceClient, jobId: string): Promise<void> {
  const { data: rows } = await service.from("import_job_rows").select("status, contact_action, policy_action").eq("job_id", jobId);
  const { data: lookups } = await service.from("import_job_lookups").select("entity_type, resolution, status").eq("job_id", jobId);

  const r = rows ?? [];
  const l = lookups ?? [];
  const isBranchType = (t: string) => t === "branch" || t === "subbranch";

  const totals = {
    ...EMPTY_TOTALS,
    clientsCreated: r.filter((x) => x.contact_action === "create" && x.status !== "error" && x.status !== "skipped").length,
    clientsUpdated: r.filter((x) => x.contact_action === "update" && x.status !== "error" && x.status !== "skipped").length,
    policiesCreated: r.filter((x) => (x.policy_action === "create" || x.policy_action === "duplicate") && x.status === "policies_done").length,
    policiesUpdated: r.filter((x) => x.policy_action === "update" && x.status === "policies_done").length,
    insurersCreated: l.filter((x) => x.entity_type === "insurer" && x.resolution === "create_new" && x.status === "done").length,
    branchesCreated: l.filter((x) => isBranchType(x.entity_type as string) && x.resolution === "create_new" && x.status === "done").length,
    productsCreated: l.filter((x) => x.entity_type === "product" && x.resolution === "create_new" && x.status === "done").length,
    errors: r.filter((x) => x.status === "error").length + l.filter((x) => x.status === "error").length,
  };

  await service
    .from("import_jobs")
    .update({
      phase: "done",
      status: totals.errors > 0 ? "completed_with_errors" : "completed",
      totals,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}
