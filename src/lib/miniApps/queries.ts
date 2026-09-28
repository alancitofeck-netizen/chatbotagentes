import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { DEFAULT_ANNUAL_RETURN_RATE_PCT } from "@/lib/miniApps/financialEngine";
import { DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR } from "@/lib/miniApps/paletteEngine";
import { templateKeysForCategory, type MiniAppTemplateCategory } from "@/lib/miniApps/templateCatalog";
import { DEFAULT_LINKED_APP_ICON, type LinkedAppType, type LinkedAppIconKey } from "@/lib/miniApps/linkedAppOptions";
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
import {
  DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND,
  DEFAULT_DIAGNOSTICO_SOLIDEZ_THEME,
  type DiagnosticoSolidezBrand,
  type DiagnosticoSolidezTheme,
} from "@/lib/miniApps/diagnosticoSolidezDefaults";
import { DEFAULT_META_UNIVERSITARIA_BRAND, type MetaUniversitariaBrand } from "@/lib/miniApps/metaUniversitariaDefaults";
import { DEFAULT_KIT_EMERGENCIA_BRAND, type KitEmergenciaBrand } from "@/lib/miniApps/kitEmergenciaDefaults";
import { DEFAULT_TEST_EMERGENCIA_BRAND, type TestEmergenciaBrand } from "@/lib/miniApps/testEmergenciaDefaults";
import { DEFAULT_DIAGNOSTICO_SALUD_BRAND, type DiagnosticoSaludBrand } from "@/lib/miniApps/diagnosticoSaludDefaults";
import { DEFAULT_AHORRO_FISCAL_BRAND, type AhorroFiscalBrand } from "@/lib/miniApps/ahorroFiscalDefaults";
import { DEFAULT_CONTROL_FINANCIERO_BRAND, type ControlFinancieroBrand } from "@/lib/miniApps/controlFinancieroDefaults";
import { getResultFieldSpec, averageResultValue, type ResultFieldFormat } from "@/lib/miniApps/resultField";

export type MiniAppTemplateKey =
  | "simulador_retiro"
  | "calculadora_brecha_retiro"
  | "app_vinculada"
  | "diagnostico_financiero"
  | "diagnostico_financiero_retiro"
  | "diagnostico_solidez_financiera"
  | "calculadora_meta_universitaria"
  | "kit_emergencia_financiera_familiar"
  | "test_preparacion_emergencia_financiera"
  | "diagnostico_salud_financiera"
  | "calculadora_ahorro_fiscal"
  | "control_financiero_base_cero"
  | "content_calendar";
export type MiniAppStatus = "active" | "inactive";
export type MiniAppLeadStatus = "new" | "contacted" | "cita_agendada" | "propuesta_enviada" | "converted" | "discarded";

export interface MiniAppListItem {
  id: string;
  name: string;
  description: string | null;
  templateKey: MiniAppTemplateKey;
  slug: string;
  status: MiniAppStatus;
  assignedAgentName: string | null;
  leadsCount: number;
  /** Subconjunto de leadsCount con status "converted" — para calcular una
   * tasa de conversión real en el listado (MiniAppsListShell.tsx), nunca
   * inventada. */
  convertedLeadsCount: number;
  lastLeadAt: string | null;
  createdAt: string;
  /** Solo presente cuando templateKey === "app_vinculada" — el ícono real
   * que el usuario eligió al vincular la app (ver linkedAppOptions.ts),
   * para que el listado no le asigne un ícono genérico a todas las apps
   * vinculadas por igual. */
  linkedAppIcon?: LinkedAppIconKey;
  /** Privacidad por Mini App individual (0180_mini_app_privacy.sql) —
   * default false para las 13 plantillas existentes, sin cambio de
   * comportamiento. Solo controla si se muestra el candado 🔒 en el
   * listado; el filtrado real de qué filas llegan acá lo hace la RLS. */
  isPrivate: boolean;
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
  /** Solo aplica a hostingMode "upload" — se inyecta como
   * `window.GL_CALENDLY_URL` en el bundle alojado (ver calendlyInjection.ts)
   * para que el HTML subido pueda ofrecer un botón real de agendar, sin
   * tener que hardcodear la URL dentro del archivo del usuario. */
  calendlyUrl?: string;
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

/** Config para "Diagnóstico de Solidez Financiera" — ver
 * diagnosticoSolidezDefaults.ts para el shape de `brand` y el valor por
 * defecto. A diferencia de DiagnosticoFinancieroConfig: no expone
 * `questions`/`levels` editables — el archivo original define sus propias
 * `QUESTIONS`/`TIERS`/`DIM_TEXT` fijas (ver diagnosticoSolidezTemplate.ts),
 * lo único configurable por asesor es la identidad de marca y qué paleta de
 * las 5 ya definidas en el HTML (`THEMES`) usar. */
export interface DiagnosticoSolidezConfig {
  brand: DiagnosticoSolidezBrand;
  themeActive: DiagnosticoSolidezTheme;
  assignedAgentName?: string;
}

/** Config para "Calculadora de Meta Universitaria" — ver
 * metaUniversitariaDefaults.ts para el shape de `brand` y el motor de
 * cálculo. Igual que DiagnosticoSolidezConfig: sin `questions`/engine
 * editable — es una calculadora de fórmula fija (costo futuro + brecha +
 * meta mensual), lo único configurable por asesor es la identidad de
 * marca. */
export interface MetaUniversitariaConfig {
  brand: MetaUniversitariaBrand;
  assignedAgentName?: string;
}

/** Config para "Kit de Emergencia Financiera Familiar" — ver
 * kitEmergenciaDefaults.ts para el shape de `brand`. Sin engine/preguntas
 * editables: es un checklist/organizador de formato fijo, lo único
 * configurable por asesor es la identidad de marca. */
export interface KitEmergenciaConfig {
  brand: KitEmergenciaBrand;
  assignedAgentName?: string;
}

/** Config para "Test de Preparación para Emergencias Financieras" — ver
 * testEmergenciaDefaults.ts para el shape de `brand` y el saneamiento del
 * lead. Sin engine/preguntas editables: es un quiz de 10 preguntas de
 * formato fijo, lo único configurable por asesor es la identidad de marca y
 * los dos enlaces complementarios (Kit de Emergencia / Fondo de
 * Emergencia). */
export interface TestEmergenciaConfig {
  brand: TestEmergenciaBrand;
  assignedAgentName?: string;
}

/** Config para "Diagnóstico de Salud Financiera" — ver
 * diagnosticoSaludDefaults.ts para el shape de `brand` y el saneamiento del
 * lead. Sin engine/preguntas editables: es un quiz de 6 pilares de formato
 * fijo, lo único configurable por asesor es la identidad de marca y los 4
 * links complementarios. */
export interface DiagnosticoSaludConfig {
  brand: DiagnosticoSaludBrand;
  assignedAgentName?: string;
}

/** Config para "Calculadora de Ahorro Fiscal" — ver ahorroFiscalDefaults.ts
 * para el shape de `brand` y el motor fiscal (ISR/PPR/EFI/colegiaturas
 * 2026). Sin engine/topes editables: el archivo original separa a propósito
 * TAX_CONFIG de CONFIG (mismo motor para cualquier instancia), lo único
 * configurable por asesor es la identidad de marca y los dos enlaces
 * complementarios (Brecha de Retiro / Diagnóstico de Solidez). */
export interface AhorroFiscalConfig {
  brand: AhorroFiscalBrand;
  assignedAgentName?: string;
}

/** Config para "Top Apps, de ingresos y gastos" (Control Financiero —
 * Presupuesto Base Cero) — ver controlFinancieroDefaults.ts para el shape
 * de `brand` y el porqué de que no exista un tipo de lead/saneamiento para
 * este template: el archivo original no captura ningún dato de contacto,
 * todo el presupuesto y las transacciones viven solo en el localStorage
 * del visitante. */
export interface ControlFinancieroConfig {
  brand: ControlFinancieroBrand;
  assignedAgentName?: string;
}

export interface MiniAppConfigByTemplate {
  simulador_retiro: MiniAppFieldConfig;
  calculadora_brecha_retiro: CalculadoraBrechaConfig;
  app_vinculada: LinkedAppConfig;
  diagnostico_financiero: DiagnosticoFinancieroConfig;
  diagnostico_financiero_retiro: DiagnosticoRetiroConfig;
  diagnostico_solidez_financiera: DiagnosticoSolidezConfig;
  calculadora_meta_universitaria: MetaUniversitariaConfig;
  kit_emergencia_financiera_familiar: KitEmergenciaConfig;
  test_preparacion_emergencia_financiera: TestEmergenciaConfig;
  diagnostico_salud_financiera: DiagnosticoSaludConfig;
  calculadora_ahorro_fiscal: AhorroFiscalConfig;
  control_financiero_base_cero: ControlFinancieroConfig;
  /** "Cronograma de Contenido" no tiene config propio — todo su contenido
   * vive en tablas relacionales (mini_app_content_*, ver contentCalendar.ts),
   * a diferencia de las demás plantillas. */
  content_calendar: Record<string, never>;
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
    isPrivate: boolean;
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
  policyId: string | null;
  /** Mismo bucket jsonb que ya usa MiniAppLeadDetail — se suma acá también
   * para poder mostrar métricas reales (score/perfil) en la tarjeta de la
   * lista sin una segunda consulta por lead (ver responseSummary/). */
  data: Record<string, unknown>;
}

export interface MiniAppLeadDetail extends MiniAppLeadRow {
  miniAppId: string;
  consentimiento: boolean;
  consentimientoFecha: string;
  receivedAt: string;
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
      .select("id, name, description, template_key, slug, status, assigned_agent_id, created_at, config, is_private")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    getMemberNamesById(supabase, workspaceId),
  ]);
  if (!apps || apps.length === 0) return [];

  const { data: leadStats } = await supabase
    .from("mini_app_leads")
    .select("mini_app_id, received_at, status")
    .eq("workspace_id", workspaceId);

  const statsByApp = new Map<string, { count: number; converted: number; lastLeadAt: string | null }>();
  for (const row of leadStats ?? []) {
    const key = row.mini_app_id as string;
    const current = statsByApp.get(key) ?? { count: 0, converted: 0, lastLeadAt: null };
    current.count += 1;
    if (row.status === "converted") current.converted += 1;
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
    convertedLeadsCount: statsByApp.get(a.id as string)?.converted ?? 0,
    lastLeadAt: statsByApp.get(a.id as string)?.lastLeadAt ?? null,
    createdAt: a.created_at as string,
    linkedAppIcon: a.template_key === "app_vinculada" ? ((a.config as { icon?: LinkedAppIconKey } | null)?.icon ?? undefined) : undefined,
    isPrivate: (a.is_private as boolean | null) ?? false,
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
      calendlyUrl: typeof raw.calendlyUrl === "string" ? raw.calendlyUrl : undefined,
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
  if (templateKey === "diagnostico_solidez_financiera") {
    const config: DiagnosticoSolidezConfig = {
      brand: { ...DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND, ...((raw.brand as Partial<DiagnosticoSolidezBrand>) ?? {}) },
      themeActive: typeof raw.themeActive === "string" ? (raw.themeActive as DiagnosticoSolidezTheme) : DEFAULT_DIAGNOSTICO_SOLIDEZ_THEME,
      assignedAgentName: typeof raw.assignedAgentName === "string" ? raw.assignedAgentName : undefined,
    };
    return config as MiniAppConfigByTemplate[T];
  }
  if (templateKey === "calculadora_meta_universitaria") {
    const config: MetaUniversitariaConfig = {
      brand: { ...DEFAULT_META_UNIVERSITARIA_BRAND, ...((raw.brand as Partial<MetaUniversitariaBrand>) ?? {}) },
      assignedAgentName: typeof raw.assignedAgentName === "string" ? raw.assignedAgentName : undefined,
    };
    return config as MiniAppConfigByTemplate[T];
  }
  if (templateKey === "kit_emergencia_financiera_familiar") {
    const config: KitEmergenciaConfig = {
      brand: { ...DEFAULT_KIT_EMERGENCIA_BRAND, ...((raw.brand as Partial<KitEmergenciaBrand>) ?? {}) },
      assignedAgentName: typeof raw.assignedAgentName === "string" ? raw.assignedAgentName : undefined,
    };
    return config as MiniAppConfigByTemplate[T];
  }
  if (templateKey === "test_preparacion_emergencia_financiera") {
    const config: TestEmergenciaConfig = {
      brand: { ...DEFAULT_TEST_EMERGENCIA_BRAND, ...((raw.brand as Partial<TestEmergenciaBrand>) ?? {}) },
      assignedAgentName: typeof raw.assignedAgentName === "string" ? raw.assignedAgentName : undefined,
    };
    return config as MiniAppConfigByTemplate[T];
  }
  if (templateKey === "diagnostico_salud_financiera") {
    const config: DiagnosticoSaludConfig = {
      brand: { ...DEFAULT_DIAGNOSTICO_SALUD_BRAND, ...((raw.brand as Partial<DiagnosticoSaludBrand>) ?? {}) },
      assignedAgentName: typeof raw.assignedAgentName === "string" ? raw.assignedAgentName : undefined,
    };
    return config as MiniAppConfigByTemplate[T];
  }
  if (templateKey === "calculadora_ahorro_fiscal") {
    const config: AhorroFiscalConfig = {
      brand: { ...DEFAULT_AHORRO_FISCAL_BRAND, ...((raw.brand as Partial<AhorroFiscalBrand>) ?? {}) },
      assignedAgentName: typeof raw.assignedAgentName === "string" ? raw.assignedAgentName : undefined,
    };
    return config as MiniAppConfigByTemplate[T];
  }
  if (templateKey === "control_financiero_base_cero") {
    const config: ControlFinancieroConfig = {
      brand: { ...DEFAULT_CONTROL_FINANCIERO_BRAND, ...((raw.brand as Partial<ControlFinancieroBrand>) ?? {}) },
      assignedAgentName: typeof raw.assignedAgentName === "string" ? raw.assignedAgentName : undefined,
    };
    return config as MiniAppConfigByTemplate[T];
  }
  if (templateKey === "content_calendar") {
    return {} as MiniAppConfigByTemplate[T];
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
        "id, workspace_id, name, description, template_key, slug, external_url, assigned_agent_id, allowed_origins, api_key_last4, status, branding, config, created_at, is_private",
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
    isPrivate: (app.is_private as boolean | null) ?? false,
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
    .select("id, origen_app, agente, nombre, whatsapp, fecha, status, contact_id, opportunity_id, policy_id, data")
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
    policyId: r.policy_id as string | null,
    data: (r.data as Record<string, unknown>) ?? {},
  }));
}

export async function getMiniAppLeadDetail(workspaceId: string, leadId: string): Promise<MiniAppLeadDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mini_app_leads")
    .select(
      "id, mini_app_id, origen_app, agente, nombre, whatsapp, fecha, consentimiento, consentimiento_fecha, received_at, data, status, contact_id, opportunity_id, policy_id",
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
    policyId: data.policy_id as string | null,
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

// ---------------------------------------------------------------------------
// Resumen (Fase 1 del rediseño) — KPIs comparados contra el período anterior,
// embudo, pendientes de hoy y desgloses. Todo en una sola función para que la
// pestaña haga un solo round-trip, mismo criterio que getPolicyBoardAction.
// ---------------------------------------------------------------------------

export type MiniAppResumenPeriod = 1 | 7 | 30 | 90;

interface PeriodBounds {
  currentStart: string;
  end: string;
  previousStart: string;
}

/** `days=1` ("Hoy") es el día calendario en curso, no las últimas 24h
 * rolling — coherente con cómo se lee "Hoy" en el resto de la app. Para el
 * resto, ventana rolling de `days` días terminando ahora, comparada contra
 * la ventana de igual longitud inmediatamente anterior. */
function getPeriodBounds(days: MiniAppResumenPeriod): PeriodBounds {
  const now = new Date();
  if (days === 1) {
    const currentStart = new Date(now);
    currentStart.setHours(0, 0, 0, 0);
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - 1);
    return { currentStart: currentStart.toISOString(), end: now.toISOString(), previousStart: previousStart.toISOString() };
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const currentStart = new Date(now.getTime() - days * dayMs);
  const previousStart = new Date(currentStart.getTime() - days * dayMs);
  return { currentStart: currentStart.toISOString(), end: now.toISOString(), previousStart: previousStart.toISOString() };
}

export interface MiniAppResumenData {
  days: MiniAppResumenPeriod;
  visits: { current: number; previous: number };
  leads: { current: number; previous: number };
  /** "Convertidos" cuenta, de los leads que ENTRARON en cada período, cuántos
   * tienen status "converted" HOY — no la fecha en la que se convirtieron
   * (esa fecha no se guarda todavía). Es una aproximación, igual que ya hacía
   * DashboardTab.tsx antes de este cambio (que ni siquiera filtraba por
   * período), pero declarada explícitamente acá. */
  converted: { current: number; previous: number };
  resultField: { label: string; format: ResultFieldFormat; current: number | null; previous: number | null } | null;
  /** true si esta Mini App ya tiene AL MENOS UN evento registrado alguna vez
   * (no solo en el período) — antes de eso, "Inició cálculo"/"Completó" se
   * muestran como "sin instrumentar todavía" (null) en vez de 0, para no dar
   * a entender que nadie avanza cuando en realidad la plantilla todavía no
   * manda esos eventos (ver ahorroFiscalTemplate.ts para el primer caso
   * instrumentado). */
  hasStepTracking: boolean;
  funnel: { key: string; label: string; count: number | null }[];
  pending: { uncontactedCount: number; oldestUncontactedAt: string | null };
  recentLeads: MiniAppLeadRow[];
  leadsByDay: { date: string; count: number }[];
  leadsByOrigin: { origin: string; count: number; converted: number }[];
}

export async function getMiniAppResumen(workspaceId: string, miniAppId: string, days: MiniAppResumenPeriod): Promise<MiniAppResumenData> {
  const supabase = await createClient();
  const { data: app } = await supabase.from("mini_apps").select("template_key").eq("id", miniAppId).eq("workspace_id", workspaceId).maybeSingle();
  const templateKey = (app?.template_key as MiniAppTemplateKey | undefined) ?? "simulador_retiro";
  const resultSpec = getResultFieldSpec(templateKey);
  const { currentStart, end, previousStart } = getPeriodBounds(days);

  const [
    { count: visitsCurrent },
    { count: visitsPrevious },
    { data: leadsInRange },
    { data: funnelSessions },
    { data: pendingLeads },
    { count: uncontactedCount },
    { data: recentRows },
    leadsByDay,
    { count: totalEventsCount },
  ] = await Promise.all([
    supabase.from("mini_app_visits").select("id", { count: "exact", head: true }).eq("mini_app_id", miniAppId).gte("created_at", currentStart).lte("created_at", end),
    supabase.from("mini_app_visits").select("id", { count: "exact", head: true }).eq("mini_app_id", miniAppId).gte("created_at", previousStart).lt("created_at", currentStart),
    supabase
      .from("mini_app_leads")
      .select("id, origen_app, agente, nombre, whatsapp, fecha, status, contact_id, opportunity_id, policy_id, data, received_at")
      .eq("workspace_id", workspaceId)
      .eq("mini_app_id", miniAppId)
      .gte("fecha", previousStart)
      .lte("fecha", end),
    supabase
      .from("mini_app_events")
      .select("event_type, session_id")
      .eq("mini_app_id", miniAppId)
      .in("event_type", ["step_viewed", "simulation_completed"])
      .gte("created_at", currentStart)
      .lte("created_at", end),
    supabase
      .from("mini_app_leads")
      .select("received_at")
      .eq("workspace_id", workspaceId)
      .eq("mini_app_id", miniAppId)
      .eq("status", "new")
      .order("received_at", { ascending: true })
      .limit(1),
    supabase.from("mini_app_leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("mini_app_id", miniAppId).eq("status", "new"),
    supabase
      .from("mini_app_leads")
      .select("id, origen_app, agente, nombre, whatsapp, fecha, status, contact_id, opportunity_id, policy_id, data")
      .eq("workspace_id", workspaceId)
      .eq("mini_app_id", miniAppId)
      .gte("fecha", currentStart)
      .lte("fecha", end)
      .order("received_at", { ascending: false })
      .limit(8),
    getMiniAppLeadsByDay(workspaceId, miniAppId, currentStart, end),
    supabase.from("mini_app_events").select("id", { count: "exact", head: true }).eq("mini_app_id", miniAppId),
  ]);

  const allLeadsInRange = (leadsInRange ?? []).map((r) => ({
    id: r.id as string,
    origenApp: r.origen_app as string,
    agente: r.agente as string | null,
    nombre: r.nombre as string,
    whatsapp: r.whatsapp as string,
    fecha: r.fecha as string,
    status: r.status as MiniAppLeadStatus,
    contactId: r.contact_id as string | null,
    opportunityId: r.opportunity_id as string | null,
    data: (r.data as Record<string, unknown>) ?? {},
    receivedAt: r.received_at as string,
  }));
  const currentLeads = allLeadsInRange.filter((l) => l.fecha >= currentStart);
  const previousLeads = allLeadsInRange.filter((l) => l.fecha < currentStart);

  const stepSessions = new Set<string>();
  const completedSessions = new Set<string>();
  for (const row of funnelSessions ?? []) {
    if (row.event_type === "step_viewed") stepSessions.add(row.session_id as string);
    if (row.event_type === "simulation_completed") completedSessions.add(row.session_id as string);
  }
  const hasStepTracking = (totalEventsCount ?? 0) > 0;

  const originMap = new Map<string, { count: number; converted: number }>();
  for (const l of currentLeads) {
    const current = originMap.get(l.origenApp) ?? { count: 0, converted: 0 };
    current.count += 1;
    if (l.status === "converted") current.converted += 1;
    originMap.set(l.origenApp, current);
  }

  return {
    days,
    visits: { current: visitsCurrent ?? 0, previous: visitsPrevious ?? 0 },
    leads: { current: currentLeads.length, previous: previousLeads.length },
    converted: {
      current: currentLeads.filter((l) => l.status === "converted").length,
      previous: previousLeads.filter((l) => l.status === "converted").length,
    },
    resultField: resultSpec
      ? {
          label: resultSpec.label,
          format: resultSpec.format,
          current: averageResultValue(templateKey, currentLeads),
          previous: averageResultValue(templateKey, previousLeads),
        }
      : null,
    hasStepTracking,
    funnel: [
      { key: "visited", label: "Visitaron la app", count: visitsCurrent ?? 0 },
      { key: "started", label: "Iniciaron el cálculo", count: hasStepTracking ? stepSessions.size : null },
      { key: "completed", label: "Completaron el cálculo", count: hasStepTracking ? completedSessions.size : null },
      { key: "submitted", label: "Dejaron sus datos", count: currentLeads.length },
      { key: "converted", label: "Contrataron", count: currentLeads.filter((l) => l.status === "converted").length },
    ],
    pending: {
      uncontactedCount: uncontactedCount ?? 0,
      oldestUncontactedAt: (pendingLeads?.[0]?.received_at as string | undefined) ?? null,
    },
    recentLeads: (recentRows ?? []).map((r) => ({
      id: r.id as string,
      origenApp: r.origen_app as string,
      agente: r.agente as string | null,
      nombre: r.nombre as string,
      whatsapp: r.whatsapp as string,
      fecha: r.fecha as string,
      status: r.status as MiniAppLeadStatus,
      contactId: r.contact_id as string | null,
      opportunityId: r.opportunity_id as string | null,
      policyId: r.policy_id as string | null,
      data: (r.data as Record<string, unknown>) ?? {},
    })),
    leadsByDay,
    leadsByOrigin: [...originMap.entries()].map(([origin, v]) => ({ origin, ...v })).sort((a, b) => b.count - a.count),
  };
}

// ---------------------------------------------------------------------------
// Analíticas (Fase 4) — comparativas de período, tasas, y el embudo de pasos
// real de mini_app_events (hoy solo instrumentado para Ahorro Fiscal, ver
// ahorroFiscalTemplate.ts). El "leads por origen" ya vive en Resumen
// (getMiniAppResumen) — no se repite acá. El mapa de calor y la distribución
// por rango de resultado se calculan en el cliente (Simulaciones ya hace lo
// mismo) a partir del array de leads que la página ya tiene cargado, sin
// consulta propia.
// ---------------------------------------------------------------------------

async function getVisitsByDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  miniAppId: string,
  rangeStartISO: string,
  rangeEndISO: string,
): Promise<{ date: string; count: number }[]> {
  const { data } = await supabase
    .from("mini_app_visits")
    .select("created_at")
    .eq("mini_app_id", miniAppId)
    .gte("created_at", rangeStartISO)
    .lte("created_at", rangeEndISO);

  const countsByDay = new Map<string, number>();
  for (const row of data ?? []) {
    const day = (row.created_at as string).slice(0, 10);
    countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
  }
  return [...countsByDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

export interface MiniAppAnalyticsPoint {
  date: string;
  visits: number;
  leads: number;
  /** Alineado por posición dentro del período (día 1 con día 1, no por fecha
   * calendario real) — así se puede dibujar como línea punteada superpuesta
   * sobre el mismo eje, igual que el mockup. `null` cuando no se pidió
   * comparar o el período anterior tiene menos días que el actual. */
  prevVisits: number | null;
  prevLeads: number | null;
}

export interface MiniAppAnalyticsData {
  series: MiniAppAnalyticsPoint[];
  rates: {
    completionPct: number | null;
    visitToLeadPct: number | null;
    leadToClientPct: number | null;
    avgDurationSeconds: number | null;
  };
  hasStepTracking: boolean;
  abandonment: { step: number; label: string; count: number }[];
}

export async function getMiniAppAnalytics(
  workspaceId: string,
  miniAppId: string,
  rangeStartISO: string,
  rangeEndISO: string,
  comparePrevious: boolean,
): Promise<MiniAppAnalyticsData> {
  const supabase = await createClient();

  const [
    visitsSeries,
    leadsSeries,
    { count: visitsCount },
    { data: leadsRows },
    { count: convertedCount },
    { data: durationRows },
    { data: stepRows },
    { count: totalEventsCount },
    { data: completedRows },
  ] = await Promise.all([
    getVisitsByDay(supabase, miniAppId, rangeStartISO, rangeEndISO),
    getMiniAppLeadsByDay(workspaceId, miniAppId, rangeStartISO, rangeEndISO),
    supabase.from("mini_app_visits").select("id", { count: "exact", head: true }).eq("mini_app_id", miniAppId).gte("created_at", rangeStartISO).lte("created_at", rangeEndISO),
    supabase.from("mini_app_leads").select("id", { count: "exact" }).eq("workspace_id", workspaceId).eq("mini_app_id", miniAppId).gte("fecha", rangeStartISO).lte("fecha", rangeEndISO),
    supabase
      .from("mini_app_leads")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("mini_app_id", miniAppId)
      .eq("status", "converted")
      .gte("fecha", rangeStartISO)
      .lte("fecha", rangeEndISO),
    supabase
      .from("mini_app_leads")
      .select("duration_seconds")
      .eq("workspace_id", workspaceId)
      .eq("mini_app_id", miniAppId)
      .gte("fecha", rangeStartISO)
      .lte("fecha", rangeEndISO)
      .not("duration_seconds", "is", null),
    supabase
      .from("mini_app_events")
      .select("step, session_id, meta")
      .eq("mini_app_id", miniAppId)
      .eq("event_type", "step_viewed")
      .gte("created_at", rangeStartISO)
      .lte("created_at", rangeEndISO),
    supabase.from("mini_app_events").select("id", { count: "exact", head: true }).eq("mini_app_id", miniAppId),
    supabase
      .from("mini_app_events")
      .select("session_id")
      .eq("mini_app_id", miniAppId)
      .eq("event_type", "simulation_completed")
      .gte("created_at", rangeStartISO)
      .lte("created_at", rangeEndISO),
  ]);

  let previousVisitsSeries: { date: string; count: number }[] = [];
  let previousLeadsSeries: { date: string; count: number }[] = [];
  let previousDays: string[] = [];
  if (comparePrevious) {
    const spanMs = new Date(rangeEndISO).getTime() - new Date(rangeStartISO).getTime();
    const prevEnd = new Date(new Date(rangeStartISO).getTime() - 1).toISOString();
    const prevStart = new Date(new Date(rangeStartISO).getTime() - spanMs).toISOString();
    previousDays = enumerateDays(prevStart, prevEnd);
    [previousVisitsSeries, previousLeadsSeries] = await Promise.all([
      getVisitsByDay(supabase, miniAppId, prevStart, prevEnd),
      getMiniAppLeadsByDay(workspaceId, miniAppId, prevStart, prevEnd),
    ]);
  }

  const days = enumerateDays(rangeStartISO, rangeEndISO);
  const visitsMap = new Map(visitsSeries.map((r) => [r.date, r.count]));
  const leadsMap = new Map(leadsSeries.map((r) => [r.date, r.count]));
  const prevVisitsMap = new Map(previousVisitsSeries.map((r) => [r.date, r.count]));
  const prevLeadsMap = new Map(previousLeadsSeries.map((r) => [r.date, r.count]));
  const series: MiniAppAnalyticsPoint[] = days.map((date, i) => ({
    date,
    visits: visitsMap.get(date) ?? 0,
    leads: leadsMap.get(date) ?? 0,
    prevVisits: previousDays[i] !== undefined ? (prevVisitsMap.get(previousDays[i]) ?? 0) : null,
    prevLeads: previousDays[i] !== undefined ? (prevLeadsMap.get(previousDays[i]) ?? 0) : null,
  }));

  const leadsCount = leadsRows?.length ?? 0;
  const hasStepTracking = (totalEventsCount ?? 0) > 0;

  const completedSessions = new Set((completedRows ?? []).map((r) => r.session_id as string));
  const completionPct = hasStepTracking && (visitsCount ?? 0) > 0 ? (completedSessions.size / (visitsCount ?? 1)) * 100 : null;
  const visitToLeadPct = (visitsCount ?? 0) > 0 ? (leadsCount / (visitsCount ?? 1)) * 100 : null;
  const leadToClientPct = leadsCount > 0 ? ((convertedCount ?? 0) / leadsCount) * 100 : null;
  const durations = (durationRows ?? []).map((r) => r.duration_seconds as number).filter((d): d is number => typeof d === "number");
  const avgDurationSeconds = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const stepBuckets = new Map<number, { sessions: Set<string>; label: string | null }>();
  for (const row of stepRows ?? []) {
    const step = row.step as number | null;
    if (step === null) continue;
    const bucket = stepBuckets.get(step) ?? { sessions: new Set<string>(), label: null };
    bucket.sessions.add(row.session_id as string);
    const meta = row.meta as { data?: { step?: unknown } } | null;
    const stepLabel = typeof meta?.data?.step === "string" ? meta.data.step : null;
    if (stepLabel && !bucket.label) bucket.label = stepLabel;
    stepBuckets.set(step, bucket);
  }
  const abandonment = [...stepBuckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, bucket]) => ({ step, label: bucket.label ? cap(bucket.label) : step === 0 ? "Abrieron la calculadora" : `Paso ${step}`, count: bucket.sessions.size }));

  return {
    series,
    rates: { completionPct, visitToLeadPct, leadToClientPct, avgDurationSeconds },
    hasStepTracking,
    abandonment,
  };
}

function enumerateDays(startISO: string, endISO: string): string[] {
  const days: string[] = [];
  const start = new Date(startISO);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endISO);
  end.setHours(0, 0, 0, 0);
  // Tope defensivo (3 años) — un rango personalizado mal armado (fechas
  // invertidas, etc.) no debe generar un array gigante/loop largo.
  for (let d = new Date(start), guard = 0; d <= end && guard < 1100; d.setDate(d.getDate() + 1), guard++) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
    /** Solo necesario para "content_calendar" (traer su contenido de las
     * tablas mini_app_content_*) — las demás plantillas no lo usan. */
    id: string;
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
    .select("id, slug, name, description, template_key, external_url, status, branding, config")
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
    id: data.id as string,
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

// ---------------------------------------------------------------------------
// Actividad de un lead (Fase 2) — mismo patrón que getPolicyActivity/
// getOpportunityActivity: lee audit_log filtrado por entity_type/entity_id,
// resuelve nombres de actor por separado. Las notas manuales van aparte (ver
// getMiniAppLeadNotesAction en actions.ts, mismo patrón que las de Pólizas)
// porque son dos fuentes distintas, no una sola — igual que en Pólizas/CRM.
// ---------------------------------------------------------------------------

export interface MiniAppLeadActivityEntry {
  id: string;
  action: string;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const MINI_APP_LEAD_ACTION_LABEL: Record<string, string> = {
  lead_received: "Llegó el lead",
  stage_changed: "Cambió de etapa",
  contact_created: "Convertido a Contacto",
  moved_to_pipeline: "Movido al Pipeline",
  conversation_started: "Se inició una conversación",
  policy_created: "Póliza creada",
  scheduling_started: "Agendó una cita",
};

export async function getMiniAppLeadActivity(workspaceId: string, leadId: string): Promise<MiniAppLeadActivityEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, actor_id, metadata, created_at")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", "mini_app_lead")
    .eq("entity_id", leadId)
    .order("created_at", { ascending: false });

  const actorIds = Array.from(new Set((data ?? []).map((r) => r.actor_id as string | null).filter((id): id is string => Boolean(id))));
  const { data: names } = actorIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map(((names ?? []) as { member_id: string; full_name: string }[]).map((n) => [n.member_id, n.full_name]));

  return (data ?? []).map((r) => ({
    id: r.id as string,
    action: MINI_APP_LEAD_ACTION_LABEL[r.action as string] ?? (r.action as string),
    actorName: r.actor_id ? (nameByMember.get(r.actor_id as string) ?? null) : null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  }));
}
