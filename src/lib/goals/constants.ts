/** Client-safe constants — mismo motivo que policies/constants.ts. */

export const GOAL_METRIC_KEYS = ["policies_count", "premium_issued", "commission_collected", "collections_rate", "new_clients", "sum_insured"] as const;
export type GoalMetricKey = (typeof GOAL_METRIC_KEYS)[number];

export type GoalMetricUnit = "count" | "currency" | "percent";

export const GOAL_METRIC_META: Record<GoalMetricKey, { label: string; unit: GoalMetricUnit }> = {
  policies_count: { label: "Pólizas emitidas", unit: "count" },
  premium_issued: { label: "Prima emitida", unit: "currency" },
  commission_collected: { label: "Comisión cobrada", unit: "currency" },
  collections_rate: { label: "Tasa de cobro", unit: "percent" },
  new_clients: { label: "Clientes nuevos", unit: "count" },
  sum_insured: { label: "Suma asegurada", unit: "currency" },
};

export const GOAL_KINDS = ["meta", "bono"] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export const GOAL_STATUSES = ["active", "completed", "missed", "archived"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  active: "Activa",
  completed: "Cumplida",
  missed: "No cumplida",
  archived: "Archivada",
};

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  /** lucide-react icon name resolved in AchievementsGrid.tsx — mantiene
   * este archivo libre de imports de componentes. */
  icon: "Rocket" | "Award" | "Medal" | "Trophy" | "Star" | "Flame" | "Gem" | "Crown";
  tier: "bronce" | "plata" | "oro" | "diamante";
}

/** Catálogo curado — cada uno se evalúa con una regla determinística contra
 * datos reales (goals/achievements.ts), nunca un puntaje/probabilidad
 * fabricado por IA. */
export const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  { key: "first_sale", name: "Primera venta", description: "Emitiste tu primera póliza.", icon: "Rocket", tier: "bronce" },
  { key: "policies_10", name: "10 pólizas", description: "Llegaste a 10 pólizas emitidas.", icon: "Medal", tier: "bronce" },
  { key: "policies_25", name: "25 pólizas", description: "Llegaste a 25 pólizas emitidas.", icon: "Medal", tier: "plata" },
  { key: "policies_50", name: "50 pólizas", description: "Llegaste a 50 pólizas emitidas.", icon: "Medal", tier: "oro" },
  { key: "first_goal", name: "Primera meta cumplida", description: "Cumpliste tu primer objetivo.", icon: "Star", tier: "bronce" },
  { key: "goals_3", name: "3 metas cumplidas", description: "Ya cumpliste 3 objetivos.", icon: "Flame", tier: "plata" },
  { key: "goals_5", name: "5 metas cumplidas", description: "Ya cumpliste 5 objetivos.", icon: "Flame", tier: "oro" },
  { key: "mdrt", name: "MDRT alcanzado", description: "Cumpliste tu objetivo MDRT.", icon: "Crown", tier: "diamante" },
  { key: "commission_100k", name: "Comisión $100k", description: "Superaste $100.000 en comisión cobrada acumulada.", icon: "Gem", tier: "oro" },
  { key: "star_collector", name: "Cobrador estrella", description: "Cumpliste un objetivo de tasa de cobro con 95% o más.", icon: "Award", tier: "plata" },
];

export const ACHIEVEMENT_BY_KEY = new Map(ACHIEVEMENT_CATALOG.map((a) => [a.key, a]));

export const TIER_COLOR: Record<AchievementDef["tier"], { bg: string; text: string; ring: string }> = {
  bronce: { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-300" },
  plata: { bg: "bg-neutral-200", text: "text-neutral-700", ring: "ring-neutral-300" },
  oro: { bg: "bg-warning-bg", text: "text-warning-strong", ring: "ring-warning-strong/40" },
  diamante: { bg: "bg-info-bg", text: "text-info-strong", ring: "ring-info-strong/40" },
};
