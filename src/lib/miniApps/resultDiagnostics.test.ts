import { describe, expect, it } from "vitest";
import { getPreparationLevel, getStrengthsAndOpportunities } from "./resultDiagnostics";

describe("getPreparationLevel", () => {
  it("classifies by replacementPct when income is known", () => {
    expect(getPreparationLevel({ aniosParaRetiro: 10, ahorroMensual: 1000, replacementPct: 95 }).level).toBe("excelente");
    expect(getPreparationLevel({ aniosParaRetiro: 10, ahorroMensual: 1000, replacementPct: 75 }).level).toBe("media");
    expect(getPreparationLevel({ aniosParaRetiro: 10, ahorroMensual: 1000, replacementPct: 55 }).level).toBe("mejorable");
    expect(getPreparationLevel({ aniosParaRetiro: 10, ahorroMensual: 1000, replacementPct: 20 }).level).toBe("riesgo");
  });

  it("falls back to años/ahorro heuristic when replacementPct is null", () => {
    expect(getPreparationLevel({ aniosParaRetiro: 25, ahorroMensual: 8000, replacementPct: null }).level).toBe("excelente");
    expect(getPreparationLevel({ aniosParaRetiro: 12, ahorroMensual: 4000, replacementPct: null }).level).toBe("media");
    expect(getPreparationLevel({ aniosParaRetiro: 7, ahorroMensual: 500, replacementPct: null }).level).toBe("mejorable");
    expect(getPreparationLevel({ aniosParaRetiro: 2, ahorroMensual: 500, replacementPct: null }).level).toBe("riesgo");
  });

  it("always returns a non-empty reason", () => {
    const result = getPreparationLevel({ aniosParaRetiro: 0, ahorroMensual: 0, replacementPct: null });
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

describe("getStrengthsAndOpportunities", () => {
  it("never returns an empty list on either side", () => {
    const { strengths, opportunities } = getStrengthsAndOpportunities({ aniosParaRetiro: 12, ahorroMensual: 4500, replacementPct: 80 });
    expect(strengths.length).toBeGreaterThan(0);
    expect(opportunities.length).toBeGreaterThan(0);
  });

  it("detects strengths for a well-prepared case", () => {
    const { strengths } = getStrengthsAndOpportunities({ aniosParaRetiro: 20, ahorroMensual: 8000, replacementPct: 95 });
    expect(strengths.length).toBeGreaterThanOrEqual(2);
  });

  it("detects opportunities for a weak case", () => {
    const { opportunities } = getStrengthsAndOpportunities({ aniosParaRetiro: 5, ahorroMensual: 1000, replacementPct: 40 });
    expect(opportunities.length).toBe(3);
  });
});
