import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ClientContract } from "@/lib/clients/queries";

export type ClientAlertType = "contract_expiring" | "tasks_pending" | "no_recent_activity" | "payment_pending" | "no_policies_this_month";
export type ClientAlertSeverity = "warning" | "critical";

export interface ClientAlert {
  type: ClientAlertType;
  severity: ClientAlertSeverity;
  message: string;
}

const MS_DAY = 1000 * 60 * 60 * 24;
function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_DAY);
}

/** Reglas de alerta calculadas en TypeScript, no SQL — mismo criterio que
 * sales_goals/getClientsList: agregados en vivo sobre datos ya existentes,
 * nada de rollups guardados. Cada función es una unidad pura (facilita
 * reusarla tanto acá — lista, agregados en batch — como desde el banner de
 * un solo cliente en getClientAlerts) y devuelve `null` cuando no aplica. */

export function contractExpiringSeverity(contract: Pick<ClientContract, "status" | "endDate"> | null, now = new Date()): ClientAlertSeverity | null {
  if (!contract || contract.status !== "activo") return null;
  const daysLeft = daysBetween(new Date(contract.endDate), now);
  if (daysLeft < 0) return null; // ya vencido — lo cubre el estado del contrato, no esta alerta
  if (daysLeft <= 14) return "critical";
  if (daysLeft <= 30) return "warning";
  return null;
}

export interface ClientAlertTaskInput {
  ownerSide: "client" | "growth_link" | null;
  status: string;
  dueAt: string | null;
}

export function tasksPendingSeverity(tasks: ClientAlertTaskInput[], now = new Date()): ClientAlertSeverity | null {
  const pending = tasks.filter((t) => t.status !== "completed");
  const overdueFromClient = pending.some((t) => t.ownerSide === "client" && t.dueAt !== null && new Date(t.dueAt) < now);
  if (overdueFromClient) return "critical";
  if (pending.length > 5) return "warning";
  return null;
}

export function noRecentActivitySeverity(lastBookingAt: string | null, contractStartDate: string | null, now = new Date()): ClientAlertSeverity | null {
  // Solo aplica una vez que el contrato ya lleva ≥14 días — un cliente
  // recién onboardeado todavía no tuvo tiempo de generar citas.
  if (!contractStartDate || daysBetween(now, new Date(contractStartDate)) < 14) return null;
  if (!lastBookingAt) return "warning";
  return daysBetween(now, new Date(lastBookingAt)) > 14 ? "warning" : null;
}

export function paymentPendingSeverity(contract: Pick<ClientContract, "status" | "totalValue" | "amountPaid"> | null): ClientAlertSeverity | null {
  if (!contract || contract.status !== "activo" || contract.totalValue === null) return null;
  const balance = contract.totalValue - (contract.amountPaid ?? 0);
  return balance > 0 ? "warning" : null;
}

export function noPoliciesThisMonthSeverity(policiesThisMonthCount: number, contractStartDate: string | null, now = new Date()): ClientAlertSeverity | null {
  if (!contractStartDate || daysBetween(now, new Date(contractStartDate)) < 30) return null;
  return policiesThisMonthCount === 0 ? "warning" : null;
}

function formatDaysLeft(endDate: string, now: Date): string {
  const days = daysBetween(new Date(endDate), now);
  return days === 0 ? "hoy" : days === 1 ? "en 1 día" : `en ${days} días`;
}

/** Arma los 5 mensajes de alerta a partir de los ingredientes ya resueltos
 * (contrato activo, tareas del cliente, última cita, pólizas del mes) —
 * usado tanto por getClientAlerts (banner de un cliente) como, con los
 * mismos ingredientes agregados en batch, por getClientsList (filtros del
 * dashboard). */
export function buildClientAlerts(input: {
  contract: ClientContract | null;
  tasks: ClientAlertTaskInput[];
  lastBookingAt: string | null;
  policiesThisMonthCount: number;
  now?: Date;
}): ClientAlert[] {
  const now = input.now ?? new Date();
  const alerts: ClientAlert[] = [];

  const contractSeverity = contractExpiringSeverity(input.contract, now);
  if (contractSeverity && input.contract) {
    alerts.push({
      type: "contract_expiring",
      severity: contractSeverity,
      message: `El contrato vence ${formatDaysLeft(input.contract.endDate, now)}.`,
    });
  }

  const tasksSeverity = tasksPendingSeverity(input.tasks, now);
  if (tasksSeverity) {
    const pendingCount = input.tasks.filter((t) => t.status !== "completed").length;
    alerts.push({
      type: "tasks_pending",
      severity: tasksSeverity,
      message:
        tasksSeverity === "critical" ? "Hay tareas vencidas que esperábamos del cliente." : `Tiene ${pendingCount} tareas pendientes acumuladas.`,
    });
  }

  const activitySeverity = noRecentActivitySeverity(input.lastBookingAt, input.contract?.startDate ?? null, now);
  if (activitySeverity) {
    alerts.push({
      type: "no_recent_activity",
      severity: activitySeverity,
      message: input.lastBookingAt ? "Sin citas en los últimos 14 días." : "Todavía no registró ninguna cita.",
    });
  }

  const paymentSeverity = paymentPendingSeverity(input.contract);
  if (paymentSeverity && input.contract) {
    const balance = (input.contract.totalValue ?? 0) - (input.contract.amountPaid ?? 0);
    alerts.push({
      type: "payment_pending",
      severity: paymentSeverity,
      message: `Saldo pendiente de ${input.contract.currency} ${balance.toLocaleString("es-MX")}.`,
    });
  }

  const policiesSeverity = noPoliciesThisMonthSeverity(input.policiesThisMonthCount, input.contract?.startDate ?? null, now);
  if (policiesSeverity) {
    alerts.push({ type: "no_policies_this_month", severity: policiesSeverity, message: "No vendió ninguna póliza este mes." });
  }

  return alerts;
}

/** Alertas de un solo cliente — para el banner del perfil
 * (clientes/[clientId]/layout.tsx). Trae solo lo que buildClientAlerts
 * necesita; no reusa getClientProfile/getClientContracts para no traer de
 * más (datos de contacto, etc.) en un fetch que corre en cada visita al
 * perfil. */
export async function getClientAlerts(workspaceId: string, clientId: string): Promise<ClientAlert[]> {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: contractRow }, { data: taskRows }, { data: lastBooking }, { count: policiesThisMonthCount }] = await Promise.all([
    supabase
      .from("client_contracts")
      .select("id, client_id, status, start_date, end_date, duration_months, total_value, monthly_value, amount_paid, currency, commission_model, document_id, notes, created_at")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .eq("status", "activo")
      .maybeSingle(),
    supabase.from("tasks").select("owner_side, status, due_at").eq("workspace_id", workspaceId).eq("client_id", clientId),
    supabase
      .from("bookings")
      .select("start_time")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("policies").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("client_id", clientId).gte("issue_date", monthStart),
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

  return buildClientAlerts({
    contract,
    tasks: (taskRows ?? []).map((t) => ({ ownerSide: t.owner_side as ClientAlertTaskInput["ownerSide"], status: t.status as string, dueAt: t.due_at as string | null })),
    lastBookingAt: (lastBooking?.start_time as string | undefined) ?? null,
    policiesThisMonthCount: policiesThisMonthCount ?? 0,
    now,
  });
}
