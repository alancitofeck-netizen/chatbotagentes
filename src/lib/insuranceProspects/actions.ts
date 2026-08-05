"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import {
  getProspectsList,
  getProspectDetail,
  getProspectNotes,
  prospectStatusLabel,
  type ProspectStatus,
} from "@/lib/insuranceProspects/queries";

function revalidateProspectPaths(prospectId?: string) {
  revalidatePath("/polizas/posibles-polizas");
  if (prospectId) revalidatePath(`/polizas/posibles-polizas/${prospectId}`);
}

export async function getProspectsListAction() {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "insurance_prospects");
  return getProspectsList(workspaceId);
}

export async function getProspectDetailAction(prospectId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "insurance_prospects");
  return getProspectDetail(workspaceId, prospectId);
}

export async function getProspectNotesAction(prospectId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getProspectNotes(workspaceId, prospectId);
}

export async function addProspectNoteAction(prospectId: string, body: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  if (!body.trim()) return;
  const supabase = await createClient();
  await supabase.from("notes").insert({ workspace_id: workspaceId, notable_type: "insurance_prospect", notable_id: prospectId, body: body.trim() });
  revalidateProspectPaths(prospectId);
}

/** Status changes leave a system note in the same `notes` table used for the
 * advisor's own notes — the Actividad tab's timeline reads just one table
 * ordered by date, so "cambios de estado" show up in the cronología without
 * a separate status-history table. */
export async function updateProspectStatusAction(prospectId: string, status: ProspectStatus): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "insurance_prospects");
  const supabase = await createClient();
  await supabase
    .from("insurance_prospects")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", prospectId)
    .eq("workspace_id", workspaceId);
  await supabase.from("notes").insert({
    workspace_id: workspaceId,
    notable_type: "insurance_prospect",
    notable_id: prospectId,
    body: `Cambió de estado a "${prospectStatusLabel(status)}".`,
  });
  revalidateProspectPaths(prospectId);
}

export async function assignProspectOwnerAction(prospectId: string, ownerAgentId: string | null): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "insurance_prospects");
  const supabase = await createClient();
  await supabase
    .from("insurance_prospects")
    .update({ owner_agent_id: ownerAgentId, updated_at: new Date().toISOString() })
    .eq("id", prospectId)
    .eq("workspace_id", workspaceId);
  revalidateProspectPaths(prospectId);
}

export interface ProspectFieldUpdates {
  fullName?: string | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  sex?: string | null;
  maritalStatus?: string | null;
  profession?: string | null;
  occupation?: string | null;
  employer?: string | null;
  employmentTenureMonths?: number | null;
  monthlyIncome?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  smoker?: boolean | null;
  drinksAlcohol?: boolean | null;
  exercises?: boolean | null;
  education?: string | null;
  degree?: string | null;
  specializations?: string | null;
  hobbies?: string | null;
  sports?: string | null;
  interests?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
}

const FIELD_TO_COLUMN: Record<keyof ProspectFieldUpdates, string> = {
  fullName: "full_name",
  dateOfBirth: "date_of_birth",
  placeOfBirth: "place_of_birth",
  sex: "sex",
  maritalStatus: "marital_status",
  profession: "profession",
  occupation: "occupation",
  employer: "employer",
  employmentTenureMonths: "employment_tenure_months",
  monthlyIncome: "monthly_income",
  heightCm: "height_cm",
  weightKg: "weight_kg",
  smoker: "smoker",
  drinksAlcohol: "drinks_alcohol",
  exercises: "exercises",
  education: "education",
  degree: "degree",
  specializations: "specializations",
  hobbies: "hobbies",
  sports: "sports",
  interests: "interests",
  phone: "phone",
  email: "email",
  city: "city",
  province: "province",
  country: "country",
};

/** Edits made from the ficha's tabs (Información Personal/Salud y Perfil/
 * Laboral) — a generic field-name-to-column mapper so each tab doesn't need
 * its own bespoke Server Action, mirroring updateMiniApp's one-action-many-
 * fields shape. */
export async function updateProspectFieldsAction(prospectId: string, updates: ProspectFieldUpdates): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "insurance_prospects");
  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    const column = FIELD_TO_COLUMN[key as keyof ProspectFieldUpdates];
    if (column) patch[column] = value;
  }
  if (Object.keys(patch).length === 0) return;
  patch.updated_at = new Date().toISOString();

  await supabase.from("insurance_prospects").update(patch).eq("id", prospectId).eq("workspace_id", workspaceId);
  revalidateProspectPaths(prospectId);
}
