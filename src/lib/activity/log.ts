import "server-only";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Generic `audit_log` writer (0020_agent_engine_core.sql) — extracted from
 * CRM's `logOpportunityActivity` so the same activity feed mechanism can be
 * reused for other entities (e.g. tasks) without duplicating the insert.
 * `logOpportunityActivity` in src/lib/crm/actions.ts is now a thin wrapper
 * around this, unchanged in behavior. */
export async function logActivity(
  supabase: SupabaseServerClient,
  workspaceId: string,
  actorId: string | null,
  entityType: string,
  entityId: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("audit_log").insert({
    workspace_id: workspaceId,
    actor_type: "user",
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}
