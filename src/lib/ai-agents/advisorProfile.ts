import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getOpenRouterCredentials, complete } from "@/lib/integrations/openrouter";

/** Fase 9 (Análisis del asesor) — analiza mensajes REALES que un asesor
 * escribió (`messages.sender_type='agent'`, `direction='outbound'`,
 * `sender_id=su workspace_members.id`) y persiste un perfil de
 * comunicación/proceso comercial. `advisorId=null` = perfil "genérico del
 * workspace" (agrega mensajes de cualquier miembro), mismo fallback que ya
 * usa `ai_agents.advisor_id`/decisionEngine.ts. Nunca inventa: si no hay
 * suficientes mensajes reales, tira un error explícito en vez de generar un
 * perfil con datos fabricados. */

export interface AdvisorProfile {
  id: string;
  workspaceId: string;
  advisorId: string | null;
  communicationStyle: string | null;
  tone: string | null;
  messageLength: string | null;
  emojiUsage: string | null;
  questioningStyle: string | null;
  salesProcess: string[];
  objectionHandling: string | null;
  followUpStyle: string | null;
  appointmentStyle: string | null;
  learnedPatterns: string[];
  analyzedMessageCount: number;
  analyzedAt: string | null;
}

const MIN_MESSAGES_TO_ANALYZE = 20;
const MAX_MESSAGES_TO_ANALYZE = 150;

function mapProfileRow(row: Record<string, unknown>): AdvisorProfile {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    advisorId: (row.advisor_id as string | null) ?? null,
    communicationStyle: (row.communication_style as string | null) ?? null,
    tone: (row.tone as string | null) ?? null,
    messageLength: (row.message_length as string | null) ?? null,
    emojiUsage: (row.emoji_usage as string | null) ?? null,
    questioningStyle: (row.questioning_style as string | null) ?? null,
    salesProcess: (row.sales_process as string[]) ?? [],
    objectionHandling: (row.objection_handling as string | null) ?? null,
    followUpStyle: (row.follow_up_style as string | null) ?? null,
    appointmentStyle: (row.appointment_style as string | null) ?? null,
    learnedPatterns: (row.learned_patterns as string[]) ?? [],
    analyzedMessageCount: (row.analyzed_message_count as number) ?? 0,
    analyzedAt: (row.analyzed_at as string | null) ?? null,
  };
}

export async function getAdvisorProfile(workspaceId: string, advisorId: string | null): Promise<AdvisorProfile | null> {
  const supabase = createServiceRoleClient();
  const query = supabase.from("advisor_profiles").select("*").eq("workspace_id", workspaceId);
  const { data } = await (advisorId ? query.eq("advisor_id", advisorId) : query.is("advisor_id", null)).maybeSingle();
  return data ? mapProfileRow(data) : null;
}

interface RawAnalysis {
  communication_style?: string | null;
  tone?: string | null;
  message_length?: string | null;
  emoji_usage?: string | null;
  questioning_style?: string | null;
  sales_process?: string[];
  objection_handling?: string | null;
  follow_up_style?: string | null;
  appointment_style?: string | null;
  learned_patterns?: string[];
}

const ANALYSIS_SYSTEM_PROMPT = `Sos un analista de estilo de venta por WhatsApp. Te paso una muestra de mensajes REALES que un asesor comercial escribió a sus clientes/prospectos — nunca inventes nada que no se desprenda de los mensajes. Analizá cómo se comunica y devolvé EXCLUSIVAMENTE un JSON con esta forma exacta, sin texto adicional ni explicaciones:

{
  "communication_style": "resumen breve, ej: informal, cercano, directo",
  "tone": "tono predominante",
  "message_length": "cortos" | "medios" | "largos",
  "emoji_usage": "ninguno" | "bajo" | "medio" | "alto",
  "questioning_style": "poco" | "moderado" | "frecuente",
  "sales_process": ["paso 1", "paso 2", "..."],
  "objection_handling": "cómo maneja objeciones, en una o dos oraciones",
  "follow_up_style": "cómo y cuándo hace seguimiento",
  "appointment_style": "cómo pide/propone la cita o llamada",
  "learned_patterns": ["patrón observado 1", "patrón observado 2"]
}

Si algo no se puede inferir de los mensajes, usá null en ese campo — nunca inventes. "sales_process" y "learned_patterns" son arrays, pueden ir vacíos si no hay evidencia suficiente.`;

export async function analyzeAdvisor(workspaceId: string, advisorId: string | null): Promise<AdvisorProfile> {
  const supabase = createServiceRoleClient();

  const messagesQuery = supabase
    .from("messages")
    .select("content")
    .eq("workspace_id", workspaceId)
    .eq("sender_type", "agent")
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES_TO_ANALYZE);
  const { data: messageRows } = await (advisorId ? messagesQuery.eq("sender_id", advisorId) : messagesQuery);

  const bodies = (messageRows ?? [])
    .map((m) => (m.content as { body?: string } | null)?.body?.trim())
    .filter((b): b is string => !!b);

  if (bodies.length < MIN_MESSAGES_TO_ANALYZE) {
    throw new Error(`Todavía no hay suficientes conversaciones reales para analizar (${bodies.length}/${MIN_MESSAGES_TO_ANALYZE} mensajes mínimos).`);
  }

  const credentials = await getOpenRouterCredentials(supabase, workspaceId);
  if (!credentials) throw new Error("Este workspace todavía no tiene una API Key de OpenRouter conectada (Perfil → Integraciones).");

  const result = await complete({
    apiKey: credentials.apiKey,
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: bodies.map((b, i) => `[${i + 1}] ${b}`).join("\n") },
    ],
    tools: [],
    models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"],
    temperature: 0.3,
    maxTokens: 800,
  });

  const raw = result.message?.content?.trim();
  if (!raw) throw new Error("El modelo no devolvió ningún análisis.");

  let parsed: RawAnalysis;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as RawAnalysis;
  } catch {
    throw new Error("No se pudo interpretar el análisis del modelo.");
  }

  const profileData = {
    workspace_id: workspaceId,
    advisor_id: advisorId,
    communication_style: parsed.communication_style ?? null,
    tone: parsed.tone ?? null,
    message_length: parsed.message_length ?? null,
    emoji_usage: parsed.emoji_usage ?? null,
    questioning_style: parsed.questioning_style ?? null,
    sales_process: Array.isArray(parsed.sales_process) ? parsed.sales_process : [],
    objection_handling: parsed.objection_handling ?? null,
    follow_up_style: parsed.follow_up_style ?? null,
    appointment_style: parsed.appointment_style ?? null,
    learned_patterns: Array.isArray(parsed.learned_patterns) ? parsed.learned_patterns : [],
    analyzed_message_count: bodies.length,
    analyzed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const existingQuery = supabase.from("advisor_profiles").select("id").eq("workspace_id", workspaceId);
  const { data: existing } = await (advisorId ? existingQuery.eq("advisor_id", advisorId) : existingQuery.is("advisor_id", null)).maybeSingle();

  const { data: saved, error } = existing
    ? await supabase.from("advisor_profiles").update(profileData).eq("id", existing.id).select("*").single()
    : await supabase.from("advisor_profiles").insert(profileData).select("*").single();
  if (error || !saved) throw new Error("No se pudo guardar el perfil del asesor.");

  return mapProfileRow(saved);
}
