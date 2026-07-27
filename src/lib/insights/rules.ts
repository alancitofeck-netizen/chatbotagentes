import type { EngineInput, Insight } from "./types";
import {
  UNANSWERED_WARNING_HOURS,
  UNANSWERED_CRITICAL_HOURS,
  STALE_OPPORTUNITY_WARNING_DAYS,
  STALE_OPPORTUNITY_CRITICAL_DAYS,
  OVERDUE_TASKS_WARNING_COUNT,
  OVERDUE_TASKS_CRITICAL_COUNT,
  WOW_POSITIVE_TREND_PCT,
  WOW_NEGATIVE_TREND_PCT,
} from "./constants";

export function ruleUnansweredConversations(input: EngineInput): Insight | null {
  const list = input.unansweredConversations;
  if (list.length === 0) return null;
  const worstHours = Math.max(...list.map((c) => c.hoursWaiting));
  const atTierCount = (hours: number) => list.filter((c) => c.hoursWaiting >= hours).length;

  if (worstHours >= UNANSWERED_CRITICAL_HOURS) {
    const count = atTierCount(UNANSWERED_CRITICAL_HOURS);
    return {
      id: "unanswered-conversations",
      priority: "critical",
      category: "conversaciones",
      icon: "message-warning",
      title: `${count} conversaci${count === 1 ? "ón espera" : "ones esperan"} respuesta hace más de 24h`,
      explanation: `La más antigua lleva ${Math.floor(worstHours)}h sin respuesta.`,
      actionLabel: "Responder ahora",
      actionHref: "/inbox",
      metricValue: count,
    };
  }
  if (worstHours >= UNANSWERED_WARNING_HOURS) {
    const count = atTierCount(UNANSWERED_WARNING_HOURS);
    return {
      id: "unanswered-conversations",
      priority: "attention",
      category: "conversaciones",
      icon: "message-warning",
      title: `${count} conversaci${count === 1 ? "ón espera" : "ones esperan"} respuesta hace más de 6h`,
      explanation: `La más antigua lleva ${Math.floor(worstHours)}h sin respuesta.`,
      actionLabel: "Responder ahora",
      actionHref: "/inbox",
      metricValue: count,
    };
  }
  return null;
}

export function ruleStaleOpportunities(input: EngineInput): Insight | null {
  const list = input.staleOpportunities;
  if (list.length === 0) return null;
  const worstDays = Math.max(...list.map((o) => o.daysSinceActivity));
  const atTierCount = (days: number) => list.filter((o) => o.daysSinceActivity >= days).length;

  if (worstDays >= STALE_OPPORTUNITY_CRITICAL_DAYS) {
    const count = atTierCount(STALE_OPPORTUNITY_CRITICAL_DAYS);
    return {
      id: "stale-opportunities",
      priority: "critical",
      category: "pipeline",
      icon: "clock-alert",
      title: `${count} oportunidad${count === 1 ? "" : "es"} sin actividad hace más de ${STALE_OPPORTUNITY_CRITICAL_DAYS} días`,
      explanation: `La más antigua lleva ${Math.floor(worstDays)} días sin movimiento.`,
      actionLabel: "Realizar seguimiento",
      actionHref: "/crm",
      metricValue: count,
    };
  }
  if (worstDays >= STALE_OPPORTUNITY_WARNING_DAYS) {
    const count = atTierCount(STALE_OPPORTUNITY_WARNING_DAYS);
    return {
      id: "stale-opportunities",
      priority: "attention",
      category: "pipeline",
      icon: "clock-alert",
      title: `${count} oportunidad${count === 1 ? "" : "es"} sin actividad hace más de ${STALE_OPPORTUNITY_WARNING_DAYS} días`,
      explanation: `La más antigua lleva ${Math.floor(worstDays)} días sin movimiento.`,
      actionLabel: "Realizar seguimiento",
      actionHref: "/crm",
      metricValue: count,
    };
  }
  return null;
}

export function ruleOverdueTasks(input: EngineInput): Insight | null {
  const count = input.overdueTasksCount;
  if (count >= OVERDUE_TASKS_CRITICAL_COUNT) {
    return {
      id: "overdue-tasks",
      priority: "critical",
      category: "tareas",
      icon: "list-checks",
      title: `${count} tareas vencidas`,
      explanation: "Se acumularon varias tareas sin completar después de su fecha límite.",
      actionLabel: "Revisar tareas",
      actionHref: "/crm?tab=tasks",
      metricValue: count,
    };
  }
  if (count >= OVERDUE_TASKS_WARNING_COUNT) {
    return {
      id: "overdue-tasks",
      priority: "attention",
      category: "tareas",
      icon: "list-checks",
      title: count === 1 ? "1 tarea vencida" : `${count} tareas vencidas`,
      explanation: "Hay al menos una tarea sin completar después de su fecha límite.",
      actionLabel: "Revisar tareas",
      actionHref: "/crm?tab=tasks",
      metricValue: count,
    };
  }
  return null;
}

const TREND_META: Record<"connections" | "meetings" | "acceptance", { label: string; href: string }> = {
  connections: { label: "conexiones", href: "/crm" },
  meetings: { label: "reuniones", href: "/calendar" },
  acceptance: { label: "tasa de aceptación", href: "/inbox" },
};

export function ruleWeeklyTrends(input: EngineInput): Insight[] {
  const insights: Insight[] = [];
  for (const key of ["connections", "meetings", "acceptance"] as const) {
    const metric = input.weekOverWeek[key];
    if (metric.deltaPct === null) continue;
    const { label, href } = TREND_META[key];
    if (metric.deltaPct >= WOW_POSITIVE_TREND_PCT) {
      insights.push({
        id: `trend-${key}`,
        priority: "positive",
        category: "tendencias",
        icon: "trending-up",
        title: `Tus ${label} aumentaron ${metric.deltaPct}% esta semana`,
        explanation: "Es una mejora real respecto a la semana pasada.",
        actionLabel: "Mantener estrategia",
        actionHref: href,
        metricValue: metric.deltaPct,
      });
    } else if (metric.deltaPct <= WOW_NEGATIVE_TREND_PCT) {
      insights.push({
        id: `trend-${key}`,
        priority: "attention",
        category: "tendencias",
        icon: "trending-down",
        title: `Tus ${label} bajaron ${Math.abs(metric.deltaPct)}% esta semana`,
        explanation: "Podría ser un buen momento para revisar tu estrategia.",
        actionLabel: "Revisar estrategia",
        actionHref: href,
        metricValue: metric.deltaPct,
      });
    }
  }
  return insights;
}

/** Always null today — no LinkedIn metrics table exists yet (only the
 * connection itself would). Once a real LinkedIn integration ships, compute
 * "days since last post" here and return an "info"-tier insight. Kept as a
 * real function (not deleted) so the engine's slot/shape is future-ready
 * without touching any fake data today. */
export function ruleLinkedInSlot(input: EngineInput): Insight | null {
  if (!input.hasLinkedInConnection) return null;
  return null;
}
