"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getCompanyGroups, getContactDetail, getContactList } from "@/lib/contacts/queries";

export async function getContactListAction(filters: {
  search?: string;
  company?: string;
  tagId?: string;
  optStatus?: string;
}) {
  const { workspaceId } = await requireActiveWorkspace();
  return getContactList(workspaceId, filters);
}

export async function getContactDetailAction(contactId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getContactDetail(workspaceId, contactId);
}

export async function getCompanyGroupsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getCompanyGroups(workspaceId);
}

/** Same upsert-by-phone pattern as addCandidateToVacancy (src/lib/ats/actions.ts)
 * — relies on the unique(workspace_id, phone) constraint to dedupe. */
export async function createContact(input: {
  name: string;
  phone: string;
  email: string;
  company: string;
  source: string;
}): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  const supabase = await createClient();

  const phone = input.phone.trim() || null;
  const payload = {
    workspace_id: workspaceId,
    name: input.name.trim(),
    email: input.email.trim() || null,
    company: input.company.trim() || null,
    source: input.source.trim() || null,
  };

  const { data: contact, error } = phone
    ? await supabase
        .from("contacts")
        .upsert({ ...payload, phone }, { onConflict: "workspace_id,phone" })
        .select("id")
        .single()
    : await supabase.from("contacts").insert(payload).select("id").single();

  if (error || !contact) throw new Error("No se pudo crear el contacto.");
  revalidatePath("/inbox/contactos");
  return { id: contact.id as string };
}

export async function updateContact(
  contactId: string,
  input: {
    name: string;
    phone: string;
    email: string;
    company: string;
    source: string;
    whatsappOptStatus: "subscribed" | "unsubscribed" | "unknown";
  },
) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      company: input.company.trim() || null,
      source: input.source.trim() || null,
      whatsapp_opt_status: input.whatsappOptStatus,
    })
    .eq("id", contactId)
    .eq("workspace_id", workspaceId);

  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un contacto con ese teléfono.");
    throw new Error("No se pudo actualizar el contacto.");
  }
  revalidatePath("/inbox/contactos");
}

export async function addContactNote(contactId: string, body: string) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!body.trim()) return;
  const supabase = await createClient();

  await supabase.from("notes").insert({
    workspace_id: workspaceId,
    notable_type: "contact",
    notable_id: contactId,
    body: body.trim(),
  });

  revalidatePath("/inbox/contactos");
}
