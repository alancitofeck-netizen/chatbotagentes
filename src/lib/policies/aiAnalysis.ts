import "server-only";
import { complete, type OpenRouterToolDef } from "@/lib/integrations/openrouter";
import type { PolicyDetail, PolicyCoverage, ContactPolicySummary } from "@/lib/policies/queries";

const MODEL_CHAIN = ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"];

export interface PolicyAnalysis {
  summary: string;
  coverageExplanation: string;
  risks: string[];
  crossSellSuggestions: { product: string; reason: string }[];
  renewalSuggestion: string;
}

/** Sin puntaje/probabilidad numérica en crossSellSuggestions — a diferencia
 * de lo que pedía el spec original ("probabilidad de conversión"), eso
 * requeriría un modelo de scoring real entrenado con datos históricos de
 * conversión que no existe acá; inventar un número le daría al asesor una
 * falsa sensación de precisión. En cambio, el LLM da una razón cualitativa
 * basada en los datos reales de la póliza y del resto de la cartera del
 * cliente — mismo criterio que se usó al diseñar la Fase 1 del módulo. */
const ANALYSIS_TOOL: OpenRouterToolDef = {
  type: "function",
  function: {
    name: "analyze_policy",
    description: "Analiza una póliza de seguro y devuelve un resumen, explicación de coberturas, riesgos y sugerencias.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Resumen de 2-3 oraciones en lenguaje simple, sin jerga técnica." },
        coverageExplanation: { type: "string", description: "Qué cubre y qué no cubre esta póliza, explicado para el cliente." },
        risks: {
          type: "array",
          items: { type: "string" },
          description: "Riesgos o vacíos de cobertura detectados (ej. suma asegurada baja, sin cobertura de responsabilidad civil). Vacío si no hay ninguno evidente.",
        },
        crossSellSuggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product: { type: "string", description: "Producto o tipo de póliza complementaria sugerida." },
              reason: { type: "string", description: "Por qué tiene sentido para este cliente en particular." },
            },
            required: ["product", "reason"],
          },
          description: "Productos complementarios que podrían interesarle al cliente, basado en lo que ya tiene contratado. Vacío si no hay una sugerencia clara y justificada.",
        },
        renewalSuggestion: { type: "string", description: "Recomendación breve y accionable sobre la renovación de esta póliza." },
      },
      required: ["summary", "coverageExplanation", "risks", "crossSellSuggestions", "renewalSuggestion"],
    },
  },
};

function buildPolicyContext(policy: PolicyDetail, coverages: PolicyCoverage[], otherPolicies: ContactPolicySummary[]): string {
  const lines = [
    `Cliente: ${policy.contactName}`,
    `Aseguradora: ${policy.company}`,
    `Producto: ${policy.product ?? "sin especificar"}`,
    `Tipo: ${policy.insuranceType}`,
    `Estado: ${policy.status}`,
    policy.startDate ? `Inicio de vigencia: ${policy.startDate}` : null,
    policy.endDate ? `Vencimiento: ${policy.endDate}` : null,
    policy.premium !== null ? `Prima: ${policy.premium} ${policy.premiumCurrency}` : null,
    policy.sumInsured !== null ? `Suma asegurada: ${policy.sumInsured} ${policy.premiumCurrency}` : null,
    policy.deductible ? `Franquicia: ${policy.deductible}` : null,
  ].filter(Boolean);

  const coverageLines = coverages.length
    ? coverages.map((c) => `- ${c.name}${c.sumInsured !== null ? ` (suma: ${c.sumInsured})` : ""}`).join("\n")
    : "Sin coberturas detalladas cargadas.";

  const otherPoliciesLines = otherPolicies.length
    ? otherPolicies.map((p) => `- ${p.insuranceType} con ${p.company}${p.product ? ` (${p.product})` : ""}`).join("\n")
    : "No tiene otras pólizas activas registradas en el sistema.";

  return `${lines.join("\n")}\n\nCoberturas:\n${coverageLines}\n\nOtras pólizas del mismo cliente:\n${otherPoliciesLines}`;
}

export async function analyzePolicyWithAI(
  apiKey: string,
  policy: PolicyDetail,
  coverages: PolicyCoverage[],
  otherPolicies: ContactPolicySummary[],
): Promise<PolicyAnalysis> {
  const context = buildPolicyContext(policy, coverages, otherPolicies);

  const result = await complete({
    apiKey,
    models: MODEL_CHAIN,
    temperature: 0.3,
    tools: [ANALYSIS_TOOL],
    messages: [
      {
        role: "system",
        content:
          "Sos un asistente experto en seguros para brokers en Argentina/LatAm. Analizás una póliza con los datos reales que te pasan y llamás a analyze_policy. Nunca inventes datos que no están en el contexto (números de suma asegurada, coberturas específicas, etc.) — tus riesgos y sugerencias deben basarse solo en lo que ves. Nunca des un porcentaje o puntaje numérico de probabilidad — no tenés forma de calcularlo con precisión, así que solo das razones cualitativas.",
      },
      { role: "user", content: `Analizá esta póliza:\n\n${context}` },
    ],
  });

  const call = result.toolCalls[0];
  if (!call) throw new Error("El modelo no devolvió un análisis estructurado.");

  let parsed: Partial<PolicyAnalysis>;
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch {
    throw new Error("No se pudo interpretar la respuesta de la IA.");
  }

  return {
    summary: parsed.summary ?? "",
    coverageExplanation: parsed.coverageExplanation ?? "",
    risks: parsed.risks ?? [],
    crossSellSuggestions: parsed.crossSellSuggestions ?? [],
    renewalSuggestion: parsed.renewalSuggestion ?? "",
  };
}

const CHANNEL_LABEL = { email: "un email", whatsapp: "un mensaje de WhatsApp" } as const;

/** Genera el texto listo para copiar/enviar — nunca envía nada
 * automáticamente (mismo criterio que el motor de automatizaciones: el
 * asesor revisa y decide antes de mandar cualquier cosa a un cliente). */
export async function generateRenewalMessageWithAI(apiKey: string, policy: PolicyDetail, channel: "email" | "whatsapp"): Promise<string> {
  const context = buildPolicyContext(policy, [], []);

  const result = await complete({
    apiKey,
    models: MODEL_CHAIN,
    temperature: 0.5,
    tools: [],
    messages: [
      {
        role: "system",
        content: `Sos un asistente de un broker de seguros en Argentina/LatAm. Escribís ${CHANNEL_LABEL[channel]} corto, cordial y profesional para el cliente, invitándolo a renovar su póliza que está por vencer. ${
          channel === "whatsapp" ? "Tono cercano, sin asunto, listo para pegar en WhatsApp." : "Incluí un asunto en la primera línea con el formato 'Asunto: ...' y después el cuerpo del email."
        } No inventes datos que no te di.`,
      },
      { role: "user", content: `Datos de la póliza:\n\n${context}` },
    ],
  });

  return result.message?.content?.trim() || "";
}
