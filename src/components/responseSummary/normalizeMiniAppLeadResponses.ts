import type { MiniAppLeadDetail, MiniAppDetail } from "@/lib/miniApps/queries";
import type { DiagnosticoQuestion } from "@/lib/miniApps/diagnosticoDefaults";
import type { DiagnosticoRetiroQuestion } from "@/lib/miniApps/diagnosticoRetiroDefaults";
import type { ResponseViewModel } from "./types";

/** Mismos labels que LeadDetailDrawer.tsx (duplicados a propósito — ese
 * archivo es "use client" y este normalizador debe poder importarse desde un
 * Server Component sin arrastrar nada de cliente). Fallback genérico para
 * cualquier templateKey sin preguntas reales (Simulador, Calculadora, App
 * Vinculada — son calculadoras, no cuestionarios). */
const GENERIC_FIELD_LABELS: Record<string, string> = {
  edad: "Edad",
  edad_retiro: "Edad de retiro",
  ahorro_mensual: "Ahorro mensual",
  ingreso_actual: "Ingreso actual",
  fondo_estimado: "Fondo estimado",
  fondo_rango_bajo: "Fondo (rango bajo)",
  fondo_rango_alto: "Fondo (rango alto)",
  renta_mensual_estimada: "Renta mensual estimada",
  regimen: "Régimen",
  retiro_deseado: "Retiro deseado",
  sueldo_mensual: "Sueldo mensual",
  semanas_cotizadas: "Semanas cotizadas",
  pension_estimada: "Pensión estimada",
  meta: "Meta",
  brecha: "Brecha",
  email: "Correo electrónico",
  score: "Puntaje",
  level: "Nivel",
  perfil: "Perfil",
  theme: "Tema de interés",
  areas: "Desglose por área",
  answers: "Respuestas (índices)",
  recomendaciones: "Recomendaciones",
};

const SKIP_GENERIC_KEYS = new Set(["bundle_version", "answers"]);

function formatGenericValue(value: unknown): string {
  if (typeof value === "number") return new Intl.NumberFormat("es-MX").format(value);
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "object" && v !== null ? Object.values(v).join(" ") : String(v))).join(", ");
  }
  return String(value);
}

function normalizeDiagnosticoFinanciero(lead: MiniAppLeadDetail, config: { questions: DiagnosticoQuestion[] }): ResponseViewModel[] {
  const out: ResponseViewModel[] = [];
  const answers = Array.isArray(lead.data.answers) ? (lead.data.answers as (number | null)[]) : [];

  config.questions.forEach((q, i) => {
    const answerIndex = answers[i];
    const option = answerIndex !== null && answerIndex !== undefined ? q.options[answerIndex] : undefined;
    if (!option) return;
    out.push({ key: `q${i}`, question: q.text, answer: option.t, answerType: "choice", section: q.area || "Respuestas del diagnóstico", order: i });
  });

  pushDiagnosticoResult(out, lead, config.questions.length);
  return out;
}

function normalizeDiagnosticoRetiro(lead: MiniAppLeadDetail, config: { questions: DiagnosticoRetiroQuestion[] }): ResponseViewModel[] {
  const out: ResponseViewModel[] = [];
  const answers = Array.isArray(lead.data.answers) ? (lead.data.answers as (number | null)[]) : [];

  config.questions.forEach((q, i) => {
    const answerIndex = answers[i];
    const option = answerIndex !== null && answerIndex !== undefined ? q.options[answerIndex] : undefined;
    if (!option) return;
    out.push({ key: `q${i}`, question: q.text, answer: option.label, answerType: "choice", section: "Respuestas del diagnóstico", order: i });
  });

  pushDiagnosticoResult(out, lead, config.questions.length);
  return out;
}

/** Filas de resultado comunes a ambos diagnósticos — siempre derivadas de
 * `lead.data`, calculado server-side de forma autoritativa al momento del
 * envío (ver ingest.ts), nunca recalculado acá. */
function pushDiagnosticoResult(out: ResponseViewModel[], lead: MiniAppLeadDetail, questionCount: number) {
  const baseOrder = questionCount + 1;
  if (typeof lead.data.score === "number") {
    out.push({ key: "score", question: "Puntaje del diagnóstico", answer: `${lead.data.score}/100`, answerType: "field", section: "Resultado", order: baseOrder });
  }
  const perfil = lead.data.level ?? lead.data.perfil;
  if (typeof perfil === "string" && perfil) {
    out.push({ key: "perfil", question: "Perfil detectado", answer: perfil, answerType: "field", section: "Resultado", order: baseOrder + 1 });
  }
  if (Array.isArray(lead.data.areas) && lead.data.areas.length > 0) {
    const areas = lead.data.areas as { name?: string; pct?: number }[];
    const formatted = areas.filter((a) => a.name).map((a) => `${a.name}: ${a.pct}%`);
    if (formatted.length > 0) {
      out.push({ key: "areas", question: "Desglose por área", answer: formatted, answerType: "multi_choice", section: "Resultado", order: baseOrder + 2 });
    }
  }
}

function normalizeGeneric(lead: MiniAppLeadDetail): ResponseViewModel[] {
  return Object.entries(lead.data)
    .filter(([key]) => !SKIP_GENERIC_KEYS.has(key))
    .map(([key, value], i) => ({
      key,
      question: GENERIC_FIELD_LABELS[key] ?? key,
      answer: formatGenericValue(value),
      answerType: "field" as const,
      section: "Datos",
      order: i,
    }));
}

/** Reconstruye pregunta+respuesta real para los dos tipos de Diagnóstico
 * (cruzando `miniApp.config.questions` con `lead.data.answers`, mismo patrón
 * que responseExtraction.ts pero contra el shape de config de Mini Apps) —
 * para cualquier otro templateKey (calculadoras sin preguntas reales) cae al
 * listado genérico de `lead.data` ya existente en LeadDetailDrawer.tsx. */
export function normalizeMiniAppLeadResponses(lead: MiniAppLeadDetail, miniApp: MiniAppDetail | null): ResponseViewModel[] {
  if (miniApp?.templateKey === "diagnostico_financiero") {
    return normalizeDiagnosticoFinanciero(lead, miniApp.config);
  }
  if (miniApp?.templateKey === "diagnostico_financiero_retiro") {
    return normalizeDiagnosticoRetiro(lead, miniApp.config);
  }
  return normalizeGeneric(lead);
}
