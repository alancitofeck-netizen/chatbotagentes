import "server-only";
import { complete, type OpenRouterToolDef } from "@/lib/integrations/openrouter";

/**
 * La función estrella del módulo: lee el texto de un PDF de póliza y le pide
 * a un modelo que devuelva los datos estructurados. Limitación de esta fase
 * (declarada al usuario): solo PDFs con capa de texto real — un PDF
 * escaneado (imagen pura) no tiene texto para extraer y esta función
 * devuelve muy poco o nada. Soporte de visión/OCR queda para una fase
 * posterior.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Import perezoso: pdf-parse ejecuta código a nivel de módulo que espera
  // un entorno Node completo (fs), y este archivo puede terminar bundleado
  // en contextos donde no hace falta pagar ese costo si nunca se llama.
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return result.text;
}

export interface ExtractedCoverage {
  name: string;
  sumInsured: number | null;
  deductible: string | null;
}

export interface ExtractedBeneficiary {
  name: string;
  relationship: string | null;
  percentage: number | null;
}

export interface ExtractedPolicyData {
  policyNumber: string | null;
  clientName: string | null;
  dni: string | null;
  cuit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  company: string | null;
  product: string | null;
  insuranceType: "auto" | "hogar" | "vida" | "otro";
  issueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  premium: number | null;
  premiumCurrency: string | null;
  commissionAmount: number | null;
  paymentFrequency: "mensual" | "trimestral" | "semestral" | "anual" | "unico" | null;
  sumInsured: number | null;
  deductible: string | null;
  coverages: ExtractedCoverage[];
  beneficiaries: ExtractedBeneficiary[];
  // Específicos por tipo — solo se completan los relevantes al insuranceType detectado.
  auto: { make: string | null; model: string | null; year: number | null; plate: string | null; vin: string | null; engine: string | null } | null;
  hogar: { address: string | null; squareMeters: number | null; propertyType: string | null } | null;
}

const EXTRACTION_TOOL: OpenRouterToolDef = {
  type: "function",
  function: {
    name: "extract_policy_data",
    description: "Extrae todos los datos estructurados de una póliza de seguro a partir de su texto.",
    parameters: {
      type: "object",
      properties: {
        policyNumber: { type: ["string", "null"] },
        clientName: { type: ["string", "null"] },
        dni: { type: ["string", "null"] },
        cuit: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
        company: { type: ["string", "null"] },
        product: { type: ["string", "null"] },
        insuranceType: { type: "string", enum: ["auto", "hogar", "vida", "otro"] },
        issueDate: { type: ["string", "null"], description: "Formato YYYY-MM-DD" },
        startDate: { type: ["string", "null"], description: "Formato YYYY-MM-DD" },
        endDate: { type: ["string", "null"], description: "Formato YYYY-MM-DD" },
        premium: { type: ["number", "null"] },
        premiumCurrency: { type: ["string", "null"], description: "Ej. USD, ARS" },
        commissionAmount: { type: ["number", "null"] },
        paymentFrequency: { type: ["string", "null"], enum: ["mensual", "trimestral", "semestral", "anual", "unico", null] },
        sumInsured: { type: ["number", "null"] },
        deductible: { type: ["string", "null"] },
        coverages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              sumInsured: { type: ["number", "null"] },
              deductible: { type: ["string", "null"] },
            },
            required: ["name"],
          },
        },
        beneficiaries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              relationship: { type: ["string", "null"] },
              percentage: { type: ["number", "null"] },
            },
            required: ["name"],
          },
        },
        auto: {
          type: ["object", "null"],
          properties: {
            make: { type: ["string", "null"] },
            model: { type: ["string", "null"] },
            year: { type: ["number", "null"] },
            plate: { type: ["string", "null"] },
            vin: { type: ["string", "null"] },
            engine: { type: ["string", "null"] },
          },
        },
        hogar: {
          type: ["object", "null"],
          properties: {
            address: { type: ["string", "null"] },
            squareMeters: { type: ["number", "null"] },
            propertyType: { type: ["string", "null"] },
          },
        },
      },
      required: ["insuranceType", "coverages", "beneficiaries"],
    },
  },
};

const MODEL_CHAIN = ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"];

/** Trunca a un tamaño razonable de contexto — una póliza real rara vez supera
 * unas pocas páginas; esto es una salvaguarda contra un PDF anormalmente
 * largo, no un límite esperado en el uso normal. */
const MAX_TEXT_CHARS = 24000;

export async function extractPolicyDataWithAI(apiKey: string, pdfText: string): Promise<ExtractedPolicyData> {
  const truncated = pdfText.slice(0, MAX_TEXT_CHARS);

  const result = await complete({
    apiKey,
    models: MODEL_CHAIN,
    temperature: 0,
    tools: [EXTRACTION_TOOL],
    messages: [
      {
        role: "system",
        content:
          "Sos un asistente experto en pólizas de seguro para brokers en Argentina/LatAm. Leé el texto de la póliza y llamá a extract_policy_data con TODOS los datos que puedas identificar. Si un dato no aparece en el texto, dejalo en null — nunca inventes valores. Las fechas siempre en formato YYYY-MM-DD.",
      },
      { role: "user", content: `Texto de la póliza:\n\n${truncated}` },
    ],
  });

  const call = result.toolCalls[0];
  if (!call) throw new Error("El modelo no devolvió datos estructurados — probá con otro PDF o cargá la póliza manualmente.");

  let parsed: Partial<ExtractedPolicyData>;
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch {
    throw new Error("No se pudo interpretar la respuesta de la IA.");
  }

  return {
    policyNumber: parsed.policyNumber ?? null,
    clientName: parsed.clientName ?? null,
    dni: parsed.dni ?? null,
    cuit: parsed.cuit ?? null,
    email: parsed.email ?? null,
    phone: parsed.phone ?? null,
    address: parsed.address ?? null,
    company: parsed.company ?? null,
    product: parsed.product ?? null,
    insuranceType: parsed.insuranceType ?? "otro",
    issueDate: parsed.issueDate ?? null,
    startDate: parsed.startDate ?? null,
    endDate: parsed.endDate ?? null,
    premium: parsed.premium ?? null,
    premiumCurrency: parsed.premiumCurrency ?? null,
    commissionAmount: parsed.commissionAmount ?? null,
    paymentFrequency: parsed.paymentFrequency ?? null,
    sumInsured: parsed.sumInsured ?? null,
    deductible: parsed.deductible ?? null,
    coverages: parsed.coverages ?? [],
    beneficiaries: parsed.beneficiaries ?? [],
    auto: parsed.auto ?? null,
    hogar: parsed.hogar ?? null,
  };
}
