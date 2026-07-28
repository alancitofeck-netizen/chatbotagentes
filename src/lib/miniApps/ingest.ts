import "server-only";
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyApiKey } from "@/lib/miniApps/apiKey";
import { simulateRetirement, DEFAULT_ANNUAL_RETURN_RATE_PCT } from "@/lib/miniApps/financialEngine";

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
  template_key: string;
  config: Record<string, unknown>;
}

/** Resolves the mini app by slug — always via createServiceRoleClient()
 * (anonymous public request, no session/RLS context). Workspace is always
 * taken from THIS row, never from anything the caller sends (same
 * principle as the YCloud webhook's resolveWorkspaceIdForYCloudAccount). */
async function resolveMiniAppBySlug(slug: string): Promise<{ ok: true; app: MiniAppRow } | { ok: false; status: number; error: string }> {
  const supabase = createServiceRoleClient();
  const { data: app } = await supabase
    .from("mini_apps")
    .select("id, workspace_id, api_key_hash, allowed_origins, status, name, template_key, config")
    .eq("slug", slug)
    .maybeSingle();

  if (!app) return { ok: false, status: 404, error: "not_found" };
  if (app.status !== "active") return { ok: false, status: 404, error: "not_found" };
  return { ok: true, app: app as unknown as MiniAppRow };
}

/** Adds the API-key check on top of resolveMiniAppBySlug — used only by the
 * public Route Handler (external mini apps). The Growth-Link-hosted page's
 * own submission path (submitMiniAppLeadFromHostedPage, miniApps/actions.ts)
 * uses resolveMiniAppBySlug directly instead: it's our own same-origin
 * form, not a third party, so requiring/exposing the API key there would
 * mean shipping a secret into the public page's client bundle for no real
 * benefit — Next.js's own Server Action origin checks are the boundary
 * for that path. */
async function resolveAuthorizedMiniApp(
  slug: string,
  apiKey: string | null,
): Promise<{ ok: true; app: MiniAppRow } | { ok: false; status: number; error: string }> {
  const resolved = await resolveMiniAppBySlug(slug);
  if (!resolved.ok) return resolved;
  if (!apiKey || !verifyApiKey(apiKey, resolved.app.api_key_hash)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return resolved;
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

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

interface ProcessLeadOptions {
  /** True for the Growth-Link-hosted page's own submission path — same-
   * origin by construction, so there's no third-party Origin header to
   * validate against the mini app's CORS allow-list. */
  skipOriginCheck?: boolean;
}

/** Shared core: validation, the simulador_retiro authoritative recompute,
 * rate limiting, idempotency, and the actual insert — used by both entry
 * points (public API-key route + the hosted page's Server Action) so
 * neither ever re-implements or drifts from the other. */
async function processLeadSubmission(
  app: MiniAppRow,
  payload: unknown,
  origin: string | null,
  ip: string | null,
  userAgent: string | null,
  options: ProcessLeadOptions,
): Promise<IngestResult> {
  const allowedOrigins = app.allowed_origins ?? [];

  if (!options.skipOriginCheck && !isOriginAllowed(origin, allowedOrigins)) {
    return { ok: false, status: 403, error: "origin_not_allowed", allowedOrigins };
  }

  if (typeof payload !== "object" || payload === null) {
    return { ok: false, status: 400, error: "invalid_json", allowedOrigins };
  }
  const body = payload as Record<string, unknown>;

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
  if (!nombre) return { ok: false, status: 400, error: "missing_nombre", allowedOrigins };
  if (!whatsapp) return { ok: false, status: 400, error: "missing_whatsapp", allowedOrigins };
  if (body.consentimiento !== true) return { ok: false, status: 400, error: "missing_consent", allowedOrigins };
  if (!isValidDateString(body.consentimiento_fecha)) {
    return { ok: false, status: 400, error: "invalid_consent_date", allowedOrigins };
  }
  if (!isValidDateString(body.fecha)) return { ok: false, status: 400, error: "invalid_fecha", allowedOrigins };

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!KNOWN_TOP_LEVEL_FIELDS.has(key)) data[key] = value;
  }

  // Authoritative recompute — never trust whatever fondo_estimado/etc. the
  // caller sent (a visitor could edit the DOM/replay a crafted request).
  // Applies regardless of entry point, so an externally-hosted simulador
  // using the same template also gets our one canonical calculation.
  if (app.template_key === "simulador_retiro") {
    const edad = toFiniteNumber(body.edad);
    const edadRetiro = toFiniteNumber(body.edad_retiro);
    const ahorroMensual = toFiniteNumber(body.ahorro_mensual);
    if (edad === null || edadRetiro === null || ahorroMensual === null) {
      return { ok: false, status: 400, error: "invalid_simulation_inputs", allowedOrigins };
    }
    const ingresoActual = toFiniteNumber(body.ingreso_actual);
    const annualReturnRatePct =
      typeof app.config?.annualReturnRatePct === "number" ? app.config.annualReturnRatePct : DEFAULT_ANNUAL_RETURN_RATE_PCT;
    const result = simulateRetirement({ edad, edadRetiro, ahorroMensual, annualReturnRatePct });

    data.edad = edad;
    data.edad_retiro = edadRetiro;
    data.ahorro_mensual = ahorroMensual;
    if (ingresoActual !== null) data.ingreso_actual = ingresoActual;
    data.fondo_estimado = result.fondoEstimado;
    data.fondo_rango_bajo = result.fondoRangoBajo;
    data.fondo_rango_alto = result.fondoRangoAlto;
    data.renta_mensual_estimada = result.rentaMensualEstimada;
  }

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
    ip_address: ip,
    user_agent: userAgent,
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

/** Public Route Handler entry point (external mini apps) — requires the
 * X-Api-Key + CORS origin check. */
export async function ingestMiniAppLead(input: IngestInput): Promise<IngestResult> {
  const resolved = await resolveAuthorizedMiniApp(input.slug, input.apiKey);
  if (!resolved.ok) return { ...resolved, allowedOrigins: [] };
  return processLeadSubmission(resolved.app, input.payload, input.origin, input.ip, input.userAgent, {});
}

/** Growth-Link-hosted page entry point (src/app/apps/[slug]/) — no API key,
 * no CORS check (same-origin Server Action), used exclusively by
 * submitMiniAppLeadFromHostedPage (src/lib/miniApps/actions.ts). */
export async function ingestMiniAppLeadFromHostedPage(
  slug: string,
  payload: unknown,
  ip: string | null,
  userAgent: string | null,
): Promise<IngestResult> {
  const resolved = await resolveMiniAppBySlug(slug);
  if (!resolved.ok) return { ...resolved, allowedOrigins: [] };
  return processLeadSubmission(resolved.app, payload, null, ip, userAgent, { skipOriginCheck: true });
}
