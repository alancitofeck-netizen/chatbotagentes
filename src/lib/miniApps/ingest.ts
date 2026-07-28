import "server-only";
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyApiKey } from "@/lib/miniApps/apiKey";

const KNOWN_TOP_LEVEL_FIELDS = new Set([
  "fecha",
  "origen_app",
  "agente",
  "nombre",
  "whatsapp",
  "consentimiento",
  "consentimiento_fecha",
]);

const RATE_LIMIT_PER_MINUTE = 20;

export type IngestResult =
  | { ok: true; duplicate?: boolean; allowedOrigins: string[] }
  | { ok: false; status: number; error: string; allowedOrigins: string[] };

export interface IngestInput {
  slug: string;
  apiKey: string | null;
  origin: string | null;
  payload: unknown;
  ip: string | null;
  userAgent: string | null;
}

interface MiniAppRow {
  id: string;
  workspace_id: string;
  api_key_hash: string;
  allowed_origins: string[];
  status: string;
  name: string;
}

/** Resolves the mini app + verifies the API key — always via
 * createServiceRoleClient(), since this is an anonymous public request with
 * no session/RLS context. Workspace is always taken from THIS row, never
 * from anything the caller sends (same principle as the YCloud webhook's
 * resolveWorkspaceIdForYCloudAccount). */
async function resolveAuthorizedMiniApp(
  slug: string,
  apiKey: string | null,
): Promise<{ ok: true; app: MiniAppRow } | { ok: false; status: number; error: string }> {
  const supabase = createServiceRoleClient();
  const { data: app } = await supabase
    .from("mini_apps")
    .select("id, workspace_id, api_key_hash, allowed_origins, status, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!app) return { ok: false, status: 404, error: "not_found" };
  if (app.status !== "active") return { ok: false, status: 404, error: "not_found" };
  if (!apiKey || !verifyApiKey(apiKey, app.api_key_hash as string)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true, app: app as unknown as MiniAppRow };
}

/** Only enforced when the request actually carries an Origin header (a
 * genuine browser POST always will, per the PDF spec) — a header-less
 * server-to-server call has nothing to check against and CORS itself is a
 * browser-only concept, so it's let through here (the API key is the real
 * auth boundary either way). */
export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

export async function ingestMiniAppLead(input: IngestInput): Promise<IngestResult> {
  const resolved = await resolveAuthorizedMiniApp(input.slug, input.apiKey);
  if (!resolved.ok) return { ...resolved, allowedOrigins: [] };
  const { app } = resolved;
  const allowedOrigins = app.allowed_origins ?? [];

  if (!isOriginAllowed(input.origin, allowedOrigins)) {
    return { ok: false, status: 403, error: "origin_not_allowed", allowedOrigins };
  }

  if (typeof input.payload !== "object" || input.payload === null) {
    return { ok: false, status: 400, error: "invalid_json", allowedOrigins };
  }
  const body = input.payload as Record<string, unknown>;

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
  if (!nombre) return { ok: false, status: 400, error: "missing_nombre", allowedOrigins };
  if (!whatsapp) return { ok: false, status: 400, error: "missing_whatsapp", allowedOrigins };
  if (body.consentimiento !== true) return { ok: false, status: 400, error: "missing_consent", allowedOrigins };
  if (!isValidDateString(body.consentimiento_fecha)) {
    return { ok: false, status: 400, error: "invalid_consent_date", allowedOrigins };
  }
  if (!isValidDateString(body.fecha)) return { ok: false, status: 400, error: "invalid_fecha", allowedOrigins };

  const supabase = createServiceRoleClient();

  const { count: recentCount } = await supabase
    .from("mini_app_leads")
    .select("id", { count: "exact", head: true })
    .eq("mini_app_id", app.id)
    .gte("received_at", new Date(Date.now() - 60_000).toISOString());
  if ((recentCount ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    return { ok: false, status: 429, error: "rate_limited", allowedOrigins };
  }

  // Idempotency ledger — same mechanism as the WhatsApp Web webhook
  // (webhook_events, unique(provider, event_id), 23505 = already processed).
  // No client-supplied idempotency key exists in the PDF spec, so it's
  // derived deterministically from the payload itself.
  const eventId = createHash("sha256").update(`${app.id}|${whatsapp}|${body.fecha as string}`).digest("hex");
  const { error: webhookEventError } = await supabase
    .from("webhook_events")
    .insert({ provider: "mini_app_lead", event_id: eventId, event_type: "lead", payload: body });
  if (webhookEventError) {
    if (webhookEventError.code === "23505") {
      return { ok: true, duplicate: true, allowedOrigins };
    }
    console.error("[mini-apps] failed to record webhook_events row:", webhookEventError);
  }

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!KNOWN_TOP_LEVEL_FIELDS.has(key)) data[key] = value;
  }

  const { error: insertError } = await supabase.from("mini_app_leads").insert({
    workspace_id: app.workspace_id,
    mini_app_id: app.id,
    origen_app: typeof body.origen_app === "string" && body.origen_app.trim() ? body.origen_app.trim() : app.name,
    agente: typeof body.agente === "string" ? body.agente.trim() || null : null,
    nombre,
    whatsapp,
    consentimiento: true,
    consentimiento_fecha: body.consentimiento_fecha,
    fecha: body.fecha,
    data,
    ip_address: input.ip,
    user_agent: input.userAgent,
  });
  if (insertError && insertError.code !== "23505") {
    console.error("[mini-apps] failed to insert lead:", insertError);
    return { ok: false, status: 500, error: "insert_failed", allowedOrigins };
  }

  if (!webhookEventError) {
    await supabase
      .from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "mini_app_lead")
      .eq("event_id", eventId);
  }

  return { ok: true, duplicate: insertError?.code === "23505", allowedOrigins };
}
