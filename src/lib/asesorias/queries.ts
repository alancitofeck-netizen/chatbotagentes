import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AsesoriaStatus = "no_iniciada" | "en_progreso" | "finalizada";

export interface AsesoriaListItem {
  id: string;
  name: string;
  contactId: string | null;
  contactName: string | null;
  advisorName: string | null;
  status: AsesoriaStatus;
  templateName: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

const LIST_SELECT =
  "id, name, contact_id, advisor_id, status, template_name, started_at, updated_at, completed_at, contacts(name)";

/** Mismo patrón que getAdvisorySessionList (advisorySessions/queries.ts,
 * módulo que este reemplaza): un select + un solo round-trip a la RPC
 * workspace_member_names para resolver los nombres de asesor. */
export async function getAsesoriaList(workspaceId: string): Promise<AsesoriaListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("asesorias").select(LIST_SELECT).eq("workspace_id", workspaceId).order("updated_at", { ascending: false });
  const rows = data ?? [];

  const advisorIds = [...new Set(rows.map((r) => r.advisor_id).filter((id): id is string => Boolean(id)))];
  const { data: memberNames } = advisorIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map<string, string>((memberNames ?? []).map((m: { member_id: string; full_name: string }) => [m.member_id, m.full_name]));

  return rows.map((r) => {
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    return {
      id: r.id as string,
      name: r.name as string,
      contactId: r.contact_id as string | null,
      contactName: (contact?.name as string | undefined) ?? null,
      advisorName: r.advisor_id ? (nameByMember.get(r.advisor_id as string) ?? null) : null,
      status: r.status as AsesoriaStatus,
      templateName: r.template_name as string | null,
      startedAt: r.started_at as string,
      updatedAt: r.updated_at as string,
      completedAt: r.completed_at as string | null,
    };
  });
}

/** Pestaña "Asesorías" de ContactDetailPanel — mismo shape que la lista
 * general, filtrado por contacto. */
export async function getContactAsesorias(workspaceId: string, contactId: string): Promise<AsesoriaListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("asesorias")
    .select(LIST_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .order("updated_at", { ascending: false });
  const rows = data ?? [];

  const advisorIds = [...new Set(rows.map((r) => r.advisor_id).filter((id): id is string => Boolean(id)))];
  const { data: memberNames } = advisorIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map<string, string>((memberNames ?? []).map((m: { member_id: string; full_name: string }) => [m.member_id, m.full_name]));

  return rows.map((r) => {
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    return {
      id: r.id as string,
      name: r.name as string,
      contactId: r.contact_id as string | null,
      contactName: (contact?.name as string | undefined) ?? null,
      advisorName: r.advisor_id ? (nameByMember.get(r.advisor_id as string) ?? null) : null,
      status: r.status as AsesoriaStatus,
      templateName: r.template_name as string | null,
      startedAt: r.started_at as string,
      updatedAt: r.updated_at as string,
      completedAt: r.completed_at as string | null,
    };
  });
}

export interface AsesoriaRow {
  id: string;
  workspaceId: string;
  contactId: string | null;
  advisorId: string | null;
  opportunityId: string | null;
  name: string;
  status: AsesoriaStatus;
  currentSlide: number;
  templateName: string | null;
  state: Record<string, unknown>;
  contextSnapshot: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
}

const DETAIL_SELECT =
  "id, workspace_id, contact_id, advisor_id, opportunity_id, name, status, current_slide, template_name, state, context_snapshot, started_at, completed_at, updated_at";

export interface AsesoriaResponseRow {
  id: string;
  questionKey: string;
  question: string;
  answer: unknown;
  answerType: string;
  slideNumber: number | null;
  section: string | null;
  updatedAt: string;
}

/** Respuestas normalizadas (asesoria_responses, ver 0117_asesoria_responses.sql
 * y responseExtraction.ts) para la pantalla de solo lectura
 * /asesorias/[asesoriaId]/resumen — ordenadas para que coincidan con el
 * orden real de las diapositivas del Meeting OS (las que no cuelgan de una
 * diapositiva, como preMeeting/nextStep/referrals, quedan al final). */
export async function getAsesoriaResponses(workspaceId: string, asesoriaId: string): Promise<AsesoriaResponseRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("asesoria_responses")
    .select("id, question_key, question, answer, answer_type, slide_number, section, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("asesoria_id", asesoriaId)
    .order("slide_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    questionKey: r.question_key as string,
    question: r.question as string,
    answer: r.answer,
    answerType: r.answer_type as string,
    slideNumber: r.slide_number as number | null,
    section: r.section as string | null,
    updatedAt: r.updated_at as string,
  }));
}

export async function getAsesoriaById(workspaceId: string, asesoriaId: string): Promise<AsesoriaRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("asesorias").select(DETAIL_SELECT).eq("workspace_id", workspaceId).eq("id", asesoriaId).maybeSingle();
  if (!data) return null;

  return {
    id: data.id as string,
    workspaceId: data.workspace_id as string,
    contactId: data.contact_id as string | null,
    advisorId: data.advisor_id as string | null,
    opportunityId: data.opportunity_id as string | null,
    name: data.name as string,
    status: data.status as AsesoriaStatus,
    currentSlide: data.current_slide as number,
    templateName: data.template_name as string | null,
    state: (data.state as Record<string, unknown> | null) ?? {},
    contextSnapshot: (data.context_snapshot as Record<string, unknown> | null) ?? {},
    startedAt: data.started_at as string,
    completedAt: data.completed_at as string | null,
    updatedAt: data.updated_at as string,
  };
}
