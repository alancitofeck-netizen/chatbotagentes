"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAutomationList } from "@/lib/automations/queries";

export async function getAutomationListAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getAutomationList(workspaceId);
}

/** Fixed shape for now: trigger = keyword match, actions = a single canned
 * text reply — the only concrete example in docs/blueprint/13-agent-engine.md.
 * Nothing executes this yet (no Decision Engine/Buffer Inteligente/YCloud) —
 * this is management/storage only, same posture as the Inbox module. */
export async function createAutomation(input: { name: string; keyword: string; responseBody: string }) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  if (!input.keyword.trim()) throw new Error("La palabra clave es obligatoria.");
  const supabase = await createClient();

  const { error } = await supabase.from("automations").insert({
    workspace_id: workspaceId,
    name: input.name.trim(),
    trigger: { type: "keyword", keyword: input.keyword.trim() },
    conditions: {},
    actions: [{ type: "send_text", body: input.responseBody.trim() }],
    enabled: true,
  });
  if (error) throw new Error("No se pudo crear la automatización.");
  revalidatePath("/automations");
}

export async function updateAutomation(
  id: string,
  input: { name: string; keyword: string; responseBody: string },
) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  if (!input.keyword.trim()) throw new Error("La palabra clave es obligatoria.");
  const supabase = await createClient();

  await supabase
    .from("automations")
    .update({
      name: input.name.trim(),
      trigger: { type: "keyword", keyword: input.keyword.trim() },
      actions: [{ type: "send_text", body: input.responseBody.trim() }],
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  revalidatePath("/automations");
}

export async function toggleAutomationEnabled(id: string, enabled: boolean) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase.from("automations").update({ enabled }).eq("id", id).eq("workspace_id", workspaceId);
  revalidatePath("/automations");
}

/** No dependent rows exist on automations today (unlike contacts' cascade
 * into conversations/opportunities/candidates) — a real delete is safe. */
export async function deleteAutomation(id: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase.from("automations").delete().eq("id", id).eq("workspace_id", workspaceId);
  revalidatePath("/automations");
}
