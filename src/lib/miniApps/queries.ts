import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { DEFAULT_ANNUAL_RETURN_RATE_PCT } from "@/lib/miniApps/financialEngine";
import { DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR } from "@/lib/miniApps/paletteEngine";
import { templateKeysForCategory, type MiniAppTemplateCategory } from "@/lib/miniApps/templateCatalog";
import { DEFAULT_LINKED_APP_ICON, type LinkedAppType } from "@/lib/miniApps/linkedAppOptions";
import {
  DEFAULT_DIAGNOSTICO_AGENTE,
  DEFAULT_DIAGNOSTICO_QUESTIONS,
  DEFAULT_DIAGNOSTICO_LEVELS,
  type DiagnosticoAgente,
  type DiagnosticoQuestion,
  type DiagnosticoLevel,
} from "@/lib/miniApps/diagnosticoDefaults";
import {
  DEFAULT_DIAGNOSTICO_RETIRO_ASESOR,
  DEFAULT_DIAGNOSTICO_RETIRO_REFERIDO,
  DEFAULT_DIAGNOSTICO_RETIRO_PRODUCTO,
  DEFAULT_DIAGNOSTICO_RETIRO_TEXTOS,
  DEFAULT_DIAGNOSTICO_RETIRO_AREA_LABELS,
  DEFAULT_DIAGNOSTICO_RETIRO_QUESTIONS,
  DEFAULT_DIAGNOSTICO_RETIRO_UMBRAL_1,
  DEFAULT_DIAGNOSTICO_RETIRO_UMBRAL_2,
  DEFAULT_DIAGNOSTICO_RETIRO_PERFILES,
  DEFAULT_DIAGNOSTICO_RETIRO_RECO_POOL,
  DEFAULT_DIAGNOSTICO_RETIRO_THEME_POOL,
  type DiagnosticoRetiroArea,
  type DiagnosticoRetiroAsesor,
  type DiagnosticoRetiroReferido,
  type DiagnosticoRetiroProducto,
  type DiagnosticoRetiroTextos,
  type DiagnosticoRetiroQuestion,
  type DiagnosticoRetiroPerfil,
  type DiagnosticoRetiroRecoPool,
  type DiagnosticoRetiroThemePool,
} from "@/lib/miniApps/diagnosticoRetiroDefaults";

export type MiniAppTemplateKey =
  | "simulador_retiro"
  | "calculadora_brecha_retiro"
  | "app_vinculada"
  | "diagnostico_financiero"
  | "diagnostico_financiero_retiro";
export type MiniAppStatus = "active" | "inactive";
export type MiniAppLeadStatus = "new" | "contacted" | "converted" | "discarded";

export interface MiniAppListItem {
  id: string;
  name: string;
  description: string | null;
  templateKey: MiniAppTemplateKey;
  slug: string;
  status: MiniAppStatus;
  assignedAgentName: string | null;
  leadsCount: number;
  lastLeadAt: string | null;
  createdAt: string;
}

/** Config for the "Calculadora de Brecha de Retiro" template — the
 * advisor's WhatsApp for the deep-link CTA, an external privacy-notice URL,
 * and an optional professional license/credential badge (mirrors the
 * Simulador's own default-to-template-label badge behavior when unset). */
export interface CalculadoraBrechaConfig {
  whatsappAsesor: string;
  avisoPrivacidadUrl: string;
  licenseBadge: string;
  assignedAgentName?: string;
}

/** Config for "App Vinculada" (botón "Vincular App") — `linkedAppType`/
 * `icon` are purely descriptive (drive the badge/icon shown on the card and
 * public landing page), never used to pick a rendering component: every
 * app_vinculada mini app renders the exact same LinkedAppLanding regardless
 * of type. `hostingMode` picks between the two ways this template's
 * external_url-less landing page can work: `"url"` (Fase 1 — links out to
 * an externally-hosted app) or `"upload"` (Fase 2 — GrowthLink hosts the
 * uploaded HTML/ZIP itself, rendered via a sandboxed iframe; `indexPath`/
 * `bundleVersion` only apply to that mode — see bundle-upload/route.ts). */
export interface LinkedAppConfig {
  linkedAppType: LinkedAppType;
  icon: string;
  hostingMode: "url" | "upload";
  indexPath?: string;
  bundleVersion?: number;
  assignedAgentName?: string;
}

/** Config para "Diagnóstico Interactivo Financiero" — ver
 * diagnosticoDefaults.ts para el shape de cada pieza y el dataset por
 * defecto. `agente` cubre exactamente los campos que el HTML original
 * necesitaba hardcodeados en `const AGENTE`; `questions`/`levels` son el
 * motor del quiz, editables desde el wizard. */
export interface DiagnosticoFinancieroConfig {
  agente: DiagnosticoAgente;
  questions: DiagnosticoQuestion[];
  levels: DiagnosticoLevel[];
  assignedAgentName?: string;
}

/** Config para "Diagnóstico Financiero - Retiro" — ver
 * diagnosticoRetiroDefaults.ts para el shape de cada pieza y el dataset por
 * defecto. A diferencia de DiagnosticoFinancieroConfig: `questions` tiene
 * opciones que puntúan en varias áreas a la vez (no un `w` escalar), y el
 * perfil de resultado se resuelve con `umbral1`/`umbral2` + `perfiles`
 * (3, siempre) en vez de un array de rangos tipo `levels`. `areaLabels`
 * cubre las 4 áreas fijas (retiro/ahorro/fiscal/proteccion — ver
 * DIAGNOSTICO_RETIRO_AREAS); lo único editable de cada área es su etiqueta
 * visible, nunca su clave. */
export interface DiagnosticoRetiroConfig {
  asesor: DiagnosticoRetiroAsesor;
  referido: DiagnosticoRetiroReferido;
  producto: DiagnosticoRetiroProducto;
  textos: DiagnosticoRetiroTextos;
  areaLabels: Record<DiagnosticoRetiroArea, string>;
  questions: DiagnosticoRetiroQuestion[];
  umbral1: number;
  umbral2: number;
  perfiles: DiagnosticoRetiroPerfil[];
  recoPool: DiagnosticoRetiroRecoPool;
  themePool: DiagnosticoRetiroThemePool;
  assignedAgentName?: string;
}

export interface MiniAppConfigByTemplate {
  simulador_retiro: MiniAppFieldConfig;
  calculadora_brecha_retiro: CalculadoraBrechaConfig;
  app_vinculada: LinkedAppConfig;
  diagnostico_financiero: DiagnosticoFinancieroConfig;
  diagnostico_financiero_retiro: DiagnosticoRetiroConfig;
}

/** True discriminated union on `templateKey` (not two independent optional
 * `config` shapes) so `if (app.templateKey === "simulador_retiro")` narrows
 * `app.config` automatically wherever this type is consumed (page.tsx,
 * ConfiguracionTab.tsx, NewMiniAppWizard.tsx). */
export type MiniAppDetail<K extends MiniAppTemplateKey = MiniAppTemplateKey> = {
  [T in K]: {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    templateKey: T;
    slug: string;
    externalUrl: string | null;
    assignedAgentId: string | null;
    assignedAgentName: string | null;
    allowedOrigins: string[];
    apiKeyLast4: string;
    status: MiniAppStatus;
    branding: MiniAppBranding;
    config: MiniAppConfigByTemplate[T];
    createdAt: string;
  };
}[K];

export interface MiniAppLeadRow {
  id: string;
  origenApp: string;
  agente: string | null;
  nombre: string;
  whatsapp: string;
  fecha: string;
  status: MiniAppLeadStatus;
  contactId: string | null;
  opportunityId: string | null;
}

export interface MiniAppLeadDetail extends MiniAppLeadRow {
  miniAppId: string;
  consentimiento: boolean;
  consentimientoFecha: string;
  receivedAt: string;
  data: Record<string, unknown>;
}

/** workspace_member_names (0003_inbox.sql) resolves member -> display name;
 * reused here the same way settings/queries.ts's getWorkspaceMembersList does. */
async function getMemberNamesById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  return new Map(
    ((data ?? []) as { member_id: string; full_name: string }[]).map((r) => [r.member_id, r.full_name]),
  );
}

export async function getMiniAppsList(workspaceId: string): Promise<MiniAppListItem[]> {
  const supabase = await createClient();
  const [{ data: apps }, memberNames] = await Promise.all([
    supabase
      .from("mini_apps")
      .select("id, name, description, template_key, slug, status, assigned_agent_id, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    getMemberNamesById(supabase, workspaceId),
  ]);
  if (!apps || apps.length === 0) return [];

  const { data: leadStats } = await supabase
    .from("mini_app_leads")
    .select("mini_app_id, received_at")
    .eq("workspace_id", workspaceId);

  const statsByApp = new Map<string, { count: number; lastLeadAt: string | null }>();
  for (const row of leadStats ?? []) {
    const key = row.mini_app_id as string;
    const current = statsByApp.get(key) ?? { count: 0, lastLeadAt: null };
    current.count += 1;
    const receivedAt = row.received_at as string;
    if (!current.lastLeadAt || receivedAt > current.lastLeadAt) current.lastLeadAt = receivedAt;
    statsByApp.set(key, current);
  }

  return apps.map((a) => ({
    id: a.id as string,
    name: a.name as string,
    description: a.description as string | null,
    templateKey: a.template_key as MiniAppTemplateKey,
    slug: a.slug as string,
    status: a.status as MiniAppStatus,
    assignedAgentName: a.assigned_agent_id ? (memberNames.get(a.assigned_agent_id as string) ?? null) : null,
    leadsCount: statsByApp.get(a.id as string)?.count ?? 0,
    lastLeadAt: statsByApp.get(a.id as string)?.lastLeadAt ?? null,
    createdAt: a.created_at as string,
  }));
}

/** Per-template default-filling for `config` — dispatches by `templateKey`
 * so getMiniAppDetail/getPublicMiniAppBySlug don't each hand-duplicate this
 * per-field-default block per template (2 call sites today, would become 4
 * without this). */
function normalizeConfigForTemplate<T extends MiniAppTemplateKey>(
  templateKey: T,
  raw: Record<string, unknown>,
): MiniAppConfigByTemplate[T] {
  if (templateKey === "calculadora_brecha_retiro") {
    const config: CalculadoraBrechaConfig = {
      whatsappAsesor: typeof raw.whatsappAsesor === "string" ? raw.whatsappAsesor : "",
      avisoPrivacidadUrl: typeof raw.avisoPrivacidadUrl === "string" ? raw.avisoPrivacidadUrl : "",
      licenseBadge: typeof raw.licenseBadge === "string" ? raw.licenseBadge : "",
      assignedAgentName: typeof raw.assignedAgentName === "string" ? raw.assignedAgentName : undefined,
    };
    return config as MiniAppConfigByTemplate[T];
  }
  if (templateKey === "app_vinculada") {
    const config: LinkedAppConfig = {
      linkedAppType: typeof raw.linkedAppType === "string" ? (raw.linkedAppType as LinkedAppType) : "otro",
      icon: typeof raw.icon === "string" ? raw.icon : DEFAULT_LINKED_APP_ICON,
      hostingMode: raw.hostingMode === "upload" ? "upload" : "url",
      indexPath: typeof raw.indexPath === "string" ? raw.indexPath : undefined,
      bundleVersion: typeof raw.bundleVersion === "number" ? raw.bundleVersion : undefined,
      assignedAgentName: typeof raw.assignedAgentName === "string" ? raw.assignedAgentName : undefined,
    };
    return config as MiniAppConfigByTemplate[T];
  }
  if (templateKey === "diagnostico_financiero") {
    const config: DiagnosticoFinancieroConfig = {
      agente: { ...DEFAULT_DIAGNOSTICO_AGENTE, ...((raw.agente as Partial<DiagnosticoAgente>) ?? {}) },
      questions: Array.isArray(raw.questions) && raw.questions.length > 0 ? (raw.questions as DiagnosticoQuestion[]) : DEFAULT_DIAGNOSTICO_QUESTIONS,
      levels: Array.isArray(raw.levels) && raw.levels.length > 0 ? (raw.levels as DiagnosticoLevel[]) : DEFAULT_DIAGNOSTICO_LEVELS,
      assignedAgentName: typeof raw.assignedAgentName === "string" ? raw.assignedAgentName : undefined,
    };
    return config as MiniAppConfigByTemplate[T];
  }
  if (templateKey === "diagnostico_financiero_retiro") {
    const config: DiagnosticoRetiroConfig = {
      asesor: { ...DEFAULT_DIAGNOSTICO_RETIRO_ASESOR, ...((raw.asesor as Partial<DiagnosticoRetiroAsesor>) ?? {}) },
      referido: { ...DEFAULT_DIAGNOSTICO_RETIRO_REFERIDO, ...((raw.referido as Partial<DiagnosticoRetiroReferido>) ?? {}) },
      producto: { ...DEFAULT_DIAGNOSTICO_RETIRO_PRODUCTO, ...((raw.producto as Partial<DiagnosticoRetiroProducto>) ?? {}) },
      textos: { ...DEFAULT_DIAGNOSTICO_RETIRO_TEXTOS, ...((raw.textos as Partial<DiagnosticoRetiroTextos>) ?? {}) },
      areaLabels: { ...DEFAULT_DIAGNOSTICO_RETIRO_AREA_LABELS, ...((raw.areaLabels as Partial<Record<DiagnosticoRetiroArea, string>>) ?? {}) },
      questions:
        Array.isArray(raw.questions) && raw.questions.length > 0
          ? (raw.questions as DiagnosticoRetiroQuestion[])
          : DEFAULT_DIAGNOSTICO_RETIRO_QUESTIONS,
      umbral1: typeof raw.umbral1 === "number" ? raw.umbral1 : DEFAULT_DIAGNOSTICO_RETIRO_UMBRAL_1,
      umbral2: typeof raw.umbral2 === "number" ? raw.umbral2 : DEFAULT_DIAGNOSTICO_RETIRO_UMBRAL_2,
      perfiles: Array.isArray(raw.perfiles) && raw.perfiles.length === 3 ? (raw.perfiles as DiagnosticoRetiroPerfil[]) : DEFAULT_DIAGNOSTICO_RETIRO_PERFILES,
      recoPool: { ...DEFAULT_DIAGNOSTICO_RETIRO_RECO_POOL, ...((raw.recoPool as Partial<DiagnosticoRetiroRecoPool>) ?? {}) },
      themePool: { ...DEFAULT_DIAGNOSTICO_RETIRO_THEME_POOL, ...((raw.themePool as Partial<DiagnosticoRetiroThemePool>) ?? {}) },
      assignedAgentName: typeof raw.assignedAgentName === "string" ? raw.assignedAgentName : undefined,
    };
    return config as MiniAppConfigByTemplate[T];
  }
  const config: MiniAppFieldConfig = {
    annualReturnRatePct: typeof raw.annualReturnRatePct === "number" ? raw.annualReturnRatePct : DEFAULT_ANNUAL_RETURN_RATE_PCT,
    showIngresoActual: typeof raw.showIngresoActual === "boolean" ? raw.showIngresoActual : true,
    fieldLabels: (raw.fieldLabels as MiniAppFieldConfig["fieldLabels"]) ?? {},
    assignedAgentName: typeof raw.assignedAgentName === "string" ? raw.assignedAgentName : undefined,
  };
  return config as MiniAppConfigByTemplate[T];
}

export async function getMiniAppDetail(workspaceId: string, miniAppId: string): Promise<MiniAppDetail | null> {
  const supabase = await createClient();
  const [{ data: app }, memberNames] = await Promise.all([
    supabase
      .from("mini_apps")
      .select(
        "id, workspace_id, name, description, template_key, slug, external_url, assigned_agent_id, allowed_origins, api_key_last4, status, branding, config, created_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("id", miniAppId)
      .maybeSingle(),
    getMemberNamesById(supabase, workspaceId),
  ]);
  if (!app) return null;

  const branding = (app.branding as Partial<MiniAppBranding>) ?? {};
  const templateKey = app.template_key as MiniAppTemplateKey;

  return {
    id: app.id as string,
    workspaceId: app.workspace_id as string,
    name: app.name as string,
    description: app.description as string | null,
    templateKey,
    slug: app.slug as string,
    externalUrl: app.external_url as string | null,
    assignedAgentId: app.assigned_agent_id as string | null,
    assignedAgentName: app.assigned_agent_id ? (memberNames.get(app.assigned_agent_id as string) ?? null) : null,
    allowedOrigins: (app.allowed_origins as string[]) ?? [],
    apiKeyLast4: app.api_key_last4 as string,
    status: app.status as MiniAppStatus,
    branding: {
      logoUrl: branding.logoUrl ?? null,
      primaryColor: branding.primaryColor ?? DEFAULT_PRIMARY_COLOR,
      secondaryColor: branding.secondaryColor ?? DEFAULT_SECONDARY_COLOR,
    },
    config: normalizeConfigForTemplate(templateKey, (app.config as Record<string, unknown>) ?? {}),
    createdAt: app.created_at as string,
  } as MiniAppDetail;
}

export interface MiniAppLeadFilters {
  status?: MiniAppLeadStatus;
  agente?: string;
  from?: string;
  to?: string;
}

export async function getMiniAppLeads(
  workspaceId: string,
  miniAppId: string,
  filters?: MiniAppLeadFilters,
): Promise<MiniAppLeadRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("mini_app_leads")
    .select("id, origen_app, agente, nombre, whatsapp, fecha, status, contact_id, opportunity_id")
    .eq("workspace_id", workspaceId)
    .eq("mini_app_id", miniAppId)
    .order("received_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.agente) query = query.eq("agente", filters.agente);
  if (filters?.from) query = query.gte("fecha", filters.from);
  if (filters?.to) query = query.lte("fecha", filters.to);

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    origenApp: r.origen_app as string,
    agente: r.agente as string | null,
    nombre: r.nombre as string,
    whatsapp: r.whatsapp as string,
    fecha: r.fecha as string,
    status: r.status as MiniAppLeadStatus,
    contactId: r.contact_id as string | null,
    opportunityId: r.opportunity_id as string | null,
  }));
}

export async function getMiniAppLeadDetail(workspaceId: string, leadId: string): Promise<MiniAppLeadDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mini_app_leads")
    .select(
      "id, mini_app_id, origen_app, agente, nombre, whatsapp, fecha, consentimiento, consentimiento_fecha, received_at, data, status, contact_id, opportunity_id",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", leadId)
    .maybeSingle();
  if (!data) return null;

  return {
    id: data.id as string,
    miniAppId: data.mini_app_id as string,
    origenApp: data.origen_app as string,
    agente: data.agente as string | null,
    nombre: data.nombre as string,
    whatsapp: data.whatsapp as string,
    fecha: data.fecha as string,
    consentimiento: data.consentimiento as boolean,
    consentimientoFecha: data.consentimiento_fecha as string,
    receivedAt: data.received_at as string,
    data: (data.data as Record<string, unknown>) ?? {},
    status: data.status as MiniAppLeadStatus,
    contactId: data.contact_id as string | null,
    opportunityId: data.opportunity_id as string | null,
  };
}

/** Leads-by-day for the Analíticas tab, bucketed by `fecha`'s calendar day
 * (UTC — same simplicity CRM Analytics' own day-bucketing uses). */
export async function getMiniAppLeadsByDay(
  workspaceId: string,
  miniAppId: string,
  rangeStartISO: string,
  rangeEndISO: string,
): Promise<{ date: string; count: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mini_app_leads")
    .select("fecha")
    .eq("workspace_id", workspaceId)
    .eq("mini_app_id", miniAppId)
    .gte("fecha", rangeStartISO)
    .lte("fecha", rangeEndISO);

  const countsByDay = new Map<string, number>();
  for (const row of data ?? []) {
    const day = (row.fecha as string).slice(0, 10);
    countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
  }
  return [...countsByDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getMiniAppVisitsCount(workspaceId: string, miniAppId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("mini_app_visits")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("mini_app_id", miniAppId);
  return count ?? 0;
}

export interface MiniAppBranding {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

export interface MiniAppFieldConfig {
  annualReturnRatePct: number;
  showIngresoActual: boolean;
  fieldLabels: Partial<Record<"edad" | "edadRetiro" | "ahorroMensual" | "ingresoActual", string>>;
  assignedAgentName?: string;
}

/** Same discriminated-union treatment as MiniAppDetail — `config`'s type
 * depends on `templateKey`, so page.tsx's own `if (app.templateKey ===
 * "simulador_retiro")` branch narrows `app.config` automatically. */
export type PublicMiniAppView<K extends MiniAppTemplateKey = MiniAppTemplateKey> = {
  [T in K]: {
    slug: string;
    name: string;
    description: string | null;
    templateKey: T;
    externalUrl: string | null;
    /** Relative proxy URL for the uploaded bundle's index.html (hostingMode
     * "upload" only, else null) — see getPublicMiniAppBySlug's own comment
     * for why this is the bundle-asset proxy route and not a direct
     * Storage URL. */
    bundlePublicUrl: string | null;
    branding: MiniAppBranding;
    config: MiniAppConfigByTemplate[T];
  };
}[K];

/** Public-safe projection for the Growth-Link-hosted page
 * (src/app/apps/[slug]/) — always via createServiceRoleClient() (no
 * session for an anonymous visitor), and the select list is deliberately
 * narrow: never api_key_hash, allowed_origins, assigned_agent_id, or
 * workspace_id. `bundlePublicUrl` (for hostingMode "upload") is a relative
 * URL to the bundle-asset proxy route (src/app/api/public/mini-apps/[slug]/
 * bundle/[...path]/route.ts), keyed by slug — it resolves workspace_id/id
 * server-side on its own, so neither ever needs to reach this view or the
 * client at all. Returns null for a missing slug or an inactive mini app
 * (the page treats both as notFound()). */
export async function getPublicMiniAppBySlug(slug: string): Promise<PublicMiniAppView | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("mini_apps")
    .select("slug, name, description, template_key, external_url, status, branding, config")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || data.status !== "active") return null;

  const branding = (data.branding as Partial<MiniAppBranding>) ?? {};
  const templateKey = data.template_key as MiniAppTemplateKey;
  const config = normalizeConfigForTemplate(templateKey, (data.config as Record<string, unknown>) ?? {});

  let bundlePublicUrl: string | null = null;
  if (templateKey === "app_vinculada") {
    const linkedConfig = config as LinkedAppConfig;
    if (linkedConfig.hostingMode === "upload" && linkedConfig.indexPath) {
      bundlePublicUrl = `/api/public/mini-apps/${slug}/bundle/${linkedConfig.indexPath}?v=${linkedConfig.bundleVersion ?? 0}`;
    }
  }

  return {
    slug: data.slug as string,
    name: data.name as string,
    description: data.description as string | null,
    templateKey,
    externalUrl: data.external_url as string | null,
    bundlePublicUrl,
    branding: {
      logoUrl: branding.logoUrl ?? null,
      primaryColor: branding.primaryColor ?? DEFAULT_PRIMARY_COLOR,
      secondaryColor: branding.secondaryColor ?? DEFAULT_SECONDARY_COLOR,
    },
    config,
  } as PublicMiniAppView;
}

// ---------------------------------------------------------------------------
// Contactos de Apps — app-origin resolution. Lives here (not
// contacts/queries.ts) so the contacts module never needs to know mini_apps'
// schema; mirrors the existing tagId pre-resolve pattern getContactList
// already uses for tags.
// ---------------------------------------------------------------------------

export interface AppContactFilter {
  category?: MiniAppTemplateCategory;
  miniAppId?: string;
}

/** Resolves which contact_ids have >=1 mini_app_leads row matching the given
 * category/app filter. Deliberately NOT `contacts.source = 'mini_app'` — a
 * contact whose first touch was a mini app but who later also messaged in
 * over WhatsApp (or vice-versa) must still show up here, and `source` only
 * ever reflects whichever channel touched the contact FIRST (linkToContact
 * in ingest.ts uses ignoreDuplicates specifically so an existing contact's
 * source is never overwritten) — so filtering by source would silently drop
 * contacts "Contactos de Apps" is supposed to surface. */
export async function getContactIdsForAppOrigin(workspaceId: string, filter: AppContactFilter): Promise<string[]> {
  const supabase = await createClient();

  let miniAppIds: string[] | null = null;
  if (filter.miniAppId) {
    miniAppIds = [filter.miniAppId];
  } else if (filter.category) {
    const keys = templateKeysForCategory(filter.category);
    if (keys.length === 0) return [];
    const { data } = await supabase.from("mini_apps").select("id").eq("workspace_id", workspaceId).in("template_key", keys);
    miniAppIds = (data ?? []).map((r) => r.id as string);
    if (miniAppIds.length === 0) return [];
  }

  let query = supabase.from("mini_app_leads").select("contact_id").eq("workspace_id", workspaceId).not("contact_id", "is", null);
  if (miniAppIds) query = query.in("mini_app_id", miniAppIds);

  const { data } = await query;
  return Array.from(new Set((data ?? []).map((r) => r.contact_id as string)));
}

export interface ContactMiniAppOrigin {
  leadId: string;
  miniAppId: string;
  miniAppName: string;
  miniAppSlug: string;
  templateKey: MiniAppTemplateKey;
  receivedAt: string;
  data: Record<string, unknown>;
  durationSeconds: number | null;
}

/** Powers ContactDetailPanel's "Origen del Lead" tab — every mini-app
 * submission this contact ever made, most recent first, fully generic
 * (reads whichever fields happen to be in each lead's `data` jsonb — no
 * per-template field names hardcoded here). */
export async function getContactMiniAppOrigins(workspaceId: string, contactId: string): Promise<ContactMiniAppOrigin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mini_app_leads")
    .select("id, mini_app_id, received_at, data, duration_seconds, mini_apps(name, slug, template_key)")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .order("received_at", { ascending: false });

  return (data ?? []).map((r) => {
    const app = Array.isArray(r.mini_apps) ? r.mini_apps[0] : r.mini_apps;
    return {
      leadId: r.id as string,
      miniAppId: r.mini_app_id as string,
      miniAppName: (app?.name as string | undefined) ?? "Mini app eliminada",
      miniAppSlug: (app?.slug as string | undefined) ?? "",
      templateKey: (app?.template_key as MiniAppTemplateKey | undefined) ?? "simulador_retiro",
      receivedAt: r.received_at as string,
      data: (r.data as Record<string, unknown>) ?? {},
      durationSeconds: (r.duration_seconds as number | null) ?? null,
    };
  });
}
