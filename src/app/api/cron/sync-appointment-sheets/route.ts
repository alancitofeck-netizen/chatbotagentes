import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runAppointmentSheetSync, type AppointmentSheetConnection } from "@/lib/appointmentSync/runner";
import type { AppointmentSyncFieldKey } from "@/lib/appointmentSync/fieldDictionary";

export const maxDuration = 60;

/**
 * Sistema de Agendas — sync de citas setter→asesor. Calco exacto de
 * src/app/api/cron/sync-lead-sheets/route.ts (mismo trigger pg_cron+pg_net,
 * supabase/migrations/0141_agenda_sheet_sync_cron.sql, cada 2 minutos).
 * claim_pending_appointment_sheet_syncs (0140) devuelve hasta N conexiones
 * activas ordenadas por last_synced_at con FOR UPDATE SKIP LOCKED, así una
 * corrida solapada nunca procesa la misma hoja dos veces.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: claimed, error } = await supabase.rpc("claim_pending_appointment_sheet_syncs", { p_limit: 20 });
  if (error) {
    console.error("[cron/sync-appointment-sheets] failed to claim connections:", error);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  const connections = (claimed ?? []) as Array<{
    id: string;
    workspace_id: string;
    spreadsheet_id: string;
    sheet_name: string;
    column_map: Record<string, AppointmentSyncFieldKey>;
    last_sheet_hash: string | null;
  }>;

  const results = await Promise.allSettled(
    connections.map((c) =>
      runAppointmentSheetSync({
        id: c.id,
        workspace_id: c.workspace_id,
        spreadsheet_id: c.spreadsheet_id,
        sheet_name: c.sheet_name,
        column_map: c.column_map,
        last_sheet_hash: c.last_sheet_hash,
      } satisfies AppointmentSheetConnection),
    ),
  );

  return NextResponse.json({ processed: results.length }, { status: 200 });
}
