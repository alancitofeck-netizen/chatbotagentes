import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runAdvisorSheetSync, type AdvisorSheetConnection } from "@/lib/advisorSync/runner";
import type { AdvisorSyncFieldKey } from "@/lib/advisorSync/fieldDictionary";

export const maxDuration = 60;

/**
 * Sincronización unificada Google Sheets → Leads + Agenda + KPIs de Agenda,
 * una conexión por asesor. Reemplaza los crons sync-lead-sheets y
 * sync-appointment-sheets (ver supabase/migrations/0145_unify_advisor_sheet_sync.sql).
 * claim_pending_advisor_sheet_syncs devuelve hasta N conexiones activas
 * ordenadas por last_synced_at con FOR UPDATE SKIP LOCKED, así una corrida
 * solapada nunca procesa la misma hoja dos veces. Disparado cada 15 minutos
 * por pg_cron + pg_net (0145, bajado de cada 2 min en 0150 — cada corrida
 * sigue pegando contra una función real de Vercel, pg_net no la exime de
 * invocaciones/CPU, y el plan Hobby se quedó sin cupo), no por Vercel Cron
 * (Hobby plan solo permite cron diario — ver CLAUDE.md).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: claimed, error } = await supabase.rpc("claim_pending_advisor_sheet_syncs", { p_limit: 20 });
  if (error) {
    console.error("[cron/sync-advisor-sheets] failed to claim connections:", error);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  const connections = (claimed ?? []) as Array<{
    id: string;
    workspace_id: string;
    advisor_client_id: string;
    spreadsheet_id: string;
    sheet_name: string;
    column_map: Record<string, AdvisorSyncFieldKey>;
    header_row: number;
    last_sheet_hash: string | null;
  }>;

  const results = await Promise.allSettled(
    connections.map((c) =>
      runAdvisorSheetSync({
        id: c.id,
        workspace_id: c.workspace_id,
        advisor_client_id: c.advisor_client_id,
        spreadsheet_id: c.spreadsheet_id,
        sheet_name: c.sheet_name,
        column_map: c.column_map,
        header_row: c.header_row,
        last_sheet_hash: c.last_sheet_hash,
      } satisfies AdvisorSheetConnection),
    ),
  );

  return NextResponse.json({ processed: results.length }, { status: 200 });
}
