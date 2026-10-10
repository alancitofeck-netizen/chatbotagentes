import { describe, expect, it } from "vitest";
import { mergeRepeatedLeadData } from "./leadDataMerge";

describe("mergeRepeatedLeadData", () => {
  it("suma las claves nuevas al lead existente", () => {
    expect(mergeRepeatedLeadData({ objetivo: "Mejorar mi retiro" }, { urgencia: "Esta semana" })).toEqual({ objetivo: "Mejorar mi retiro", urgencia: "Esta semana" });
  });

  it("lo nuevo pisa a lo anterior en la misma clave", () => {
    expect(mergeRepeatedLeadData({ urgencia: "Este mes" }, { urgencia: "Esta semana" })).toEqual({ urgencia: "Esta semana" });
  });

  it("un valor vacío nunca borra uno lleno", () => {
    expect(mergeRepeatedLeadData({ email: "a@b.com" }, { email: "", notas: null })).toBeNull();
  });

  it("devuelve null si el reenvío no aporta nada", () => {
    expect(mergeRepeatedLeadData({ edad_actual: 30, escenarios: { a: 1 } }, { edad_actual: 30, escenarios: { a: 1 } })).toBeNull();
  });
});
