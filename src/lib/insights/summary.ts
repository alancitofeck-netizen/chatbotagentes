import type { CrmBoard } from "@/lib/crm/queries";
import type { UnansweredConversation, UncontactedLead, WeekOverWeekMetrics } from "./queries";
import type { HealthMeta, Insight, RecommendedAction, StaleOpportunity, TrendItem } from "./types";
import { deriveHealthStatus } from "./engine";
import { STALE_OPPORTUNITY_WARNING_DAYS } from "./constants";

/** Flattens CrmBoard.cardsByStage to just the open-stage (not won/lost) cards
 * whose daysSinceActivity crosses the "stale" threshold — reuses the field
 * getCrmBoard already computes (last contact message / last note / created
 * date), never re-derives "activity" from opportunities.updated_at (that
 * column is only bumped by kanban stage-drags, not a real activity signal). */
export function deriveStaleOpportunities(board: CrmBoard | null): StaleOpportunity[] {
  if (!board) return [];
  const openStageIds = new Set(board.stages.filter((s) => !s.isWon && !s.isLost).map((s) => s.id));
  const result: StaleOpportunity[] = [];
  for (const [stageId, cards] of Object.entries(board.cardsByStage)) {
    if (!openStageIds.has(stageId)) continue;
    for (const card of cards) {
      if (card.daysSinceActivity !== null && card.daysSinceActivity >= STALE_OPPORTUNITY_WARNING_DAYS) {
        result.push({ id: card.id, title: card.title, contactName: card.contactName, daysSinceActivity: card.daysSinceActivity });
      }
    }
  }
  return result;
}

export interface ExecutiveSummaryInput {
  wonThisWeek: number;
  unansweredCount: number;
  connectionsDeltaPct: number | null;
  staleOpportunitiesCount: number;
  overdueTasksCount: number;
}

export function buildExecutiveSummary(input: ExecutiveSummaryInput, insights: Insight[]): { bullets: string[]; health: HealthMeta } {
  const bullets: string[] = [];

  bullets.push(
    input.wonThisWeek > 0
      ? `Cerraste ${input.wonThisWeek} oportunidad${input.wonThisWeek === 1 ? "" : "es"} esta semana.`
      : "Todavía no cerraste oportunidades esta semana.",
  );

  bullets.push(
    input.unansweredCount > 0
      ? `Tienes ${input.unansweredCount} conversación${input.unansweredCount === 1 ? "" : "es"} esperando respuesta.`
      : "No tienes conversaciones esperando respuesta.",
  );

  if (input.connectionsDeltaPct !== null) {
    bullets.push(
      input.connectionsDeltaPct >= 0
        ? `Tus nuevos contactos aumentaron un ${input.connectionsDeltaPct}% esta semana.`
        : `Tus nuevos contactos bajaron un ${Math.abs(input.connectionsDeltaPct)}% esta semana.`,
    );
  }

  bullets.push(
    input.staleOpportunitiesCount > 0
      ? `${input.staleOpportunitiesCount} oportunidad${input.staleOpportunitiesCount === 1 ? "" : "es"} sin actividad reciente en tu pipeline.`
      : "Tu pipeline se mantiene saludable.",
  );

  if (input.overdueTasksCount > 0) {
    bullets.push(
      `Tienes ${input.overdueTasksCount} tarea${input.overdueTasksCount === 1 ? "" : "s"} vencida${input.overdueTasksCount === 1 ? "" : "s"}.`,
    );
  }

  return { bullets, health: deriveHealthStatus(insights) };
}

const TREND_LABEL: Record<TrendItem["key"], string> = {
  connections: "Conexiones",
  meetings: "Reuniones",
  acceptance: "Aceptación",
};

/** One interpretive sentence per metric per bucket — never a bare number. */
export function interpretTrend(key: TrendItem["key"], deltaPct: number | null): string {
  const subject = key === "connections" ? "prospección" : key === "meetings" ? "agenda" : "tasa de respuesta inicial";
  if (deltaPct === null) return "Todavía no hay suficientes datos de la semana pasada para comparar.";
  if (deltaPct >= 20) return `Tu ${subject} está mejorando con fuerza.`;
  if (deltaPct >= 0) return `Tu ${subject} se mantiene estable, con una leve mejora.`;
  if (deltaPct >= -15) return `Bajó un poco respecto a la semana anterior — vale la pena vigilarlo.`;
  return key === "acceptance"
    ? "La tasa bajó respecto a la semana anterior. Podría ser un buen momento para revisar el mensaje inicial."
    : `Bajó de forma notoria respecto a la semana anterior — conviene revisar tu ${subject}.`;
}

/** Always exactly 3 items — descriptive, never threshold-gated/hidden
 * (unlike Priority Insights, which only shows what crosses a threshold). */
export function buildTrendItems(weekOverWeek: WeekOverWeekMetrics): TrendItem[] {
  return (["connections", "meetings", "acceptance"] as const).map((key) => ({
    key,
    label: TREND_LABEL[key],
    deltaPct: weekOverWeek[key].deltaPct,
    comment: interpretTrend(key, weekOverWeek[key].deltaPct),
  }));
}

export function buildRecommendedActions(input: {
  unansweredConversations: UnansweredConversation[];
  staleOpportunities: StaleOpportunity[];
  uncontactedLeads: UncontactedLead[];
  overdueTasksCount: number;
}): RecommendedAction[] {
  return [
    { label: "Responder conversaciones pendientes", count: input.unansweredConversations.length, href: "/inbox", icon: "message-warning" },
    { label: "Revisar oportunidades estancadas", count: input.staleOpportunities.length, href: "/crm", icon: "clock-alert" },
    { label: "Contactar nuevos leads", count: input.uncontactedLeads.length, href: "/crm", icon: "trending-up" },
    { label: "Revisar tareas vencidas", count: input.overdueTasksCount, href: "/crm?tab=tasks", icon: "list-checks" },
  ];
}
