import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { recomputeAndCacheClientHealth } from "@/lib/clients/health";

export const maxDuration = 60;

/**
 * Recalcula el Client Health Score de todos los clientes activos, una vez
 * al día — mismo patrón que sync-kpis/flush-buffers: CRON_SECRET + cliente
 * service-role (no hay sesión de usuario acá, RLS de `clients` exige
 * owner/admin). El fallback perezoso en clientes/[clientId]/layout.tsx
 * cubre el hueco entre esta corrida y la creación de un cliente nuevo, o
 * si esta corrida se saltó un día — no hace falta más frecuencia que
 * diaria para un score que solo cambia con datos de negocio.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: clients, error } = await supabase.from("clients").select("id, workspace_id").eq("status", "activo");
  if (error) {
    console.error("[cron/recompute-health-scores] failed to list clients:", error);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  const rows = (clients ?? []) as { id: string; workspace_id: string }[];
  const results = await Promise.allSettled(rows.map((c) => recomputeAndCacheClientHealth(c.workspace_id, c.id, supabase)));
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ processed: results.length, failed }, { status: 200 });
}
