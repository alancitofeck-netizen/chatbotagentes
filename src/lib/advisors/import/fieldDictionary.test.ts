import { describe, expect, it } from "vitest";
import { detectColumnMapping } from "./fieldDictionary";

function mappingOf(headers: string[]) {
  return Object.fromEntries(detectColumnMapping(headers).map((r) => [r.header, r.fieldKey]));
}

describe("detectColumnMapping", () => {
  it("maps the request's own worked examples exactly", () => {
    const mapping = mappingOf(["Nombre Cliente", "Company", "Premium", "Policy Number", "Expiration"]);
    expect(mapping["Nombre Cliente"]).toBe("clienteNombre");
    expect(mapping["Company"]).toBe("polizaAseguradora");
    expect(mapping["Premium"]).toBe("polizaPremio");
    expect(mapping["Policy Number"]).toBe("polizaNumero");
    expect(mapping["Expiration"]).toBe("fechaVencimiento");
  });

  it("maps every insurer-header variant from the request to Aseguradora", () => {
    for (const header of ["Aseguradora", "Compañía", "Insurance Company"]) {
      expect(mappingOf([header])[header]).toBe("polizaAseguradora");
    }
  });

  it("maps every policy-number variant from the request to Número de póliza", () => {
    for (const header of ["Póliza", "Número", "N° Póliza", "Policy Number"]) {
      expect(mappingOf([header])[header]).toBe("polizaNumero");
    }
  });

  it("leaves an unrecognizable column unmapped rather than guessing", () => {
    const mapping = detectColumnMapping(["xyz_totally_unrelated_column"]);
    expect(mapping[0].fieldKey).toBeNull();
  });

  it("never assigns the same internal field to two different headers", () => {
    // Two headers that would both plausibly match "Aseguradora" — only one wins.
    const mapping = detectColumnMapping(["Aseguradora", "Compañía"]);
    const assignedToInsurer = mapping.filter((r) => r.fieldKey === "polizaAseguradora");
    expect(assignedToInsurer).toHaveLength(1);
  });
});
