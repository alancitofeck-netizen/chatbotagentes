import { describe, expect, it } from "vitest";
import { diceCoefficient, findBestMatch, normalizeForMatch } from "./fuzzyMatch";

describe("normalizeForMatch", () => {
  it("strips accents", () => {
    expect(normalizeForMatch("San Cristóbal")).toBe("san cristobal");
    expect(normalizeForMatch("Federación Patronal")).toBe("federacion patronal");
  });

  it("lowercases and collapses punctuation to spaces", () => {
    expect(normalizeForMatch("N° Póliza")).toBe("n poliza");
    expect(normalizeForMatch("FEDERACION PATRONAL")).toBe("federacion patronal");
  });
});

describe("diceCoefficient", () => {
  it("scores 1 for values identical after normalization", () => {
    expect(diceCoefficient("San Cristobal", "San Cristóbal")).toBe(1);
    expect(diceCoefficient("Federacion Patronal", "FEDERACION PATRONAL")).toBe(1);
  });

  it("scores high for near-duplicate names the wizard should suggest merging", () => {
    // "Federación Patronal" (existing) vs "Federacion Patronal Seguros" (file)
    expect(diceCoefficient("Federación Patronal", "Federacion Patronal Seguros")).toBeGreaterThan(0.72);
  });

  it("scores low for genuinely different names", () => {
    expect(diceCoefficient("San Cristóbal", "La Caja")).toBeLessThan(0.3);
  });

  it("returns 0 rather than throwing for empty strings", () => {
    expect(diceCoefficient("", "anything")).toBe(0);
    expect(diceCoefficient("", "")).toBe(0);
  });
});

describe("findBestMatch", () => {
  it("returns null for an empty candidate list", () => {
    expect(findBestMatch("x", [], (s: string) => s)).toBeNull();
  });

  it("picks the highest-scoring candidate", () => {
    const candidates = ["La Caja", "San Cristóbal", "Federación Patronal"];
    const result = findBestMatch("San Cristobal", candidates, (s) => s);
    expect(result?.item).toBe("San Cristóbal");
    expect(result?.score).toBe(1);
  });
});
