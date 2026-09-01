import type { TourConfig } from "../types";
import { crmTours } from "./crm";
import { calendarTours } from "./calendar";
import { tasksTours } from "./tasks";
import { classroomTours } from "./classroom";
import { policiesTours } from "./policies";
import { agendaTours } from "./agenda";
import { collectionsTours } from "./collections";
import { goalsTours } from "./goals";
import { documentsTours } from "./documents";
import { kpisTours } from "./kpis";
import { extractionTours } from "./extraction";
import { assistantTours } from "./assistant";
import { providersTours } from "./providers";
import { portfolioAgentTours } from "./portfolioAgent";
import { automationsTours } from "./automations";
import { presentationsTours } from "./presentations";
import { aiAgentsTours } from "./aiAgents";
import { advisorsAdminTours } from "./advisorsAdmin";
import { operationsTours } from "./operations";
import { dataTransferTours } from "./dataTransfer";
import { dashboardTours } from "./dashboard";
import { inboxTours } from "./inbox";
import { advisorsTours } from "./advisors";
import { miniAppsTours } from "./miniApps";
import { asesoriasTours } from "./asesorias";
import { manychatTours } from "./manychat";
import { atsTours } from "./ats";

/** Registro central de todos los tours de producto — cada módulo nuevo solo
 * necesita agregar un archivo `registry/<modulo>.ts` + sumarlo acá, nunca
 * tocar el motor (ProductTour/TourSpotlight/TourTooltip). */
export const ALL_TOURS: TourConfig[] = [
  ...crmTours,
  ...calendarTours,
  ...tasksTours,
  ...classroomTours,
  ...policiesTours,
  ...agendaTours,
  ...collectionsTours,
  ...goalsTours,
  ...documentsTours,
  ...kpisTours,
  ...extractionTours,
  ...assistantTours,
  ...providersTours,
  ...portfolioAgentTours,
  ...automationsTours,
  ...presentationsTours,
  ...aiAgentsTours,
  ...advisorsAdminTours,
  ...operationsTours,
  ...dataTransferTours,
  ...dashboardTours,
  ...inboxTours,
  ...advisorsTours,
  ...miniAppsTours,
  ...asesoriasTours,
  ...manychatTours,
  ...atsTours,
];

export function getTourByKey(key: string): TourConfig | undefined {
  return ALL_TOURS.find((t) => t.key === key);
}

export function getToursForModule(moduleKey: string): TourConfig[] {
  return ALL_TOURS.filter((t) => t.moduleKey === moduleKey);
}
