import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ConversationLeadAnalysis {
  intencion: string | null;
  interes: "alto" | "medio" | "bajo" | null;
  necesidad: string | null;
  objeciones: string[];
  probabilidad: "alta" | "media" | "baja" | null;
}

export interface ConversationExtractedInfo {
  empresa: string | null;
  cargo: string | null;
  ciudad: string | null;
  necesidad: string | null;
  presupuesto: string | null;
}

export interface ConversationAiInsight {
  summary: string | null;
  nextStep: string | null;
  leadAnalysis: ConversationLeadAnalysis | null;
  extractedInfo: ConversationExtractedInfo | null;
  generatedAt: string | null;
}

const EMPTY_INSIGHT: ConversationAiInsight = { summary: null, nextStep: null, leadAnalysis: null, extractedInfo: null, generatedAt: null };

/** Solo lectura del caché (conversation_ai_insights) — NUNCA dispara una
 * llamada a OpenRouter, mismo criterio que getCachedAiManagerInsightsAction
 * (Asesores → Performance). La generación real vive en actions.ts. */
export async function getConversationAiInsight(workspaceId: string, conversationId: string): Promise<ConversationAiInsight> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversation_ai_insights")
    .select("summary, next_step, lead_analysis, extracted_info, generated_at")
    .eq("workspace_id", workspaceId)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (!data) return EMPTY_INSIGHT;
  return {
    summary: data.summary as string | null,
    nextStep: data.next_step as string | null,
    leadAnalysis: data.lead_analysis as ConversationLeadAnalysis | null,
    extractedInfo: data.extracted_info as ConversationExtractedInfo | null,
    generatedAt: data.generated_at as string | null,
  };
}
