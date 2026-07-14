"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import {
  getAiAgentList,
  getAiAgentDetail,
  getAgentPrompts,
  getGlobalTools,
  getAgentToolIds,
  getAgentKnowledgeBase,
  getAgentTestRuns,
  getAgentMetrics,
  type BusinessHoursConfig,
  type ResponseMode,
} from "@/lib/ai-agents/queries";
import { getDocuments } from "@/lib/documents/queries";
import { ingestKnowledgeDocument } from "@/lib/ai-agents/knowledgeBase";
import { runSandboxTurn } from "@/lib/ai/agentRuntime";

const AI_AGENTS_PATH = "/crm";

async function getOwnAgent(workspaceId: string, agentId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("ai_agents").select("id, module_key, name").eq("id", agentId).eq("workspace_id", workspaceId).maybeSingle();
  return data;
}

export async function getAiAgentListAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getAiAgentList(workspaceId);
}

export async function getAiAgentDetailAction(agentId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getAiAgentDetail(workspaceId, agentId);
}

/** Crea el agente + un primer prompt en borrador — un agente sin ningún
 * prompt no tendría nada que activar nunca, así que se crea junto. */
export async function createAiAgent(input: { name: string; description: string; moduleKey: "crm" | "ats" }) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");

  const supabase = await createClient();
  const { data: agent, error } = await supabase
    .from("ai_agents")
    .insert({ workspace_id: workspaceId, module_key: input.moduleKey, name: input.name.trim(), description: input.description.trim() })
    .select("id")
    .single();
  if (error || !agent) throw new Error("No se pudo crear el agente.");

  await supabase.from("ai_prompts").insert({
    workspace_id: workspaceId,
    module_key: input.moduleKey,
    agent_id: agent.id,
    name: input.name.trim(),
    system_prompt: "",
    status: "draft",
    version: 1,
  });

  revalidatePath(AI_AGENTS_PATH);
  return { id: agent.id as string };
}

export async function updateAiAgentGeneral(
  agentId: string,
  input: {
    name: string;
    description: string;
    model: string;
    temperature: number;
    maxTokens: number;
    businessHours: BusinessHoursConfig;
    responseMode: ResponseMode;
  },
) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const target = await getOwnAgent(workspaceId, agentId);
  if (!target) throw new Error("Agente no encontrado en este workspace.");
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");

  const supabase = await createClient();
  await supabase
    .from("ai_agents")
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      model: input.model,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      business_hours: input.businessHours,
      response_mode: input.responseMode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId);

  revalidatePath(AI_AGENTS_PATH);
}

export async function toggleAiAgentStatus(agentId: string, status: "active" | "inactive") {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const target = await getOwnAgent(workspaceId, agentId);
  if (!target) throw new Error("Agente no encontrado en este workspace.");

  const supabase = await createClient();
  await supabase.from("ai_agents").update({ status }).eq("id", agentId);
  revalidatePath(AI_AGENTS_PATH);
}

export async function updateAiAgentChannels(agentId: string, channels: string[]) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const target = await getOwnAgent(workspaceId, agentId);
  if (!target) throw new Error("Agente no encontrado en este workspace.");

  const supabase = await createClient();
  await supabase.from("ai_agents").update({ channels }).eq("id", agentId);
  revalidatePath(AI_AGENTS_PATH);
}

/** Duplica el agente + su prompt más reciente + sus tools asignadas —
 * arranca en 'inactive' (nunca duplica un agente ya activo respondiendo). */
export async function duplicateAiAgent(agentId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();

  const { data: source } = await supabase.from("ai_agents").select("*").eq("id", agentId).eq("workspace_id", workspaceId).maybeSingle();
  if (!source) throw new Error("Agente no encontrado en este workspace.");

  const { data: newAgent, error } = await supabase
    .from("ai_agents")
    .insert({
      workspace_id: workspaceId,
      module_key: source.module_key,
      name: `${source.name} (copia)`,
      description: source.description,
      status: "inactive",
      channels: source.channels,
      model: source.model,
      temperature: source.temperature,
      max_tokens: source.max_tokens,
      business_hours: source.business_hours,
      response_mode: source.response_mode,
    })
    .select("id")
    .single();
  if (error || !newAgent) throw new Error("No se pudo duplicar el agente.");

  const { data: latestPrompt } = await supabase
    .from("ai_prompts")
    .select("name, system_prompt, variables, model_config")
    .eq("agent_id", agentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: newPrompt } = await supabase
    .from("ai_prompts")
    .insert({
      workspace_id: workspaceId,
      module_key: source.module_key,
      agent_id: newAgent.id,
      name: latestPrompt?.name ?? source.name,
      system_prompt: latestPrompt?.system_prompt ?? "",
      variables: latestPrompt?.variables ?? {},
      model_config: latestPrompt?.model_config ?? {},
      status: "draft",
      version: 1,
    })
    .select("id")
    .single();

  const { data: toolIds } = await supabase.from("agent_tools").select("tool_id").eq("agent_id", agentId);
  if (toolIds?.length) {
    await supabase.from("agent_tools").insert(toolIds.map((t) => ({ agent_id: newAgent.id, tool_id: t.tool_id })));
  }
  void newPrompt;

  revalidatePath(AI_AGENTS_PATH);
  return { id: newAgent.id as string };
}

export async function deleteAiAgent(agentId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const target = await getOwnAgent(workspaceId, agentId);
  if (!target) throw new Error("Agente no encontrado en este workspace.");

  const supabase = await createClient();
  await supabase.from("ai_agents").delete().eq("id", agentId);
  revalidatePath(AI_AGENTS_PATH);
}

// ---------------------------------------------------------------------------
// Prompt (sucesor de src/lib/ai-settings/actions.ts, ahora por agent_id)
// ---------------------------------------------------------------------------

export async function getAgentPromptsAction(agentId: string) {
  await requireActiveWorkspace();
  return getAgentPrompts(agentId);
}

async function getOwnPromptForAgent(workspaceId: string, agentId: string, promptId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_prompts")
    .select("id, status, agent_id, module_key, name")
    .eq("id", promptId)
    .eq("workspace_id", workspaceId)
    .eq("agent_id", agentId)
    .maybeSingle();
  return data;
}

export async function updateAgentPromptDraft(agentId: string, promptId: string, systemPrompt: string, variables: Record<string, string>) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const target = await getOwnPromptForAgent(workspaceId, agentId, promptId);
  if (!target) throw new Error("Prompt no encontrado.");
  if (target.status !== "draft") throw new Error("Solo se puede editar un prompt en borrador.");

  const supabase = await createClient();
  await supabase.from("ai_prompts").update({ system_prompt: systemPrompt, variables }).eq("id", promptId);
  revalidatePath(AI_AGENTS_PATH);
}

export async function createAgentPromptVersion(agentId: string, systemPrompt: string, variables: Record<string, string>) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();

  const { data: agent } = await supabase.from("ai_agents").select("module_key, name").eq("id", agentId).eq("workspace_id", workspaceId).maybeSingle();
  if (!agent) throw new Error("Agente no encontrado en este workspace.");

  const { data: family } = await supabase
    .from("ai_prompts")
    .select("version")
    .eq("agent_id", agentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("ai_prompts").insert({
    workspace_id: workspaceId,
    module_key: agent.module_key,
    agent_id: agentId,
    name: agent.name,
    system_prompt: systemPrompt,
    variables,
    status: "draft",
    version: (family?.version ?? 0) + 1,
  });
  if (error) throw new Error("No se pudo crear la nueva versión.");
  revalidatePath(AI_AGENTS_PATH);
}

export async function activateAgentPrompt(agentId: string, promptId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const target = await getOwnPromptForAgent(workspaceId, agentId, promptId);
  if (!target) throw new Error("Prompt no encontrado.");
  if (target.status !== "draft") throw new Error("Solo se puede activar una versión en borrador.");

  const supabase = await createClient();
  await supabase.from("ai_prompts").update({ status: "archived" }).eq("agent_id", agentId).eq("status", "active");
  await supabase.from("ai_prompts").update({ status: "active" }).eq("id", promptId);
  revalidatePath(AI_AGENTS_PATH);
}

export async function archiveAgentPrompt(agentId: string, promptId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const target = await getOwnPromptForAgent(workspaceId, agentId, promptId);
  if (!target) throw new Error("Prompt no encontrado.");

  const supabase = await createClient();
  await supabase.from("ai_prompts").update({ status: "archived" }).eq("id", promptId);
  revalidatePath(AI_AGENTS_PATH);
}

// ---------------------------------------------------------------------------
// Herramientas
// ---------------------------------------------------------------------------

export async function getGlobalToolsAction() {
  await requireActiveWorkspace();
  return getGlobalTools();
}

export async function getAgentToolIdsAction(agentId: string) {
  await requireActiveWorkspace();
  return getAgentToolIds(agentId);
}

export async function toggleAgentTool(agentId: string, toolId: string, enabled: boolean) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const target = await getOwnAgent(workspaceId, agentId);
  if (!target) throw new Error("Agente no encontrado en este workspace.");

  const supabase = await createClient();
  if (enabled) {
    await supabase.from("agent_tools").upsert({ agent_id: agentId, tool_id: toolId });
  } else {
    await supabase.from("agent_tools").delete().eq("agent_id", agentId).eq("tool_id", toolId);
  }
  revalidatePath(AI_AGENTS_PATH);
}

// ---------------------------------------------------------------------------
// Base de conocimiento
// ---------------------------------------------------------------------------

export async function getAgentKnowledgeBaseAction(agentId: string) {
  await requireActiveWorkspace();
  return getAgentKnowledgeBase(agentId);
}

/** Documentos del workspace disponibles para asociar — reutiliza el módulo
 * Documentos existente (src/lib/documents/queries.ts), no un picker nuevo. */
export async function getWorkspaceDocumentsForPickerAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getDocuments(workspaceId, null, { view: "all" });
}

export async function attachKnowledgeDocument(agentId: string, documentId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const target = await getOwnAgent(workspaceId, agentId);
  if (!target) throw new Error("Agente no encontrado en este workspace.");

  const supabase = await createClient();
  const { error } = await supabase.from("agent_knowledge_base").upsert({ agent_id: agentId, document_id: documentId, status: "pending", error: null });
  if (error) throw new Error("No se pudo asociar el documento.");

  revalidatePath(AI_AGENTS_PATH);
  // Ingesta síncrona (sin cola/worker, ver knowledgeBase.ts) — se dispara acá,
  // fuera del try/catch de la validación de arriba para no confundir un
  // fallo de ingesta con un fallo de autorización.
  await ingestKnowledgeDocument(agentId, documentId, workspaceId);
  revalidatePath(AI_AGENTS_PATH);
}

export async function retryKnowledgeDocument(agentId: string, documentId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const target = await getOwnAgent(workspaceId, agentId);
  if (!target) throw new Error("Agente no encontrado en este workspace.");

  await ingestKnowledgeDocument(agentId, documentId, workspaceId);
  revalidatePath(AI_AGENTS_PATH);
}

export async function detachKnowledgeDocument(agentId: string, documentId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const target = await getOwnAgent(workspaceId, agentId);
  if (!target) throw new Error("Agente no encontrado en este workspace.");

  const supabase = await createClient();
  await supabase.from("agent_knowledge_base").delete().eq("agent_id", agentId).eq("document_id", documentId);
  await supabase.from("document_chunks").delete().eq("document_id", documentId);
  revalidatePath(AI_AGENTS_PATH);
}

// ---------------------------------------------------------------------------
// Pruebas / Historial / Métricas
// ---------------------------------------------------------------------------

/** Sandbox — nunca toca messages/conversation_buffers/YCloud/tool_calls
 * (agentRuntime.ts::runSandboxTurn). Resuelve el prompt activo (o el más
 * reciente si ninguno está activo, para poder iterar antes de activar) del
 * agente en vez de recibir un promptId suelto. */
export async function testAgentAction(agentId: string, testMessage: string, testContactId?: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!testMessage.trim()) return { reply: null, toolTrace: [], error: "Escribí un mensaje de prueba." };

  const supabase = await createClient();
  // Prefiere el prompt activo; si no hay ninguno activo todavía (agente
  // recién creado, iterando antes de activar), usa la versión más reciente.
  let { data: prompt } = await supabase
    .from("ai_prompts")
    .select("id")
    .eq("agent_id", agentId)
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();
  if (!prompt) {
    ({ data: prompt } = await supabase
      .from("ai_prompts")
      .select("id")
      .eq("agent_id", agentId)
      .eq("workspace_id", workspaceId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle());
  }
  if (!prompt) return { reply: null, toolTrace: [], error: "Este agente todavía no tiene ningún prompt." };

  return runSandboxTurn({
    workspaceId,
    promptId: prompt.id as string,
    testMessage: testMessage.trim(),
    testContactId,
    testedByMemberId: memberId ?? undefined,
  });
}

export async function getAgentTestRunsAction(agentId: string) {
  await requireActiveWorkspace();
  return getAgentTestRuns(agentId);
}

export async function getAgentMetricsAction(agentId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getAgentMetrics(workspaceId, agentId);
}
