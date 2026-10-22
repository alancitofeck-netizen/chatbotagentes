import { describe, expect, it } from "vitest";
import { financeStatus, nextRecurrenceDate, toBase, whatsappReminderUrl, type FinanceItem } from "./model";

const item = (over: Partial<FinanceItem>): FinanceItem => ({
  key: "manual:1", id: "1", source: "manual", type: "in", cat: "asesoria", title: "Asesoría", party: "Juan Pérez",
  amount: 100, cur: "USD", date: "2026-10-21", rec: "", method: "", methodDetail: "", paid: false, paidDate: null,
  notes: "", policyId: null, contactPhone: null, ...over,
});

describe("financeStatus", () => {
  it("pagado, vencido, pronto (≤3 días) y pendiente", () => {
    expect(financeStatus(item({ paid: true, date: "2026-01-01" }), "2026-10-21")).toBe("done");
    expect(financeStatus(item({ date: "2026-10-20" }), "2026-10-21")).toBe("late");
    expect(financeStatus(item({ date: "2026-10-21" }), "2026-10-21")).toBe("soon");
    expect(financeStatus(item({ date: "2026-10-24" }), "2026-10-21")).toBe("soon");
    expect(financeStatus(item({ date: "2026-10-25" }), "2026-10-21")).toBe("pend");
  });
});

describe("nextRecurrenceDate", () => {
  it("mensual y anual, respetando fin de mes", () => {
    expect(nextRecurrenceDate("2026-10-15", "mensual")).toBe("2026-11-15");
    expect(nextRecurrenceDate("2026-01-31", "mensual")).toBe("2026-02-28");
    expect(nextRecurrenceDate("2026-12-10", "mensual")).toBe("2027-01-10");
    expect(nextRecurrenceDate("2028-02-29", "anual")).toBe("2029-02-28");
    expect(nextRecurrenceDate("2026-10-15", "")).toBeNull();
  });
});

describe("toBase", () => {
  const settings = { baseCurrency: "MXN", rates: { USD: 1, MXN: 18.5, ARS: 1200 } };
  it("convierte a la moneda de los totales", () => {
    expect(toBase(100, "USD", settings)).toBeCloseTo(1850);
    expect(toBase(1850, "MXN", settings)).toBeCloseTo(1850);
    expect(toBase(1200, "ARS", settings)).toBeCloseTo(18.5);
    expect(toBase(10, "EUR", settings)).toBeCloseTo(185);
  });
});

describe("whatsappReminderUrl", () => {
  it("usa el teléfono del cliente cuando lo hay", () => {
    expect(whatsappReminderUrl(item({ contactPhone: "+52 55 1234 5678" }))).toMatch(/^https:\/\/wa\.me\/525512345678\?text=Hola%20Juan/);
    expect(whatsappReminderUrl(item({}))).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });
});
