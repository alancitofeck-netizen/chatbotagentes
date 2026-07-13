"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import { getGlobalTools, getPromptToolIds, getPrompts } from "@/lib/ai-settings/queries";

export async function getPromptsAction(moduleKey: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getPrompts(workspaceId, moduleKey);
}

export async function getGlobalToolsAction() {
  await requireActiveWorkspace();
  return getGlobalTools();
}

export async function getPromptToolIdsAction(promptId: string) {
  await requireActiveWorkspace();
  return getPromptToolIds(promptId);
}

async function getOwnPrompt(workspaceId: string, promptId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_prompts")
    .select("id, module_key, name, status")
    .eq("id", promptId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data;
}

export async function createPrompt(input: { moduleKey: string; name: string; systemPrompt: string }) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  const supabase = await createClient();

  const { error } = await supabase.from("ai_prompts").insert({
    workspace_id: workspaceId,
    module_key: input.moduleKey,
    name: input.name.trim(),
    system_prompt: input.systemPrompt,
    status: "draft",
    version: 1,
  });
  if (error) throw new Error("No se pudo crear el prompt.");
  revalidatePath("/settings/ai");
}

/** Never edits an active version in place — copies name/module_key from the
 * source prompt into a new row with version+1 within that same
 * (workspace_id, name, module_key) family, always starting as 'draft'
 * (docs/blueprint/05-ai-engine.md). */
export async function createPromptVersion(promptId: string, input: { systemPrompt: string }) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const source = await getOwnPrompt(workspaceId, promptId);
  if (!source) throw new Error("Prompt no encontrado en este workspace.");

  const supabase = await createClient();
  const { data: family } = await supabase
    .from("ai_prompts")
    .select("version")
    .eq("workspace_id", workspaceId)
    .eq("module_key", source.module_key)
    .eq("name", source.name)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("ai_prompts").insert({
    workspace_id: workspaceId,
    module_key: source.module_key,
    name: source.name,
    system_prompt: input.systemPrompt,
    status: "draft",
    version: (family?.version ?? 0) + 1,
  });
  if (error) throw new Error("No se pudo crear la nueva versión.");
  revalidatePath("/settings/ai");
}

export async function updatePromptDraft(promptId: string, systemPrompt: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const target = await getOwnPrompt(workspaceId, promptId);
  if (!target) throw new Error("Prompt no encontrado en este workspace.");
  if (target.status !== "draft") throw new Error("Solo se puede editar un prompt en borrador.");

  const supabase = await createClient();
  await supabase.from("ai_prompts").update({ system_prompt: systemPrompt }).eq("id", promptId);
  revalidatePath("/settings/ai");
}

/** Only one 'active' prompt per (workspace, module_key) at a time — this is
 * an application rule, not a DB constraint (docs/blueprint/05-ai-engine.md).
 * Activating archives whatever was previously active in the same family. */
export async function activatePrompt(promptId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const target = await getOwnPrompt(workspaceId, promptId);
  if (!target) throw new Error("Prompt no encontrado en este workspace.");
  if (target.status !== "draft") throw new Error("Solo se puede activar una versión en borrador.");

  const supabase = await createClient();
  await supabase
    .from("ai_prompts")
    .update({ status: "archived" })
    .eq("workspace_id", workspaceId)
    .eq("module_key", target.module_key)
    .eq("status", "active");

  await supabase.from("ai_prompts").update({ status: "active" }).eq("id", promptId);
  revalidatePath("/settings/ai");
}

export async function archivePrompt(promptId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const target = await getOwnPrompt(workspaceId, promptId);
  if (!target) throw new Error("Prompt no encontrado en este workspace.");

  const supabase = await createClient();
  await supabase.from("ai_prompts").update({ status: "archived" }).eq("id", promptId);
  revalidatePath("/settings/ai");
}

export async function togglePromptTool(promptId: string, toolId: string, enabled: boolean) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const target = await getOwnPrompt(workspaceId, promptId);
  if (!target) throw new Error("Prompt no encontrado en este workspace.");

  const supabase = await createClient();
  if (enabled) {
    await supabase.from("agent_tools").upsert({ prompt_id: promptId, tool_id: toolId });
  } else {
    await supabase.from("agent_tools").delete().eq("prompt_id", promptId).eq("tool_id", toolId);
  }
  revalidatePath("/settings/ai");
}
