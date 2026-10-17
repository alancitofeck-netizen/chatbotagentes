import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runAdvisorSheetSync, toAdvisorSheetConnection } from "@/lib/advisorSync/runner";

export const maxDuration = 60;

/**
 * Sincronización unificada Google Sheets → Leads + Agenda + KPIs de Agenda,
 * una conexión por asesor. Reemplaza los crons sync-lead-sheets y
 * sync-appointment-sheets (ver supabase/migrations/0145_unify_advisor_sheet_sync.sql).
 * claim_pending_advisor_sheet_syncs devuelve hasta N conexiones activas
 * ordenadas por last_synced_at con FOR UPDATE SKIP LOCKED, así una corrida
 * solapada nunca procesa la misma hoja dos veces. Desde 0199 NO está
 * programado (la sync de hojas de agenda es solo manual, "Sincronizar ahora"
 * en Agenda); antes: disparado cada 2 horas
 * por pg_cron + pg_net (0145 → 0150 cada 15 min → 0151 cada 2h — consumo
 * mínimo a propósito: cada corrida pega contra una función real de Vercel,
 * pg_net no la exime de invocaciones/CPU, y el plan Hobby se quedó sin
 * cupo). La vía rápida para cambios que no pueden esperar es "Sincronizar
 * ahora" (botón manual en Perfil → Integraciones), no este cron — no es
 * Vercel Cron (Hobby plan solo permite cron diario — ver CLAUDE.md).
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

  const connections = (claimed ?? []) as Record<string, unknown>[];
  const results = await Promise.allSettled(connections.map((c) => runAdvisorSheetSync(toAdvisorSheetConnection(c))));

  return NextResponse.json({ processed: results.length }, { status: 200 });
}
