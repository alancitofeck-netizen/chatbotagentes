import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PromptStatus = "draft" | "active" | "archived";

export interface AiPrompt {
  id: string;
  moduleKey: string;
  name: string;
  systemPrompt: string;
  status: PromptStatus;
  version: number;
  createdAt: string;
}

export async function getPrompts(workspaceId: string, moduleKey: string): Promise<AiPrompt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_prompts")
    .select("id, module_key, name, system_prompt, status, version, created_at")
    .eq("workspace_id", workspaceId)
    .eq("module_key", moduleKey)
    .order("version", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    moduleKey: row.module_key as string,
    name: row.name as string,
    systemPrompt: row.system_prompt as string,
    status: row.status as PromptStatus,
    version: row.version as number,
    createdAt: row.created_at as string,
  }));
}

export interface AiTool {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

/** Global catalog only (workspace_id is null) — the examples named in
 * docs/blueprint/05-ai-engine.md, seeded by 0007_ai_prompts.sql. No workspace
 * ever creates its own tool row in this pass. */
export async function getGlobalTools(): Promise<AiTool[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tools")
    .select("id, key, name, description")
    .is("workspace_id", null)
    .order("name", { ascending: true });

  return (data ?? []).map((t) => ({
    id: t.id as string,
    key: t.key as string,
    name: t.name as string,
    description: t.description as string | null,
  }));
}

export async function getPromptToolIds(promptId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("agent_tools").select("tool_id").eq("prompt_id", promptId);
  return (data ?? []).map((r) => r.tool_id as string);
}
