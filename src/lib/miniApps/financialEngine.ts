/**
 * Retirement-simulator projection engine — deliberately isolated in this one
 * file so it can be swapped for an advisor's official methodology later
 * without touching the public page, the wizard, or the ingestion path. This
 * is a standard compound-interest ESTIMATE, not certified financial advice;
 * every consumer of this module must keep presenting it as an estimate.
 *
 * Both the public page (live preview as the visitor types) and the
 * ingestion path (authoritative recompute at lead-submission time, so a
 * visitor can never submit a falsified number) call the same pure function
 * here — no I/O, safe to import from either a client or server bundle.
 */

export interface RetirementSimulationInput {
  edad: number;
  edadRetiro: number;
  ahorroMensual: number;
  /** Expected annual return, as a percentage (e.g. 8 for 8%) — configurable
   * per mini app (mini_apps.config.annualReturnRatePct), never hardcoded. */
  annualReturnRatePct: number;
}

export interface RetirementSimulationResult {
  fondoEstimado: number;
  fondoRangoBajo: number;
  fondoRangoAlto: number;
  rentaMensualEstimada: number;
}

/** Conservative/optimistic bands are the base rate ± this many percentage
 * points — not user-configurable, just an internal presentation choice. */
const RANGE_OFFSET_PCT = 2;

/** "4% rule" convention for translating a lump sum into a sustainable
 * monthly withdrawal during retirement. */
const ANNUAL_WITHDRAWAL_RATE_PCT = 4;

const MIN_RETURN_RATE_PCT = 0;

/** Future value of a fixed monthly contribution, compounded monthly, over
 * `months` — ordinary annuity (contribution at the end of each month). */
function futureValueOfMonthlySavings(monthlyAmount: number, months: number, annualRatePct: number): number {
  if (months <= 0 || monthlyAmount <= 0) return 0;
  const monthlyRate = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;
  if (monthlyRate === 0) return monthlyAmount * months;
  return monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

export function simulateRetirement(input: RetirementSimulationInput): RetirementSimulationResult {
  const months = Math.max((input.edadRetiro - input.edad) * 12, 0);
  const baseRate = Math.max(input.annualReturnRatePct, MIN_RETURN_RATE_PCT);
  const lowRate = Math.max(baseRate - RANGE_OFFSET_PCT, MIN_RETURN_RATE_PCT);
  const highRate = baseRate + RANGE_OFFSET_PCT;

  const fondoEstimado = futureValueOfMonthlySavings(input.ahorroMensual, months, baseRate);
  const fondoRangoBajo = futureValueOfMonthlySavings(input.ahorroMensual, months, lowRate);
  const fondoRangoAlto = futureValueOfMonthlySavings(input.ahorroMensual, months, highRate);
  const rentaMensualEstimada = (fondoEstimado * (ANNUAL_WITHDRAWAL_RATE_PCT / 100)) / 12;

  return {
    fondoEstimado: Math.round(fondoEstimado),
    fondoRangoBajo: Math.round(fondoRangoBajo),
    fondoRangoAlto: Math.round(fondoRangoAlto),
    rentaMensualEstimada: Math.round(rentaMensualEstimada),
  };
}

export const DEFAULT_ANNUAL_RETURN_RATE_PCT = 8;
