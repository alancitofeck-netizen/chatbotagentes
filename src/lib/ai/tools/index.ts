import type { ToolHandler } from "@/lib/ai/tools/shared";
import { searchContact } from "@/lib/ai/tools/searchContact";
import { queryCrmContext } from "@/lib/ai/tools/queryCrmContext";
import { createOpportunity } from "@/lib/ai/tools/createOpportunity";
import { checkAgendaAvailability } from "@/lib/ai/tools/checkAgendaAvailability";
import { createAppointment } from "@/lib/ai/tools/createAppointment";
import { runAutomation } from "@/lib/ai/tools/runAutomation";
import { requestHumanHandoff } from "@/lib/ai/tools/requestHumanHandoff";

export type { ToolHandler, ToolContext } from "@/lib/ai/tools/shared";

/** Registry keyed by `tools.handler_key`. `score_candidate`/
 * `extract_resume_data` are deliberately absent — confirmed blocker this
 * round (no `attachments` table, no CV upload flow in the ATS UI yet). */
export const handlers: Record<string, ToolHandler> = {
  search_contact: searchContact,
  query_crm_context: queryCrmContext,
  create_opportunity: createOpportunity,
  check_agenda_availability: checkAgendaAvailability,
  create_appointment: createAppointment,
  run_automation: runAutomation,
  request_human_handoff: requestHumanHandoff,
};

export const SIDE_EFFECTING_HANDLER_KEYS = new Set(["create_opportunity", "create_appointment", "run_automation"]);
