import "server-only";
import { complete, type OpenRouterToolDef } from "@/lib/integrations/openrouter";
import type { AdvisorySessionDetail } from "@/lib/advisorySessions/queries";

const MODEL_CHAIN = ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"];

export interface AdvisorySessionAnalysis {
  summary: string;
  risks: string[];
  recommendedProducts: string[];
  opportunities: string[];
  objections: { objection: string; suggestedResponse: string }[];
}

/** Mismo criterio que policies/aiAnalysis.ts: nada de puntajes/probabilidades
 * numéricas fabricadas — todo es texto cualitativo generado a partir de las
 * respuestas reales del cliente. */
const ANALYSIS_TOOL: OpenRouterToolDef = {
  type: "function",
  function: {
    name: "analyze_advisory_session",
    description: "Analiza las respuestas de una asesoría de seguros y devuelve un perfil, riesgos, productos recomendados, oportunidades y objeciones posibles.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Resumen de 2-3 oraciones del perfil del cliente, en lenguaje simple." },
        risks: {
          type: "array",
          items: { type: "string" },
          description: "Riesgos o vacíos de protección detectados a partir de las respuestas (ej. sin seguro de vida, sin ahorro). Vacío si no hay ninguno evidente.",
        },
        recommendedProducts: {
          type: "array",
          items: { type: "string" },
          description: "Productos de seguro que tendría sentido ofrecerle a este cliente, basado en su perfil y lo que ya tiene.",
        },
        opportunities: {
          type: "array",
          items: { type: "string" },
          description: "Oportunidades comerciales (venta cruzada, paquetes, beneficios fiscales) — texto cualitativo, nunca un porcentaje o puntaje.",
        },
        objections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              objection: { type: "string", description: "Una objeción probable del cliente (ej. precio, tiempo, comparación con competencia)." },
              suggestedResponse: { type: "string", description: "Una respuesta sugerida para el asesor ante esa objeción." },
            },
            required: ["objection", "suggestedResponse"],
          },
        },
      },
      required: ["summary", "risks", "recommendedProducts", "opportunities", "objections"],
    },
  },
};

function buildSessionContext(session: AdvisorySessionDetail): string {
  const lines: string[] = [];
  if (session.contactName) lines.push(`Cliente: ${session.contactName}`);

  const profileEntries = Object.entries(session.profileData).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (profileEntries.length) lines.push(`Perfil:\n${profileEntries.map(([k, v]) => `- ${k}: ${v}`).join("\n")}`);

  const discoveryEntries = Object.entries(session.discoveryData).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (discoveryEntries.length) lines.push(`Descubrimiento:\n${discoveryEntries.map(([k, v]) => `- ${k}: ${v}`).join("\n")}`);

  if (session.branchKey) lines.push(`Ramo de interés: ${session.branchKey}`);
  const branchEntries = Object.entries(session.branchAnswers).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (branchEntries.length) lines.push(`Respuestas del ramo:\n${branchEntries.map(([k, v]) => `- ${k}: ${v}`).join("\n")}`);

  return lines.join("\n\n") || "Sin datos cargados todavía.";
}

export async function analyzeAdvisorySessionWithAI(apiKey: string, session: AdvisorySessionDetail): Promise<AdvisorySessionAnalysis> {
  const context = buildSessionContext(session);

  const result = await complete({
    apiKey,
    models: MODEL_CHAIN,
    temperature: 0.4,
    tools: [ANALYSIS_TOOL],
    messages: [
      {
        role: "system",
        content:
          "Sos un asistente comercial experto en seguros para brokers en Argentina/LatAm, acompañando a un asesor durante una reunión en vivo con un cliente. Analizás las respuestas reales recopiladas y llamás a analyze_advisory_session. Nunca inventes datos que no están en el contexto. Nunca des un porcentaje o puntaje numérico de probabilidad — no tenés forma de calcularlo con precisión, así que das solo razones cualitativas.",
      },
      { role: "user", content: `Datos recopilados en la reunión:\n\n${context}` },
    ],
  });

  const call = result.toolCalls[0];
  if (!call) throw new Error("El modelo no devolvió un análisis estructurado.");

  let parsed: Partial<AdvisorySessionAnalysis>;
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch {
    throw new Error("No se pudo interpretar la respuesta de la IA.");
  }

  return {
    summary: parsed.summary ?? "",
    risks: parsed.risks ?? [],
    recommendedProducts: parsed.recommendedProducts ?? [],
    opportunities: parsed.opportunities ?? [],
    objections: parsed.objections ?? [],
  };
}
