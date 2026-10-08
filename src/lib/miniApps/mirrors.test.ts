import { describe, expect, it, vi } from "vitest";
import { getMiniAppGroup, getMiniAppMirrors, updateMiniAppGroup, withMirrorTargets } from "./mirrors";

/** Cliente falso: solo la cadena from().select().eq() que usa mirrors.ts. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as never, from, eq };
}

describe("getMiniAppMirrors", () => {
  it("busca los espejos por mirror_of de la original", async () => {
    const mirror = { id: "m1", workspace_id: "ws-b", name: "Espejo", assigned_agent_id: null };
    const { client, from, eq } = fakeClient({ data: [mirror], error: null });

    await expect(getMiniAppMirrors(client, "orig")).resolves.toEqual([mirror]);
    expect(from).toHaveBeenCalledWith("mini_apps");
    expect(eq).toHaveBeenCalledWith("mirror_of", "orig");
  });

  it("ante un error devuelve [] para no frenar la escritura de la original", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({ data: null, error: { message: "boom" } });
    await expect(getMiniAppMirrors(client, "orig")).resolves.toEqual([]);
  });
});

describe("withMirrorTargets", () => {
  it("devuelve la original primero y después cada espejo", async () => {
    const { client } = fakeClient({
      data: [
        { id: "m1", workspace_id: "ws-b", name: "Espejo 1", assigned_agent_id: null },
        { id: "m2", workspace_id: "ws-c", name: "Espejo 2", assigned_agent_id: null },
      ],
      error: null,
    });

    await expect(withMirrorTargets(client, { id: "orig", workspace_id: "ws-a" })).resolves.toEqual([
      { workspace_id: "ws-a", mini_app_id: "orig" },
      { workspace_id: "ws-b", mini_app_id: "m1" },
      { workspace_id: "ws-c", mini_app_id: "m2" },
    ]);
  });

  it("sin espejos, solo la original", async () => {
    const { client } = fakeClient({ data: [], error: null });
    await expect(withMirrorTargets(client, { id: "orig", workspace_id: "ws-a" })).resolves.toEqual([{ workspace_id: "ws-a", mini_app_id: "orig" }]);
  });
});

/** Cliente falso para getMiniAppGroup: from().select().eq().maybeSingle() para
 * la fila pedida y from().select().or() para la original + espejos. */
function groupClient(row: unknown, rows: unknown[]) {
  const or = vi.fn().mockResolvedValue({ data: rows, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }), or }) }));
  return { client: { from } as never, or };
}

const ORIGINAL = { id: "orig", workspace_id: "ws-sujey", slug: "cotizador", config: { bundleVersion: 3, propio: "s" }, allowed_origins: ["null"], mirror_of: null };
const ESPEJO = { id: "esp", workspace_id: "ws-adri", slug: "cotizador", config: { bundleVersion: 3, propio: "a" }, allowed_origins: ["null"], mirror_of: "orig" };

describe("getMiniAppGroup", () => {
  it("desde un espejo, la página publicada es la de la original", async () => {
    const { client, or } = groupClient({ id: "esp", mirror_of: "orig" }, [ORIGINAL, ESPEJO]);
    const group = await getMiniAppGroup(client, "esp");

    expect(or).toHaveBeenCalledWith("id.eq.orig,mirror_of.eq.orig");
    expect(group?.published).toEqual({ id: "orig", workspace_id: "ws-sujey", slug: "cotizador", config: ORIGINAL.config, allowed_origins: ["null"] });
    expect(group?.copies.map((c) => c.id)).toEqual(["orig", "esp"]);
  });

  it("desde la original da el mismo grupo", async () => {
    const { client, or } = groupClient({ id: "orig", mirror_of: null }, [ORIGINAL, ESPEJO]);
    const group = await getMiniAppGroup(client, "orig");
    expect(or).toHaveBeenCalledWith("id.eq.orig,mirror_of.eq.orig");
    expect(group?.published.id).toBe("orig");
  });

  it("devuelve null si la mini app no existe", async () => {
    const { client } = groupClient(null, []);
    await expect(getMiniAppGroup(client, "nada")).resolves.toBeNull();
  });
});

describe("updateMiniAppGroup", () => {
  it("aplica el cambio a todas las copias sin pisar lo propio de cada una", async () => {
    const updates: { id: string; values: Record<string, unknown> }[] = [];
    const from = vi.fn(() => ({
      update: (values: Record<string, unknown>) => ({ eq: (_col: string, id: string) => (updates.push({ id, values }), Promise.resolve({ error: null })) }),
    }));
    const group = {
      published: { id: "orig", workspace_id: "ws-sujey", slug: "cotizador", config: ORIGINAL.config, allowed_origins: ["null"] },
      copies: [
        { id: "orig", config: ORIGINAL.config },
        { id: "esp", config: ESPEJO.config },
      ],
    };

    await updateMiniAppGroup({ from } as never, group, { bundleVersion: 4 }, { api_key_last4: "abcd" });

    expect(updates.map((u) => [u.id, u.values.config, u.values.api_key_last4])).toEqual([
      ["orig", { bundleVersion: 4, propio: "s" }, "abcd"],
      ["esp", { bundleVersion: 4, propio: "a" }, "abcd"],
    ]);
  });
});
