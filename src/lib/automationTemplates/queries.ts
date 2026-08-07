import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AutomationCategory } from "@/lib/automationTemplates/constants";

export interface AutomationCatalogEntry {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: AutomationCategory;
  defaultEnabled: boolean;
  defaultMessageTemplate: string;
  hasTrigger: boolean;
  position: number;
}

function mapCatalogRow(r: Record<string, unknown>): AutomationCatalogEntry {
  return {
    key: r.key as string,
    name: r.name as string,
    description: r.description as string,
    icon: r.icon as string,
    category: r.category as AutomationCategory,
    defaultEnabled: r.default_enabled as boolean,
    defaultMessageTemplate: r.default_message_template as string,
    hasTrigger: r.has_trigger as boolean,
    position: r.position as number,
  };
}

/** Catálogo GLOBAL — mismo dato para cualquier workspace, no hace falta
 * sembrarlo por workspace (ver la nota en 0110_automation_catalog.sql). */
export async function getAutomationCatalog(): Promise<AutomationCatalogEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("automation_catalog").select("*").order("position", { ascending: true });
  return (data ?? []).map(mapCatalogRow);
}

export interface AutomationTemplate extends AutomationCatalogEntry {
  enabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  messageTemplate: string;
  /** true si el workspace ya la tocó (existe fila de override) — separa
   * "está en su default de catálogo" de "el asesor la configuró". */
  isCustomized: boolean;
}

/** Catálogo + la fila de override del workspace (si existe) mezclados en un
 * solo view-model — "Biblioteca" siempre tiene las N filas del catálogo,
 * nunca depende de que el workspace ya haya sido sembrado. */
export async function getAutomationsBoard(workspaceId: string): Promise<AutomationTemplate[]> {
  const supabase = await createClient();
  const [catalog, { data: overrides }] = await Promise.all([
    getAutomationCatalog(),
    supabase.from("automation_templates").select("*").eq("workspace_id", workspaceId),
  ]);

  const overrideByType = new Map(((overrides ?? []) as Record<string, unknown>[]).map((r) => [r.type as string, r]));

  return catalog.map((entry) => {
    const override = overrideByType.get(entry.key);
    return {
      ...entry,
      enabled: override ? (override.enabled as boolean) : entry.defaultEnabled,
      whatsappEnabled: override ? (override.whatsapp_enabled as boolean) : true,
      emailEnabled: override ? (override.email_enabled as boolean) : false,
      smsEnabled: override ? (override.sms_enabled as boolean) : false,
      messageTemplate: override ? ((override.message_template as string | null) ?? entry.defaultMessageTemplate) : entry.defaultMessageTemplate,
      isCustomized: Boolean(override),
    };
  });
}

export interface AutomationStats {
  activeCount: number;
  inactiveCount: number;
  customCount: number;
  executionsThisMonth: number;
}

/** `customCount` cuenta las automatizaciones creadas con el Builder (tabla
 * `automations`, módulo ya existente en src/lib/automations/ — reusado acá
 * solo para el conteo, sin tocar ese módulo). */
export async function getAutomationStats(workspaceId: string, board: AutomationTemplate[]): Promise<AutomationStats> {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ count: customCount }, { count: executionsThisMonth }] = await Promise.all([
    supabase.from("automations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("automation_send_log").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", monthStart.toISOString()),
  ]);

  const activeCount = board.filter((a) => a.enabled).length;
  return { activeCount, inactiveCount: board.length - activeCount, customCount: customCount ?? 0, executionsThisMonth: executionsThisMonth ?? 0 };
}

export interface AutomationHistoryEntry {
  id: string;
  automationType: string;
  automationName: string;
  icon: string;
  entityLabel: string | null;
  status: "completed" | "failed";
  error: string | null;
  createdAt: string;
}

/** Pestaña "Historial" — quién se disparó, para quién, y si falló. */
export async function getAutomationHistory(workspaceId: string, limit = 50): Promise<AutomationHistoryEntry[]> {
  const supabase = await createClient();
  const [{ data: logs }, catalog] = await Promise.all([
    supabase
      .from("automation_send_log")
      .select("id, automation_type, entity_label, status, error, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit),
    getAutomationCatalog(),
  ]);

  const catalogByKey = new Map(catalog.map((c) => [c.key, c]));

  return ((logs ?? []) as Record<string, unknown>[]).map((r) => {
    const type = r.automation_type as string;
    const entry = catalogByKey.get(type);
    return {
      id: r.id as string,
      automationType: type,
      automationName: entry?.name ?? type,
      icon: entry?.icon ?? "Sparkles",
      entityLabel: r.entity_label as string | null,
      status: r.status as "completed" | "failed",
      error: r.error as string | null,
      createdAt: r.created_at as string,
    };
  });
}
