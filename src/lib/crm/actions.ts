"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { getCrmBoard, getCrmPipelines, getOpportunityActivity, getOpportunityDetail } from "@/lib/crm/queries";
import { getCrmAnalyticsRangeData, resolveDateRange, type DateRangePreset } from "@/lib/crm/analyticsRange";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Feeds CardDetailSheet's "Historial" tab — `audit_log` already existed
 * (0020_agent_engine_core.sql, built for the AI engine) but no CRM mutation
 * ever wrote to it, so an opportunity's history tab was always just a stub. */
async function logOpportunityActivity(
  supabase: SupabaseServerClient,
  workspaceId: string,
  opportunityId: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  const memberId = await getCurrentMemberId(workspaceId);
  await supabase.from("audit_log").insert({
    workspace_id: workspaceId,
    actor_type: "user",
    actor_id: memberId,
    action,
    entity_type: "opportunity",
    entity_id: opportunityId,
    metadata,
  });
}

export async function getCrmBoardAction(pipelineId?: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getCrmBoard(workspaceId, pipelineId);
}

export async function getCrmPipelinesAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getCrmPipelines(workspaceId);
}

export async function getCrmAnalyticsRangeAction(preset: DateRangePreset, customStart?: string, customEnd?: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const range = resolveDateRange(preset, customStart, customEnd);
  return getCrmAnalyticsRangeData(workspaceId, range);
}

const DEFAULT_CRM_STAGES = [
  { name: "Nuevo", isWon: false, isLost: false },
  { name: "Contactado", isWon: false, isLost: false },
  { name: "Calificado", isWon: false, isLost: false },
  { name: "Propuesta", isWon: false, isLost: false },
  { name: "Negociación", isWon: false, isLost: false },
  { name: "Ganado", isWon: true, isLost: false },
  { name: "Perdido", isWon: false, isLost: true },
];

/** Same pattern as Asesores' ensurePipeline() (src/lib/advisors/actions.ts):
 * a workspace has no self-serve "create workspace" flow that seeds a CRM
 * pipeline yet, so the first opportunity created for a workspace provisions
 * it instead of throwing "todavía no tiene un pipeline de ventas". Exported
 * so the Tablero empty state can also call it directly (no opportunity
 * required to get a usable board). */
export async function ensureCrmPipeline(workspaceId: string): Promise<string> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("pipelines")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("module_key", "crm")
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: pipeline, error } = await supabase
    .from("pipelines")
    .insert({ workspace_id: workspaceId, module_key: "crm", name: "Pipeline de ventas" })
    .select("id")
    .single();
  if (error || !pipeline) throw new Error("No se pudo crear el pipeline de ventas.");

  await supabase.from("pipeline_stages").insert(
    DEFAULT_CRM_STAGES.map((s, i) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      position: i,
      is_won: s.isWon,
      is_lost: s.isLost,
    })),
  );

  return pipeline.id as string;
}

export async function ensureCrmPipelineAction() {
  const { workspaceId } = await requireActiveWorkspace();
  await ensureCrmPipeline(workspaceId);
  revalidatePath("/crm");
  return getCrmBoard(workspaceId);
}

export async function getOpportunityDetailAction(opportunityId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getOpportunityDetail(workspaceId, opportunityId);
}

export async function getOpportunityActivityAction(opportunityId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getOpportunityActivity(workspaceId, opportunityId);
}

/** Pipeline management (múltiples pipelines + columnas editables) — the
 * Blueprint (06-crm.md) explicitly allows more than one CRM pipeline per
 * workspace, but no UI ever existed for it before this. */
export async function createPipeline(name: string) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!name.trim()) throw new Error("El nombre es obligatorio.");
  const supabase = await createClient();

  const { data: pipeline, error } = await supabase
    .from("pipelines")
    .insert({ workspace_id: workspaceId, module_key: "crm", name: name.trim() })
    .select("id")
    .single();
  if (error || !pipeline) throw new Error("No se pudo crear el pipeline.");

  await supabase.from("pipeline_stages").insert(
    DEFAULT_CRM_STAGES.map((s, i) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      position: i,
      is_won: s.isWon,
      is_lost: s.isLost,
    })),
  );

  revalidatePath("/crm");
  return { id: pipeline.id as string };
}

export async function renamePipeline(pipelineId: string, name: string) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!name.trim()) throw new Error("El nombre es obligatorio.");
  const supabase = await createClient();

  await supabase.from("pipelines").update({ name: name.trim() }).eq("id", pipelineId).eq("workspace_id", workspaceId);
  revalidatePath("/crm");
}

/** Blocked if it still has opportunities on it (the app enforces this, not
 * just a UI nicety — `pipeline_items`/`pipeline_stages` cascade-delete at the
 * DB level, which would silently orphan those opportunities). */
export async function deletePipeline(pipelineId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const { count } = await supabase
    .from("pipeline_items")
    .select("id", { count: "exact", head: true })
    .eq("pipeline_id", pipelineId)
    .eq("item_type", "opportunity");
  if (count && count > 0) {
    throw new Error("Este pipeline todavía tiene oportunidades. Movélas o eliminalas antes de borrar el pipeline.");
  }

  await supabase.from("pipelines").delete().eq("id", pipelineId).eq("workspace_id", workspaceId);
  revalidatePath("/crm");
}

export async function createPipelineStage(pipelineId: string, name: string) {
  if (!name.trim()) throw new Error("El nombre de la etapa es obligatorio.");
  await requireActiveWorkspace();
  const supabase = await createClient();

  const { count } = await supabase
    .from("pipeline_stages")
    .select("id", { count: "exact", head: true })
    .eq("pipeline_id", pipelineId);

  await supabase.from("pipeline_stages").insert({
    pipeline_id: pipelineId,
    name: name.trim(),
    position: count ?? 0,
  });

  revalidatePath("/crm");
}

export async function updatePipelineStage(
  stageId: string,
  input: { name: string; isWon: boolean; isLost: boolean },
) {
  if (!input.name.trim()) throw new Error("El nombre de la etapa es obligatorio.");
  await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase
    .from("pipeline_stages")
    .update({ name: input.name.trim(), is_won: input.isWon, is_lost: input.isLost })
    .eq("id", stageId);

  revalidatePath("/crm");
}

/** Blocked if the stage still has cards on it — same reasoning as
 * deletePipeline (cascade would silently orphan those opportunities). */
export async function deletePipelineStage(stageId: string) {
  await requireActiveWorkspace();
  const supabase = await createClient();

  const { count } = await supabase
    .from("pipeline_items")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", stageId)
    .eq("item_type", "opportunity");
  if (count && count > 0) {
    throw new Error("Esta etapa todavía tiene oportunidades. Movélas antes de eliminarla.");
  }

  await supabase.from("pipeline_stages").delete().eq("id", stageId);
  revalidatePath("/crm");
}

/** Persists a drag-reorder of the stage columns themselves (distinct from
 * moveOpportunityCard, which reorders cards within/across stages). */
export async function reorderPipelineStages(stageIdsInOrder: string[]) {
  await requireActiveWorkspace();
  const supabase = await createClient();

  await Promise.all(
    stageIdsInOrder.map((stageId, index) =>
      supabase.from("pipeline_stages").update({ position: index }).eq("id", stageId),
    ),
  );

  revalidatePath("/crm");
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
    .select("id, item_id, stage_id, pipelines(workspace_id)")
    .eq("id", pipelineItemId)
    .maybeSingle();

  const pipeline = Array.isArray(item?.pipelines) ? item?.pipelines[0] : item?.pipelines;
  if (!item || pipeline?.workspace_id !== workspaceId) {
    throw new Error("Tarjeta no encontrada en este workspace.");
  }

  const [{ data: originStage }, { data: destinationStage }] = await Promise.all([
    supabase.from("pipeline_stages").select("name").eq("id", item.stage_id).maybeSingle(),
    supabase.from("pipeline_stages").select("name, is_won, is_lost").eq("id", stageId).maybeSingle(),
  ]);

  await supabase.from("pipeline_items").update({ stage_id: stageId, position }).eq("id", pipelineItemId);

  // Keep opportunities.status in sync with the destination stage — nothing
  // wrote to it before this fix, so Dashboard's "Ventas del mes"/"% conversión"
  // KPIs (which filter status === 'won') never reflected real drag activity.
  const status = destinationStage?.is_won ? "won" : destinationStage?.is_lost ? "lost" : "open";
  // `updated_at` is stamped explicitly here (no DB trigger keeps it current) —
  // the board KPI header (src/lib/crm/queries.ts) buckets "Ventas cerradas"/
  // "Conversión del mes" by this timestamp, so it needs to reflect the actual
  // stage-change moment, not just creation time.
  await supabase
    .from("opportunities")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", item.item_id)
    .eq("workspace_id", workspaceId);

  if (item.stage_id !== stageId) {
    await logOpportunityActivity(supabase, workspaceId, item.item_id as string, "opportunity_stage_changed", {
      from_stage: originStage?.name ?? null,
      to_stage: destinationStage?.name ?? null,
    });
  }

  revalidatePath("/crm");
  revalidatePath("/dashboard");
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

export interface LeadFormInput {
  name: string;
  phone: string;
  email: string;
  company: string;
  jobTitle: string;
  source: string;
  title: string;
  value: number;
  currency: string;
  priority: "high" | "medium" | "low";
  probability: number | null;
  expectedCloseDate: string | null;
  ownerId: string | null;
}

/** Upserts the underlying contact by phone (same pattern as createContact,
 * src/lib/contacts/actions.ts), then creates the opportunity + its first
 * pipeline_items row — mirroring addCandidateToVacancy's opportunity/
 * pipeline_item creation order (src/lib/ats/actions.ts). No "create lead" flow
 * existed anywhere before this feature. */
export async function createOpportunity(input: LeadFormInput, stageId?: string) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  if (!input.title.trim()) throw new Error("El título de la oportunidad es obligatorio.");
  const supabase = await createClient();

  const pipelineId = await ensureCrmPipeline(workspaceId);

  let targetStageId = stageId;
  if (!targetStageId) {
    const { data: firstStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!firstStage) throw new Error("El pipeline todavía no tiene etapas.");
    targetStageId = firstStage.id as string;
  }

  const phone = input.phone.trim() || null;
  const contactPayload = {
    workspace_id: workspaceId,
    name: input.name.trim(),
    email: input.email.trim() || null,
    company: input.company.trim() || null,
    source: input.source.trim() || null,
    custom_fields: input.jobTitle.trim() ? { job_title: input.jobTitle.trim() } : {},
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
      priority: input.priority,
      probability: input.probability,
      expected_close_date: input.expectedCloseDate,
      owner_id: input.ownerId,
    })
    .select("id")
    .single();
  if (opportunityError || !opportunity) throw new Error("No se pudo crear la oportunidad.");

  const { data: pipelineItem, error: pipelineItemError } = await supabase
    .from("pipeline_items")
    .insert({
      pipeline_id: pipelineId,
      stage_id: targetStageId,
      item_type: "opportunity",
      item_id: opportunity.id,
      position: 0,
    })
    .select("id")
    .single();
  if (pipelineItemError || !pipelineItem) throw new Error("No se pudo agregar el lead al tablero.");

  await supabase.from("opportunities").update({ pipeline_item_id: pipelineItem.id }).eq("id", opportunity.id);

  await logOpportunityActivity(supabase, workspaceId, opportunity.id as string, "opportunity_created", {
    title: input.title.trim(),
  });

  revalidatePath("/crm");
  revalidatePath("/dashboard");
  return { id: opportunity.id as string, contactId: contact.id as string };
}

/** Edits both the opportunity row and its underlying contact (by id, unlike
 * createOpportunity's upsert-by-phone) — LeadFormSheet is the single edit
 * surface, reused by the card's pencil quick-action and from CardDetailSheet,
 * instead of duplicating a second inline-edit form. */
export async function updateOpportunity(opportunityId: string, contactId: string, input: LeadFormInput) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  if (!input.title.trim()) throw new Error("El título de la oportunidad es obligatorio.");
  const supabase = await createClient();

  await supabase
    .from("contacts")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      company: input.company.trim() || null,
      source: input.source.trim() || null,
      custom_fields: input.jobTitle.trim() ? { job_title: input.jobTitle.trim() } : {},
    })
    .eq("id", contactId)
    .eq("workspace_id", workspaceId);

  await supabase
    .from("opportunities")
    .update({
      title: input.title.trim(),
      value: input.value,
      currency: input.currency,
      priority: input.priority,
      probability: input.probability,
      expected_close_date: input.expectedCloseDate,
      owner_id: input.ownerId,
    })
    .eq("id", opportunityId)
    .eq("workspace_id", workspaceId);

  await logOpportunityActivity(supabase, workspaceId, opportunityId, "opportunity_updated", {
    title: input.title.trim(),
  });

  revalidatePath("/crm");
}

export async function deleteOpportunity(opportunityId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await logOpportunityActivity(supabase, workspaceId, opportunityId, "opportunity_deleted");

  await supabase.from("pipeline_items").delete().eq("item_type", "opportunity").eq("item_id", opportunityId);
  await supabase.from("notes").delete().eq("workspace_id", workspaceId).eq("notable_type", "opportunity").eq("notable_id", opportunityId);
  await supabase.from("opportunities").delete().eq("id", opportunityId).eq("workspace_id", workspaceId);

  revalidatePath("/crm");
  revalidatePath("/dashboard");
}

export async function bulkMoveOpportunities(pipelineItemIds: string[], stageId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  if (pipelineItemIds.length === 0) return;
  const supabase = await createClient();

  const { data: destinationStage } = await supabase
    .from("pipeline_stages")
    .select("is_won, is_lost")
    .eq("id", stageId)
    .maybeSingle();
  const status = destinationStage?.is_won ? "won" : destinationStage?.is_lost ? "lost" : "open";

  const { data: items } = await supabase
    .from("pipeline_items")
    .select("id, item_id")
    .in("id", pipelineItemIds);

  await supabase.from("pipeline_items").update({ stage_id: stageId, position: 0 }).in("id", pipelineItemIds);

  const opportunityIds = (items ?? []).map((i) => i.item_id as string);
  if (opportunityIds.length) {
    await supabase
      .from("opportunities")
      .update({ status, updated_at: new Date().toISOString() })
      .in("id", opportunityIds)
      .eq("workspace_id", workspaceId);
  }

  revalidatePath("/crm");
  revalidatePath("/dashboard");
}

export async function bulkDeleteOpportunities(opportunityIds: string[]) {
  const { workspaceId } = await requireActiveWorkspace();
  if (opportunityIds.length === 0) return;
  const supabase = await createClient();

  await supabase.from("pipeline_items").delete().eq("item_type", "opportunity").in("item_id", opportunityIds);
  await supabase
    .from("notes")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("notable_type", "opportunity")
    .in("notable_id", opportunityIds);
  await supabase.from("opportunities").delete().in("id", opportunityIds).eq("workspace_id", workspaceId);

  revalidatePath("/crm");
  revalidatePath("/dashboard");
}

export async function bulkAssignOwner(opportunityIds: string[], ownerId: string | null) {
  const { workspaceId } = await requireActiveWorkspace();
  if (opportunityIds.length === 0) return;
  const supabase = await createClient();

  await supabase.from("opportunities").update({ owner_id: ownerId }).in("id", opportunityIds).eq("workspace_id", workspaceId);

  revalidatePath("/crm");
}

/** Tags live on the contact (shared with Contactos/Inbox), so bulk-tagging a
 * set of opportunities tags each opportunity's underlying contact — same
 * reuse decision as toggleOpportunityTag below. */
export async function bulkAddTag(contactIds: string[], tagId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  if (contactIds.length === 0) return;
  const supabase = await createClient();

  const { data: contacts } = await supabase.from("contacts").select("id").eq("workspace_id", workspaceId).in("id", contactIds);
  const validIds = (contacts ?? []).map((c) => c.id as string);

  if (validIds.length) {
    await supabase
      .from("contact_tags")
      .upsert(
        validIds.map((contactId) => ({ contact_id: contactId, tag_id: tagId })),
        { onConflict: "contact_id,tag_id", ignoreDuplicates: true },
      );
  }

  revalidatePath("/crm");
  revalidatePath("/inbox");
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function exportOpportunitiesCsv() {
  const { workspaceId } = await requireActiveWorkspace();
  const board = await getCrmBoard(workspaceId);
  if (!board) return "";

  const stageNameById = new Map(board.stages.map((s) => [s.id, s.name]));
  const header = [
    "titulo",
    "contacto",
    "empresa",
    "email",
    "telefono",
    "etapa",
    "valor",
    "moneda",
    "prioridad",
    "probabilidad",
    "origen",
    "agente",
    "creado",
  ];
  const rows: string[] = [header.join(",")];

  for (const cards of Object.values(board.cardsByStage)) {
    for (const c of cards) {
      rows.push(
        [
          c.title,
          c.contactName,
          c.company ?? "",
          c.email ?? "",
          c.phone ?? "",
          stageNameById.get(c.stageId) ?? "",
          String(c.value),
          c.currency,
          c.priority,
          c.probability === null ? "" : String(c.probability),
          c.source ?? "",
          c.ownerName ?? "",
          c.createdAt,
        ]
          .map((v) => csvEscape(String(v)))
          .join(","),
      );
    }
  }

  return rows.join("\n");
}

export interface ImportLeadRow {
  name: string;
  phone: string;
  email: string;
  company: string;
  source: string;
  value: string;
  priority: string;
}

export async function importOpportunitiesCsv(rows: ImportLeadRow[]) {
  const results = { imported: 0, skipped: [] as { row: number; reason: string }[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name?.trim()) {
      results.skipped.push({ row: i + 1, reason: "Falta el nombre." });
      continue;
    }
    if (!row.phone?.trim()) {
      results.skipped.push({ row: i + 1, reason: "Falta el teléfono." });
      continue;
    }
    const priority = ["high", "medium", "low"].includes(row.priority?.trim())
      ? (row.priority.trim() as "high" | "medium" | "low")
      : "medium";
    const value = Number(row.value);

    try {
      await createOpportunity({
        name: row.name,
        phone: row.phone,
        email: row.email ?? "",
        company: row.company ?? "",
        jobTitle: "",
        source: row.source ?? "",
        title: `Lead — ${row.name.trim()}`,
        value: Number.isFinite(value) ? value : 0,
        currency: "USD",
        priority,
        probability: null,
        expectedCloseDate: null,
        ownerId: null,
      });
      results.imported += 1;
    } catch (err) {
      results.skipped.push({ row: i + 1, reason: err instanceof Error ? err.message : "Error desconocido." });
    }
  }

  return results;
}
