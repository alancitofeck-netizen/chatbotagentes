import { describe, expect, it } from "vitest";
import { parseCsvRows, splitCsvLine } from "./csv";

describe("splitCsvLine", () => {
  it("splits a plain comma-separated line", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("keeps a comma inside quotes as part of the field", () => {
    expect(splitCsvLine('Acme, Inc.,"Smith, John",42')).toEqual(["Acme", "Inc.", "Smith, John", "42"]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(splitCsvLine('"She said ""hi""",ok')).toEqual(['She said "hi"', "ok"]);
  });

  it("trims surrounding whitespace on every field", () => {
    expect(splitCsvLine(" a , b ")).toEqual(["a", "b"]);
  });
});

describe("parseCsvRows", () => {
  it("maps rows onto headers, case preserved", () => {
    const { headers, rows } = parseCsvRows("Name,Email\nAlice,alice@x.com\nBob,bob@x.com");
    expect(headers).toEqual(["Name", "Email"]);
    expect(rows).toEqual([
      { Name: "Alice", Email: "alice@x.com" },
      { Name: "Bob", Email: "bob@x.com" },
    ]);
  });

  it("returns empty when there's only a header row (no data)", () => {
    expect(parseCsvRows("Name,Email")).toEqual({ headers: [], rows: [] });
  });

  it("fills a missing trailing field with an empty string", () => {
    const { rows } = parseCsvRows("Name,Email,Phone\nAlice,alice@x.com");
    expect(rows).toEqual([{ Name: "Alice", Email: "alice@x.com", Phone: "" }]);
  });

  it("caps the number of parsed data rows when maxRows is given", () => {
    const text = "Name\n" + ["a", "b", "c", "d"].join("\n");
    expect(parseCsvRows(text, 2).rows).toEqual([{ Name: "a" }, { Name: "b" }]);
  });

  it("ignores blank lines", () => {
    const { rows } = parseCsvRows("Name\nAlice\n\nBob\n");
    expect(rows).toEqual([{ Name: "Alice" }, { Name: "Bob" }]);
  });
});
