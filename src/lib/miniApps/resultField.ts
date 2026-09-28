import type { MiniAppTemplateKey } from "@/lib/miniApps/queries";

export type ResultFieldFormat = "currency" | "percent";

interface ResultFieldSpec {
  /** Clave dentro del `data` jsonb del lead — siempre uno de los campos
   * recalculados server-side en processLeadSubmission (ingest.ts), nunca uno
   * que el visitante pudo mandar sin recomputar. */
  key: string;
  label: string;
  format: ResultFieldFormat;
}

/** El "resultado principal" de cada plantilla — usado por Resumen (KPI de
 * resultado promedio) y Simulaciones (Fase 3) para no tener que hardcodear
 * un campo distinto en cada componente. Las plantillas sin un resultado
 * numérico claro (Kit Emergencia solo guarda categorías/conteos sin recómputo
 * propio server-side, App Vinculada no tiene datos propios, Cronograma de
 * Contenido no genera leads) quedan sin entrada — sus KPIs/vistas
 * simplemente omiten esa tarjeta en vez de mostrar un dato inventado. */
const RESULT_FIELD_BY_TEMPLATE: Partial<Record<MiniAppTemplateKey, ResultFieldSpec>> = {
  simulador_retiro: { key: "fondo_estimado", label: "Fondo estimado", format: "currency" },
  calculadora_brecha_retiro: { key: "brecha", label: "Brecha de retiro", format: "currency" },
  diagnostico_financiero: { key: "score", label: "Puntaje financiero", format: "percent" },
  diagnostico_financiero_retiro: { key: "score", label: "Puntaje general", format: "percent" },
  diagnostico_solidez_financiera: { key: "overall", label: "Solidez financiera", format: "percent" },
  calculadora_meta_universitaria: { key: "meta_mensual_estimada", label: "Meta mensual", format: "currency" },
  test_preparacion_emergencia_financiera: { key: "emergency_score", label: "Preparación", format: "percent" },
  diagnostico_salud_financiera: { key: "financial_score", label: "Salud financiera", format: "percent" },
  calculadora_ahorro_fiscal: { key: "ahorro_fiscal_estimado", label: "Ahorro fiscal", format: "currency" },
};

export function getResultFieldSpec(templateKey: MiniAppTemplateKey): ResultFieldSpec | null {
  return RESULT_FIELD_BY_TEMPLATE[templateKey] ?? null;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Extrae el resultado numérico de un lead puntual según su plantilla —
 * `null` si la plantilla no tiene un campo definido o el lead no lo trae
 * (nunca inventa un valor). */
export function getLeadResultValue(templateKey: MiniAppTemplateKey, data: Record<string, unknown>): number | null {
  const spec = getResultFieldSpec(templateKey);
  if (!spec) return null;
  return toFiniteNumber(data[spec.key]);
}

/** Promedio del resultado principal entre los leads que sí lo tienen — el
 * denominador es solo esos leads, no el total (un lead sin el campo no debe
 * arrastrar el promedio hacia 0). */
export function averageResultValue(templateKey: MiniAppTemplateKey, leads: { data: Record<string, unknown> }[]): number | null {
  const spec = getResultFieldSpec(templateKey);
  if (!spec) return null;
  const values = leads.map((l) => toFiniteNumber(l.data[spec.key])).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
