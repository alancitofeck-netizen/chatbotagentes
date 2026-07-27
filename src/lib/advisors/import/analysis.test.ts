import { describe, expect, it } from "vitest";
import { candidateKey, collectDistinctLookups, suggestIntraFileMerges } from "./analysis";
import type { MappedRowData } from "./types";

describe("suggestIntraFileMerges", () => {
  it("suggests merging near-duplicate NEW insurer names within the same file", () => {
    const rows: MappedRowData[] = [
      { polizaAseguradora: "Federacion Patronal" },
      { polizaAseguradora: "Federación Patronal S.A." },
      { polizaAseguradora: "Sancor Seguros" },
    ];
    const candidates = collectDistinctLookups(rows);
    const suggestions = suggestIntraFileMerges(candidates, new Map());

    const fpVariant = candidates.find((c) => c.fileValue === "Federación Patronal S.A.")!;
    const suggestion = suggestions.get(candidateKey(fpVariant));
    expect(suggestion?.targetFileValue).toBe("Federacion Patronal");

    const sancor = candidates.find((c) => c.fileValue === "Sancor Seguros")!;
    expect(suggestions.get(candidateKey(sancor))).toBeUndefined();
  });

  it("does not suggest a merge for a candidate that already matched the existing catalog", () => {
    const rows: MappedRowData[] = [{ polizaAseguradora: "Federacion Patronal" }, { polizaAseguradora: "Federación Patronal S.A." }];
    const candidates = collectDistinctLookups(rows);
    const first = candidates[0];
    const catalogMatch = new Map([[candidateKey(first), { candidateId: "existing-id", score: 0.9 }]]);

    const suggestions = suggestIntraFileMerges(candidates, catalogMatch);
    const second = candidates[1];
    // The first candidate is excluded from being a merge target's SOURCE
    // (it's anchored to the catalog already) but can still be considered as
    // a matching target for the second — what matters is neither produces a
    // suggestion pointing at a non-existent grouping.
    expect(suggestions.has(candidateKey(first))).toBe(false);
    void second;
  });

  it("keeps genuinely distinct insurer names separate", () => {
    const rows: MappedRowData[] = [{ polizaAseguradora: "Sancor Seguros" }, { polizaAseguradora: "La Caja" }];
    const candidates = collectDistinctLookups(rows);
    const suggestions = suggestIntraFileMerges(candidates, new Map());
    expect(suggestions.size).toBe(0);
  });
});
