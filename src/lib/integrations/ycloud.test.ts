import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { digitsOnly, getYCloudCredentials, normalizeE164, resolveWorkspaceIdForYCloudAccount } from "./ycloud";

describe("digitsOnly", () => {
  it("strips a leading '+'", () => {
    expect(digitsOnly("+15551234567")).toBe("15551234567");
  });

  it("strips spaces and dashes", () => {
    expect(digitsOnly("+1 555-123-4567")).toBe("15551234567");
  });

  it("passes through a bare digit string unchanged", () => {
    expect(digitsOnly("15551234567")).toBe("15551234567");
  });
});

describe("normalizeE164", () => {
  it("adds a leading '+' when missing", () => {
    expect(normalizeE164("15551234567")).toBe("+15551234567");
  });

  it("leaves an already-E.164 number untouched", () => {
    expect(normalizeE164("+15551234567")).toBe("+15551234567");
  });

  it("trims surrounding whitespace before checking for '+'", () => {
    expect(normalizeE164("  15551234567  ")).toBe("+15551234567");
  });
});

/** Builds a fake Supabase query builder: `.select()`/`.eq()` are chainable
 * (return themselves) and the object itself is thenable, resolving to
 * `result` once awaited — mirrors how supabase-js's PostgrestFilterBuilder
 * is used in ycloud.ts (awaited directly, `.then()` never called explicitly). */
function fakeFrom(result: { data: unknown }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    then: (resolve: (v: typeof result) => void) => resolve(result),
  };
  return builder;
}

function fakeSupabaseFrom(result: { data: unknown }): SupabaseClient {
  return { from: () => fakeFrom(result) } as unknown as SupabaseClient;
}

describe("resolveWorkspaceIdForYCloudAccount", () => {
  it("matches by digits-only, ignoring a leading '+' mismatch", async () => {
    const supabase = fakeSupabaseFrom({
      data: [{ workspace_id: "ws-1", external_account_id: "+15553147336" }],
    });
    // Webhook payload arrives without '+' — must still match the '+'-prefixed stored value.
    await expect(resolveWorkspaceIdForYCloudAccount(supabase, "15553147336")).resolves.toBe("ws-1");
  });

  it("returns null when no row matches", async () => {
    const supabase = fakeSupabaseFrom({
      data: [{ workspace_id: "ws-1", external_account_id: "+15553147336" }],
    });
    await expect(resolveWorkspaceIdForYCloudAccount(supabase, "+19998887777")).resolves.toBeNull();
  });

  it("returns null when the query returns no rows at all", async () => {
    const supabase = fakeSupabaseFrom({ data: [] });
    await expect(resolveWorkspaceIdForYCloudAccount(supabase, "+15553147336")).resolves.toBeNull();
  });

  it("returns null when data is null (query error swallowed upstream)", async () => {
    const supabase = fakeSupabaseFrom({ data: null });
    await expect(resolveWorkspaceIdForYCloudAccount(supabase, "+15553147336")).resolves.toBeNull();
  });

  it("picks the correct workspace among multiple connections", async () => {
    const supabase = fakeSupabaseFrom({
      data: [
        { workspace_id: "ws-1", external_account_id: "+15551110000" },
        { workspace_id: "ws-2", external_account_id: "+15553147336" },
      ],
    });
    await expect(resolveWorkspaceIdForYCloudAccount(supabase, "15553147336")).resolves.toBe("ws-2");
  });
});

function fakeSupabaseRpc(result: { data: unknown; error: unknown }): SupabaseClient {
  return {
    rpc: () => ({ maybeSingle: async () => result }),
  } as unknown as SupabaseClient;
}

describe("getYCloudCredentials", () => {
  it("returns the api key and account id when a row is found", async () => {
    const supabase = fakeSupabaseRpc({
      data: { external_account_id: "+15553147336", api_key: "secret-key-123" },
      error: null,
    });
    await expect(getYCloudCredentials(supabase, "ws-1")).resolves.toEqual({
      apiKey: "secret-key-123",
      externalAccountId: "+15553147336",
    });
  });

  it("returns null when no active connection exists for the workspace", async () => {
    const supabase = fakeSupabaseRpc({ data: null, error: null });
    await expect(getYCloudCredentials(supabase, "ws-without-integration")).resolves.toBeNull();
  });

  it("returns null (not throws) when the RPC errors, e.g. called with the wrong client", async () => {
    const supabase = fakeSupabaseRpc({ data: null, error: { message: "permission denied" } });
    await expect(getYCloudCredentials(supabase, "ws-1")).resolves.toBeNull();
  });

  it("returns null when the row exists but api_key is empty (defensive)", async () => {
    const supabase = fakeSupabaseRpc({ data: { external_account_id: "+1555", api_key: "" }, error: null });
    await expect(getYCloudCredentials(supabase, "ws-1")).resolves.toBeNull();
  });
});
