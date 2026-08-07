"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { findOrCreateContact } from "@/lib/contacts/match";
import { getAsesoriaList, getContactAsesorias, getAsesoriaById, type AsesoriaListItem } from "@/lib/asesorias/queries";
import { buildAsesoriaSeed } from "@/lib/asesorias/seed";

const ASESORIA_CONTACT_SOURCE = "asesoria";

export async function getAsesoriaListAction(): Promise<AsesoriaListItem[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getAsesoriaList(workspaceId);
}

export async function getContactAsesoriasAction(contactId: string): Promise<AsesoriaListItem[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getContactAsesorias(workspaceId, contactId);
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

  const seed = buildAsesoriaSeed({
    contact,
    advisorName,
    brand: { companyName: (workspace?.name as string | undefined) ?? undefined, advisorName: advisorName ?? undefined },
    continuable: Boolean(contactId),
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
