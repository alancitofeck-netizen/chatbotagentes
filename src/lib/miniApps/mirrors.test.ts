import { describe, expect, it, vi } from "vitest";
import { getMiniAppMirrors, withMirrorTargets } from "./mirrors";

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
