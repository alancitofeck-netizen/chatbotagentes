import type { MiniAppTemplateKey } from "@/lib/miniApps/queries";

/**
 * The single place a new mini app template gets registered — the ONE spot
 * that grows per-template as Growth Link ships more mini apps (calculadoras,
 * quizzes, formularios, landing pages). "Contactos de Apps" and its filters
 * read only from this map, never from a hardcoded template name — that's
 * what makes the feature scale to hundreds of future mini apps without any
 * of the CRM/contacts code needing to know a specific template exists.
 *
 * `MiniAppTemplateKey` is imported type-only, so this file never pulls in
 * queries.ts's "server-only" boundary — it needs to render client-side
 * (the category filter pills in ContactsShell.tsx).
 */
export type MiniAppTemplateCategory =
  | "simuladores"
  | "calculadoras"
  | "quizzes"
  | "formularios"
  | "landing_pages"
  | "vinculadas"
  | "herramientas_internas";

export const TEMPLATE_CATEGORIES: { key: MiniAppTemplateCategory; label: string }[] = [
  { key: "simuladores", label: "Simuladores" },
  { key: "calculadoras", label: "Calculadoras" },
  { key: "quizzes", label: "Quizzes" },
  { key: "formularios", label: "Formularios" },
  { key: "landing_pages", label: "Landing Pages" },
  { key: "vinculadas", label: "Apps Vinculadas" },
  { key: "herramientas_internas", label: "Herramientas internas" },
];

export const TEMPLATE_KEY_META: Record<MiniAppTemplateKey, { label: string; category: MiniAppTemplateCategory }> = {
  simulador_retiro: { label: "Simulador de Retiro", category: "simuladores" },
  calculadora_brecha_retiro: { label: "Calculadora de Brecha de Retiro", category: "calculadoras" },
  app_vinculada: { label: "App Vinculada", category: "vinculadas" },
  diagnostico_financiero: { label: "Diagnóstico Interactivo Financiero", category: "quizzes" },
  diagnostico_financiero_retiro: { label: "Diagnóstico Financiero - Retiro", category: "quizzes" },
  diagnostico_solidez_financiera: { label: "diagnostico financiero - Caballo de Troya", category: "quizzes" },
  calculadora_meta_universitaria: { label: "Calculadora de Meta Universitaria", category: "calculadoras" },
  kit_emergencia_financiera_familiar: { label: "Kit de Emergencia Financiera Familiar", category: "formularios" },
  test_preparacion_emergencia_financiera: { label: "Test de Preparación para Emergencias Financieras", category: "quizzes" },
  diagnostico_salud_financiera: { label: "Diagnóstico de Salud Financiera", category: "quizzes" },
  calculadora_ahorro_fiscal: { label: "Calculadora de Ahorro Fiscal", category: "calculadoras" },
  control_financiero_base_cero: { label: "Top Apps, de ingresos y gastos", category: "calculadoras" },
  content_calendar: { label: "Cronograma de Contenido", category: "herramientas_internas" },
};

export function templateKeysForCategory(category: MiniAppTemplateCategory): MiniAppTemplateKey[] {
  return (Object.keys(TEMPLATE_KEY_META) as MiniAppTemplateKey[]).filter((k) => TEMPLATE_KEY_META[k].category === category);
}

export function categoryLabel(category: MiniAppTemplateCategory): string {
  return TEMPLATE_CATEGORIES.find((c) => c.key === category)?.label ?? category;
}
