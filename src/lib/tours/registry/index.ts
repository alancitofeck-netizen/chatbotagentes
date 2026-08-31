import type { TourConfig } from "../types";
import { crmTours } from "./crm";
import { calendarTours } from "./calendar";
import { tasksTours } from "./tasks";
import { classroomTours } from "./classroom";

/** Registro central de todos los tours de producto — Fase 2 solo necesita
 * agregar un archivo `registry/<modulo>.ts` + sumarlo acá, nunca tocar el
 * motor (ProductTour/TourSpotlight/TourTooltip). */
export const ALL_TOURS: TourConfig[] = [...crmTours, ...calendarTours, ...tasksTours, ...classroomTours];

export function getTourByKey(key: string): TourConfig | undefined {
  return ALL_TOURS.find((t) => t.key === key);
}

export function getToursForModule(moduleKey: string): TourConfig[] {
  return ALL_TOURS.filter((t) => t.moduleKey === moduleKey);
}
