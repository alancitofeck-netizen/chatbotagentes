/**
 * Presentation-only diagnostics for the results screen — preparation level,
 * strengths/opportunities, executive summary and personalized
 * recommendation. Deliberately separate from financialEngine.ts: these
 * functions never touch the actual retirement math, they only classify/
 * narrate numbers financialEngine.ts already produced. Pure, no I/O, safe
 * for a client bundle.
 */

export type PreparationLevel = "excelente" | "bueno" | "regular" | "atencion" | "riesgo";

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

  if (strengths.length === 0) strengths.push("Ya diste el primer paso: simulaste tu retiro y sabés en qué punto estás parado.");
  if (opportunities.length === 0) opportunities.push("Tu estrategia actual podría optimizarse — revisarla con regularidad ayuda a mantenerla alineada a tus metas.");

  return { strengths, opportunities };
}

/** Dynamic paragraph for the "Resumen ejecutivo" card — never a fixed
 * string, always driven by the preparation tier. */
export function getExecutiveSummary(level: PreparationLevel): string {
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
}

export interface RecommendationInput {
  aniosParaRetiro: number;
  ahorroMensual: number;
  stars: number;
}

/** One personalized recommendation, chosen by priority (más urgente primero):
 * cerca del retiro > aporta poco > ya bien encaminado > joven con tiempo a favor. */
export function getPersonalizedRecommendation({ aniosParaRetiro, ahorroMensual, stars }: RecommendationInput): string {
  if (aniosParaRetiro <= 8) {
    return "Estás cerca del retiro: conviene revisar tu estrategia actual cuanto antes para asegurar el mejor resultado posible.";
  }
  if (stars <= 2 || ahorroMensual < 3000) {
    return "Tu aporte mensual es el punto con mayor impacto posible: incrementarlo, aunque sea gradualmente, puede cambiar mucho tu proyección.";
  }
  if (stars >= 4) {
    return "Tu plan ya va por muy buen camino: el foco ahora es consolidarlo y revisarlo con regularidad.";
  }
  return "Tenés tiempo de sobra a tu favor: aprovecharlo ahora es lo que más va a potenciar el interés compuesto en tu beneficio.";
}
