import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Strips everything but digits so a phone-like identifier compares equal
 * regardless of a leading '+', spaces, or dashes — YCloud's docs say phone
 * fields arrive without '+', but values stored in `integration_connections`/
 * `contacts` may have been entered with one (e.g. copied from a dashboard).
 * Comparing exact strings would silently drop a real match on formatting. */
export function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/** Normalizes to E.164 (leading '+') — YCloud's send API wants this, while
 * inbound webhook fields and `integration_connections.external_account_id`
 * may or may not already have it. */
export function normalizeE164(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

/**
 * Resolves the receiving workspace from `integration_connections`, keyed by
 * the RECEIVING YCloud number/account id — never the sender's own phone.
 * docs/blueprint/04-inbox.md + 12-security-audit.md #1 are explicit this is
 * the one place an application bug (not RLS) could leak conversations across
 * tenants. Shared by the webhook (resolving `to`/`from` on inbound events and
 * status updates) — moved here (out of the webhook route file) so it has a
 * single implementation, testable in isolation.
 */
export async function resolveWorkspaceIdForYCloudAccount(
  supabase: SupabaseClient,
  externalAccountId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("integration_connections")
    .select("workspace_id, external_account_id")
    .eq("provider", "ycloud")
    .eq("status", "active");

  const target = digitsOnly(externalAccountId);
  const match = (data ?? []).find((row) => digitsOnly(row.external_account_id as string) === target);

  return (match?.workspace_id as string | undefined) ?? null;
}

export interface YCloudCredentials {
  apiKey: string;
  externalAccountId: string;
}

/**
 * Resolves a workspace's own YCloud API key from Supabase Vault — replaces
 * the single shared `process.env.YCLOUD_API_KEY` every workspace used to
 * read (src/app/api/messages/send/route.ts, before this pass).
 *
 * Delegates to `public.get_whatsapp_credentials` (SECURITY DEFINER,
 * supabase/migrations/0013_whatsapp_credentials_lookup.sql), which is the
 * only place the decrypted secret is ever materialized. That RPC's EXECUTE
 * grant is restricted to `service_role` — calling it with a request-scoped
 * client (the regular `createClient()`, tied to the signed-in user's JWT)
 * will simply fail with a permissions error, so `supabase` here MUST be a
 * `createServiceRoleClient()` instance. Never forward `apiKey` to the
 * browser or log it.
 */
export async function getYCloudCredentials(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<YCloudCredentials | null> {
  const { data, error } = await supabase.rpc("get_whatsapp_credentials", { p_workspace_id: workspaceId }).maybeSingle();

  if (error) {
    console.error(`[ycloud] failed to resolve credentials for workspace ${workspaceId}:`, error);
    return null;
  }

  const row = data as { external_account_id: string; api_key: string } | null;
  if (!row || !row.api_key) return null;

  return { apiKey: row.api_key, externalAccountId: row.external_account_id };
}

export interface YCloudTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phoneNumber?: string }>;
}

export interface CreateYCloudTemplateInput {
  wabaId: string;
  name: string;
  language: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  components: YCloudTemplateComponent[];
}

export interface YCloudTemplateResult {
  id: string;
  status: string;
  rejectedReason?: string;
}

/** POST /v2/whatsapp/templates — submits a template to Meta for review via
 * YCloud. The response's `status` is normally "PENDING" right after
 * creation; the final approved/rejected outcome arrives later via the
 * `whatsapp.template.reviewed` webhook (src/app/api/webhooks/ycloud/route.ts),
 * not synchronously here. */
export async function createYCloudTemplate(
  credentials: YCloudCredentials,
  input: CreateYCloudTemplateInput,
): Promise<YCloudTemplateResult> {
  const res = await fetch("https://api.ycloud.com/v2/whatsapp/templates", {
    method: "POST",
    headers: { "X-API-Key": credentials.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("[ycloud] template creation rejected:", res.status, data);
    throw new Error((data?.message as string | undefined) ?? "YCloud rechazó la creación de la plantilla.");
  }
  return {
    id: data.id as string,
    status: (data.status as string | undefined) ?? "PENDING",
    rejectedReason: data.rejectedReason as string | undefined,
  };
}

/** DELETE /v2/whatsapp/templates/{id} — 404 is treated as already-deleted
 * (idempotent), not an error, since the local row may be out of sync with
 * YCloud (e.g. deleted from the YCloud dashboard directly). */
export async function deleteYCloudTemplate(credentials: YCloudCredentials, ycloudTemplateId: string): Promise<void> {
  const res = await fetch(`https://api.ycloud.com/v2/whatsapp/templates/${ycloudTemplateId}`, {
    method: "DELETE",
    headers: { "X-API-Key": credentials.apiKey },
  });
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => null);
    console.error("[ycloud] template deletion rejected:", res.status, data);
    throw new Error((data?.message as string | undefined) ?? "YCloud rechazó la eliminación de la plantilla.");
  }
}
