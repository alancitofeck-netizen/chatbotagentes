import { NextResponse, type NextRequest } from "next/server";
import { runImportTick } from "@/lib/advisors/import/jobRunner";

export const maxDuration = 60;

/**
 * Importador de Cartera's background engine entrypoint — mirrors
 * src/app/api/cron/flush-buffers/route.ts and src/app/api/cron/sync-kpis/route.ts
 * exactly: pg_cron + pg_net is the real trigger (supabase/migrations/
 * 0057_pgcron_import_processing.sql, every 10 seconds — a foreground wizard
 * the user is actively watching, faster than KPI sync's 3 minutes), vercel.json's
 * once-daily entry is only a Hobby-plan-compatible safety net.
 *
 * Unlike the other two cron routes, this one drives a multi-phase state
 * machine per job (lookups → clients → policies → renewals → finalizing)
 * rather than a flat claim-and-process list — see runImportTick
 * (src/lib/advisors/import/jobRunner.ts) for the phase orchestration itself;
 * this route is intentionally thin.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { processedJobs } = await runImportTick();
    return NextResponse.json({ processedJobs }, { status: 200 });
  } catch (err) {
    console.error("[cron/process-imports] tick failed:", err);
    return NextResponse.json({ error: "tick_failed" }, { status: 500 });
  }
}
