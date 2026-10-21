import { describe, expect, it } from "vitest";
import { applySharedStateOps, parseSharedStateOps } from "./sharedStateOps";

const base = {
  client: { name: "Luis", handle: "" },
  weeks: [{ n: 1, objective: "a" }],
  feed: [
    { id: "f01", status: "Pendiente", hook: "x" },
    { id: "f02", status: "Pendiente", hook: "y" },
  ],
};

describe("applySharedStateOps", () => {
  it("fija un campo de un item por id sin tocar los demás", () => {
    const next = applySharedStateOps(base, [{ p: ["feed", "f02", "status"], v: "Publicado" }]);
    expect(next.feed).toEqual([
      { id: "f01", status: "Pendiente", hook: "x" },
      { id: "f02", status: "Publicado", hook: "y" },
    ]);
    expect(base.feed[1].status).toBe("Pendiente");
  });

  it("combina cambios de dos personas sobre campos distintos", () => {
    const a = applySharedStateOps(base, [{ p: ["feed", "f01", "status"], v: "Publicado" }]);
    const b = applySharedStateOps(a, [{ p: ["feed", "f02", "hook"], v: "nuevo" }]);
    expect(b.feed).toEqual([
      { id: "f01", status: "Publicado", hook: "x" },
      { id: "f02", status: "Pendiente", hook: "nuevo" },
    ]);
  });

  it("objetos, semanas por n y reemplazo de lista", () => {
    const next = applySharedStateOps(base, [
      { p: ["client", "handle"], v: "@luis" },
      { p: ["weeks", 1, "objective"], v: "b" },
      { p: ["feed"], v: [{ id: "f03" }] },
    ]);
    expect((next.client as { handle: string }).handle).toBe("@luis");
    expect(next.weeks).toEqual([{ n: 1, objective: "b" }]);
    expect(next.feed).toEqual([{ id: "f03" }]);
  });

  it("ignora un item que ya no existe", () => {
    expect(applySharedStateOps(base, [{ p: ["feed", "zzz", "status"], v: "Publicado" }])).toEqual(base);
  });
});

describe("parseSharedStateOps", () => {
  it("rechaza formas inválidas y claves peligrosas", () => {
    expect(parseSharedStateOps("x")).toBeNull();
    expect(parseSharedStateOps([{ p: [], v: 1 }])).toBeNull();
    expect(parseSharedStateOps([{ p: ["__proto__", "a"], v: 1 }])).toBeNull();
    expect(parseSharedStateOps([{ p: ["feed", "f01", "status"] }])).toBeNull();
    expect(parseSharedStateOps([{ p: ["feed", "f01", "status"], v: "ok" }])).toEqual([{ p: ["feed", "f01", "status"], v: "ok" }]);
  });
});
