import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runLeadSheetSync, type LeadSheetConnection } from "@/lib/leadSync/runner";
import type { LeadSyncFieldKey } from "@/lib/leadSync/fieldDictionary";

export const maxDuration = 60;

/**
 * Lead sync entrypoint — mirrors src/app/api/cron/sync-kpis/route.ts exactly
 * (same pg_cron+pg_net trigger shape, supabase/migrations/
 * 0084_lead_sheet_sync_cron.sql, every 2 minutes). `claim_pending_lead_sheet_
 * syncs` (0083_lead_sheet_sync_claim.sql) returns up to N active connections
 * oldest-synced-first with FOR UPDATE SKIP LOCKED, so an overlapping tick
 * never double-processes the same sheet.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: claimed, error } = await supabase.rpc("claim_pending_lead_sheet_syncs", { p_limit: 20 });
  if (error) {
    console.error("[cron/sync-lead-sheets] failed to claim connections:", error);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  const connections = (claimed ?? []) as Array<{
    id: string;
    workspace_id: string;
    spreadsheet_id: string;
    sheet_name: string;
    column_map: Record<string, LeadSyncFieldKey>;
    pipeline_id: string;
    default_stage_id: string;
    default_owner_id: string | null;
  }>;

  const results = await Promise.allSettled(
    connections.map((c) =>
      runLeadSheetSync({
        id: c.id,
        workspace_id: c.workspace_id,
        spreadsheet_id: c.spreadsheet_id,
        sheet_name: c.sheet_name,
        column_map: c.column_map,
        pipeline_id: c.pipeline_id,
        default_stage_id: c.default_stage_id,
        default_owner_id: c.default_owner_id,
      } satisfies LeadSheetConnection),
    ),
  );

  return NextResponse.json({ processed: results.length }, { status: 200 });
}
