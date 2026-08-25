"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { findOrCreateContact } from "@/lib/contacts/match";
import { getAsesoriaList, getContactAsesorias, getAsesoriaById, getWorkspaceReferralActivity, type AsesoriaListItem, type ReferralActivityPoint } from "@/lib/asesorias/queries";
import { buildAsesoriaSeed } from "@/lib/asesorias/seed";
import { getAsesoriaMasterTemplate } from "@/lib/asesorias/masterTemplate";
import { getWorkspaceReferrals, updateReferralStatus, type ReferralRow, type ReferralStatus } from "@/lib/asesorias/referrals";
import { getDefaultOutboundBusinessNumber, getOrCreateOpenConversationForContact } from "@/lib/messaging/conversations";
import { generateReferralOpener } from "@/lib/ai/agentRuntime";
import { sendOutboundWhatsAppMessage } from "@/lib/messaging/send";
import { logActivity } from "@/lib/activity/log";

const ASESORIA_CONTACT_SOURCE = "asesoria";

export async function getAsesoriaListAction(): Promise<AsesoriaListItem[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getAsesoriaList(workspaceId);
}

export async function getContactAsesoriasAction(contactId: string): Promise<AsesoriaListItem[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getContactAsesorias(workspaceId, contactId);
}

export async function getAsesoriaReferralActivityAction(): Promise<ReferralActivityPoint[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getWorkspaceReferralActivity(workspaceId);
}

export async function getAsesoriaReferralsAction(): Promise<ReferralRow[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getWorkspaceReferrals(workspaceId);
}

export async function updateReferralStatusAction(referralId: string, status: ReferralStatus): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await updateReferralStatus(referralId, workspaceId, status);
  revalidatePath("/asesorias/referidos");
}

/** "🚀 Iniciar conversación" (Fase 4, Agentes IA de Referidos, punto 4) —
 * valida referido autorizado + workspace + teléfono + WhatsApp habilitado,
 * resuelve el agente de referidos (misma desambiguación por advisor_id que
 * decisionEngine.ts) y genera el mensaje inicial. NO envía nada todavía —
 * crea/obtiene la conversación en mode:'human' y devuelve el borrador para
 * que el asesor lo edite; sendReferralConversationMessageAction hace el
 * envío real recién cuando el asesor confirma. */
export async function startReferralConversationAction(
  referralId: string,
): Promise<{ ok: true; conversationId: string; draftMessage: string } | { ok: false; error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { data: referral } = await supabase
    .from("asesoria_referrals")
    .select("id, phone, referred_contact_id, advisor_id")
    .eq("id", referralId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!referral) return { ok: false, error: "Referido no encontrado en este workspace." };
  if (!referral.referred_contact_id) {
    return { ok: false, error: "Este referido todavía no tiene un contacto vinculado — esperá al próximo autoguardado de la asesoría." };
  }
  if (!referral.phone) return { ok: false, error: "Este referido no tiene teléfono cargado." };

  const businessNumber = await getDefaultOutboundBusinessNumber(supabase, workspaceId);
  if (!businessNumber) return { ok: false, error: "Este workspace todavía no tiene WhatsApp conectado (YCloud o WhatsApp Web)." };

  // Mismo criterio de desambiguación que decisionEngine.ts: preferir el
  // agente cuyo advisor_id coincide con el del referido, si no el agente
  // "para todo el workspace" (advisor_id null).
  const { data: agentsRaw } = await supabase
    .from("ai_agents")
    .select("id, advisor_id")
    .eq("workspace_id", workspaceId)
    .eq("module_key", "referrals")
    .eq("status", "active")
    .contains("channels", ["whatsapp"]);
  let agents = agentsRaw ?? [];
  if (agents.length > 1) {
    const matching = agents.filter((a) => a.advisor_id === referral.advisor_id);
    agents = matching.length > 0 ? matching : agents.filter((a) => a.advisor_id === null);
  }
  if (agents.length === 0) return { ok: false, error: "No hay ningún Agente IA de Referidos activo en este workspace." };
  if (agents.length > 1) return { ok: false, error: "Hay más de un Agente IA de Referidos activo — dejá uno solo para este asesor." };
  const agent = agents[0];

  const { data: prompt } = await supabase.from("ai_prompts").select("id").eq("agent_id", agent.id).eq("status", "active").maybeSingle();
  if (!prompt) return { ok: false, error: "El Agente IA de Referidos todavía no tiene ningún prompt activo." };

  const conversationId = await getOrCreateOpenConversationForContact(
    supabase,
    workspaceId,
    referral.referred_contact_id as string,
    businessNumber,
    memberId,
  );

  const generated = await generateReferralOpener({ workspaceId, conversationId, promptId: prompt.id as string, agentId: agent.id as string });
  if ("error" in generated) return { ok: false, error: generated.error };

  return { ok: true, conversationId, draftMessage: generated.text };
}

/** Confirma y envía el mensaje inicial (editado o no) — recién acá la
 * conversación pasa a mode:'ai', para que el Agente IA de Referidos
 * atienda las respuestas siguientes (mismo criterio que el flujo de
 * "aprobar borrador" ya existente en el Inbox: senderType:'agent' porque un
 * humano es quien efectivamente aprieta enviar, aunque el texto lo haya
 * redactado la IA). */
export async function sendReferralConversationMessageAction(
  conversationId: string,
  message: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const trimmed = message.trim();
  if (!trimmed) return { ok: false, error: "El mensaje no puede estar vacío." };

  const result = await sendOutboundWhatsAppMessage({
    supabase,
    workspaceId,
    conversationId,
    content: trimmed,
    senderType: "agent",
    senderId: memberId,
  });
  if (!result.ok) return { ok: false, error: result.error };

  await supabase.from("conversations").update({ mode: "ai" }).eq("id", conversationId).eq("workspace_id", workspaceId);
  await logActivity(supabase, workspaceId, memberId, "conversation", conversationId, "referral_conversation_started", {});

  revalidatePath("/asesorias/referidos");
  revalidatePath("/inbox");
  return { ok: true };
}

export interface CreateAsesoriaInput {
  name?: string;
  contactId?: string | null;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contextSnapshot?: Record<string, unknown>;
}

/** Crea la fila y la siembra — mismo criterio que
 * createAdvisorySessionAction (advisorySessions/actions.ts, módulo que este
 * reemplaza): si no viene un contactId pero sí nombre/teléfono/email,
 * resuelve-o-crea el contacto vía findOrCreateContact (mismo helper que ya
 * usan Asesoría Guiada y Pólizas). `continuable: true` cuando queda un
 * contacto vinculado — ver seed.ts para por qué. */
export async function createAsesoriaAction(input: CreateAsesoriaInput): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  let contactId = input.contactId ?? null;
  if (!contactId && (input.contactName || input.contactPhone || input.contactEmail)) {
    contactId = await findOrCreateContact(
      supabase,
      workspaceId,
      { name: input.contactName, phone: input.contactPhone, email: input.contactEmail },
      ASESORIA_CONTACT_SOURCE,
    );
  }

  interface ContactRow {
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
  }
  let contact: ContactRow | null = null;
  if (contactId) {
    const { data } = await supabase.from("contacts").select("name, email, phone, company").eq("id", contactId).eq("workspace_id", workspaceId).maybeSingle();
    contact = (data ?? null) as ContactRow | null;
  }

  const { data: workspace } = await supabase.from("workspaces").select("name").eq("id", workspaceId).maybeSingle();
  const { data: memberNames } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  const advisorName = ((memberNames ?? []) as { member_id: string; full_name: string }[]).find((m) => m.member_id === memberId)?.full_name ?? null;
  const baseTemplate = memberId ? await getAsesoriaMasterTemplate(workspaceId, memberId) : null;

  const seed = buildAsesoriaSeed({
    contact,
    advisorName,
    brand: { companyName: (workspace?.name as string | undefined) ?? undefined, advisorName: advisorName ?? undefined },
    continuable: Boolean(contactId),
    baseTemplate,
  });

  const { data: created, error } = await supabase
    .from("asesorias")
    .insert({
      workspace_id: workspaceId,
      contact_id: contactId,
      advisor_id: memberId,
      created_by: memberId,
      name: input.name?.trim() || contact?.name || "Nueva asesoría",
      status: "en_progreso",
      current_slide: seed.session.progress,
      template_name: (seed.template as { name?: string }).name ?? null,
      state: seed,
      context_snapshot: input.contextSnapshot ?? {},
    })
    .select("id")
    .single();
  if (error || !created) throw new Error("No se pudo crear la asesoría.");

  revalidatePath("/asesorias");
  return { id: created.id as string };
}

/** Crea una copia fresca (sin respuestas) del mismo contacto — mismo botón
 * "Duplicar" que ya existe en el historial de un contacto. Reusa
 * createAsesoriaAction con el mismo contactId, no copia `state` de la
 * original (arranca de cero a propósito, "asesoría nueva"). */
export async function duplicateAsesoriaAction(asesoriaId: string): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const original = await getAsesoriaById(workspaceId, asesoriaId);
  if (!original) throw new Error("Asesoría no encontrada.");
  return createAsesoriaAction({ name: `${original.name} (copia)`, contactId: original.contactId, contextSnapshot: original.contextSnapshot });
}

export async function deleteAsesoriaAction(asesoriaId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await supabase.from("asesorias").delete().eq("id", asesoriaId).eq("workspace_id", workspaceId);
  revalidatePath("/asesorias");
}
