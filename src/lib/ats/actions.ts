"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getCandidateApplicationDetail, getVacancies, getVacancyBoard } from "@/lib/ats/queries";

/** Exact stage names from docs/blueprint/07-ats.md's example pipeline. */
const DEFAULT_STAGES = ["Aplicó", "Preclasificado", "Entrevista", "Oferta", "Contratado", "Rechazado"];

export async function getVacanciesAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getVacancies(workspaceId);
}

export async function getVacancyBoardAction(vacancyId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getVacancyBoard(workspaceId, vacancyId);
}

export async function getCandidateApplicationDetailAction(applicationId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getCandidateApplicationDetail(workspaceId, applicationId);
}

/** Creates the vacancy together with its own pipeline instance + default
 * stages, atomically from the caller's perspective — each vacancy owns its
 * pipeline (docs/blueprint/07-ats.md), unlike CRM's single global one. */
export async function createVacancy(input: { title: string; department: string; location: string }) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!input.title.trim()) throw new Error("El título es obligatorio.");
  const supabase = await createClient();

  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .insert({ workspace_id: workspaceId, module_key: "ats", name: `Pipeline — ${input.title.trim()}` })
    .select("id")
    .single();
  if (pipelineError || !pipeline) throw new Error("No se pudo crear el pipeline de la vacante.");

  await supabase.from("pipeline_stages").insert(
    DEFAULT_STAGES.map((name, i) => ({
      pipeline_id: pipeline.id,
      name,
      position: i,
      is_won: name === "Contratado",
      is_lost: name === "Rechazado",
    })),
  );

  const { data: vacancy, error: vacancyError } = await supabase
    .from("vacancies")
    .insert({
      workspace_id: workspaceId,
      title: input.title.trim(),
      department: input.department.trim() || null,
      location: input.location.trim() || null,
      pipeline_id: pipeline.id,
    })
    .select("id")
    .single();
  if (vacancyError || !vacancy) throw new Error("No se pudo crear la vacante.");

  revalidatePath("/ats");
  return vacancy.id as string;
}

/** Re-validates workspace ownership before writing — same defense-in-depth as
 * moveOpportunityCard (src/lib/crm/actions.ts); RLS also enforces this. */
export async function moveCandidateCard(pipelineItemId: string, stageId: string, position: number) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

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
  revalidatePath("/ats");
}

export async function addCandidateNote(applicationId: string, body: string) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!body.trim()) return;
  const supabase = await createClient();

  await supabase.from("notes").insert({
    workspace_id: workspaceId,
    notable_type: "candidate_application",
    notable_id: applicationId,
    body: body.trim(),
  });
  revalidatePath("/ats");
}

/** A candidate IS a contact (docs/blueprint/07-ats.md) — creates/reuses the
 * contact by phone, creates/reuses its 1:1 candidate row, then the
 * application + its pipeline_item in the vacancy's first stage. */
export async function addCandidateToVacancy(
  vacancyId: string,
  input: { name: string; phone: string; email: string; source: string },
) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  const supabase = await createClient();

  const { data: vacancy } = await supabase
    .from("vacancies")
    .select("id, pipeline_id")
    .eq("workspace_id", workspaceId)
    .eq("id", vacancyId)
    .maybeSingle();
  if (!vacancy || !vacancy.pipeline_id) throw new Error("Vacante no encontrada.");

  const phone = input.phone.trim() || null;
  const contactPayload = {
    workspace_id: workspaceId,
    name: input.name.trim(),
    email: input.email.trim() || null,
    source: input.source.trim() || "ats",
  };

  const { data: contact, error: contactError } = phone
    ? await supabase
        .from("contacts")
        .upsert({ ...contactPayload, phone }, { onConflict: "workspace_id,phone" })
        .select("id")
        .single()
    : await supabase.from("contacts").insert(contactPayload).select("id").single();
  if (contactError || !contact) throw new Error("No se pudo crear el contacto.");
  const contactId = contact.id as string;

  const { data: existingCandidate } = await supabase
    .from("candidates")
    .select("id")
    .eq("contact_id", contactId)
    .maybeSingle();

  let candidateId: string;
  if (existingCandidate) {
    candidateId = existingCandidate.id as string;
  } else {
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .insert({ workspace_id: workspaceId, contact_id: contactId, source: input.source.trim() || null })
      .select("id")
      .single();
    if (candidateError || !candidate) throw new Error("No se pudo crear el candidato.");
    candidateId = candidate.id as string;
  }

  const { data: firstStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("pipeline_id", vacancy.pipeline_id)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!firstStage) throw new Error("La vacante no tiene etapas configuradas.");

  const { data: application, error: applicationError } = await supabase
    .from("candidate_applications")
    .insert({ workspace_id: workspaceId, vacancy_id: vacancyId, candidate_id: candidateId })
    .select("id")
    .single();
  if (applicationError || !application) throw new Error("Este candidato ya está aplicando a esta vacante.");

  const { data: pipelineItem, error: pipelineItemError } = await supabase
    .from("pipeline_items")
    .insert({
      pipeline_id: vacancy.pipeline_id,
      stage_id: firstStage.id,
      item_type: "candidate_application",
      item_id: application.id,
      position: 0,
    })
    .select("id")
    .single();
  if (pipelineItemError || !pipelineItem) throw new Error("No se pudo agregar el candidato al tablero.");

  await supabase.from("candidate_applications").update({ pipeline_item_id: pipelineItem.id }).eq("id", application.id);

  revalidatePath("/ats");
}
