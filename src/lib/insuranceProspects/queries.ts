import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateAge, type ProspectStatus } from "@/lib/insuranceProspects/statusOptions";

export type { ProspectStatus } from "@/lib/insuranceProspects/statusOptions";
export { PROSPECT_STATUS_OPTIONS, prospectStatusLabel, calculateAge } from "@/lib/insuranceProspects/statusOptions";

export interface ProspectListItem {
  id: string;
  contactId: string;
  fullName: string;
  age: number | null;
  occupation: string | null;
  maritalStatus: string | null;
  smoker: boolean | null;
  city: string | null;
  ownerAgentName: string | null;
  status: ProspectStatus;
  createdAt: string;
}

async function getMemberNamesById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  return new Map(((data ?? []) as { member_id: string; full_name: string }[]).map((r) => [r.member_id, r.full_name]));
}

interface ContactEmbed {
  name: string;
}

function unwrapEmbed<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getProspectsList(workspaceId: string): Promise<ProspectListItem[]> {
  const supabase = await createClient();
  const [{ data: rows }, memberNames] = await Promise.all([
    supabase
      .from("insurance_prospects")
      .select("id, contact_id, full_name, date_of_birth, occupation, marital_status, smoker, city, owner_agent_id, status, created_at, contacts(name)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    getMemberNamesById(supabase, workspaceId),
  ]);

  return (rows ?? []).map((r) => {
    const contact = unwrapEmbed<ContactEmbed>(r.contacts as ContactEmbed | ContactEmbed[] | null);
    return {
      id: r.id as string,
      contactId: r.contact_id as string,
      fullName: contact?.name ?? (r.full_name as string | null) ?? "Sin nombre",
      age: calculateAge(r.date_of_birth as string | null),
      occupation: r.occupation as string | null,
      maritalStatus: r.marital_status as string | null,
      smoker: r.smoker as boolean | null,
      city: r.city as string | null,
      ownerAgentName: r.owner_agent_id ? (memberNames.get(r.owner_agent_id as string) ?? null) : null,
      status: r.status as ProspectStatus,
      createdAt: r.created_at as string,
    };
  });
}

export interface ProspectDetail {
  id: string;
  workspaceId: string;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  miniAppId: string | null;
  miniAppLeadId: string | null;
  origenAppNombre: string | null;
  ownerAgentId: string | null;
  ownerAgentName: string | null;
  status: ProspectStatus;
  age: number | null;
  fullName: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  sex: string | null;
  maritalStatus: string | null;
  profession: string | null;
  occupation: string | null;
  employer: string | null;
  employmentTenureMonths: number | null;
  monthlyIncome: number | null;
  heightCm: number | null;
  weightKg: number | null;
  smoker: boolean | null;
  drinksAlcohol: boolean | null;
  exercises: boolean | null;
  education: string | null;
  degree: string | null;
  specializations: string | null;
  hobbies: string | null;
  sports: string | null;
  interests: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  extraFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export async function getProspectDetail(workspaceId: string, prospectId: string): Promise<ProspectDetail | null> {
  const supabase = await createClient();
  const [{ data: row }, memberNames] = await Promise.all([
    supabase
      .from("insurance_prospects")
      .select("*, contacts(name, phone)")
      .eq("workspace_id", workspaceId)
      .eq("id", prospectId)
      .maybeSingle(),
    getMemberNamesById(supabase, workspaceId),
  ]);
  if (!row) return null;

  const contact = unwrapEmbed<{ name: string; phone: string | null }>(
    row.contacts as { name: string; phone: string | null } | { name: string; phone: string | null }[] | null,
  );

  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    contactId: row.contact_id as string,
    contactName: contact?.name ?? (row.full_name as string | null) ?? "Sin nombre",
    contactPhone: contact?.phone ?? null,
    miniAppId: row.mini_app_id as string | null,
    miniAppLeadId: row.mini_app_lead_id as string | null,
    origenAppNombre: row.origen_app_nombre as string | null,
    ownerAgentId: row.owner_agent_id as string | null,
    ownerAgentName: row.owner_agent_id ? (memberNames.get(row.owner_agent_id as string) ?? null) : null,
    status: row.status as ProspectStatus,
    age: calculateAge(row.date_of_birth as string | null),
    fullName: row.full_name as string | null,
    dateOfBirth: row.date_of_birth as string | null,
    placeOfBirth: row.place_of_birth as string | null,
    sex: row.sex as string | null,
    maritalStatus: row.marital_status as string | null,
    profession: row.profession as string | null,
    occupation: row.occupation as string | null,
    employer: row.employer as string | null,
    employmentTenureMonths: row.employment_tenure_months as number | null,
    monthlyIncome: row.monthly_income as number | null,
    heightCm: row.height_cm as number | null,
    weightKg: row.weight_kg as number | null,
    smoker: row.smoker as boolean | null,
    drinksAlcohol: row.drinks_alcohol as boolean | null,
    exercises: row.exercises as boolean | null,
    education: row.education as string | null,
    degree: row.degree as string | null,
    specializations: row.specializations as string | null,
    hobbies: row.hobbies as string | null,
    sports: row.sports as string | null,
    interests: row.interests as string | null,
    phone: row.phone as string | null,
    email: row.email as string | null,
    city: row.city as string | null,
    province: row.province as string | null,
    country: row.country as string | null,
    extraFields: (row.extra_fields as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface ProspectNote {
  id: string;
  body: string;
  createdAt: string;
}

export async function getProspectNotes(workspaceId: string, prospectId: string): Promise<ProspectNote[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("id, body, created_at")
    .eq("workspace_id", workspaceId)
    .eq("notable_type", "insurance_prospect")
    .eq("notable_id", prospectId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((n) => ({ id: n.id as string, body: n.body as string, createdAt: n.created_at as string }));
}
