/** Derivaciones puras de Asesores → Operaciones — deliberadamente separadas
 * de agencyOperations.ts (que tiene "server-only" arriba): un import de
 * VALOR (no de tipo) de una función real, aunque sea pura, desde un módulo
 * con ese guard igual arrastra todo el grafo del módulo al bundle del
 * cliente y hace explotar el build ("'server-only' cannot be imported from
 * a Client Component module") — mismo gotcha ya documentado para
 * policies/constants.ts, encontrado en vivo acá (OperacionesShell.tsx es
 * Client Component). Los `import type` de agencyOperations.ts sí son
 * seguros (se borran en compilación), solo las funciones/consts reales
 * necesitan vivir acá. */

import { POLICY_STAGES, type PolicyStatus } from "@/lib/policies/constants";
import type { AgencyPolicyRow } from "@/lib/kpis/agencyOperations";

export interface AgencyFunnelStage {
  stageKey: PolicyStatus;
  stageName: string;
  count: number;
  value: number;
}

/** Funnel de "Conversión" — agrupa por POLICY_STAGES (mismo motor de
 * pipeline genérico que deriveCrmAnalytics usa para CRM, adaptado a
 * policies.status en vez de a un solo CrmBoard). */
export function deriveAgencyPolicyFunnel(policies: AgencyPolicyRow[]): AgencyFunnelStage[] {
  return POLICY_STAGES.map((stage) => {
    const rows = policies.filter((p) => p.status === stage.key);
    return { stageKey: stage.key, stageName: stage.name, count: rows.length, value: rows.reduce((sum, p) => sum + (p.premium ?? 0), 0) };
  });
}

export interface AgencyProductBucket {
  product: string;
  count: number;
}

/** "Top productos" — agrupa por policies.product. */
export function deriveAgencyTopProducts(policies: AgencyPolicyRow[], limit = 6): AgencyProductBucket[] {
  const counts = new Map<string, number>();
  for (const p of policies) {
    const key = p.product || "Otro";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([product, count]) => ({ product, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Mismo criterio de anualización que getCarteraDetailSummary
 * (src/lib/portfolioAgent/queries.ts): mensual×12, trimestral×4,
 * semestral×2, anual/único×1, excluye canceladas — reimplementado acá (no
 * exportado del otro archivo) porque ese es de un solo workspace y este es
 * cross-asesor; misma fórmula documentada dos veces a propósito. */
const FREQUENCY_MULTIPLIER: Record<string, number> = { mensual: 12, trimestral: 4, semestral: 2, anual: 1, unico: 1 };

export function annualizedPremium(policies: AgencyPolicyRow[]): number {
  return policies
    .filter((p) => p.status !== "cancelada" && p.premium !== null && p.paymentFrequency)
    .reduce((sum, p) => sum + (p.premium ?? 0) * (FREQUENCY_MULTIPLIER[p.paymentFrequency ?? ""] ?? 0), 0);
}
