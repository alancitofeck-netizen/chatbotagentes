import { describe, expect, it } from "vitest";
import { isSupportedFileName, isXlsxFileName, parseCsvFile } from "./parseFile";

describe("isSupportedFileName", () => {
  it("accepts .xlsx and .csv", () => {
    expect(isSupportedFileName("cartera.xlsx")).toBe(true);
    expect(isSupportedFileName("cartera.csv")).toBe(true);
    expect(isSupportedFileName("CARTERA.XLSX")).toBe(true);
  });

  it("rejects legacy .xls and anything else", () => {
    expect(isSupportedFileName("cartera.xls")).toBe(false);
    expect(isSupportedFileName("cartera.pdf")).toBe(false);
    expect(isSupportedFileName("cartera")).toBe(false);
  });
});

describe("isXlsxFileName", () => {
  it("only matches .xlsx", () => {
    expect(isXlsxFileName("cartera.xlsx")).toBe(true);
    expect(isXlsxFileName("cartera.csv")).toBe(false);
  });
});

describe("parseCsvFile", () => {
  it("strips a leading UTF-8 BOM so the first header maps cleanly", () => {
    const { headers } = parseCsvFile("﻿Nombre,Email\nAlice,a@x.com", 100);
    expect(headers[0]).toBe("Nombre");
  });

  it("reports totalRows independent of the maxRows cap", () => {
    const text = "Nombre\n" + ["a", "b", "c", "d", "e"].join("\n");
    const parsed = parseCsvFile(text, 2);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.totalRows).toBe(5);
  });
});
