import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { importGoogleEvents } from "@/lib/integrations/googleCalendar";

export const maxDuration = 60;

/**
 * Google Calendar → CRM automatic sync — before this, `importGoogleEvents`
 * only ran on a manual "Sincronizar ahora" click (src/lib/integrations/actions.ts's
 * syncGoogleCalendarNowAction), so an event created in Google Calendar never
 * appeared in the CRM's own /calendar until someone remembered to go to
 * Configuración → Integraciones and click sync. Same pg_cron + pg_net
 * mechanism as flush-buffers/sync-kpis (supabase/migrations/
 * 0036_pgcron_calendar_sync.sql, every 3 minutes). Deliberately has NO
 * `vercel.json` daily-fallback entry, unlike the other two cron routes —
 * Vercel's Hobby plan caps a project at 2 Cron Jobs total, and that budget
 * is already spent on flush-buffers/sync-kpis; adding a 3rd would risk
 * blocking the next deploy. pg_cron isn't subject to that limit at all
 * (it's not a registered Vercel Cron Job, just an outbound pg_net call), so
 * it remains the sole trigger for this route.
 *
 * Deliberately no claim-RPC/batching here (unlike sync-kpis) — this loops
 * over every workspace with an active google_calendar connection in one
 * tick. importGoogleEvents itself is already cheap (one Calendar API call +
 * upsert-by-external_id) and idempotent; add a claim RPC later if the
 * number of connected workspaces ever makes a single tick too slow.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: connections, error } = await supabase
    .from("integration_connections")
    .select("workspace_id")
    .eq("provider", "google_calendar")
    .eq("status", "active");

  if (error) {
    console.error("[cron/sync-calendar] failed to list connections:", error);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  const workspaceIds = (connections ?? []).map((c) => c.workspace_id as string);
  const results = await Promise.allSettled(workspaceIds.map((id) => importGoogleEvents(id)));

  return NextResponse.json({ processed: results.length }, { status: 200 });
}
