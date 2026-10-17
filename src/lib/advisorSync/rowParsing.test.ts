import { describe, expect, it } from "vitest";
import { appointmentRowKey, parseContactado, parseSheetDate, phoneDigits, phoneLookupCandidates } from "./rowParsing";

const MX = 360; // UTC-6
const NOW = new Date("2026-10-17T12:00:00Z");

describe("phoneDigits / phoneLookupCandidates", () => {
  it("deja solo dígitos", () => {
    expect(phoneDigits("+52 1 (220) 104-9780")).toBe("5212201049780");
    expect(phoneDigits(undefined)).toBe("");
  });

  it("incluye las variantes con/sin + y con/sin el 1 de celular mexicano", () => {
    const c = phoneLookupCandidates("5212201049780");
    expect(c).toContain("5212201049780");
    expect(c).toContain("+5212201049780");
    expect(c).toContain("522201049780");
    expect(c).toContain("+522201049780");
    expect(phoneLookupCandidates("5532620603")).toContain("525532620603");
    expect(phoneLookupCandidates("")).toEqual([]);
  });
});

describe("parseSheetDate", () => {
  it("dd/mm sin año asume el año actual y respeta la zona horaria", () => {
    const r = parseSheetDate("15/10", "16:30", MX, NOW)!;
    expect(r.sinHora).toBe(false);
    expect(r.date.toISOString()).toBe("2026-10-15T22:30:00.000Z");
  });

  it("hora vacía → sin hora, 00:00 local (nunca inventa un horario)", () => {
    const r = parseSheetDate("15/10/2026", "", MX, NOW)!;
    expect(r.sinHora).toBe(true);
    expect(r.date.toISOString()).toBe("2026-10-15T06:00:00.000Z");
  });

  it("acepta serial de Sheets con fracción de hora y hora como fracción", () => {
    // 46310 = 2026-10-15
    expect(parseSheetDate("46310", "0.5", MX, NOW)!.date.toISOString()).toBe("2026-10-15T18:00:00.000Z");
    expect(parseSheetDate("46310.75", undefined, 180, NOW)!.date.toISOString()).toBe("2026-10-15T21:00:00.000Z");
  });

  it("entiende am/pm y descarta horas ambiguas", () => {
    expect(parseSheetDate("2026-10-15", "4 pm", MX, NOW)!.date.toISOString()).toBe("2026-10-15T22:00:00.000Z");
    expect(parseSheetDate("2026-10-15", "12:15 a.m.", MX, NOW)!.date.toISOString()).toBe("2026-10-15T06:15:00.000Z");
    expect(parseSheetDate("2026-10-15", "10", MX, NOW)!.sinHora).toBe(true);
  });

  it("rechaza fechas inválidas", () => {
    expect(parseSheetDate("31/02", "10:00", MX, NOW)).toBeNull();
    expect(parseSheetDate("mañana", "10:00", MX, NOW)).toBeNull();
    expect(parseSheetDate("", "10:00", MX, NOW)).toBeNull();
  });
});

describe("parseContactado", () => {
  it("Sí/No y variantes", () => {
    expect(parseContactado("Sí")).toBe(true);
    expect(parseContactado("SI")).toBe(true);
    expect(parseContactado("x")).toBe(true);
    expect(parseContactado("No")).toBe(false);
    expect(parseContactado("")).toBeNull();
    expect(parseContactado("quizás")).toBeNull();
  });
});

describe("appointmentRowKey", () => {
  it("usa el día local, no el UTC", () => {
    const late = parseSheetDate("15/10", "23:30", MX, NOW)!.date; // ya es 16/10 en UTC
    expect(appointmentRowKey("5215512345678", late, MX)).toBe("k:5215512345678|2026-10-15");
  });
});
