"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity/log";
import { resolveOpenRouterApiKey } from "@/lib/integrations/openrouter";
import { slugify } from "@/lib/miniApps/apiKey";
import {
  getPresentationList,
  getPresentationById,
  getPresentationsKpis,
  type PresentationStep,
} from "@/lib/presentations/queries";
import type { PersonalInfo, PresentationPhoto, CommercialInfo, PresentationSlide } from "@/lib/presentations/constants";
import { generatePresentationContent } from "@/lib/presentations/aiContent";
import { buildPresentationPdf } from "@/lib/presentations/pdf";

const BUCKET = "presentation-assets";

function revalidatePresentations(id?: string) {
  revalidatePath("/presentaciones");
  if (id) revalidatePath(`/presentaciones/${id}`);
}

export async function getPresentationListAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getPresentationList(workspaceId);
}

export async function getPresentationsKpisAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getPresentationsKpis(workspaceId);
}

export async function getPresentationByIdAction(presentationId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getPresentationById(workspaceId, presentationId);
}

export async function createPresentationAction(input?: { title?: string; clientLabel?: string }): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("presentations")
    .insert({
      workspace_id: workspaceId,
      owner_id: memberId,
      created_by: memberId,
      title: input?.title?.trim() || "Nueva presentación",
      client_label: input?.clientLabel?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear la presentación.");

  await logActivity(supabase, workspaceId, memberId, "presentation", data.id as string, "presentation_created", {});

  revalidatePresentations();
  return { id: data.id as string };
}

export async function duplicatePresentationAction(presentationId: string): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const source = await getPresentationById(workspaceId, presentationId);
  if (!source) throw new Error("Presentación no encontrada.");

  const { data, error } = await supabase
    .from("presentations")
    .insert({
      workspace_id: workspaceId,
      owner_id: memberId,
      created_by: memberId,
      title: `${source.title} (copia)`,
      client_label: source.clientLabel,
      personal_info: source.personalInfo,
      photos: source.photos,
      commercial_info: source.commercialInfo,
      ai_content: source.aiContent,
      slides: source.slides,
      current_step: "informacion",
      status: "borrador",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo duplicar la presentación.");

  revalidatePresentations();
  return { id: data.id as string };
}

export async function deletePresentationAction(presentationId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await supabase.from("presentations").delete().eq("id", presentationId).eq("workspace_id", workspaceId);
  revalidatePresentations();
}

export interface PresentationStepPatch {
  currentStep?: PresentationStep;
  title?: string;
  clientLabel?: string | null;
  personalInfo?: PersonalInfo;
  photos?: PresentationPhoto[];
  commercialInfo?: CommercialInfo;
  slides?: PresentationSlide[];
}

/** Autosave — mismo criterio que updateAdvisorySessionStepAction: el
 * cliente manda el objeto acumulado completo de cada grupo de campos, así
 * que siempre es un UPDATE directo, nunca un merge parcial de jsonb. */
export async function updatePresentationStepAction(presentationId: string, patch: PresentationStepPatch): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.currentStep !== undefined) dbPatch.current_step = patch.currentStep;
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.clientLabel !== undefined) dbPatch.client_label = patch.clientLabel;
  if (patch.personalInfo !== undefined) dbPatch.personal_info = patch.personalInfo;
  if (patch.photos !== undefined) dbPatch.photos = patch.photos;
  if (patch.commercialInfo !== undefined) dbPatch.commercial_info = patch.commercialInfo;
  if (patch.slides !== undefined) dbPatch.slides = patch.slides;

  const { error } = await supabase.from("presentations").update(dbPatch).eq("id", presentationId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo guardar.");
}

export async function deletePresentationPhotoAction(presentationId: string, photoId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const presentation = await getPresentationById(workspaceId, presentationId);
  if (!presentation) throw new Error("Presentación no encontrada.");

  const photo = presentation.photos.find((p) => p.id === photoId);
  const nextPhotos = presentation.photos.filter((p) => p.id !== photoId);

  const supabase = await createClient();
  await supabase.from("presentations").update({ photos: nextPhotos, updated_at: new Date().toISOString() }).eq("id", presentationId).eq("workspace_id", workspaceId);

  if (photo) {
    const service = createServiceRoleClient();
    await service.storage.from(BUCKET).remove([photo.originalPath]);
  }
}

/** Genera bio/propuesta de valor/FAQs/etc. con IA — mismo patrón exacto que
 * analyzeAdvisorySessionAction: resuelve la credencial de OpenRouter,
 * arma el contexto, llama generatePresentationContent (aiContent.ts), y
 * siembra el resultado en ai_content + slides (slides queda editable de
 * forma independiente desde acá en adelante). */
export async function generatePresentationAiContentAction(presentationId: string): Promise<{ aiContent: Record<string, unknown>; slides: PresentationSlide[] } | { error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const service = createServiceRoleClient();
  const credentials = await resolveOpenRouterApiKey(service, workspaceId, "generar la presentación con IA");
  if (!credentials.ok) return { error: credentials.error };
  const apiKey = credentials.apiKey;

  const presentation = await getPresentationById(workspaceId, presentationId);
  if (!presentation) return { error: "Presentación no encontrada." };

  const supabase = await createClient();
  await supabase.from("presentations").update({ status: "generando", updated_at: new Date().toISOString() }).eq("id", presentationId).eq("workspace_id", workspaceId);

  try {
    const { aiContent, slides } = await generatePresentationContent(apiKey, presentation);

    await supabase
      .from("presentations")
      .update({ ai_content: aiContent, slides, status: "borrador", current_step: "vista_previa", updated_at: new Date().toISOString() })
      .eq("id", presentationId)
      .eq("workspace_id", workspaceId);

    const memberId = await getCurrentMemberId(workspaceId);
    await logActivity(supabase, workspaceId, memberId, "presentation", presentationId, "presentation_ai_generated", {});

    revalidatePresentations(presentationId);
    return { aiContent: aiContent as unknown as Record<string, unknown>, slides };
  } catch (err) {
    await supabase.from("presentations").update({ status: "borrador", updated_at: new Date().toISOString() }).eq("id", presentationId).eq("workspace_id", workspaceId);
    return { error: err instanceof Error ? err.message : "No se pudo generar la presentación con IA." };
  }
}

/** Finaliza: genera el slug público, arma el PDF (pdf.ts), lo sube al
 * bucket, marca status "lista". El QR se genera client-side a partir del
 * link público (ver FinalizarStep.tsx) — no hace falta persistir la imagen
 * del QR, se regenera al vuelo cada vez que se muestra. */
export async function finalizePresentationAction(presentationId: string): Promise<{ shareSlug: string; pdfStoragePath: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const presentation = await getPresentationById(workspaceId, presentationId);
  if (!presentation) throw new Error("Presentación no encontrada.");

  const shareSlug = presentation.shareSlug ?? slugify(presentation.title);

  const pdfBuffer = await buildPresentationPdf(presentation);
  const pdfPath = `${workspaceId}/${presentationId}/presentacion.pdf`;
  const service = createServiceRoleClient();
  const { error: uploadError } = await service.storage.from(BUCKET).upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error("No se pudo generar el PDF.");

  const { error } = await supabase
    .from("presentations")
    .update({
      status: "lista",
      current_step: "finalizar",
      share_slug: shareSlug,
      pdf_storage_path: pdfPath,
      completed_at: presentation.completedAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", presentationId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo finalizar la presentación.");

  await logActivity(supabase, workspaceId, memberId, "presentation", presentationId, "presentation_finalized", { shareSlug });

  revalidatePresentations(presentationId);
  return { shareSlug, pdfStoragePath: pdfPath };
}
