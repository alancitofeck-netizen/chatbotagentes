/** Config por defecto para "Diagnóstico de Solidez Financiera" — los campos
 * de `BRAND_CONFIG` y la paleta activa (`THEME_ACTIVE`) del HTML original
 * que sirvió de base a este tipo de Mini App. Única fuente de verdad,
 * importada tanto por queries.ts (relleno de defaults si `config` viene
 * vacío/incompleto) como por NewMiniAppWizard.tsx (estado inicial del
 * formulario) — mismo patrón que diagnosticoDefaults.ts. Arranca en blanco
 * (no con los datos de ejemplo "Patricio Jaik" del archivo original) para
 * que cada asesor lo complete con lo suyo, igual que DEFAULT_DIAGNOSTICO_AGENTE. */

export type DiagnosticoSolidezTheme = "brass" | "navy" | "emerald" | "wine" | "copper";

export interface DiagnosticoSolidezBrand {
  advisorName: string;
  companyName: string;
  title: string;
  badge: string;
  photoURL: string;
  logoURL: string;
  whatsapp: string;
  calendly: string;
  privacyURL: string;
  advisorID: string;
  webhookURL: string;
  waGreeting: string;
}

export const DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND: DiagnosticoSolidezBrand = {
  advisorName: "",
  companyName: "",
  title: "Asesor patrimonial",
  badge: "",
  photoURL: "",
  logoURL: "",
  whatsapp: "",
  calendly: "",
  privacyURL: "",
  advisorID: "",
  webhookURL: "",
  waGreeting: "Hola, acabo de realizar el Diagnóstico de Solidez Financiera y me gustaría entender mejor mi resultado.",
};

export const DEFAULT_DIAGNOSTICO_SOLIDEZ_THEME: DiagnosticoSolidezTheme = "brass";

export const DIAGNOSTICO_SOLIDEZ_THEME_OPTIONS: { key: DiagnosticoSolidezTheme; label: string; swatch: string }[] = [
  { key: "brass", label: "Bronce", swatch: "#B08D4C" },
  { key: "navy", label: "Marino", swatch: "#3B82C4" },
  { key: "emerald", label: "Esmeralda", swatch: "#2E9E7B" },
  { key: "wine", label: "Vino", swatch: "#A6486B" },
  { key: "copper", label: "Cobre", swatch: "#C17A45" },
];

/** Copia server-side, literal, de `DIMS`/`QUESTIONS`/`TIERS` en
 * diagnosticoSolidezTemplate.ts — a diferencia de diagnostico_financiero/
 * diagnostico_financiero_retiro, este cuestionario NO es editable por
 * asesor (DiagnosticoSolidezConfig solo tiene `brand`/`themeActive`), así
 * que no hace falta guardarlo en `mini_apps.config`: es una constante fija,
 * igual en el cliente y acá. Se usa para (a) recalcular `scores`/`overall`
 * de forma autoritativa en ingest.ts — nunca confiar en el resultado que
 * manda el navegador — y (b) reconstruir pregunta+respuesta real para el
 * panel de "Resumen de respuestas" (normalizeMiniAppLeadResponses.ts). El
 * cliente manda `respuestas: {dim, respuesta}[]` en el mismo orden que
 * QUESTIONS (nunca el índice de opción elegido ni su valor numérico), así
 * que para recomputar `v` acá hay que volver a resolver `respuesta` contra
 * `opts`/la escala de la pregunta correspondiente por posición. */
export const DIAGNOSTICO_SOLIDEZ_DIMS: Record<string, string> = {
  proteccion: "Protección",
  salud: "Salud",
  retiro: "Retiro",
  liquidez: "Liquidez",
  patrimonio: "Patrimonio",
  fiscal: "Eficiencia fiscal",
};

export interface DiagnosticoSolidezQuestionOption {
  t: string;
  v: number;
}

export interface DiagnosticoSolidezQuestion {
  dim: string;
  context?: true;
  key?: string;
  q: string;
  sub?: string;
  type?: "scale";
  opts?: DiagnosticoSolidezQuestionOption[];
  ends?: [string, string];
}

export const DIAGNOSTICO_SOLIDEZ_QUESTIONS: DiagnosticoSolidezQuestion[] = [
  {
    dim: "retiro",
    context: true,
    key: "edad",
    q: "¿En qué rango de edad te encuentras?",
    sub: "Nos ayuda a interpretar tu horizonte de tiempo.",
    opts: [
      { t: "20–29", v: 100 },
      { t: "30–39", v: 85 },
      { t: "40–49", v: 65 },
      { t: "50–59", v: 45 },
      { t: "60 o más", v: 30 },
    ],
  },
  {
    dim: "patrimonio",
    context: true,
    key: "ingreso",
    q: "¿Cuál es aproximadamente tu ingreso mensual?",
    sub: "Solo por rangos. No pedimos ningún dato bancario.",
    opts: [
      { t: "Menos de $30,000", v: 40 },
      { t: "$30,000 – $60,000", v: 60 },
      { t: "$60,000 – $120,000", v: 75 },
      { t: "$120,000 – $250,000", v: 88 },
      { t: "Más de $250,000", v: 100 },
    ],
  },
  {
    dim: "proteccion",
    key: "dependientes",
    q: "¿Alguien depende económicamente de ti?",
    sub: "Define cuánto pesa tu protección familiar.",
    opts: [
      { t: "No, nadie depende de mí", v: 100 },
      { t: "Sí, mi pareja", v: 55 },
      { t: "Sí, mis hijos", v: 45 },
      { t: "Sí, pareja e hijos", v: 35 },
      { t: "Otros familiares también", v: 40 },
    ],
  },
  {
    dim: "liquidez",
    q: "Si mañana tus ingresos se detuvieran, ¿cuánto tiempo podrías mantener tu estilo de vida sin endeudarte?",
    opts: [
      { t: "Menos de 1 mes", v: 15 },
      { t: "1 a 3 meses", v: 40 },
      { t: "3 a 6 meses", v: 70 },
      { t: "6 a 12 meses", v: 90 },
      { t: "Más de 12 meses", v: 100 },
    ],
  },
  {
    dim: "proteccion",
    q: "Si llegaras a faltar mañana, ¿tu familia podría mantener su estabilidad financiera los próximos años?",
    opts: [
      { t: "Definitivamente sí", v: 100 },
      { t: "Probablemente sí", v: 75 },
      { t: "No estoy seguro", v: 45 },
      { t: "Probablemente no", v: 25 },
      { t: "Definitivamente no", v: 10 },
    ],
  },
  {
    dim: "salud",
    q: "¿Cómo enfrentarías un gasto médico importante de varios cientos de miles de pesos?",
    opts: [
      { t: "Tengo una cobertura adecuada", v: 100 },
      { t: "Tengo cobertura, pero desconozco sus alcances", v: 65 },
      { t: "Dependo únicamente del seguro de mi empresa", v: 40 },
      { t: "Utilizaría mis ahorros", v: 35 },
      { t: "Tendría que endeudarme", v: 10 },
    ],
  },
  {
    dim: "salud",
    q: "¿Cuentas con un seguro de gastos médicos mayores privado (no solo el de la empresa)?",
    opts: [
      { t: "Sí, propio y vigente", v: 100 },
      { t: "Sí, pero no sé bien qué cubre", v: 65 },
      { t: "Solo el de mi empresa", v: 35 },
      { t: "No cuento con uno", v: 10 },
    ],
  },
  {
    dim: "retiro",
    q: "¿Actualmente tienes una estrategia específica para financiar tu retiro?",
    opts: [
      { t: "Sí, estructurada y con aportaciones constantes", v: 100 },
      { t: "Tengo ahorros/inversiones, pero sin estrategia clara", v: 55 },
      { t: "Apenas estoy comenzando", v: 30 },
      { t: "No tengo ninguna", v: 10 },
    ],
  },
  {
    dim: "retiro",
    type: "scale",
    q: "¿Qué tan claro tienes cuánto necesitarías acumular para mantener tu estilo de vida en el retiro?",
    sub: "1 = no tengo idea · 5 = lo tengo muy claro",
    ends: ["Sin idea", "Muy claro"],
  },
  {
    dim: "proteccion",
    q: "¿Cuentas con un seguro de vida o estrategia de protección familiar?",
    opts: [
      { t: "Sí, y sé que es suficiente", v: 100 },
      { t: "Sí, pero desconozco si es suficiente", v: 60 },
      { t: "Solo lo que me da mi empresa", v: 35 },
      { t: "No", v: 10 },
    ],
  },
  {
    dim: "patrimonio",
    q: "¿Qué porcentaje de tus ingresos destinas regularmente al ahorro o inversión?",
    opts: [
      { t: "0%", v: 10 },
      { t: "Menos del 5%", v: 35 },
      { t: "5% a 10%", v: 60 },
      { t: "10% a 20%", v: 85 },
      { t: "Más del 20%", v: 100 },
    ],
  },
  {
    dim: "fiscal",
    q: "¿Utilizas alguna estrategia financiera que además te dé beneficios fiscales?",
    sub: "Orientación inicial. No sustituye asesoría fiscal.",
    opts: [
      { t: "Sí, de forma consciente", v: 100 },
      { t: "Creo que sí, pero no estoy seguro", v: 55 },
      { t: "No", v: 25 },
      { t: "Desconocía que existían", v: 15 },
    ],
  },
];

export const DIAGNOSTICO_SOLIDEZ_TIERS: { min: number; name: string; desc: string }[] = [
  { min: 85, name: "Estructura financiera sólida", desc: "Tienes muy buenos fundamentos. El objetivo ahora es optimizar y mantener tu estrategia actual." },
  { min: 70, name: "Buena estructura con oportunidades", desc: "Tienes bases importantes construidas, aunque existen áreas que podrían fortalecerse." },
  { min: 50, name: "Estructura en desarrollo", desc: "Has tomado buenas decisiones, pero todavía hay vulnerabilidades que merece la pena revisar." },
  {
    min: 0,
    name: "Estructura por construir",
    desc: "Varias áreas de tu planificación todavía dependen demasiado de tus ingresos futuros o de circunstancias externas. Es un buen momento para empezar a estructurarlas.",
  },
];

const DIAGNOSTICO_SOLIDEZ_WEIGHTS: Record<string, number> = { proteccion: 1.2, salud: 1.1, retiro: 1.2, liquidez: 1, patrimonio: 1, fiscal: 0.9 };

export function getDiagnosticoSolidezTier(overall: number) {
  return DIAGNOSTICO_SOLIDEZ_TIERS.find((t) => overall >= t.min) ?? DIAGNOSTICO_SOLIDEZ_TIERS[DIAGNOSTICO_SOLIDEZ_TIERS.length - 1];
}

/** Resuelve el valor numérico (`v`) de una respuesta de texto contra la
 * pregunta correspondiente — el cliente nunca manda `v` ni el índice de
 * opción elegido, solo el texto ya elegido (`respuesta`), así que hay que
 * volver a matchearlo. Devuelve `null` si el texto no matchea ninguna
 * opción conocida (respuesta corrupta/desactualizada) — ese ítem se excluye
 * del promedio en vez de contarlo como 0, para no penalizar por un dato que
 * no se pudo interpretar. */
function resolveAnswerValue(question: DiagnosticoSolidezQuestion, respuesta: string): number | null {
  if (question.type === "scale") {
    const n = Number(respuesta.split("/")[0]);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? ((n - 1) / 4) * 100 : null;
  }
  const opt = question.opts?.find((o) => o.t === respuesta);
  return opt ? opt.v : null;
}

export interface DiagnosticoSolidezAnswerInput {
  dim: string;
  respuesta: string;
}

export interface DiagnosticoSolidezScoreResult {
  scores: Record<string, number>;
  overall: number;
  answers: { question: string; dim: string; dimLabel: string; respuesta: string }[];
  areasAtencion: { dim: string; dimLabel: string; score: number }[];
  fortalezaPrincipal: { dim: string; dimLabel: string; score: number } | null;
}

/** Espejo exacto de `computeScores()` en diagnosticoSolidezTemplate.ts —
 * misma aritmética (promedio simple por dimensión, promedio ponderado para
 * `overall`) — pero partiendo de las respuestas en TEXTO que manda el
 * cliente (`respuestas: {dim, respuesta}[]`, en el mismo orden que
 * DIAGNOSTICO_SOLIDEZ_QUESTIONS) en vez del `v` numérico que el propio
 * cliente ya había calculado — así el resultado guardado nunca depende de
 * un `scores`/`overall` que el visitante pudo haber alterado en el
 * navegador antes de enviarlo. */
export function computeDiagnosticoSolidezScore(rawAnswers: DiagnosticoSolidezAnswerInput[]): DiagnosticoSolidezScoreResult {
  const buckets: Record<string, number[]> = {};
  const answers: DiagnosticoSolidezScoreResult["answers"] = [];

  DIAGNOSTICO_SOLIDEZ_QUESTIONS.forEach((question, i) => {
    const raw = rawAnswers[i];
    if (!raw || typeof raw.respuesta !== "string") return;
    const value = resolveAnswerValue(question, raw.respuesta);
    if (value !== null) {
      (buckets[question.dim] ??= []).push(value);
    }
    answers.push({
      question: question.q,
      dim: question.dim,
      dimLabel: DIAGNOSTICO_SOLIDEZ_DIMS[question.dim] ?? question.dim,
      respuesta: raw.respuesta,
    });
  });

  const scores: Record<string, number> = {};
  Object.keys(DIAGNOSTICO_SOLIDEZ_DIMS).forEach((dim) => {
    const bucket = buckets[dim] ?? [];
    scores[dim] = bucket.length > 0 ? Math.round(bucket.reduce((sum, v) => sum + v, 0) / bucket.length) : 0;
  });

  let num = 0;
  let den = 0;
  Object.keys(scores).forEach((dim) => {
    const weight = DIAGNOSTICO_SOLIDEZ_WEIGHTS[dim] ?? 1;
    num += scores[dim] * weight;
    den += 100 * weight;
  });
  const overall = den > 0 ? Math.round((num / den) * 100) : 0;

  const ranked = Object.entries(scores)
    .map(([dim, score]) => ({ dim, dimLabel: DIAGNOSTICO_SOLIDEZ_DIMS[dim] ?? dim, score }))
    .sort((a, b) => a.score - b.score);

  return {
    scores,
    overall,
    answers,
    areasAtencion: ranked.slice(0, 2),
    fortalezaPrincipal: ranked.length > 0 ? ranked[ranked.length - 1] : null,
  };
}
