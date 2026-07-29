/**
 * Presentation-only diagnostics for the results screen — preparation level,
 * strengths/opportunities, executive summary and personalized
 * recommendation. Deliberately separate from financialEngine.ts: these
 * functions never touch the actual retirement math, they only classify/
 * narrate numbers financialEngine.ts already produced. Pure, no I/O, safe
 * for a client bundle.
 *
 * Qualification answers (asked AFTER the initial simulation, during the
 * results reveal) flow into these same functions as an additional,
 * optional input so the diagnosis text is genuinely personalized — not
 * just financial-threshold-driven. Compositional by design (one
 * independently-chosen clause per answer, appended to the base
 * financial-level narrative) rather than a hand-authored cross-product of
 * every answer combination, which would not scale.
 */

export type PreparationLevel = "excelente" | "bueno" | "regular" | "atencion" | "riesgo";

/** Raw qualification answer CODES (not labels) — these are app-controlled
 * constants (see qualificationOptions.ts), stable enough to branch on
 * directly, same reliability as a label string but without needing to
 * reverse-parse human text. */
export interface QualificationAnswers {
  preocupacion: string | null;
  habloAsesor: string | null;
  objetivo: string | null;
  cuandoEmpezar: string | null;
}

/** One independent narrative clause per "mayor preocupación" answer —
 * appended to the base executive-summary paragraph. Returns null when
 * there's no answer yet (base paragraph stays alone) or the code doesn't
 * match a known option. */
export function getPreocupacionClause(preocupacion: string | null): string | null {
  switch (preocupacion) {
    case "pension_insuficiente":
      return "Tu principal preocupación era que tu pensión no alcance, y esta simulación confirma que hoy existe una brecha real entre lo proyectado y lo recomendado — es justo el punto en el que conviene enfocar tu plan.";
    case "retirarme_antes":
      return "Como te interesa retirarte antes de lo previsto, tené en cuenta que cada año que adelantás la fecha reduce tanto tus aportes totales como el tiempo de interés compuesto — vale la pena simular ese escenario puntual con más detalle.";
    case "solo_conocer":
      return "Ya que por ahora solo buscabas conocer tu situación, tomá este resultado como una foto de referencia — no hay ninguna urgencia en tomar decisiones todavía.";
    case "no_se_cuanto":
      return "Este resultado te da justamente lo que buscabas: un número claro sobre el cual empezar a planificar, en lugar de una incógnita.";
    case "proteger_familia":
      return "Ya que tu prioridad es proteger a tu familia, además del monto acumulado conviene revisar coberturas y beneficiarios como parte de tu plan de retiro.";
    default:
      return null;
  }
}

function getObjetivoClauseText(objetivo: string | null): string {
  switch (objetivo) {
    case "mejorar_retiro":
      return "mejorar tu ingreso durante el retiro";
    case "reducir_impuestos":
      return "reducir impuestos en tu estrategia de ahorro";
    case "invertir_mejor":
      return "invertir mejor el dinero que ya estás ahorrando";
    case "proteger_patrimonio":
      return "proteger tu patrimonio a largo plazo";
    case "no_seguro":
      return "conocer mejor tus opciones antes de decidir";
    default:
      return "mejorar tu situación financiera de cara al retiro";
  }
}

function getUrgenciaClauseText(cuandoEmpezar: string | null): string {
  switch (cuandoEmpezar) {
    case "esta_semana":
      return "estás dispuesto a actuar cuanto antes, esta misma semana";
    case "este_mes":
      return "planeás avanzar con esto durante este mes";
    case "mas_adelante":
      return "por ahora preferís tomarte tu tiempo antes de avanzar";
    default:
      return "";
  }
}

const LEVEL_SUMMARY_INTRO: Record<PreparationLevel, string> = {
  excelente: "Tu proyección de retiro hoy es excelente.",
  bueno: "Tu proyección de retiro va por buen camino.",
  regular: "Con tu ritmo de ahorro actual vas por un camino razonable, pero todavía hay margen para mejorar el resultado.",
  atencion: "Tu proyección de retiro necesita atención — todavía estás a tiempo de corregir el rumbo.",
  riesgo: "Tu proyección de retiro muestra un riesgo importante que conviene abordar cuanto antes.",
};

export interface PreparationInput {
  aniosParaRetiro: number;
  ahorroMensual: number;
  /** Coverage of the RECOMMENDED income, 0-200ish — null when the visitor
   * didn't share their current income (no gap could be computed). */
  replacementPct: number | null;
}

export interface PreparationResult {
  level: PreparationLevel;
  /** 1-5, used to render the ⭐ rating — never a color, so this never
   * collides with the mini app's own palette. */
  stars: number;
  label: string;
  reason: string;
}

export function getPreparationLevel({ aniosParaRetiro, ahorroMensual, replacementPct }: PreparationInput): PreparationResult {
  if (replacementPct !== null) {
    if (replacementPct >= 95) {
      return { level: "excelente", stars: 5, label: "Excelente", reason: `Tu proyección cubre el ${replacementPct}% de lo recomendado para tu retiro.` };
    }
    if (replacementPct >= 80) {
      return { level: "bueno", stars: 4, label: "Bueno", reason: `Estás cubriendo el ${replacementPct}% de lo recomendado — vas bien encaminado.` };
    }
    if (replacementPct >= 60) {
      return {
        level: "regular",
        stars: 3,
        label: "Regular",
        reason: `Tu proyección cubre el ${replacementPct}% de lo recomendado — todavía queda una parte de la diferencia por cerrar.`,
      };
    }
    if (replacementPct >= 40) {
      return {
        level: "atencion",
        stars: 2,
        label: "Necesita atención",
        reason: `Tu proyección cubre solo el ${replacementPct}% de lo recomendado para mantener tu ritmo de vida.`,
      };
    }
    return {
      level: "riesgo",
      stars: 1,
      label: "Riesgo alto",
      reason: `Tu proyección cubre apenas el ${replacementPct}% de lo recomendado — hoy hay una brecha importante.`,
    };
  }

  // Sin ingreso actual no hay % de cobertura — se estima con años restantes y
  // ahorro mensual, para que el nivel siempre exista.
  if (aniosParaRetiro >= 25 && ahorroMensual >= 8000) {
    return { level: "excelente", stars: 5, label: "Excelente", reason: `Te quedan ${aniosParaRetiro} años para capitalizar tu ahorro y ya estás aportando un muy buen monto mensual.` };
  }
  if (aniosParaRetiro >= 18 && ahorroMensual >= 5000) {
    return { level: "bueno", stars: 4, label: "Bueno", reason: "Vas bien encaminado — el tiempo y tu ritmo de ahorro juegan a tu favor." };
  }
  if (aniosParaRetiro >= 10 && ahorroMensual >= 3000) {
    return { level: "regular", stars: 3, label: "Regular", reason: "Vas por buen camino, aunque todavía hay margen para acelerar tu plan." };
  }
  if (aniosParaRetiro >= 5) {
    return { level: "atencion", stars: 2, label: "Necesita atención", reason: `Con ${aniosParaRetiro} años por delante, conviene revisar tu estrategia de ahorro cuanto antes.` };
  }
  return {
    level: "riesgo",
    stars: 1,
    label: "Riesgo alto",
    reason: "Con poco tiempo restante y un ahorro acotado, tu plan actual podría no ser suficiente.",
  };
}

export interface StrengthsOpportunitiesInput {
  aniosParaRetiro: number;
  ahorroMensual: number;
  replacementPct: number | null;
  /** Cuánto mejoraría el fondo si se retrasa el retiro un año — permite
   * detectar la oportunidad "retrasar un poco el retiro mejoraría el
   * resultado" sin que este módulo tenga que llamar a simulateRetirement. */
  mejoraRetrasandoRetiroPct?: number;
  /** Respuestas de calificación — opcionales, agregan a lo sumo 1 línea
   * extra a cada lista, nunca reemplazan la lógica financiera existente. */
  qualification?: QualificationAnswers | null;
}

export interface StrengthsOpportunitiesResult {
  strengths: string[];
  opportunities: string[];
}

export function getStrengthsAndOpportunities({
  aniosParaRetiro,
  ahorroMensual,
  replacementPct,
  mejoraRetrasandoRetiroPct,
  qualification,
}: StrengthsOpportunitiesInput): StrengthsOpportunitiesResult {
  const strengths: string[] = [];
  const opportunities: string[] = [];

  if (aniosParaRetiro >= 15) strengths.push("Estás comenzando a planificar con tiempo — tu horizonte de inversión es favorable.");
  if (ahorroMensual >= 6000) strengths.push("Ya realizás aportaciones mensuales constantes y significativas.");
  if (replacementPct !== null && replacementPct >= 90) strengths.push("Tu proyección de crecimiento ya cubre lo recomendado para tu retiro.");

  if (aniosParaRetiro < 10) opportunities.push("Te queda poco tiempo para aprovechar el interés compuesto — cada año cuenta.");
  if (ahorroMensual < 3000) opportunities.push("Tu ahorro mensual todavía es bajo respecto a la meta recomendada.");
  if (replacementPct !== null && replacementPct < 70) opportunities.push("Existe una diferencia importante entre tu ingreso proyectado y el que necesitarías.");
  if (mejoraRetrasandoRetiroPct !== undefined && mejoraRetrasandoRetiroPct >= 8) {
    opportunities.push("Retrasar un poco tu retiro mejoraría considerablemente el resultado.");
  }

  if (qualification?.preocupacion === "pension_insuficiente") {
    opportunities.push("Tu inquietud principal —que la pensión no alcance— coincide con la brecha detectada en esta simulación.");
  }
  if (qualification?.habloAsesor === "no") {
    strengths.push("Este es tu primer acercamiento a asesoría de retiro — ya diste un paso que muchos posponen.");
  }

  if (strengths.length === 0) strengths.push("Ya diste el primer paso: simulaste tu retiro y sabés en qué punto estás parado.");
  if (opportunities.length === 0) opportunities.push("Tu estrategia actual podría optimizarse — revisarla con regularidad ayuda a mantenerla alineada a tus metas.");

  return { strengths, opportunities };
}

/** Dynamic paragraph for the "Resumen ejecutivo" card — never a fixed
 * string, always driven by the preparation tier, now optionally extended
 * with a clause driven by the qualification answers (once known). */
export function getExecutiveSummary(level: PreparationLevel, qualification?: QualificationAnswers | null): string {
  const base = (() => {
    switch (level) {
      case "excelente":
        return "Según la información que ingresaste, hoy vas por un excelente camino para construir un retiro sólido — mantener este ritmo es la mejor estrategia.";
      case "bueno":
        return "Según la información que ingresaste, hoy vas por un buen camino para construir un retiro sólido, aunque todavía existen oportunidades para mejorar significativamente el resultado.";
      case "regular":
        return "Según tus datos, tu plan de retiro va en una dirección razonable, pero hay varias decisiones que podrían mejorar bastante tu resultado final.";
      case "atencion":
        return "Según tus datos actuales, existe una probabilidad importante de que tus ingresos durante el retiro sean inferiores al estilo de vida que deseas mantener — todavía hay margen para corregirlo.";
      case "riesgo":
        return "Según tus datos actuales existe una probabilidad importante de que tus ingresos durante el retiro sean inferiores al estilo de vida que deseas mantener.";
    }
  })();
  const clause = getPreocupacionClause(qualification?.preocupacion ?? null);
  return clause ? `${base} ${clause}` : base;
}

/** Dynamic paragraph for the new "Resumen de tu diagnóstico" card — a
 * synthesis distinct from getExecutiveSummary's wording, weaving in
 * objetivo + urgencia. Never a fixed string. */
export function getDiagnosisSummary(level: PreparationLevel, qualification: QualificationAnswers | null): string {
  const base = LEVEL_SUMMARY_INTRO[level];
  const objetivoText = getObjetivoClauseText(qualification?.objetivo ?? null);
  const urgenciaText = getUrgenciaClauseText(qualification?.cuandoEmpezar ?? null);
  return `${base} Tu objetivo principal es ${objetivoText}${urgenciaText ? `, y ${urgenciaText}.` : "."}`;
}

export interface RecommendationInput {
  edad: number;
  aniosParaRetiro: number;
  ahorroMensual: number;
  stars: number;
  /** Código crudo de "mayor preocupación" — null si todavía no respondió. */
  preocupacion?: string | null;
}

/** One personalized recommendation, chosen by priority (más urgente
 * primero): cerca del retiro > quiere retirarse antes (intención explícita)
 * > aporta poco / riesgo estructural > proyección excelente > mayor de 55
 * (optimizar estrategia) > default (joven/tiempo a favor, resto de casos). */
export function getPersonalizedRecommendation({ edad, aniosParaRetiro, ahorroMensual, stars, preocupacion }: RecommendationInput): string {
  if (aniosParaRetiro <= 8) {
    return "Estás cerca del retiro: conviene revisar tu estrategia actual cuanto antes para asegurar el mejor resultado posible.";
  }
  if (preocupacion === "retirarme_antes") {
    return "Ya que buscás retirarte antes de lo previsto, conviene medir con precisión el impacto: cada año que adelantás la fecha achica tanto tus aportes totales como el tiempo de interés compuesto — antes de decidir, vale la pena simular ese escenario puntual con más detalle.";
  }
  if (stars <= 2 || ahorroMensual < 3000) {
    return "Tu aporte mensual es el punto con mayor impacto posible: incrementarlo, aunque sea gradualmente, puede cambiar mucho tu proyección.";
  }
  if (stars >= 4) {
    return "Tu plan ya va por muy buen camino: el foco ahora es consolidarlo y revisarlo con regularidad.";
  }
  if (edad > 55) {
    return "A tu edad, el mayor impacto no viene de sumar más años de ahorro, sino de optimizar la estrategia actual: revisar el tipo de instrumento, el nivel de riesgo y el momento exacto del retiro.";
  }
  return "Tenés tiempo de sobra a tu favor: aprovecharlo ahora es lo que más va a potenciar el interés compuesto en tu beneficio.";
}
