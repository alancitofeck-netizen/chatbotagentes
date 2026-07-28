import { describe, expect, it } from "vitest";
import { recommendedMonthlyIncome, simulateRetirement, RECOMMENDED_INCOME_REPLACEMENT_PCT } from "./financialEngine";

describe("recommendedMonthlyIncome", () => {
  it("applies the replacement percentage and rounds", () => {
    expect(recommendedMonthlyIncome(10000)).toBe(7000);
    expect(recommendedMonthlyIncome(12345)).toBe(Math.round(12345 * (RECOMMENDED_INCOME_REPLACEMENT_PCT / 100)));
  });

  it("returns 0 when current income is 0 (unknown)", () => {
    expect(recommendedMonthlyIncome(0)).toBe(0);
  });
});

describe("brecha derivation (as used by the results screen)", () => {
  it("floors at zero when the estimated pension already covers the recommended income", () => {
    const result = simulateRetirement({ edad: 25, edadRetiro: 65, ahorroMensual: 20000, annualReturnRatePct: 8 });
    const ingresoRecomendado = recommendedMonthlyIncome(5000);
    const brecha = Math.max(0, ingresoRecomendado - result.rentaMensualEstimada);
    expect(brecha).toBe(0);
  });

  it("is positive when the estimated pension falls short of the recommended income", () => {
    const result = simulateRetirement({ edad: 55, edadRetiro: 65, ahorroMensual: 1000, annualReturnRatePct: 8 });
    const ingresoRecomendado = recommendedMonthlyIncome(40000);
    const brecha = Math.max(0, ingresoRecomendado - result.rentaMensualEstimada);
    expect(brecha).toBeGreaterThan(0);
  });
});
