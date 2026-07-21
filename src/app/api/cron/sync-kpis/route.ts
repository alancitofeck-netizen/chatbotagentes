import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runKpiSyncForSetter } from "@/lib/kpis/syncRunner";

export const maxDuration = 60;

/**
 * KPIs module sync entrypoint — mirrors src/app/api/cron/flush-buffers/route.ts
 * exactly: pg_cron + pg_net is the real trigger (supabase/migrations/
 * 0034_pgcron_kpi_sync.sql, every 3 minutes), `vercel.json`'s once-daily
 * entry is only a Hobby-plan-compatible safety net. `claim_pending_kpi_syncs`
 * (0035_kpi_setter_sheets.sql) returns up to N kpi_setters rows (one Google
 * Sheet per setter, confirmed with the user — not one per workspace) ordered
 * oldest-synced-first, so "hundreds of workspaces × dozens of setters"
 * spreads across ticks instead of one 3-minute tick serially fetching every
 * connected sheet in a single invocation.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: claimed, error } = await supabase.rpc("claim_pending_kpi_syncs", { p_limit: 20 });
  if (error) {
    console.error("[cron/sync-kpis] failed to claim setters:", error);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  const setters = (claimed ?? []) as { id: string; workspace_id: string; spreadsheet_id: string; sheet_name: string | null }[];
  const results = await Promise.allSettled(
    setters.map((s) => runKpiSyncForSetter(s.workspace_id, { id: s.id, spreadsheetId: s.spreadsheet_id, sheetName: s.sheet_name })),
  );

  return NextResponse.json({ processed: results.length }, { status: 200 });
}
