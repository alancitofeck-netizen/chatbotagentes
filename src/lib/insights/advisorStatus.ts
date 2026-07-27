import type { AgentListItem } from "@/lib/agents/queries";
import {
  ADVISOR_INACTIVITY_HOURS,
  ADVISOR_ATTENTION_PENDING_CONVERSATIONS,
  ADVISOR_ATTENTION_RESPONSE_RATE_PCT,
} from "./constants";

export type AdvisorStatus = "excelente" | "atencion" | "sin_actividad";

export interface AdvisorStatusResult {
  /** Named `advisorStatus`, not `status` — AgentListItem already has its own
   * unrelated `status` field ("active"|"vacation"|"inactive"), and
   * intersecting two incompatible `status` literal unions collapses the
   * merged type to `never`. */
  advisorStatus: AdvisorStatus;
  badgeVariant: "success" | "warning" | "error";
  sentence: string;
}

/** Fixed precedence, first match wins: inactivity always overrides
 * everything (a real red flag beats a good number), a real sale this week
 * always reads as excellent, then pending-backlog/response-rate
 * degradation reads as needing attention, and the fallback is a genuine
 * positive sentence built from real meetingsThisWeek — never a generic
 * "todo bien". */
export function computeAdvisorStatus(agent: AgentListItem, now: Date): AdvisorStatusResult {
  const lastSeenIso = agent.lastActivityAt ?? agent.sessionLastActiveAt;
  const hoursSince = lastSeenIso ? (now.getTime() - new Date(lastSeenIso).getTime()) / 3_600_000 : Infinity;

  if (hoursSince >= ADVISOR_INACTIVITY_HOURS) {
    const days = Number.isFinite(hoursSince) ? Math.floor(hoursSince / 24) : null;
    return {
      advisorStatus: "sin_actividad",
      badgeVariant: "error",
      sentence: days !== null ? `No registra movimientos hace ${days} día${days === 1 ? "" : "s"}.` : "Aún no registra actividad.",
    };
  }

  if (agent.wonThisWeek >= 1) {
    return {
      advisorStatus: "excelente",
      badgeVariant: "success",
      sentence: `Cerró ${agent.wonThisWeek} venta${agent.wonThisWeek === 1 ? "" : "s"} esta semana.`,
    };
  }

  if (agent.pendingConversations >= ADVISOR_ATTENTION_PENDING_CONVERSATIONS) {
    return {
      advisorStatus: "atencion",
      badgeVariant: "warning",
      sentence: `Tiene ${agent.pendingConversations} conversaciones pendientes.`,
    };
  }

  if (agent.responseRate < ADVISOR_ATTENTION_RESPONSE_RATE_PCT) {
    return {
      advisorStatus: "atencion",
      badgeVariant: "warning",
      sentence: `Su tasa de respuesta bajó a ${agent.responseRate}%.`,
    };
  }

  return {
    advisorStatus: "excelente",
    badgeVariant: "success",
    sentence: `Agendó ${agent.meetingsThisWeek} reunión${agent.meetingsThisWeek === 1 ? "" : "es"} esta semana.`,
  };
}
