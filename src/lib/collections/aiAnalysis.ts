import "server-only";
import { complete } from "@/lib/integrations/openrouter";
import type { CollectionItem } from "@/lib/collections/queries";

const MODEL_CHAIN = ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"];
const CHANNEL_LABEL = { email: "un email", whatsapp: "un mensaje de WhatsApp" } as const;

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Genera el texto listo para copiar/enviar — nunca envía nada
 * automáticamente (mismo criterio que el motor de automatizaciones y que
 * generateRenewalMessageWithAI en Pólizas: el asesor revisa y decide antes
 * de mandar cualquier cosa a un cliente). Sin puntaje/probabilidad — el
 * único razonamiento cuantitativo de este módulo vive en insights.ts y es
 * 100% determinístico. */
export async function generateCollectionMessageWithAI(apiKey: string, item: CollectionItem, channel: "email" | "whatsapp"): Promise<string> {
  const overdue = item.status !== "pagado" && item.status !== "cancelado" && item.dueDate < new Date().toISOString().slice(0, 10);
  const context = [
    `Cliente: ${item.contactName}`,
    `Aseguradora/póliza: ${item.company}${item.policyNumber ? ` (póliza ${item.policyNumber})` : ""}`,
    `Monto: ${formatCurrency(item.amount, item.currency)}`,
    `Vencimiento: ${item.dueDate}${overdue ? " (ya vencido)" : ""}`,
    item.notes ? `Notas internas: ${item.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await complete({
    apiKey,
    models: MODEL_CHAIN,
    temperature: 0.5,
    tools: [],
    messages: [
      {
        role: "system",
        content: `Sos un asistente de un broker de seguros en Argentina/LatAm. Escribís ${CHANNEL_LABEL[channel]} corto, cordial y profesional para recordarle a un cliente un pago ${overdue ? "vencido" : "próximo a vencer"}. ${
          channel === "whatsapp" ? "Tono cercano, sin asunto, listo para pegar en WhatsApp." : "Incluí un asunto en la primera línea con el formato 'Asunto: ...' y después el cuerpo del email."
        } ${overdue ? "Sé firme pero respetuoso, sin sonar agresivo." : "Tono de recordatorio amable, no de reclamo."} No inventes datos que no te di (no menciones intereses, recargos ni consecuencias legales — no tenés esa información).`,
      },
      { role: "user", content: `Datos del cobro:\n\n${context}` },
    ],
  });

  return result.message?.content?.trim() || "";
}
