import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeGoalMetricValue } from "@/lib/goals/queries";
import { ACHIEVEMENT_CATALOG, type GoalMetricKey } from "@/lib/goals/constants";

interface ActiveGoalRow {
  id: string;
  member_id: string | null;
  metric_key: string;
  target_value: number;
  period_start: string;
  period_end: string;
}

/** Corre en cada carga de la pantalla (lazy, mismo criterio que
 * ensurePolicyPaymentSchedule/ensurePolicyAutomationRules): revisa los
 * objetivos activos de este miembro (+ los de equipo) y los marca
 * "completed" si ya se alcanzó el valor, o "missed" si venció sin
 * alcanzarse — así "todos los indicadores se actualizan sin carga manual"
 * como pidió el spec, sin necesitar un cron aparte. */
export async function syncGoalCompletion(workspaceId: string, memberId: string | null): Promise<void> {
  const supabase = await createClient();
  let query = supabase.from("sales_goals").select("id, member_id, metric_key, target_value, period_start, period_end").eq("workspace_id", workspaceId).eq("status", "active");
  query = memberId ? query.or(`member_id.eq.${memberId},member_id.is.null`) : query.is("member_id", null);
  const { data } = await query;
  const goals = (data ?? []) as ActiveGoalRow[];
  if (goals.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);

  await Promise.all(
    goals.map(async (goal) => {
      try {
        const currentValue = await computeGoalMetricValue(workspaceId, goal.member_id, goal.metric_key as GoalMetricKey, goal.period_start, goal.period_end);
        if (currentValue >= goal.target_value) {
          await supabase.from("sales_goals").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", goal.id);
        } else if (goal.period_end < today) {
          await supabase.from("sales_goals").update({ status: "missed" }).eq("id", goal.id);
        }
      } catch (err) {
        console.error(`[goals] syncGoalCompletion failed for goal ${goal.id}:`, err);
      }
    }),
  );
}

/** Evalúa el catálogo curado de logros contra datos reales y persiste los
 * que se acaban de desbloquear — devuelve solo las claves NUEVAS (para
 * disparar la celebración en la UI, nunca re-festejar un logro viejo). */
export async function evaluateAndUnlockAchievements(workspaceId: string, memberId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data: existing } = await supabase.from("sales_achievements").select("achievement_key").eq("workspace_id", workspaceId).eq("member_id", memberId);
  const unlockedKeys = new Set(((existing ?? []) as { achievement_key: string }[]).map((r) => r.achievement_key));

  const { data: policyRows } = await supabase.from("policies").select("commission_amount, commission_status").eq("workspace_id", workspaceId).eq("owner_id", memberId).neq("status", "cancelada");
  const policies = (policyRows ?? []) as { commission_amount: number | null; commission_status: string | null }[];
  const policiesCount = policies.length;
  const lifetimeCommission = policies.filter((p) => p.commission_status === "cobrada").reduce((s, p) => s + (p.commission_amount ?? 0), 0);

  const { data: completedGoals } = await supabase
    .from("sales_goals")
    .select("name, metric_key, period_start, period_end")
    .eq("workspace_id", workspaceId)
    .eq("member_id", memberId)
    .eq("status", "completed");
  const completed = (completedGoals ?? []) as { name: string; metric_key: string; period_start: string; period_end: string }[];

  const toUnlock: string[] = [];
  const check = (key: string, condition: boolean) => {
    if (condition && !unlockedKeys.has(key)) toUnlock.push(key);
  };

  check("first_sale", policiesCount >= 1);
  check("policies_10", policiesCount >= 10);
  check("policies_25", policiesCount >= 25);
  check("policies_50", policiesCount >= 50);
  check("first_goal", completed.length >= 1);
  check("goals_3", completed.length >= 3);
  check("goals_5", completed.length >= 5);
  check("commission_100k", lifetimeCommission >= 100_000);
  check(
    "mdrt",
    completed.some((g) => g.name.toLowerCase().includes("mdrt")),
  );

  if (!unlockedKeys.has("star_collector")) {
    const collectionsGoals = completed.filter((g) => g.metric_key === "collections_rate");
    for (const g of collectionsGoals) {
      const rate = await computeGoalMetricValue(workspaceId, memberId, "collections_rate", g.period_start, g.period_end);
      if (rate >= 95) {
        toUnlock.push("star_collector");
        break;
      }
    }
  }

  const validKeys = new Set(ACHIEVEMENT_CATALOG.map((a) => a.key));
  const rows = toUnlock.filter((key) => validKeys.has(key)).map((key) => ({ workspace_id: workspaceId, member_id: memberId, achievement_key: key }));
  if (rows.length > 0) {
    const { error } = await supabase.from("sales_achievements").insert(rows);
    if (error) {
      console.error(`[goals] failed to persist achievements for ${memberId}:`, error.message);
      return [];
    }
  }
  return toUnlock;
}
