import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { paymentPendingSeverity } from "@/lib/clients/alerts";
import type { ClientContract, ClientHealthLabel } from "@/lib/clients/queries";

export interface ClientHealthResult {
  score: number;
  label: ClientHealthLabel;
}

function labelFor(score: number): ClientHealthLabel {
  if (score >= 70) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

const MS_DAY = 1000 * 60 * 60 * 24;

/** Client Health Score (0-100) — 6 factores ponderados, cada uno calculado
 * en vivo sobre datos que ya existen (mismo criterio que getClientsList/
 * alerts.ts: nada de rollups guardados, solo el score final se cachea en
 * `clients.health_score*`). Sin datos suficientes para juzgar un factor →
 * no penaliza (puntaje completo de ese factor), salvo ROI, donde el propio
 * enunciado pide 0 explícitamente cuando no hay datos — es la única
 * excepción, documentada en su bloque. */
export async function computeClientHealthScore(workspaceId: string, clientId: string, supabaseClient?: SupabaseClient): Promise<ClientHealthResult> {
  const supabase = supabaseClient ?? (await createClient());
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * MS_DAY).toISOString();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [{ data: tasks }, { data: bookings }, { data: contractRow }, { data: policies }] = await Promise.all([
    supabase.from("tasks").select("status, due_at, updated_at").eq("workspace_id", workspaceId).eq("client_id", clientId),
    supabase.from("bookings").select("start_time, attended").eq("workspace_id", workspaceId).eq("client_id", clientId),
    supabase
      .from("client_contracts")
      .select("id, client_id, status, start_date, end_date, duration_months, total_value, monthly_value, amount_paid, currency, commission_model, document_id, notes, created_at")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .eq("status", "activo")
      .maybeSingle(),
    supabase.from("policies").select("commission_amount").eq("workspace_id", workspaceId).eq("client_id", clientId),
  ]);

  const contract: ClientContract | null = contractRow
    ? {
        id: contractRow.id as string,
        clientId: contractRow.client_id as string,
        status: contractRow.status as ClientContract["status"],
        startDate: contractRow.start_date as string,
        endDate: contractRow.end_date as string,
        durationMonths: contractRow.duration_months as number | null,
        totalValue: contractRow.total_value as number | null,
        monthlyValue: contractRow.monthly_value as number | null,
        amountPaid: contractRow.amount_paid as number | null,
        currency: contractRow.currency as string,
        commissionModel: contractRow.commission_model as string | null,
        documentId: contractRow.document_id as string | null,
        notes: contractRow.notes as string | null,
        createdAt: contractRow.created_at as string,
      }
    : null;

  // 1) Cumplimiento de tareas (20%) — tareas con vencimiento en los
  // últimos 30 días, % que terminaron 'completed'. Sin tareas vencidas en
  // esa ventana → no hay nada que juzgar, puntaje completo.
  const thirtyDaysAgo = new Date(now.getTime() - 30 * MS_DAY).toISOString();
  const dueRecently = (tasks ?? []).filter((t) => typeof t.due_at === "string" && t.due_at >= thirtyDaysAgo && t.due_at <= now.toISOString());
  const taskPoints = dueRecently.length === 0 ? 20 : (dueRecently.filter((t) => t.status === "completed").length / dueRecently.length) * 20;

  // 2) Actividad reciente (15%) — última cita o última actualización de
  // tarea; completo a ≤7 días, decae lineal a 0 en 30+.
  const lastBooking = (bookings ?? []).map((b) => b.start_time as string).sort().at(-1) ?? null;
  const lastTaskUpdate = (tasks ?? []).map((t) => t.updated_at as string).sort().at(-1) ?? null;
  const lastActivity = [lastBooking, lastTaskUpdate].filter((v): v is string => v !== null).sort().at(-1) ?? null;
  let activityPoints = 0;
  if (lastActivity) {
    const daysSince = (now.getTime() - new Date(lastActivity).getTime()) / MS_DAY;
    activityPoints = daysSince <= 7 ? 15 : daysSince >= 30 ? 0 : 15 * (1 - (daysSince - 7) / 23);
  }

  // 3) Tendencia de citas (20%) — este mes vs el anterior. Igual o
  // creciendo = completo; cayendo = proporcional. Sin citas el mes
  // anterior y alguna este mes = completo (no hay caída que penalizar).
  const citasEsteMes = (bookings ?? []).filter((b) => new Date(b.start_time as string) >= thisMonthStart).length;
  const citasMesAnterior = (bookings ?? []).filter((b) => {
    const d = new Date(b.start_time as string);
    return d >= lastMonthStart && d < thisMonthStart;
  }).length;
  const trendPoints = citasMesAnterior === 0 || citasEsteMes >= citasMesAnterior ? 20 : (citasEsteMes / citasMesAnterior) * 20;

  // 4) Show rate (15%) — citas atendidas/total, últimos 90 días; completo
  // a partir de 70%. Sin citas en la ventana → no penaliza.
  const recentBookings = (bookings ?? []).filter((b) => (b.start_time as string) >= ninetyDaysAgo);
  const attended = recentBookings.filter((b) => b.attended === true).length;
  const showRate = recentBookings.length > 0 ? attended / recentBookings.length : null;
  const showRatePoints = showRate === null ? 15 : Math.min(1, showRate / 0.7) * 15;

  // 5) ROI (15%) — comisión total generada / lo pagado en el contrato
  // activo. Única excepción a "sin datos no penaliza": el propio criterio
  // de negocio pide 0 puntos cuando no hay contrato activo o no pagó nada
  // todavía (no hay forma de justificar el gasto sin esa base).
  const totalCommission = (policies ?? []).reduce((sum, p) => sum + ((p.commission_amount as number | null) ?? 0), 0);
  const amountPaid = contract?.amountPaid ?? 0;
  const roi = amountPaid > 0 ? totalCommission / amountPaid : 0;
  const roiPoints = amountPaid <= 0 ? 0 : roi >= 2 ? 15 : roi >= 1 ? 7.5 : 0;

  // 6) Estado de pago (15%) — completo si no hay saldo pendiente (misma
  // regla que la alerta "payment_pending", reusada para no duplicar el
  // umbral en dos lugares).
  const paymentPoints = paymentPendingSeverity(contract) ? 0 : 15;

  const score = Math.max(0, Math.min(100, Math.round(taskPoints + activityPoints + trendPoints + showRatePoints + roiPoints + paymentPoints)));
  return { score, label: labelFor(score) };
}

/** Recalcula y cachea (clients.health_score/health_score_label/
 * health_score_updated_at) — usado tanto por el cron diario (service-role,
 * todos los clientes activos) como por el fallback perezoso del perfil
 * (client autenticado normal, un solo cliente). */
export async function recomputeAndCacheClientHealth(workspaceId: string, clientId: string, supabaseClient?: SupabaseClient): Promise<ClientHealthResult> {
  const supabase = supabaseClient ?? (await createClient());
  const result = await computeClientHealthScore(workspaceId, clientId, supabase);
  await supabase
    .from("clients")
    .update({ health_score: result.score, health_score_label: result.label, health_score_updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", clientId);
  return result;
}
