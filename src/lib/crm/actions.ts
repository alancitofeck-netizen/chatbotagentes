"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getOpportunityDetail } from "@/lib/crm/queries";

export async function getOpportunityDetailAction(opportunityId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getOpportunityDetail(workspaceId, opportunityId);
}

/** Persists a Kanban drag: the client already moved the card optimistically. */
export async function moveOpportunityCard(pipelineItemId: string, stageId: string, position: number) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  // Re-validate the item actually belongs to this workspace's pipeline before writing —
  // RLS also enforces this, but failing fast with a clear path here avoids relying on
  // RLS alone for a cross-tenant id someone could pass in (defense in depth).
  const { data: item } = await supabase
    .from("pipeline_items")
    .select("id, pipelines(workspace_id)")
    .eq("id", pipelineItemId)
    .maybeSingle();

  const pipeline = Array.isArray(item?.pipelines) ? item?.pipelines[0] : item?.pipelines;
  if (!item || pipeline?.workspace_id !== workspaceId) {
    throw new Error("Tarjeta no encontrada en este workspace.");
  }

  await supabase.from("pipeline_items").update({ stage_id: stageId, position }).eq("id", pipelineItemId);

  revalidatePath("/crm");
}

export async function addOpportunityNote(opportunityId: string, body: string) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!body.trim()) return;
  const supabase = await createClient();

  await supabase.from("notes").insert({
    workspace_id: workspaceId,
    notable_type: "opportunity",
    notable_id: opportunityId,
    body: body.trim(),
  });

  revalidatePath("/crm");
}
