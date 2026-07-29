import { describe, expect, it } from "vitest";
import {
  getDiagnosisSummary,
  getExecutiveSummary,
  getPersonalizedRecommendation,
  getPreparationLevel,
  getStrengthsAndOpportunities,
} from "./resultDiagnostics";

describe("getPreparationLevel", () => {
  it("classifies by replacementPct across all 5 tiers when income is known", () => {
    expect(getPreparationLevel({ aniosParaRetiro: 10, ahorroMensual: 1000, replacementPct: 97 }).stars).toBe(5);
    expect(getPreparationLevel({ aniosParaRetiro: 10, ahorroMensual: 1000, replacementPct: 85 }).stars).toBe(4);
    expect(getPreparationLevel({ aniosParaRetiro: 10, ahorroMensual: 1000, replacementPct: 65 }).stars).toBe(3);
    expect(getPreparationLevel({ aniosParaRetiro: 10, ahorroMensual: 1000, replacementPct: 45 }).stars).toBe(2);
    expect(getPreparationLevel({ aniosParaRetiro: 10, ahorroMensual: 1000, replacementPct: 20 }).stars).toBe(1);
  });

  it("falls back to años/ahorro heuristic across all 5 tiers when replacementPct is null", () => {
    expect(getPreparationLevel({ aniosParaRetiro: 30, ahorroMensual: 9000, replacementPct: null }).stars).toBe(5);
    expect(getPreparationLevel({ aniosParaRetiro: 20, ahorroMensual: 6000, replacementPct: null }).stars).toBe(4);
    expect(getPreparationLevel({ aniosParaRetiro: 12, ahorroMensual: 4000, replacementPct: null }).stars).toBe(3);
    expect(getPreparationLevel({ aniosParaRetiro: 7, ahorroMensual: 500, replacementPct: null }).stars).toBe(2);
    expect(getPreparationLevel({ aniosParaRetiro: 2, ahorroMensual: 500, replacementPct: null }).stars).toBe(1);
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

  it("flags the 'delay retirement' opportunity only when it would meaningfully help", () => {
    const { opportunities: withoutHelp } = getStrengthsAndOpportunities({
      aniosParaRetiro: 20,
      ahorroMensual: 8000,
      replacementPct: 95,
      mejoraRetrasandoRetiroPct: 2,
    });
    const { opportunities: withHelp } = getStrengthsAndOpportunities({
      aniosParaRetiro: 20,
      ahorroMensual: 8000,
      replacementPct: 95,
      mejoraRetrasandoRetiroPct: 12,
    });
    expect(withHelp.some((t) => t.includes("Retrasar"))).toBe(true);
    expect(withoutHelp.some((t) => t.includes("Retrasar"))).toBe(false);
  });
});

describe("getExecutiveSummary", () => {
  it("returns a distinct, non-empty paragraph for every tier", () => {
    const levels = ["excelente", "bueno", "regular", "atencion", "riesgo"] as const;
    const summaries = levels.map((l) => getExecutiveSummary(l));
    expect(new Set(summaries).size).toBe(levels.length);
    for (const s of summaries) expect(s.length).toBeGreaterThan(20);
  });

  it("genuinely changes the text depending on the qualification answer", () => {
    const base = getExecutiveSummary("regular", null);
    const withPension = getExecutiveSummary("regular", { preocupacion: "pension_insuficiente", habloAsesor: null, objetivo: null, cuandoEmpezar: null });
    const withSoloConocer = getExecutiveSummary("regular", { preocupacion: "solo_conocer", habloAsesor: null, objetivo: null, cuandoEmpezar: null });
    expect(withPension).not.toBe(base);
    expect(withSoloConocer).not.toBe(base);
    expect(withPension).not.toBe(withSoloConocer);
  });
});

describe("getDiagnosisSummary", () => {
  it("differs based on objetivo and cuandoEmpezar", () => {
    const a = getDiagnosisSummary("regular", { preocupacion: null, habloAsesor: null, objetivo: "mejorar_retiro", cuandoEmpezar: "esta_semana" });
    const b = getDiagnosisSummary("regular", { preocupacion: null, habloAsesor: null, objetivo: "no_seguro", cuandoEmpezar: "mas_adelante" });
    expect(a).not.toBe(b);
  });

  it("still returns a coherent paragraph with no answers yet", () => {
    const s = getDiagnosisSummary("excelente", null);
    expect(s.length).toBeGreaterThan(20);
  });
});

describe("getPersonalizedRecommendation", () => {
  it("prioritizes 'near retirement' above everything else", () => {
    const rec = getPersonalizedRecommendation({ edad: 58, aniosParaRetiro: 5, ahorroMensual: 9000, stars: 5 });
    expect(rec).toMatch(/cerca del retiro/i);
  });

  it("prioritizes an explicit 'retire early' intent above the low-savings flag", () => {
    const rec = getPersonalizedRecommendation({ edad: 40, aniosParaRetiro: 20, ahorroMensual: 1000, stars: 2, preocupacion: "retirarme_antes" });
    expect(rec).toMatch(/retirarte antes/i);
  });

  it("flags low savings when not near retirement and no 'retire early' intent", () => {
    const rec = getPersonalizedRecommendation({ edad: 40, aniosParaRetiro: 20, ahorroMensual: 1000, stars: 2 });
    expect(rec).toMatch(/aporte mensual/i);
  });

  it("suggests consolidating for a strong profile", () => {
    const rec = getPersonalizedRecommendation({ edad: 40, aniosParaRetiro: 20, ahorroMensual: 8000, stars: 5 });
    expect(rec).toMatch(/consolidarlo/i);
  });

  it("suggests optimizing strategy for someone over 55 with an average profile", () => {
    const rec = getPersonalizedRecommendation({ edad: 58, aniosParaRetiro: 12, ahorroMensual: 4000, stars: 3 });
    expect(rec).toMatch(/optimizar la estrategia/i);
  });

  it("suggests leveraging time for a young, average profile", () => {
    const rec = getPersonalizedRecommendation({ edad: 32, aniosParaRetiro: 25, ahorroMensual: 4000, stars: 3 });
    expect(rec).toMatch(/tiempo de sobra/i);
  });
});
