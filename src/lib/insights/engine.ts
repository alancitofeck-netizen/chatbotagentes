import type { EngineInput, HealthMeta, Insight, InsightPriority } from "./types";
import {
  ruleUnansweredConversations,
  ruleStaleOpportunities,
  ruleOverdueTasks,
  ruleWeeklyTrends,
  ruleLinkedInSlot,
} from "./rules";

const PRIORITY_ORDER: Record<InsightPriority, number> = { critical: 0, attention: 1, positive: 2, info: 3 };

export function evaluateInsights(input: EngineInput): Insight[] {
  const insights = [
    ruleUnansweredConversations(input),
    ruleStaleOpportunities(input),
    ruleOverdueTasks(input),
    ...ruleWeeklyTrends(input),
    ruleLinkedInSlot(input),
  ].filter((i): i is Insight => i !== null);

  return insights.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

const HEALTH_META: Record<"critical" | "watch" | "good", HealthMeta> = {
  critical: { status: "critical", emoji: "🔴", label: "Necesita atención hoy" },
  watch: { status: "watch", emoji: "🟡", label: "Hay puntos para revisar" },
  good: { status: "good", emoji: "🟢", label: "Todo marcha bien" },
};

/** Derived purely from the same Insight[] the engine already produced —
 * never a second, parallel calculation. */
export function deriveHealthStatus(insights: Insight[]): HealthMeta {
  if (insights.some((i) => i.priority === "critical")) return HEALTH_META.critical;
  if (insights.some((i) => i.priority === "attention")) return HEALTH_META.watch;
  return HEALTH_META.good;
}
