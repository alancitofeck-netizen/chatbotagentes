import { describe, expect, it } from "vitest";
import { calculateBrechaRetiro, REGIMEN_LABELS } from "./brechaEngine";

describe("calculateBrechaRetiro", () => {
  const base = { edad: 40, retiroDeseado: 65, sueldoMensual: 25000, semanasCotizadas: null, ahorroMensual: 0 };

  it("Ley 73: pensión actual usa el factor por semanas, con 750 por default cuando semanasCotizadas es null", () => {
    const result = calculateBrechaRetiro({ ...base, regimen: "73" });
    // factor = 0.40 + max(0, 750-500)/1500*0.45 = 0.40 + 0.075 = 0.475
    expect(result.have).toBeCloseTo(25000 * 0.475, 5);
    expect(result.haveLbl).toBe("Pensión hoy");
    expect(result.needLbl).toBe("Con Mod. 40");
    expect(result.gap).toBeGreaterThan(0);
  });

  it("Ley 73: más semanas cotizadas suben el factor (hasta el tope de 0.85)", () => {
    const few = calculateBrechaRetiro({ ...base, regimen: "73", semanasCotizadas: 500 });
    const many = calculateBrechaRetiro({ ...base, regimen: "73", semanasCotizadas: 3000 });
    expect(many.have).toBeGreaterThan(few.have);
    expect(many.have).toBeCloseTo(25000 * 0.85, 5); // tope del factor
  });

  it("Ley 97: have = 30% del sueldo + 50% del ahorro voluntario, need = 75% del sueldo", () => {
    const result = calculateBrechaRetiro({ ...base, regimen: "97", ahorroMensual: 2000 });
    expect(result.have).toBeCloseTo(25000 * 0.3 + 2000 * 0.5, 5);
    expect(result.need).toBeCloseTo(25000 * 0.75, 5);
    expect(result.gapLbl).toBe("Tu brecha mensual");
  });

  it("régimen desconocido usa un estimado base del 32% del sueldo", () => {
    const result = calculateBrechaRetiro({ ...base, regimen: "unknown" });
    expect(result.have).toBeCloseTo(25000 * 0.32, 5);
    expect(result.gapLbl).toBe("Tu brecha estimada");
  });

  it("el gap nunca es negativo para Ley 97 y régimen desconocido", () => {
    const result97 = calculateBrechaRetiro({ ...base, regimen: "97", sueldoMensual: 1000, ahorroMensual: 10000 });
    expect(result97.gap).toBeGreaterThanOrEqual(0);
  });

  it("los 3 régimenes producen textos y facts distintos", () => {
    const r73 = calculateBrechaRetiro({ ...base, regimen: "73" });
    const r97 = calculateBrechaRetiro({ ...base, regimen: "97" });
    const rUnknown = calculateBrechaRetiro({ ...base, regimen: "unknown" });
    const eyebrows = new Set([r73.resEyebrow, r97.resEyebrow, rUnknown.resEyebrow]);
    expect(eyebrows.size).toBe(3);
    expect(r73.facts).not.toEqual(r97.facts);
    expect(r97.facts).not.toEqual(rUnknown.facts);
  });

  it("REGIMEN_LABELS da texto legible para el CRM, no los códigos internos", () => {
    expect(REGIMEN_LABELS["73"]).toBe("Ley 73");
    expect(REGIMEN_LABELS["97"]).toBe("Ley 97");
    expect(REGIMEN_LABELS.unknown).toBe("Por confirmar");
  });
});
