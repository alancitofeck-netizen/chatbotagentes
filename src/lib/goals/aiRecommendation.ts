import "server-only";
import { complete } from "@/lib/integrations/openrouter";
import { GOAL_METRIC_META, type GoalMetricKey } from "@/lib/goals/constants";
import { paceLabel, type PaceStatus } from "@/lib/goals/projections";

const MODEL_CHAIN = ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"];

/** Único llamado a IA de todo el módulo — genera el texto de la
 * recomendación accionable a partir de números YA calculados de forma
 * determinística (goals/projections.ts). El modelo nunca decide si vas a
 * llegar o no, ni inventa un porcentaje: solo redacta qué hacer dado el
 * ritmo real. Mismo criterio que el resto de la app (Cobranza, Pólizas,
 * Asesoría Guiada). */
export async function generateGoalRecommendation(
  apiKey: string,
  input: {
    goalName: string;
    metricKey: GoalMetricKey;
    currentValue: number;
    targetValue: number;
    daysRemaining: number;
    paceStatus: PaceStatus;
    projectedValue: number;
  },
): Promise<string> {
  const meta = GOAL_METRIC_META[input.metricKey];
  const context = [
    `Objetivo: ${input.goalName}`,
    `Métrica: ${meta.label}`,
    `Avance actual: ${input.currentValue}`,
    `Objetivo total: ${input.targetValue}`,
    `Días restantes: ${input.daysRemaining}`,
    `Ritmo: ${paceLabel(input.paceStatus)}`,
    `Proyección al ritmo actual: ${input.projectedValue}`,
  ].join("\n");

  const result = await complete({
    apiKey,
    models: MODEL_CHAIN,
    temperature: 0.5,
    tools: [],
    messages: [
      {
        role: "system",
        content:
          "Sos un coach comercial para asesores de seguros en Argentina/LatAm. Te doy el avance real de un objetivo (ya calculado, no lo recalcules) y escribís UNA recomendación corta y accionable (1-2 oraciones) sobre qué hacer para llegar. Nunca inventes un porcentaje de probabilidad ni datos que no te di — basate solo en los números reales que te paso. Tono motivador pero honesto, no exageres si va atrasado.",
      },
      { role: "user", content: context },
    ],
  });

  return result.message?.content?.trim() || "";
}
