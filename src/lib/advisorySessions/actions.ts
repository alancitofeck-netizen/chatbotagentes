"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity/log";
import { findOrCreateContact } from "@/lib/contacts/match";
import { addContactNote } from "@/lib/contacts/actions";
import { createTask } from "@/lib/tasks/actions";
import { getOpenRouterCredentials } from "@/lib/integrations/openrouter";
import {
  getAdvisorySessionList,
  getAdvisorySessionById,
  type AdvisoryStep,
} from "@/lib/advisorySessions/queries";
import { analyzeAdvisorySessionWithAI, type AdvisorySessionAnalysis } from "@/lib/advisorySessions/aiAnalysis";

function revalidateAdvisorySessions() {
  revalidatePath("/asesoria-guiada");
}

export async function getAdvisorySessionListAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getAdvisorySessionList(workspaceId);
}

export async function getAdvisorySessionByIdAction(sessionId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getAdvisorySessionById(workspaceId, sessionId);
}

export interface AdvisorySessionContactInput {
  contactId?: string | null;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

/** Crea la sesión — con o sin cliente elegido todavía (se puede vincular
 * después desde el paso Perfil). Reusa el mismo dedupe por teléfono que
 * Pólizas, con su propio `source` para no mezclar el origen de los
 * contactos creados desde cada módulo. */
export async function createAdvisorySessionAction(input: AdvisorySessionContactInput): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  let contactId = input.contactId ?? null;
  if (!contactId && (input.contactName?.trim() || input.contactPhone?.trim() || input.contactEmail?.trim())) {
    contactId = await findOrCreateContact(
      supabase,
      workspaceId,
      { name: input.contactName, phone: input.contactPhone, email: input.contactEmail },
      "advisory_session",
    );
  }

  const { data, error } = await supabase
    .from("advisory_sessions")
    .insert({ workspace_id: workspaceId, contact_id: contactId, owner_id: memberId, created_by: memberId })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear la asesoría.");

  revalidateAdvisorySessions();
  return { id: data.id as string };
}

export async function linkAdvisorySessionContactAction(sessionId: string, input: AdvisorySessionContactInput): Promise<{ contactId: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const contactId =
    input.contactId ??
    (await findOrCreateContact(supabase, workspaceId, { name: input.contactName, phone: input.contactPhone, email: input.contactEmail }, "advisory_session"));

  const { error } = await supabase
    .from("advisory_sessions")
    .update({ contact_id: contactId, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo vincular el cliente.");

  revalidateAdvisorySessions();
  return { contactId };
}

export interface AdvisorySessionStepPatch {
  currentStep?: AdvisoryStep;
  profileData?: Record<string, unknown>;
  discoveryData?: Record<string, unknown>;
  branchKey?: string | null;
  branchAnswers?: Record<string, unknown>;
  summaryNotes?: string;
}

/** Autosave — el cliente manda el objeto acumulado completo de cada grupo
 * de campos (mismo criterio que PolicyPdfUploadSheet's patch()), así que
 * acá siempre es un UPDATE directo, nunca un merge parcial de jsonb. */
export async function updateAdvisorySessionStepAction(sessionId: string, patch: AdvisorySessionStepPatch): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.currentStep !== undefined) dbPatch.current_step = patch.currentStep;
  if (patch.profileData !== undefined) dbPatch.profile_data = patch.profileData;
  if (patch.discoveryData !== undefined) dbPatch.discovery_data = patch.discoveryData;
  if (patch.branchKey !== undefined) dbPatch.branch_key = patch.branchKey;
  if (patch.branchAnswers !== undefined) dbPatch.branch_answers = patch.branchAnswers;
  if (patch.summaryNotes !== undefined) dbPatch.summary_notes = patch.summaryNotes;

  const { error } = await supabase.from("advisory_sessions").update(dbPatch).eq("id", sessionId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo guardar.");
}

export async function analyzeAdvisorySessionAction(sessionId: string): Promise<AdvisorySessionAnalysis> {
  const { workspaceId } = await requireActiveWorkspace();
  const service = createServiceRoleClient();
  const credentials = await getOpenRouterCredentials(service, workspaceId);
  if (!credentials) throw new Error("Conectá OpenRouter primero (Perfil → Integraciones) para poder analizar la asesoría con IA.");

  const session = await getAdvisorySessionById(workspaceId, sessionId);
  if (!session) throw new Error("Asesoría no encontrada.");

  const analysis = await analyzeAdvisorySessionWithAI(credentials.apiKey, session);

  const supabase = await createClient();
  await supabase
    .from("advisory_sessions")
    .update({ ai_analysis: analysis, current_step: "analisis_ia", updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("workspace_id", workspaceId);

  revalidateAdvisorySessions();
  return analysis;
}

/** Cierre de la asesoría — crea automáticamente nota (en el contacto) +
 * tarea de seguimiento + actividad, con lógica fija (no configurable
 * todavía, ver alcance de Fase 1 acordado). No crea evento de calendario:
 * no hay una fecha de reunión de seguimiento capturada en ningún paso, así
 * que inventar una sería fabricar un dato, no automatizar uno real. */
export async function finalizeAdvisorySessionAction(sessionId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const session = await getAdvisorySessionById(workspaceId, sessionId);
  if (!session) throw new Error("Asesoría no encontrada.");

  const clientLabel = session.contactName ?? "el cliente";

  if (session.contactId) {
    const aiSummary = (session.aiAnalysis as { summary?: string } | null)?.summary;
    const summaryLines = [
      `Resumen de asesoría guiada con ${clientLabel}.`,
      session.branchKey ? `Ramo de interés: ${session.branchKey}.` : null,
      aiSummary ?? null,
    ].filter((l): l is string => Boolean(l));
    await addContactNote(session.contactId, summaryLines.join("\n"));

    await createTask({
      title: `Seguimiento: asesoría con ${clientLabel}`,
      description: "Generada automáticamente al finalizar la Asesoría Guiada.",
      priority: "medium",
      dueAt: null,
      assignedTo: session.ownerId ?? memberId ?? "",
      relatedType: "contact",
      relatedId: session.contactId,
    });
  }

  const { error } = await supabase
    .from("advisory_sessions")
    .update({ status: "completada", current_step: "resumen", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo finalizar la asesoría.");

  await logActivity(supabase, workspaceId, memberId, "advisory_session", sessionId, "advisory_session_completed", { contactName: session.contactName });

  revalidateAdvisorySessions();
}

export async function deleteAdvisorySessionAction(sessionId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await supabase.from("advisory_sessions").delete().eq("id", sessionId).eq("workspace_id", workspaceId);
  revalidateAdvisorySessions();
}
