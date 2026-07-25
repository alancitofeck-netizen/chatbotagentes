"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAdvisorsBoard, getDealDetail } from "@/lib/advisors/queries";

export async function getAdvisorsBoardAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getAdvisorsBoard(workspaceId);
}

export async function getDealDetailAction(opportunityId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getDealDetail(workspaceId, opportunityId);
}

export interface DealFormInput {
  name: string;
  phone: string;
  email: string;
  company: string;
  title: string;
  value: number;
  currency: string;
  policyType: string;
  renewalDate: string;
  commission: number | null;
  ownerId: string | null;
}

const DEFAULT_STAGES = [
  { name: "Nuevo", isWon: false, isLost: false },
  { name: "Contactado", isWon: false, isLost: false },
  { name: "Propuesta", isWon: false, isLost: false },
  { name: "Cliente", isWon: true, isLost: false },
  { name: "Perdido", isWon: false, isLost: true },
];

/** Unlike CRM (seeded with a pipeline at workspace creation), the Asesores
 * module starts with none — the first deal created for a workspace
 * auto-provisions its pipeline + a sensible default stage set, making the
 * board's own empty-state copy ("se crea con tu primera oportunidad") true
 * for this module.
 *
 * `pipelines_insert` and `pipeline_stages_write` (0002_crm_and_dashboard.sql)
 * both restrict writes to owner/admin only — by design, same as CRM's
 * `pipelines_insert` (see ensureCrmPipeline, src/lib/crm/actions.ts, fixed
 * for the exact same reason). A solo self-registered Agent workspace has no
 * owner/admin at all, so their first "Nueva póliza" here hit the identical
 * bug: creating this pipeline threw an RLS violation the caller's own
 * plain client can't get past, which the Server Action boundary then
 * reduces to a digest-only error in production. The existence check still
 * runs on the caller's own RLS-scoped session (cheap, and covers the
 * overwhelming majority of calls — the pipeline already exists); only the
 * actual creation — always this exact fixed shape: one pipeline named
 * "Pólizas y clientes" with these 5 default stages, never a custom name,
 * never more than one per workspace — escalates to the service-role
 * client. This does not open up arbitrary pipeline/stage creation to
 * agents anywhere else; every other write path in this file stays on the
 * RLS-scoped client. */
async function ensurePipeline(workspaceId: string): Promise<string> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("pipelines")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("module_key", "advisors")
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;

  const serviceClient = createServiceRoleClient();
  const { data: pipeline, error } = await serviceClient
    .from("pipelines")
    .insert({ workspace_id: workspaceId, module_key: "advisors", name: "Pólizas y clientes" })
    .select("id")
    .single();
  if (error || !pipeline) throw new Error("No se pudo crear el pipeline de Asesores.");

  await serviceClient.from("pipeline_stages").insert(
    DEFAULT_STAGES.map((s, i) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      position: i,
      is_won: s.isWon,
      is_lost: s.isLost,
    })),
  );

  return pipeline.id as string;
}

/** Upserts the underlying contact by phone (same pattern as createContact/
 * createOpportunity), creates the opportunity + its pipeline_item, then the
 * advisor_policies row 1:1 extending it. */
export async function createDeal(input: DealFormInput, stageId?: string) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  if (!input.title.trim()) throw new Error("El título es obligatorio.");
  const supabase = await createClient();

  const pipelineId = await ensurePipeline(workspaceId);

  let targetStageId = stageId;
  if (!targetStageId) {
    const { data: firstStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    targetStageId = firstStage?.id as string;
  }

  const phone = input.phone.trim() || null;
  const contactPayload = {
    workspace_id: workspaceId,
    name: input.name.trim(),
    email: input.email.trim() || null,
    company: input.company.trim() || null,
  };

  const { data: contact, error: contactError } = phone
    ? await supabase
        .from("contacts")
        .upsert({ ...contactPayload, phone }, { onConflict: "workspace_id,phone" })
        .select("id")
        .single()
    : await supabase.from("contacts").insert(contactPayload).select("id").single();
  if (contactError || !contact) throw new Error("No se pudo crear el contacto.");

  const { data: opportunity, error: opportunityError } = await supabase
    .from("opportunities")
    .insert({
      workspace_id: workspaceId,
      contact_id: contact.id,
      title: input.title.trim(),
      value: input.value,
      currency: input.currency,
      owner_id: input.ownerId,
    })
    .select("id")
    .single();
  if (opportunityError || !opportunity) throw new Error("No se pudo crear la oportunidad.");

  const { data: pipelineItem, error: pipelineItemError } = await supabase
    .from("pipeline_items")
    .insert({ pipeline_id: pipelineId, stage_id: targetStageId, item_type: "opportunity", item_id: opportunity.id, position: 0 })
    .select("id")
    .single();
  if (pipelineItemError || !pipelineItem) throw new Error("No se pudo agregar la póliza al tablero.");

  await supabase.from("opportunities").update({ pipeline_item_id: pipelineItem.id }).eq("id", opportunity.id);

  await supabase.from("advisor_policies").insert({
    workspace_id: workspaceId,
    opportunity_id: opportunity.id,
    policy_type: input.policyType.trim() || null,
    renewal_date: input.renewalDate || null,
    commission: input.commission,
  });

  revalidatePath("/advisors");
  return { id: opportunity.id as string, contactId: contact.id as string };
}

export async function updateDeal(opportunityId: string, contactId: string, input: DealFormInput) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  if (!input.title.trim()) throw new Error("El título es obligatorio.");
  const supabase = await createClient();

  await supabase
    .from("contacts")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      company: input.company.trim() || null,
    })
    .eq("id", contactId)
    .eq("workspace_id", workspaceId);

  await supabase
    .from("opportunities")
    .update({ title: input.title.trim(), value: input.value, currency: input.currency, owner_id: input.ownerId })
    .eq("id", opportunityId)
    .eq("workspace_id", workspaceId);

  await supabase
    .from("advisor_policies")
    .upsert(
      {
        workspace_id: workspaceId,
        opportunity_id: opportunityId,
        policy_type: input.policyType.trim() || null,
        renewal_date: input.renewalDate || null,
        commission: input.commission,
      },
      { onConflict: "opportunity_id" },
    );

  revalidatePath("/advisors");
}

export async function deleteDeal(opportunityId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase.from("pipeline_items").delete().eq("item_type", "opportunity").eq("item_id", opportunityId);
  await supabase.from("notes").delete().eq("workspace_id", workspaceId).eq("notable_type", "opportunity").eq("notable_id", opportunityId);
  await supabase.from("advisor_policies").delete().eq("opportunity_id", opportunityId);
  await supabase.from("opportunities").delete().eq("id", opportunityId).eq("workspace_id", workspaceId);

  revalidatePath("/advisors");
}

/** Persists a Kanban drag — same pattern as moveOpportunityCard (src/lib/crm/actions.ts),
 * keeps opportunities.status in sync with the destination stage's is_won/is_lost. */
export async function moveDeal(pipelineItemId: string, stageId: string, position: number) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("pipeline_items")
    .select("id, item_id, pipelines(workspace_id)")
    .eq("id", pipelineItemId)
    .maybeSingle();

  const pipeline = Array.isArray(item?.pipelines) ? item?.pipelines[0] : item?.pipelines;
  if (!item || pipeline?.workspace_id !== workspaceId) {
    throw new Error("Póliza no encontrada en este workspace.");
  }

  await supabase.from("pipeline_items").update({ stage_id: stageId, position }).eq("id", pipelineItemId);

  const { data: destinationStage } = await supabase
    .from("pipeline_stages")
    .select("is_won, is_lost")
    .eq("id", stageId)
    .maybeSingle();

  const status = destinationStage?.is_won ? "won" : destinationStage?.is_lost ? "lost" : "open";
  await supabase
    .from("opportunities")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", item.item_id)
    .eq("workspace_id", workspaceId);

  revalidatePath("/advisors");
}

export async function addDealNote(opportunityId: string, body: string) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!body.trim()) return;
  const supabase = await createClient();

  await supabase.from("notes").insert({
    workspace_id: workspaceId,
    notable_type: "opportunity",
    notable_id: opportunityId,
    body: body.trim(),
  });

  revalidatePath("/advisors");
}
