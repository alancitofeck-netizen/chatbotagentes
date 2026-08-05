import "server-only";
import { complete, type OpenRouterToolDef } from "@/lib/integrations/openrouter";
import type { PresentationDetail } from "@/lib/presentations/queries";
import { SLIDE_LABEL, type PresentationSlide } from "@/lib/presentations/constants";

const MODEL_CHAIN = ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"];

export interface PresentationAiContent {
  professionalBio: string;
  presentationText: string;
  personalStory: string;
  valueProposition: string;
  differentiators: string[];
  benefits: string[];
  callToAction: string;
  faqs: { question: string; answer: string }[];
  objections: { objection: string; response: string }[];
  impactPhrases: string[];
}

/** Mismo criterio que analyzeAdvisorySessionWithAI: todo texto cualitativo
 * generado a partir de datos reales cargados en los pasos previos, nunca un
 * puntaje/porcentaje fabricado. */
const CONTENT_TOOL: OpenRouterToolDef = {
  type: "function",
  function: {
    name: "generate_presentation_content",
    description: "Genera el contenido profesional de una presentación comercial para un asesor, a partir de su información personal y comercial.",
    parameters: {
      type: "object",
      properties: {
        professionalBio: { type: "string", description: "Biografía profesional de 3-4 oraciones, tono premium y cercano." },
        presentationText: { type: "string", description: "Texto de presentación corto para la portada — 1-2 oraciones de impacto." },
        personalStory: { type: "string", description: "Breve historia personal/profesional que genere conexión con el cliente." },
        valueProposition: { type: "string", description: "Propuesta de valor clara — qué resuelve este asesor y para quién." },
        differentiators: { type: "array", items: { type: "string" }, description: "3-5 diferenciales frente a otros asesores." },
        benefits: { type: "array", items: { type: "string" }, description: "3-5 beneficios concretos de trabajar con este asesor." },
        callToAction: { type: "string", description: "Llamado a la acción final, breve y directo." },
        faqs: {
          type: "array",
          items: {
            type: "object",
            properties: { question: { type: "string" }, answer: { type: "string" } },
            required: ["question", "answer"],
          },
          description: "3-5 preguntas frecuentes con su respuesta.",
        },
        objections: {
          type: "array",
          items: {
            type: "object",
            properties: { objection: { type: "string" }, response: { type: "string" } },
            required: ["objection", "response"],
          },
          description: "2-3 objeciones comunes de un prospecto y una respuesta sugerida.",
        },
        impactPhrases: { type: "array", items: { type: "string" }, description: "2-3 frases cortas de impacto para usar como títulos/citas dentro de la presentación." },
      },
      required: [
        "professionalBio",
        "presentationText",
        "personalStory",
        "valueProposition",
        "differentiators",
        "benefits",
        "callToAction",
        "faqs",
        "objections",
        "impactPhrases",
      ],
    },
  },
};

function buildContext(presentation: PresentationDetail): string {
  const lines: string[] = [];
  const p = presentation.personalInfo;
  const c = presentation.commercialInfo;

  const personalEntries = Object.entries(p).filter(([k, v]) => v !== null && v !== undefined && v !== "" && k !== "logoPath");
  if (personalEntries.length) lines.push(`Información personal/profesional:\n${personalEntries.map(([k, v]) => `- ${k}: ${v}`).join("\n")}`);

  const commercialEntries = Object.entries(c).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (commercialEntries.length) lines.push(`Información comercial:\n${commercialEntries.map(([k, v]) => `- ${k}: ${v}`).join("\n")}`);

  return lines.join("\n\n") || "Sin datos cargados todavía.";
}

function buildSlides(presentation: PresentationDetail, content: PresentationAiContent): PresentationSlide[] {
  const p = presentation.personalInfo;
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ") || presentation.title;

  const bodies: Record<string, string> = {
    portada: [fullName, p.profession, content.presentationText].filter(Boolean).join("\n"),
    sobre_mi: [content.professionalBio, content.personalStory].filter(Boolean).join("\n\n"),
    servicios: presentation.commercialInfo.services ?? "",
    beneficios: [content.valueProposition, ...content.benefits.map((b) => `• ${b}`)].filter(Boolean).join("\n"),
    casos_exito: presentation.commercialInfo.successCases ?? "",
    testimonios: content.differentiators.map((d) => `• ${d}`).join("\n"),
    contacto: [p.whatsapp, p.email, p.website, content.callToAction].filter(Boolean).join("\n"),
  };

  return Object.entries(SLIDE_LABEL).map(([key, title], i) => ({ key, title, body: bodies[key] ?? "", order: i }));
}

export async function generatePresentationContent(
  apiKey: string,
  presentation: PresentationDetail,
): Promise<{ aiContent: PresentationAiContent; slides: PresentationSlide[] }> {
  const context = buildContext(presentation);

  const result = await complete({
    apiKey,
    models: MODEL_CHAIN,
    temperature: 0.6,
    tools: [CONTENT_TOOL],
    messages: [
      {
        role: "system",
        content:
          "Sos un redactor experto en presentaciones comerciales premium para asesores de seguros/finanzas en Argentina/LatAm. Generás contenido profesional, cálido y creíble a partir de datos reales que te pasan — nunca inventás logros, certificaciones o cifras que no están en el contexto. Llamás a generate_presentation_content con el resultado.",
      },
      { role: "user", content: `Datos cargados por el asesor:\n\n${context}` },
    ],
  });

  const call = result.toolCalls[0];
  if (!call) throw new Error("El modelo no devolvió contenido estructurado.");

  let parsed: Partial<PresentationAiContent>;
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch {
    throw new Error("No se pudo interpretar la respuesta de la IA.");
  }

  const aiContent: PresentationAiContent = {
    professionalBio: parsed.professionalBio ?? "",
    presentationText: parsed.presentationText ?? "",
    personalStory: parsed.personalStory ?? "",
    valueProposition: parsed.valueProposition ?? "",
    differentiators: parsed.differentiators ?? [],
    benefits: parsed.benefits ?? [],
    callToAction: parsed.callToAction ?? "",
    faqs: parsed.faqs ?? [],
    objections: parsed.objections ?? [],
    impactPhrases: parsed.impactPhrases ?? [],
  };

  const slides = buildSlides(presentation, aiContent);
  return { aiContent, slides };
}
