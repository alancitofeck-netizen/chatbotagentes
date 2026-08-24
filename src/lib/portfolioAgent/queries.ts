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
