import type { MiniAppLeadDetail, MiniAppDetail } from "@/lib/miniApps/queries";
import type { DiagnosticoQuestion } from "@/lib/miniApps/diagnosticoDefaults";
import type { DiagnosticoRetiroQuestion } from "@/lib/miniApps/diagnosticoRetiroDefaults";
import { getDiagnosticoSolidezTier } from "@/lib/miniApps/diagnosticoSolidezDefaults";
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

/** Etiquetas legibles para DiagnosticoRetiroThemeKey (diagnosticoRetiroDefaults.ts)
 * — la pregunta de "objetivo" (sin puntos, solo tema) guarda la clave interna
 * en data.theme, nunca un texto ya formateado para mostrar. */
const THEME_LABELS: Record<string, string> = {
  mantener: "Mantener nivel de vida",
  patrimonio: "Patrimonio protegido",
  fiscal: "Eficiencia fiscal",
  liquidez: "Liquidez",
};

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
  if (typeof lead.data.theme === "string" && lead.data.theme) {
    out.push({ key: "theme", question: "Objetivo declarado", answer: THEME_LABELS[lead.data.theme] ?? lead.data.theme, answerType: "field", section: "Resultado", order: baseOrder + 3 });
  }
  if (Array.isArray(lead.data.recomendaciones) && lead.data.recomendaciones.length > 0) {
    const recos = (lead.data.recomendaciones as unknown[]).filter((r): r is string => typeof r === "string" && r.trim() !== "");
    if (recos.length > 0) {
      out.push({ key: "recomendaciones", question: "Recomendaciones", answer: recos, answerType: "multi_choice", section: "Resultado", order: baseOrder + 4 });
    }
  }
  if (Array.isArray(lead.data.answers) && lead.data.answers.length > 0) {
    out.push({ key: "answers", question: "Respuestas (índices)", answer: lead.data.answers, answerType: "multi_choice", section: "Resultado", order: baseOrder + 5 });
  }
}

/** "Diagnóstico de Solidez Financiera" — a diferencia de los otros dos
 * diagnósticos, no hay preguntas configuradas en `miniApp.config` (el
 * cuestionario es fijo, no editable por asesor — ver
 * diagnosticoSolidezDefaults.ts), así que acá alcanza con `lead.data`, ya
 * guardada con pregunta+respuesta real por ingest.ts (nunca el `scores`/
 * `resultado` crudo que mandó el navegador). */
function normalizeDiagnosticoSolidez(lead: MiniAppLeadDetail): ResponseViewModel[] {
  const out: ResponseViewModel[] = [];
  const answers = Array.isArray(lead.data.answers)
    ? (lead.data.answers as { question?: unknown; dim?: unknown; dimLabel?: unknown; respuesta?: unknown }[])
    : [];

  answers.forEach((a, i) => {
    if (typeof a.question !== "string" || typeof a.respuesta !== "string") return;
    out.push({
      key: `q${i}`,
      question: a.question,
      answer: a.respuesta,
      answerType: "choice",
      section: typeof a.dimLabel === "string" ? a.dimLabel : "Diagnóstico",
      order: i,
    });
  });

  const baseOrder = answers.length + 1;
  if (typeof lead.data.overall === "number") {
    const tier = getDiagnosticoSolidezTier(lead.data.overall);
    out.push({ key: "overall", question: "Puntaje general", answer: `${lead.data.overall}/100`, answerType: "field", section: "Resultado", order: baseOrder });
    out.push({ key: "tier", question: tier.name, answer: tier.desc, answerType: "field", section: "Resultado", order: baseOrder + 1 });
  }
  if (Array.isArray(lead.data.areasAtencion) && lead.data.areasAtencion.length > 0) {
    const areas = lead.data.areasAtencion as { dimLabel?: string; score?: number }[];
    const formatted = areas.filter((a) => a.dimLabel).map((a) => `${a.dimLabel}: ${a.score}%`);
    if (formatted.length > 0) {
      out.push({ key: "areasAtencion", question: "Áreas de atención", answer: formatted, answerType: "multi_choice", section: "Resultado", order: baseOrder + 2 });
    }
  }
  const fortaleza = lead.data.fortalezaPrincipal as { dimLabel?: string; score?: number } | null | undefined;
  if (fortaleza?.dimLabel) {
    out.push({ key: "fortaleza", question: "Fortaleza principal", answer: `${fortaleza.dimLabel}: ${fortaleza.score}%`, answerType: "field", section: "Resultado", order: baseOrder + 3 });
  }

  return out;
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
  if (miniApp?.templateKey === "diagnostico_solidez_financiera") {
    return normalizeDiagnosticoSolidez(lead);
  }
  return normalizeGeneric(lead);
}
