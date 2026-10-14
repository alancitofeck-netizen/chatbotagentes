import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { exportReferralToSheet } from "@/lib/asesorias/referralExport/runner";

export const maxDuration = 60;

/**
 * Red de seguridad para "Exportar Referidos a hoja" — mismo molde que
 * src/app/api/cron/sync-kpis/route.ts: pg_cron + pg_net cada 3 minutos es el
 * disparador real (supabase/migrations/0197_referral_sheet_export.sql),
 * esta entrada diaria en vercel.json es solo el respaldo compatible con el
 * plan Hobby. `claim_pending_referral_exports` (misma migración) devuelve
 * hasta N exports en estado 'pending' (fallaron o quedaron pendientes de la
 * primera vez), más viejos primero, con FOR UPDATE SKIP LOCKED para que
 * varios ticks no se pisen si uno tarda.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: claimed, error } = await supabase.rpc("claim_pending_referral_exports", { p_limit: 20 });
  if (error) {
    console.error("[cron/sync-referral-exports] failed to claim pending exports:", error);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  const pending = (claimed ?? []) as { export_id: string; referral_id: string; workspace_id: string }[];
  const results = await Promise.allSettled(pending.map((p) => exportReferralToSheet(p.workspace_id, p.referral_id)));

  return NextResponse.json({ processed: results.length }, { status: 200 });
}
