import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ACHIEVEMENT_BY_KEY, type GoalMetricKey, type GoalKind, type GoalStatus } from "@/lib/goals/constants";

export interface SalesGoal {
  id: string;
  workspaceId: string;
  memberId: string | null;
  memberName: string | null;
  createdBy: string | null;
  name: string;
  metricKey: GoalMetricKey;
  goalKind: GoalKind;
  rewardLabel: string | null;
  targetValue: number;
  periodStart: string;
  periodEnd: string;
  status: GoalStatus;
  completedAt: string | null;
  createdAt: string;
}

interface GoalRow {
  id: string;
  workspace_id: string;
  member_id: string | null;
  created_by: string | null;
  name: string;
  metric_key: string;
  goal_kind: string;
  reward_label: string | null;
  target_value: number;
  period_start: string;
  period_end: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

async function resolveMemberNames(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, memberIds: string[]): Promise<Map<string, string>> {
  if (memberIds.length === 0) return new Map();
  const { data } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  return new Map(((data ?? []) as { member_id: string; full_name: string }[]).map((m) => [m.member_id, m.full_name]));
}

function mapGoal(r: GoalRow, nameByMember: Map<string, string>): SalesGoal {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    memberId: r.member_id,
    memberName: r.member_id ? (nameByMember.get(r.member_id) ?? null) : null,
    createdBy: r.created_by,
    name: r.name,
    metricKey: r.metric_key as GoalMetricKey,
    goalKind: r.goal_kind as GoalKind,
    rewardLabel: r.reward_label,
    targetValue: r.target_value,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    status: r.status as GoalStatus,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  };
}

/** Objetivos visibles para un miembro: los suyos propios (individuales) +
 * los de todo el equipo (member_id null) — mismos que ve en su propio
 * dashboard de Metas. */
export async function getGoalsForMember(workspaceId: string, memberId: string | null, statuses: GoalStatus[] = ["active"]): Promise<SalesGoal[]> {
  const supabase = await createClient();
  let query = supabase.from("sales_goals").select("*").eq("workspace_id", workspaceId).in("status", statuses).order("period_end", { ascending: true });
  query = memberId ? query.or(`member_id.eq.${memberId},member_id.is.null`) : query.is("member_id", null);
  const { data } = await query;
  const rows = (data ?? []) as GoalRow[];
  const memberIds = [...new Set(rows.map((r) => r.member_id).filter((id): id is string => Boolean(id)))];
  const nameByMember = await resolveMemberNames(supabase, workspaceId, memberIds);
  return rows.map((r) => mapGoal(r, nameByMember));
}

/** Todos los objetivos del workspace, cualquier estado — para el panel de
 * configuración del Owner y el historial completo. */
export async function getAllGoals(workspaceId: string): Promise<SalesGoal[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("sales_goals").select("*").eq("workspace_id", workspaceId).order("period_end", { ascending: false });
  const rows = (data ?? []) as GoalRow[];
  const memberIds = [...new Set(rows.map((r) => r.member_id).filter((id): id is string => Boolean(id)))];
  const nameByMember = await resolveMemberNames(supabase, workspaceId, memberIds);
  return rows.map((r) => mapGoal(r, nameByMember));
}

export async function getGoalById(workspaceId: string, goalId: string): Promise<SalesGoal | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("sales_goals").select("*").eq("id", goalId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) return null;
  const nameByMember = await resolveMemberNames(supabase, workspaceId, data.member_id ? [data.member_id as string] : []);
  return mapGoal(data as GoalRow, nameByMember);
}

/** Único lugar que calcula "cuánto llevo" para una métrica — deliberadamente
 * NO reusa getPolicyDashboardKpis/getCollectionsKpis (esas tienen ventanas
 * fijas de "este mes"/"este año"; acá el rango lo define cada objetivo, ver
 * la nota en la migración 0105). `memberId` null = agregado de todo el
 * workspace (objetivo de equipo). */
export async function computeGoalMetricValue(workspaceId: string, memberId: string | null, metricKey: GoalMetricKey, periodStart: string, periodEnd: string): Promise<number> {
  const supabase = await createClient();

  if (metricKey === "collections_rate") {
    let policyQuery = supabase.from("policies").select("id").eq("workspace_id", workspaceId);
    if (memberId) policyQuery = policyQuery.eq("owner_id", memberId);
    const { data: policyRows } = await policyQuery;
    const policyIds = (policyRows ?? []).map((p) => p.id as string);
    if (policyIds.length === 0) return 0;

    const { data: payments } = await supabase
      .from("policy_payments")
      .select("status, due_date, paid_at")
      .in("policy_id", policyIds)
      .gte("due_date", periodStart)
      .lte("due_date", periodEnd);
    const rows = (payments ?? []) as { status: string; due_date: string; paid_at: string | null }[];
    if (rows.length === 0) return 0;
    const paid = rows.filter((r) => r.status === "pagado").length;
    return Math.round((paid / rows.length) * 100);
  }

  if (metricKey === "new_clients") {
    let query = supabase.from("policies").select("contact_id").eq("workspace_id", workspaceId).gte("created_at", periodStart).lte("created_at", `${periodEnd}T23:59:59`);
    if (memberId) query = query.eq("owner_id", memberId);
    const { data } = await query;
    return new Set((data ?? []).map((r) => r.contact_id as string)).size;
  }

  // policies_count / premium_issued / commission_collected / sum_insured —
  // todas agregan sobre policies con el mismo filtro base.
  let query = supabase
    .from("policies")
    .select("premium, commission_amount, commission_status, sum_insured, status")
    .eq("workspace_id", workspaceId)
    .gte("created_at", periodStart)
    .lte("created_at", `${periodEnd}T23:59:59`);
  if (memberId) query = query.eq("owner_id", memberId);
  const { data } = await query;
  const rows = (data ?? []) as { premium: number | null; commission_amount: number | null; commission_status: string | null; sum_insured: number | null; status: string }[];
  const active = rows.filter((r) => r.status !== "cancelada");

  switch (metricKey) {
    case "policies_count":
      return active.length;
    case "premium_issued":
      return active.reduce((sum, r) => sum + (r.premium ?? 0), 0);
    case "sum_insured":
      return active.reduce((sum, r) => sum + (r.sum_insured ?? 0), 0);
    case "commission_collected":
      return rows.filter((r) => r.commission_status === "cobrada").reduce((sum, r) => sum + (r.commission_amount ?? 0), 0);
    default:
      return 0;
  }
}

/** Rango de igual duración inmediatamente anterior — para "variación
 * respecto al período anterior" en el ranking. */
export function previousPeriod(periodStart: string, periodEnd: string): { start: string; end: string } {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const prevEnd = new Date(start.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86_400_000);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(prevStart), end: fmt(prevEnd) };
}

export interface RankingEntry {
  position: number;
  memberId: string;
  memberName: string;
  currentValue: number;
  targetValue: number;
  progressPct: number;
  changePct: number | null;
}

/** Ranking = un miembro entra si tiene un objetivo INDIVIDUAL activo para
 * esta métrica (el más próximo a vencer) — el ranking mide cumplimiento
 * real contra una meta definida, no un leaderboard genérico sin contexto.
 * Sin objetivos individuales cargados para la métrica elegida, vuelve
 * vacío (la UI invita a crear objetivos). */
export async function getRanking(workspaceId: string, metricKey: GoalMetricKey): Promise<RankingEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales_goals")
    .select("member_id, target_value, period_start, period_end")
    .eq("workspace_id", workspaceId)
    .eq("metric_key", metricKey)
    .eq("status", "active")
    .not("member_id", "is", null)
    .order("period_end", { ascending: true });

  const rows = (data ?? []) as { member_id: string; target_value: number; period_start: string; period_end: string }[];
  const latestPerMember = new Map<string, { target_value: number; period_start: string; period_end: string }>();
  for (const r of rows) latestPerMember.set(r.member_id, r);
  if (latestPerMember.size === 0) return [];

  const nameByMember = await resolveMemberNames(supabase, workspaceId, [...latestPerMember.keys()]);

  const entries = await Promise.all(
    [...latestPerMember.entries()].map(async ([memberId, goal]) => {
      const currentValue = await computeGoalMetricValue(workspaceId, memberId, metricKey, goal.period_start, goal.period_end);
      const prev = previousPeriod(goal.period_start, goal.period_end);
      const prevValue = await computeGoalMetricValue(workspaceId, memberId, metricKey, prev.start, prev.end);
      const progressPct = goal.target_value > 0 ? Math.round((currentValue / goal.target_value) * 100) : 0;
      const changePct = prevValue > 0 ? Math.round(((currentValue - prevValue) / prevValue) * 100) : null;
      return { memberId, memberName: nameByMember.get(memberId) ?? "Sin nombre", currentValue, targetValue: goal.target_value, progressPct, changePct };
    }),
  );

  entries.sort((a, b) => b.progressPct - a.progressPct);
  return entries.map((e, i) => ({ position: i + 1, ...e }));
}

export interface TimelineEntry {
  id: string;
  date: string;
  kind: "goal" | "achievement";
  title: string;
  description: string;
}

export async function getTimeline(workspaceId: string, memberId: string): Promise<TimelineEntry[]> {
  const supabase = await createClient();

  const [{ data: goals }, { data: achievements }] = await Promise.all([
    supabase
      .from("sales_goals")
      .select("id, name, goal_kind, reward_label, completed_at")
      .eq("workspace_id", workspaceId)
      .eq("member_id", memberId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(30),
    supabase.from("sales_achievements").select("id, achievement_key, unlocked_at").eq("workspace_id", workspaceId).eq("member_id", memberId).order("unlocked_at", { ascending: false }).limit(30),
  ]);

  const goalEntries: TimelineEntry[] = ((goals ?? []) as { id: string; name: string; goal_kind: string; reward_label: string | null; completed_at: string }[]).map((g) => ({
    id: `goal-${g.id}`,
    date: g.completed_at,
    kind: "goal" as const,
    title: g.goal_kind === "bono" ? `Bono cumplido: ${g.name}` : `Meta cumplida: ${g.name}`,
    description: g.reward_label ?? "",
  }));

  const achievementEntries: TimelineEntry[] = ((achievements ?? []) as { id: string; achievement_key: string; unlocked_at: string }[]).map((a) => ({
    id: `achievement-${a.id}`,
    date: a.unlocked_at,
    kind: "achievement" as const,
    title: `Logro desbloqueado: ${ACHIEVEMENT_BY_KEY.get(a.achievement_key)?.name ?? a.achievement_key}`,
    description: ACHIEVEMENT_BY_KEY.get(a.achievement_key)?.description ?? "",
  }));

  return [...goalEntries, ...achievementEntries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface UnlockedAchievement {
  achievementKey: string;
  unlockedAt: string;
}

export async function getAchievements(workspaceId: string, memberId: string): Promise<UnlockedAchievement[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("sales_achievements").select("achievement_key, unlocked_at").eq("workspace_id", workspaceId).eq("member_id", memberId);
  return ((data ?? []) as { achievement_key: string; unlocked_at: string }[]).map((r) => ({ achievementKey: r.achievement_key, unlockedAt: r.unlocked_at }));
}

export interface ProductBreakdownEntry {
  insuranceType: string;
  count: number;
  premium: number;
}

/** "Progreso por producto" del spec — acá "producto" son los ramos reales
 * que ya existen en el esquema (InsuranceType: auto/hogar/vida/otro), no
 * categorías inventadas que no están en la base. */
export async function getProductBreakdown(workspaceId: string, memberId: string | null, periodStart: string, periodEnd: string): Promise<ProductBreakdownEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("policies")
    .select("insurance_type, premium")
    .eq("workspace_id", workspaceId)
    .neq("status", "cancelada")
    .gte("created_at", periodStart)
    .lte("created_at", `${periodEnd}T23:59:59`);
  if (memberId) query = query.eq("owner_id", memberId);
  const { data } = await query;
  const rows = (data ?? []) as { insurance_type: string; premium: number | null }[];

  const byType = new Map<string, { count: number; premium: number }>();
  for (const r of rows) {
    const entry = byType.get(r.insurance_type) ?? { count: 0, premium: 0 };
    entry.count += 1;
    entry.premium += r.premium ?? 0;
    byType.set(r.insurance_type, entry);
  }
  return [...byType.entries()].map(([insuranceType, v]) => ({ insuranceType, ...v })).sort((a, b) => b.premium - a.premium);
}
