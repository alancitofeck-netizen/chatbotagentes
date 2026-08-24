import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface CarteraSummary {
  totalClients: number;
  totalPolicies: number;
  /** Solo pólizas con payment_frequency = 'mensual' — sumar premium de
   * frecuencias distintas (trimestral/anual/etc.) requeriría inventar una
   * tasa de conversión que nadie pidió, así que no se hace. */
  monthlyPremium: number;
  /** renewal_date (o end_date si no hay) dentro de los próximos 30 días. */
  upcomingRenewals: number;
}

/** KPIs básicos de "Analizador de Cartera" — cuenta directa sobre policies,
 * mismo criterio "nunca un contador aparte" que ya usa
 * getInsuranceProvidersBoard. Solo pólizas que vinieron de una conexión de
 * aseguradora (insurance_connection_id no nulo) — pólizas cargadas a mano
 * fuera de ese flujo no son "cartera sincronizada". */
export async function getCarteraSummary(workspaceId: string): Promise<CarteraSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("policies")
    .select("contact_id, premium, payment_frequency, renewal_date, end_date, status")
    .eq("workspace_id", workspaceId)
    .not("insurance_connection_id", "is", null);

  const rows = (data ?? []) as {
    contact_id: string;
    premium: number | null;
    payment_frequency: string | null;
    renewal_date: string | null;
    end_date: string | null;
    status: string;
  }[];

  const clients = new Set(rows.map((r) => r.contact_id));
  const monthlyPremium = rows.filter((r) => r.payment_frequency === "mensual" && r.status !== "cancelada").reduce((sum, r) => sum + (r.premium ?? 0), 0);

  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const upcomingRenewals = rows.filter((r) => {
    const dateStr = r.renewal_date ?? r.end_date;
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    return t >= now && t <= in30Days;
  }).length;

  return { totalClients: clients.size, totalPolicies: rows.length, monthlyPremium, upcomingRenewals };
}

export interface CarteraDetailSummary {
  activePolicies: number;
  activePolicyPct: number;
  cancelledPolicies: number;
  cancelledPolicyPct: number;
  averageMonthlyPremium: number;
  /** Suma de premium anualizado — mensual×12, trimestral×4, semestral×2,
   * anual×1, único×1 (un pago único ya es "de una vez", no se multiplica) —
   * excluye pólizas canceladas. Fórmula documentada acá a propósito: es un
   * cálculo estándar (anualizar por frecuencia de pago), no un número
   * inventado, pero merece quedar explícito para no confundirlo con una
   * suma directa de `premium`. */
  annualPortfolioValue: number;
  connectedInsurers: number;
  distinctProducts: number;
}

const FREQUENCY_MULTIPLIER: Record<string, number> = { mensual: 12, trimestral: 4, semestral: 2, anual: 1, unico: 1 };

export async function getCarteraDetailSummary(workspaceId: string): Promise<CarteraDetailSummary> {
  const supabase = await createClient();
  const [{ data: policyRows }, { data: connectionRows }] = await Promise.all([
    supabase.from("policies").select("status, premium, payment_frequency, product").eq("workspace_id", workspaceId).not("insurance_connection_id", "is", null),
    supabase.from("insurance_connections").select("id").eq("workspace_id", workspaceId).eq("status", "connected"),
  ]);

  const rows = (policyRows ?? []) as { status: string; premium: number | null; payment_frequency: string | null; product: string | null }[];
  const total = rows.length;
  const active = rows.filter((r) => r.status === "activa").length;
  const cancelled = rows.filter((r) => r.status === "cancelada").length;

  const monthlyRows = rows.filter((r) => r.payment_frequency === "mensual" && r.status !== "cancelada" && r.premium !== null);
  const averageMonthlyPremium = monthlyRows.length === 0 ? 0 : monthlyRows.reduce((sum, r) => sum + (r.premium ?? 0), 0) / monthlyRows.length;

  const annualPortfolioValue = rows
    .filter((r) => r.status !== "cancelada" && r.premium !== null && r.payment_frequency)
    .reduce((sum, r) => sum + (r.premium ?? 0) * (FREQUENCY_MULTIPLIER[r.payment_frequency ?? ""] ?? 0), 0);

  const distinctProducts = new Set(rows.map((r) => r.product).filter((p): p is string => Boolean(p))).size;

  return {
    activePolicies: active,
    activePolicyPct: total === 0 ? 0 : Math.round((active / total) * 1000) / 10,
    cancelledPolicies: cancelled,
    cancelledPolicyPct: total === 0 ? 0 : Math.round((cancelled / total) * 1000) / 10,
    averageMonthlyPremium,
    annualPortfolioValue,
    connectedInsurers: (connectionRows ?? []).length,
    distinctProducts,
  };
}
