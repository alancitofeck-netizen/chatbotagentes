/**
 * Named thresholds for the insights engine — first-pass, documented,
 * adjustable heuristics, same convention as ACTIVITY_WINDOW_DAYS in
 * src/lib/agents/queries.ts (this feature isn't in the Blueprint at all).
 */

export const UNANSWERED_WARNING_HOURS = 6;
export const UNANSWERED_CRITICAL_HOURS = 24;

export const STALE_OPPORTUNITY_WARNING_DAYS = 7;
export const STALE_OPPORTUNITY_CRITICAL_DAYS = 21;

export const OVERDUE_TASKS_WARNING_COUNT = 1;
export const OVERDUE_TASKS_CRITICAL_COUNT = 5;

export const WOW_POSITIVE_TREND_PCT = 20;
export const WOW_NEGATIVE_TREND_PCT = -15;

/** "New leads" window for the uncontacted-leads recommended action. */
export const NEW_LEAD_WINDOW_DAYS = 7;

export const ADVISOR_INACTIVITY_HOURS = 48;
export const ADVISOR_ATTENTION_PENDING_CONVERSATIONS = 8;
export const ADVISOR_ATTENTION_RESPONSE_RATE_PCT = 50;
