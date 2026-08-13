import "server-only";
import { complete, type OpenRouterToolDef } from "@/lib/integrations/openrouter";

export interface ExtractedContractData {
  startDate: string | null;
  endDate: string | null;
  totalValue: number | null;
  monthlyValue: number | null;
  commissionModel: string | null;
  /** Nombres de campos (claves de ExtractedContractData) que el propio
   * modelo marcó como ambiguos/poco legibles/inferidos — mismo criterio que
   * ExtractedPolicyData.lowConfidenceFields (pdfExtraction.ts). Vacío si no
   * marcó ninguno. */
  lowConfidenceFields: string[];
}

const EXTRACTION_TOOL: OpenRouterToolDef = {
  type: "function",
  function: {
    name: "extract_contract_data",
    description: "Extrae los datos estructurados de un contrato de servicios a partir de su texto.",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: ["string", "null"], description: "Fecha de inicio del contrato, formato YYYY-MM-DD" },
        endDate: { type: ["string", "null"], description: "Fecha de finalización del contrato, formato YYYY-MM-DD" },
        totalValue: { type: ["number", "null"], description: "Valor total contratado, en la moneda que indique el contrato (solo el número)" },
        monthlyValue: { type: ["number", "null"], description: "Valor mensual, si el contrato es de pago recurrente (solo el número)" },
        commissionModel: { type: ["string", "null"], description: "Modelo de comisión descripto en el contrato, ej. '20% sobre pólizas cerradas'" },
        lowConfidenceFields: {
          type: "array",
          items: { type: "string" },
          description:
            "Nombres de campos (ej. 'endDate', 'totalValue') que llenaste pero no estás seguro de haber leído bien — texto borroso/ambiguo, o un valor inferido en vez de leído directamente. Vacío si estás seguro de todos.",
        },
      },
      required: ["lowConfidenceFields"],
    },
  },
};

const MODEL_CHAIN = ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"];

/** Trunca a un tamaño razonable de contexto — mismo criterio y mismo límite
 * que pdfExtraction.ts (un contrato real rara vez supera unas pocas
 * páginas). */
const MAX_TEXT_CHARS = 24000;

/** Recómputo NO incluido acá a propósito: la duración del contrato se sigue
 * calculando en la UI a partir de startDate/endDate (ContractPanel.tsx),
 * nunca se le pide a la IA — evita que devuelva una duración textual que no
 * coincida con las fechas realmente extraídas. */
export async function extractContractDataWithAI(apiKey: string, pdfText: string): Promise<ExtractedContractData> {
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
          "Sos un asistente experto en contratos de servicios entre una agencia y un asesor financiero/de seguros. Leé el texto del contrato y llamá a extract_contract_data con TODOS los datos que puedas identificar. Si un dato no aparece en el texto, dejalo en null — nunca inventes valores. Las fechas siempre en formato YYYY-MM-DD. En lowConfidenceFields listá el nombre de cada campo que llenaste pero del que no estás seguro (texto ambiguo, borroso, o un valor que tuviste que inferir en vez de leer directamente) — sé honesto, no lo dejes vacío solo por completar.",
      },
      { role: "user", content: `Texto del contrato:\n\n${truncated}` },
    ],
  });

  const call = result.toolCalls[0];
  if (!call) throw new Error("El modelo no devolvió datos estructurados — probá con otro PDF o cargá el contrato manualmente.");

  let parsed: Partial<ExtractedContractData>;
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch {
    throw new Error("No se pudo interpretar la respuesta de la IA.");
  }

  return {
    startDate: parsed.startDate ?? null,
    endDate: parsed.endDate ?? null,
    totalValue: parsed.totalValue ?? null,
    monthlyValue: parsed.monthlyValue ?? null,
    commissionModel: parsed.commissionModel ?? null,
    lowConfidenceFields: parsed.lowConfidenceFields ?? [],
  };
}
