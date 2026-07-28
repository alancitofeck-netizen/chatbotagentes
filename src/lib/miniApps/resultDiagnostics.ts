/**
 * Presentation-only diagnostics for the results screen — preparation level
 * and the strengths/opportunities lists. Deliberately separate from
 * financialEngine.ts: these functions never touch the actual retirement
 * math, they only classify/narrate numbers financialEngine.ts already
 * produced. Pure, no I/O, safe for a client bundle.
 */

export type PreparationLevel = "excelente" | "media" | "mejorable" | "riesgo";

export interface PreparationInput {
  aniosParaRetiro: number;
  ahorroMensual: number;
  /** Coverage of the RECOMMENDED income, 0-200ish — null when the visitor
   * didn't share their current income (no gap could be computed). */
  replacementPct: number | null;
}

export interface PreparationResult {
  level: PreparationLevel;
  emoji: string;
  label: string;
  reason: string;
}

export function getPreparationLevel({ aniosParaRetiro, ahorroMensual, replacementPct }: PreparationInput): PreparationResult {
  if (replacementPct !== null) {
    if (replacementPct >= 90) {
      return {
        level: "excelente",
        emoji: "🟢",
        label: "Muy bien preparado",
        reason: `Tu proyección cubre el ${replacementPct}% de lo recomendado para tu retiro.`,
      };
    }
    if (replacementPct >= 70) {
      return {
        level: "media",
        emoji: "🟡",
        label: "Preparación media",
        reason: `Estás cubriendo el ${replacementPct}% de lo recomendado — todavía queda una parte de la diferencia por cerrar.`,
      };
    }
    if (replacementPct >= 50) {
      return {
        level: "mejorable",
        emoji: "🟠",
        label: "Necesita mejorar",
        reason: `Tu proyección cubre solo el ${replacementPct}% de lo recomendado para mantener tu ritmo de vida.`,
      };
    }
    return {
      level: "riesgo",
      emoji: "🔴",
      label: "Riesgo alto",
      reason: `Tu proyección cubre apenas el ${replacementPct}% de lo recomendado — hoy hay una brecha importante.`,
    };
  }

  // Sin ingreso actual no hay % de cobertura — se estima con años restantes y
  // ahorro mensual, para que el nivel siempre exista.
  if (aniosParaRetiro >= 20 && ahorroMensual >= 6000) {
    return {
      level: "excelente",
      emoji: "🟢",
      label: "Muy bien preparado",
      reason: `Te quedan ${aniosParaRetiro} años para capitalizar tu ahorro y ya estás aportando un buen monto mensual.`,
    };
  }
  if (aniosParaRetiro >= 10 && ahorroMensual >= 3000) {
    return {
      level: "media",
      emoji: "🟡",
      label: "Preparación media",
      reason: "Vas por buen camino, aunque todavía hay margen para acelerar tu plan.",
    };
  }
  if (aniosParaRetiro >= 5) {
    return {
      level: "mejorable",
      emoji: "🟠",
      label: "Necesita mejorar",
      reason: `Con ${aniosParaRetiro} años por delante, conviene revisar tu estrategia de ahorro cuanto antes.`,
    };
  }
  return {
    level: "riesgo",
    emoji: "🔴",
    label: "Riesgo alto",
    reason: "Con poco tiempo restante y un ahorro acotado, tu plan actual podría no ser suficiente.",
  };
}

export interface StrengthsOpportunitiesInput {
  aniosParaRetiro: number;
  ahorroMensual: number;
  replacementPct: number | null;
}

export interface StrengthsOpportunitiesResult {
  strengths: string[];
  opportunities: string[];
}

export function getStrengthsAndOpportunities({
  aniosParaRetiro,
  ahorroMensual,
  replacementPct,
}: StrengthsOpportunitiesInput): StrengthsOpportunitiesResult {
  const strengths: string[] = [];
  const opportunities: string[] = [];

  if (aniosParaRetiro >= 15) strengths.push("Empezaste a planificar con tiempo de sobra a tu favor.");
  if (ahorroMensual >= 6000) strengths.push("Ya realizás un ahorro mensual constante y significativo.");
  if (replacementPct !== null && replacementPct >= 90) strengths.push("Tu proyección ya cubre lo recomendado para tu retiro.");

  if (aniosParaRetiro < 10) opportunities.push("Te queda poco tiempo para aprovechar el interés compuesto — cada año cuenta.");
  if (ahorroMensual < 3000) opportunities.push("Tu ahorro mensual todavía es bajo respecto a la meta recomendada.");
  if (replacementPct !== null && replacementPct < 70) opportunities.push("Hay una diferencia importante entre lo que necesitarías y tu pensión estimada.");

  if (strengths.length === 0) strengths.push("Ya diste el primer paso: simulaste tu retiro y sabés en qué punto estás parado.");
  if (opportunities.length === 0) opportunities.push("Revisar tu plan cada año te ayuda a mantenerlo alineado a tus metas.");

  return { strengths, opportunities };
}
