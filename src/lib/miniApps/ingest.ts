import "server-only";
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyApiKey } from "@/lib/miniApps/apiKey";
import { simulateRetirement, recommendedMonthlyIncome, DEFAULT_ANNUAL_RETURN_RATE_PCT } from "@/lib/miniApps/financialEngine";
import {
  getPreparationLevel,
  getStrengthsAndOpportunities,
  getExecutiveSummary,
  getDiagnosisSummary,
  getPersonalizedRecommendation,
  type QualificationAnswers,
} from "@/lib/miniApps/resultDiagnostics";
import {
  PREOCUPACION_OPTIONS,
  HABLO_ASESOR_OPTIONS,
  OBJETIVO_OPTIONS,
  CUANDO_OPTIONS,
  labelFor,
  type QualificationOption,
} from "@/lib/miniApps/qualificationOptions";

const KNOWN_TOP_LEVEL_FIELDS = new Set([
  "fecha",
  "origen_app",
  "agente",
  "nombre",
  "whatsapp",
  "consentimiento",
  "consentimiento_fecha",
  "duration_seconds",
]);

/** Single unified contact record per the "Contactos de Apps" design — a
 * mini-app lead is a real CRM contact from the moment it's submitted, not
 * just after someone manually clicks "convertir a contacto"
 * (convertMiniAppLeadToContact, miniApps/actions.ts, still exists for the
 * cases where a lead somehow arrived without one — e.g. rows created before
 * this existed). `ignoreDuplicates: true` means an EXISTING contact's
 * name/source is never overwritten by a repeat mini-app submission — the
 * contact who was here first (whatever channel they came from) wins. */
export const MINI_APP_CONTACT_SOURCE = "mini_app";

const RATE_LIMIT_PER_MINUTE = 20;

export type IngestResult =
  | { ok: true; duplicate?: boolean; allowedOrigins: string[]; leadId?: string }
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

  const { data: insertedLead, error: insertError } = await supabase
    .from("mini_app_leads")
    .insert({
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
      duration_seconds: toFiniteNumber(body.duration_seconds),
      ip_address: ip,
      user_agent: userAgent,
    })
    .select("id")
    .single();
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

  if (insertedLead) {
    await linkLeadToContact(supabase, app.workspace_id, nombre, whatsapp, insertedLead.id as string);
  }

  return { ok: true, duplicate: insertError?.code === "23505", allowedOrigins, leadId: insertedLead?.id as string | undefined };
}

/** Best-effort — a failure here must never fail the lead submission itself
 * (the lead is already durably recorded by this point), same posture as the
 * webhook_events write above it. Upsert-by-phone reuses the exact shape
 * already proven in convertMiniAppLeadToContact/createOpportunity's own
 * contact upsert, just fired automatically instead of waiting for a manual
 * click. */
async function linkLeadToContact(
  supabase: ReturnType<typeof createServiceRoleClient>,
  workspaceId: string,
  nombre: string,
  whatsapp: string,
  leadId: string,
): Promise<void> {
  try {
    const { data: upserted } = await supabase
      .from("contacts")
      .upsert(
        { workspace_id: workspaceId, name: nombre, phone: whatsapp, source: MINI_APP_CONTACT_SOURCE },
        { onConflict: "workspace_id,phone", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();

    let contactId = upserted?.id as string | undefined;
    if (!contactId) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("phone", whatsapp)
        .maybeSingle();
      contactId = existing?.id as string | undefined;
    }
    if (contactId) {
      await supabase.from("mini_app_leads").update({ contact_id: contactId }).eq("id", leadId);
    }
  } catch (err) {
    console.error("[mini-apps] failed to link lead to contact:", err);
  }
}

export interface QualificationAnswerInput {
  preocupacion?: string | null;
  habloAsesor?: string | null;
  objetivo?: string | null;
  cuandoEmpezar?: string | null;
}

interface CodeLabel {
  code: string;
  label: string;
}

type StoredQualification = Record<"preocupacion" | "habloAsesor" | "objetivo" | "cuandoEmpezar", CodeLabel | null>;

function toCodeLabel(options: QualificationOption[], code: string | null | undefined): CodeLabel | null {
  if (!code) return null;
  const label = labelFor(options, code);
  return label ? { code, label } : null;
}

/** Re-derives the full diagnosis (preparation level, strengths/
 * opportunities, executive summary, recommendation, diagnosis summary) from
 * the lead's already-authoritative financial fields (written by
 * processLeadSubmission's own recompute, never trusted from the client) +
 * the qualification answers just saved — never trusts anything the client
 * might have computed for these texts either, same "server recomputes"
 * posture as the financial numbers themselves. Degrades gracefully with
 * partial/missing qualification answers (the compositional clause
 * functions in resultDiagnostics.ts simply omit what isn't known yet). */
function recomputeDiagnosis(existing: Record<string, unknown>, qualification: StoredQualification) {
  const edad = toFiniteNumber(existing.edad) ?? 0;
  const edadRetiro = toFiniteNumber(existing.edad_retiro) ?? edad;
  const ahorroMensual = toFiniteNumber(existing.ahorro_mensual) ?? 0;
  const ingresoActual = toFiniteNumber(existing.ingreso_actual);
  const fondoEstimado = toFiniteNumber(existing.fondo_estimado) ?? 0;
  const rentaMensualEstimada = toFiniteNumber(existing.renta_mensual_estimada) ?? 0;
  const annualReturnRatePct =
    typeof (existing as { annual_return_rate_pct?: unknown }).annual_return_rate_pct === "number"
      ? (existing as { annual_return_rate_pct: number }).annual_return_rate_pct
      : DEFAULT_ANNUAL_RETURN_RATE_PCT;

  const aniosParaRetiro = Math.max(edadRetiro - edad, 0);
  const ingresoRecomendado = ingresoActual !== null && ingresoActual > 0 ? recommendedMonthlyIncome(ingresoActual) : null;
  const replacementPct =
    ingresoRecomendado !== null && ingresoRecomendado > 0 ? Math.min(200, Math.round((rentaMensualEstimada / ingresoRecomendado) * 100)) : null;

  const retiroTardio = simulateRetirement({ edad, edadRetiro: edadRetiro + 1, ahorroMensual, annualReturnRatePct });
  const mejoraRetrasandoRetiroPct = fondoEstimado > 0 ? Math.round(((retiroTardio.fondoEstimado - fondoEstimado) / fondoEstimado) * 100) : 0;

  const qualificationAnswers: QualificationAnswers = {
    preocupacion: qualification.preocupacion?.code ?? null,
    habloAsesor: qualification.habloAsesor?.code ?? null,
    objetivo: qualification.objetivo?.code ?? null,
    cuandoEmpezar: qualification.cuandoEmpezar?.code ?? null,
  };

  const preparation = getPreparationLevel({ aniosParaRetiro, ahorroMensual, replacementPct });
  const { strengths, opportunities } = getStrengthsAndOpportunities({
    aniosParaRetiro,
    ahorroMensual,
    replacementPct,
    mejoraRetrasandoRetiroPct,
    qualification: qualificationAnswers,
  });
  const executiveSummary = getExecutiveSummary(preparation.level, qualificationAnswers);
  const diagnosisSummary = getDiagnosisSummary(preparation.level, qualificationAnswers);
  const recommendation = getPersonalizedRecommendation({
    edad,
    aniosParaRetiro,
    ahorroMensual,
    stars: preparation.stars,
    preocupacion: qualificationAnswers.preocupacion,
  });

  return {
    preparationLevel: preparation.level,
    stars: preparation.stars,
    preparationLabel: preparation.label,
    preparationReason: preparation.reason,
    executiveSummary,
    strengths,
    opportunities,
    recommendation,
    diagnosisSummary,
    computedAt: new Date().toISOString(),
  };
}

/** Appends the "calificación de lead" question answers (asked during the
 * results reveal, i.e. AFTER the lead already exists) into the same lead's
 * `data` jsonb, resolving each code to its human-readable label ("guardar
 * exactamente lo que seleccionó la persona", not just the internal code),
 * and recomputes the full diagnosis (server-authoritative, same "never
 * trust the client's own computed text" posture as the financial numbers)
 * so the CRM always has a durable, up-to-date snapshot. Best-effort, same
 * posture as linkLeadToContact: a failure here must never surface to the
 * visitor, the lead itself is already durably saved by this point.
 * Read-then-write merge (not a raw `data || jsonb` update) is fine here:
 * single-visitor, single-write flow, no meaningful concurrent-write risk. */
export async function appendMiniAppLeadQualification(leadId: string, answers: QualificationAnswerInput): Promise<void> {
  const supabase = createServiceRoleClient();
  try {
    const { data: row } = await supabase.from("mini_app_leads").select("data").eq("id", leadId).maybeSingle();
    const existing = (row?.data as Record<string, unknown> | null) ?? {};
    const existingQualification = (existing.qualification as Partial<StoredQualification> | undefined) ?? {};

    const qualification: StoredQualification = {
      preocupacion:
        answers.preocupacion !== undefined ? toCodeLabel(PREOCUPACION_OPTIONS, answers.preocupacion) : (existingQualification.preocupacion ?? null),
      habloAsesor:
        answers.habloAsesor !== undefined ? toCodeLabel(HABLO_ASESOR_OPTIONS, answers.habloAsesor) : (existingQualification.habloAsesor ?? null),
      objetivo: answers.objetivo !== undefined ? toCodeLabel(OBJETIVO_OPTIONS, answers.objetivo) : (existingQualification.objetivo ?? null),
      cuandoEmpezar:
        answers.cuandoEmpezar !== undefined ? toCodeLabel(CUANDO_OPTIONS, answers.cuandoEmpezar) : (existingQualification.cuandoEmpezar ?? null),
    };

    const diagnosis = recomputeDiagnosis(existing, qualification);

    await supabase
      .from("mini_app_leads")
      .update({ data: { ...existing, qualification, diagnosis } })
      .eq("id", leadId);
  } catch (err) {
    console.error("[mini-apps] failed to append lead qualification:", err);
  }
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
