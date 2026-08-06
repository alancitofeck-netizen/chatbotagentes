"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { getOpenRouterCredentials } from "@/lib/integrations/openrouter";
import {
  getGoalsForMember,
  getAllGoals,
  getGoalById,
  computeGoalMetricValue,
  getRanking,
  getTimeline,
  getAchievements,
  getProductBreakdown,
  type SalesGoal,
  type RankingEntry,
  type TimelineEntry,
} from "@/lib/goals/queries";
import { syncGoalCompletion, evaluateAndUnlockAchievements } from "@/lib/goals/achievements";
import { generateGoalRecommendation } from "@/lib/goals/aiRecommendation";
import { computeGoalProjection, type GoalProjection } from "@/lib/goals/projections";
import type { GoalMetricKey, GoalKind } from "@/lib/goals/constants";

function revalidateGoals() {
  revalidatePath("/metas");
}

export interface GoalWithProgress extends SalesGoal {
  currentValue: number;
  projection: GoalProjection;
}

export interface GoalsBoard {
  goals: GoalWithProgress[];
  achievements: { key: string; unlockedAt: string }[];
  newlyUnlocked: string[];
  role: string;
  memberId: string | null;
}

/** Un solo round-trip para la pantalla principal — sincroniza el estado de
 * los objetivos (activo → cumplido/no cumplido) y evalúa logros nuevos
 * antes de devolver todo, así "los indicadores se actualizan sin carga
 * manual" con solo entrar a la pantalla. */
export async function getGoalsBoardAction(): Promise<GoalsBoard> {
  const { workspaceId, role } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);

  await syncGoalCompletion(workspaceId, memberId);
  const newlyUnlocked = memberId ? await evaluateAndUnlockAchievements(workspaceId, memberId) : [];

  const [goals, achievements] = await Promise.all([getGoalsForMember(workspaceId, memberId, ["active"]), memberId ? getAchievements(workspaceId, memberId) : Promise.resolve([])]);

  const goalsWithProgress = await Promise.all(
    goals.map(async (goal) => {
      const currentValue = await computeGoalMetricValue(workspaceId, goal.memberId, goal.metricKey, goal.periodStart, goal.periodEnd);
      const projection = computeGoalProjection(currentValue, goal.targetValue, goal.periodStart, goal.periodEnd);
      return { ...goal, currentValue, projection };
    }),
  );

  return {
    goals: goalsWithProgress,
    achievements: achievements.map((a) => ({ key: a.achievementKey, unlockedAt: a.unlockedAt })),
    newlyUnlocked,
    role,
    memberId,
  };
}

export async function getRankingAction(metricKey: GoalMetricKey): Promise<RankingEntry[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getRanking(workspaceId, metricKey);
}

export async function getTimelineAction(): Promise<TimelineEntry[]> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return [];
  return getTimeline(workspaceId, memberId);
}

export interface ProductBreakdownParams {
  periodStart: string;
  periodEnd: string;
  scope: "own" | "team";
}

export async function getProductBreakdownAction(params: ProductBreakdownParams) {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = params.scope === "own" ? await getCurrentMemberId(workspaceId) : null;
  return getProductBreakdown(workspaceId, memberId, params.periodStart, params.periodEnd);
}

export async function getGoalsHistoryAction(): Promise<SalesGoal[]> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const all = await getAllGoals(workspaceId);
  return all.filter((g) => (g.status === "completed" || g.status === "missed") && (g.memberId === null || g.memberId === memberId));
}

/** Panel de configuración del Owner/admin — ve TODOS los objetivos,
 * cualquier estado, de cualquier miembro (RLS ya garantiza que un rol no
 * autorizado ni siquiera pueda insertar/editar, esto es solo lectura para
 * armar la lista de gestión). */
export async function getAllGoalsAction(): Promise<SalesGoal[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getAllGoals(workspaceId);
}

export interface GoalFormInput {
  name: string;
  metricKey: GoalMetricKey;
  goalKind: GoalKind;
  rewardLabel: string | null;
  targetValue: number;
  periodStart: string;
  periodEnd: string;
  memberId: string | null;
}

export async function createGoalAction(input: GoalFormInput): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  if (input.targetValue <= 0) throw new Error("El objetivo tiene que ser mayor a cero.");
  if (input.periodEnd < input.periodStart) throw new Error("La fecha de fin no puede ser anterior al inicio.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_goals")
    .insert({
      workspace_id: workspaceId,
      member_id: input.memberId,
      created_by: memberId,
      name: input.name.trim(),
      metric_key: input.metricKey,
      goal_kind: input.goalKind,
      reward_label: input.rewardLabel?.trim() || null,
      target_value: input.targetValue,
      period_start: input.periodStart,
      period_end: input.periodEnd,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el objetivo.");

  revalidateGoals();
  return { id: data.id as string };
}

export async function updateGoalAction(goalId: string, input: Partial<GoalFormInput>): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.metricKey !== undefined) patch.metric_key = input.metricKey;
  if (input.goalKind !== undefined) patch.goal_kind = input.goalKind;
  if (input.rewardLabel !== undefined) patch.reward_label = input.rewardLabel?.trim() || null;
  if (input.targetValue !== undefined) patch.target_value = input.targetValue;
  if (input.periodStart !== undefined) patch.period_start = input.periodStart;
  if (input.periodEnd !== undefined) patch.period_end = input.periodEnd;
  if (input.memberId !== undefined) patch.member_id = input.memberId;

  const { error } = await supabase.from("sales_goals").update(patch).eq("id", goalId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el objetivo.");
  revalidateGoals();
}

export async function archiveGoalAction(goalId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("sales_goals").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", goalId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo archivar el objetivo.");
  revalidateGoals();
}

export async function deleteGoalAction(goalId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await supabase.from("sales_goals").delete().eq("id", goalId).eq("workspace_id", workspaceId);
  revalidateGoals();
}

export async function generateGoalRecommendationAction(goalId: string): Promise<string> {
  const { workspaceId } = await requireActiveWorkspace();
  const service = createServiceRoleClient();
  const credentials = await getOpenRouterCredentials(service, workspaceId);
  if (!credentials) throw new Error("Conectá OpenRouter primero (Perfil → Integraciones) para poder generar recomendaciones con IA.");

  const goal = await getGoalById(workspaceId, goalId);
  if (!goal) throw new Error("Objetivo no encontrado.");
  const currentValue = await computeGoalMetricValue(workspaceId, goal.memberId, goal.metricKey, goal.periodStart, goal.periodEnd);
  const projection = computeGoalProjection(currentValue, goal.targetValue, goal.periodStart, goal.periodEnd);

  return generateGoalRecommendation(credentials.apiKey, {
    goalName: goal.name,
    metricKey: goal.metricKey,
    currentValue,
    targetValue: goal.targetValue,
    daysRemaining: projection.daysRemaining,
    paceStatus: projection.paceStatus,
    projectedValue: projection.projectedValue,
  });
}
