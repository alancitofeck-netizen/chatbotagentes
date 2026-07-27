/**
 * Growth Link Dashboard — insights-first redesign (2026-07-27). Pure types
 * only, no Supabase/React imports — the engine (engine.ts/rules.ts) mirrors
 * src/lib/ai/decisionEngine.ts's pure/testable style: typed input in, typed
 * output out, zero I/O.
 */
import type { UnansweredConversation, WeekOverWeekMetrics } from "./queries";

export type InsightPriority = "critical" | "attention" | "positive" | "info";

export type InsightCategory = "conversaciones" | "pipeline" | "tareas" | "tendencias" | "integraciones";

/** Plain string keys — resolved to lucide-react components only inside the
 * component that renders them (PriorityInsights.tsx), keeping this module
 * free of any React import. */
export type InsightIcon =
  | "message-warning"
  | "clock-alert"
  | "trending-up"
  | "trending-down"
  | "list-checks"
  | "share";

export interface Insight {
  id: string;
  priority: InsightPriority;
  category: InsightCategory;
  icon: InsightIcon;
  /** Interpolated with real numbers — never a fixed string regardless of data. */
  title: string;
  explanation: string;
  actionLabel: string;
  actionHref: string;
  /** The raw number that triggered this insight — useful for verification/tests. */
  metricValue: number;
}

export type HealthStatus = "good" | "watch" | "critical";

export interface HealthMeta {
  status: HealthStatus;
  emoji: "🟢" | "🟡" | "🔴";
  label: string;
}

/** Derived from CrmBoard (src/lib/crm/queries.ts) — an open-stage opportunity
 * whose daysSinceActivity crosses the "stale" threshold. See
 * summary.ts's deriveStaleOpportunities. */
export interface StaleOpportunity {
  id: string;
  title: string;
  contactName: string;
  daysSinceActivity: number;
}

/** Pure input for the rules engine — everything pre-fetched, no Supabase
 * client, no I/O inside rules.ts/engine.ts (stricter than decisionEngine.ts,
 * which still takes a client — a deliberate improvement for testability). */
export interface EngineInput {
  unansweredConversations: UnansweredConversation[];
  staleOpportunities: StaleOpportunity[];
  overdueTasksCount: number;
  weekOverWeek: WeekOverWeekMetrics;
  hasLinkedInConnection: boolean;
}

export interface TrendItem {
  key: "connections" | "meetings" | "acceptance";
  label: string;
  deltaPct: number | null;
  comment: string;
}

export interface RecommendedAction {
  label: string;
  count: number;
  href: string;
  icon: InsightIcon;
}
