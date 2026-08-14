import { describe, expect, it } from "vitest";
import { detectAppointmentSyncColumnMapping, resolveEstadoCita } from "./fieldDictionary";

describe("resolveEstadoCita", () => {
  it("maps known aliases to their canonical estado_cita value", () => {
    expect(resolveEstadoCita("Agendada")).toBe("agendada");
    expect(resolveEstadoCita("confirmado")).toBe("confirmada");
    expect(resolveEstadoCita("Asistió")).toBe("realizada");
    expect(resolveEstadoCita("No Show")).toBe("no_show");
    expect(resolveEstadoCita("No asistió")).toBe("no_show");
    expect(resolveEstadoCita("CANCELADO")).toBe("cancelada");
    expect(resolveEstadoCita("Vendido")).toBe("venta");
  });

  it("defaults to agendada for unrecognized or missing text", () => {
    expect(resolveEstadoCita(undefined)).toBe("agendada");
    expect(resolveEstadoCita("")).toBe("agendada");
    expect(resolveEstadoCita("texto raro sin sentido")).toBe("agendada");
  });
});

describe("detectAppointmentSyncColumnMapping", () => {
  it("resolves exact-synonym headers to their field key", () => {
    const headers = ["Fecha", "Hora", "Cliente", "Telefono", "Asesor", "Setter", "Tipo de cita", "Estado"];
    const result = detectAppointmentSyncColumnMapping(headers);
    const byHeader = Object.fromEntries(result.map((r) => [r.header, r.fieldKey]));
    expect(byHeader["Fecha"]).toBe("date");
    expect(byHeader["Hora"]).toBe("time");
    expect(byHeader["Cliente"]).toBe("leadName");
    expect(byHeader["Telefono"]).toBe("phone");
    expect(byHeader["Asesor"]).toBe("advisorName");
    expect(byHeader["Setter"]).toBe("setterName");
    expect(byHeader["Tipo de cita"]).toBe("appointmentType");
    expect(byHeader["Estado"]).toBe("estado");
  });

  it("never assigns two headers to the same field key", () => {
    const headers = ["Fecha", "Date", "Cliente", "Nombre completo"];
    const result = detectAppointmentSyncColumnMapping(headers);
    const assignedKeys = result.map((r) => r.fieldKey).filter((k) => k !== null);
    expect(new Set(assignedKeys).size).toBe(assignedKeys.length);
  });

  it("leaves unrecognized headers unmapped", () => {
    const result = detectAppointmentSyncColumnMapping(["Columna sin relacion alguna xyz"]);
    expect(result[0].fieldKey).toBeNull();
  });
});
