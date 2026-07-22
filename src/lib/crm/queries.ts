import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
}

export interface OpportunityTag {
  id: string;
  name: string;
  color: string;
}

export interface OpportunityCard {
  id: string;
  pipelineItemId: string;
  stageId: string;
  position: number;
  title: string;
  value: number;
  currency: string;
  priority: "high" | "medium" | "low";
  probability: number | null;
  expectedCloseDate: string | null;
  calendarEventId: string | null;
  contactId: string;
  contactName: string;
  contactAvatarUrl: string | null;
  company: string | null;
  jobTitle: string | null;
  source: string | null;
  email: string | null;
  phone: string | null;
  tags: OpportunityTag[];
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string;
  lastContactAt: string | null;
  nextMeeting: { subject: string | null; startTime: string } | null;
  lastNote: { body: string; createdAt: string } | null;
  daysSinceActivity: number | null;
}

export interface BoardKpis {
  totalOpportunities: number;
  newLeadsThisMonth: number;
  newLeadsDeltaPct: number | null;
  meetingsScheduled: number;
  proposalsSent: number;
  dealsWonThisMonth: number;
  dealsWonDeltaPct: number | null;
  totalPipelineValue: number;
  monthlyConversionRate: number;
  monthlyConversionDeltaPct: number | null;
}

export interface CrmBoard {
  pipelineId: string;
  pipelineName: string;
  stages: PipelineStage[];
  cardsByStage: Record<string, OpportunityCard[]>;
  kpis: BoardKpis;
}

export interface CrmPipelineOption {
  id: string;
  name: string;
}

/** For the pipeline switcher in CrmBoardShell — only rendered when a
 * workspace has more than one `module_key='crm'` pipeline. */
export async function getCrmPipelines(workspaceId: string): Promise<CrmPipelineOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipelines")
    .select("id, name, created_at")
    .eq("workspace_id", workspaceId)
    .eq("module_key", "crm")
    .order("created_at", { ascending: true });
  return (data ?? []).map((p) => ({ id: p.id as string, name: p.name as string }));
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function monthBounds(monthsAgo: number) {
  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() - monthsAgo, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

/** A workspace's sales pipeline (module_key='crm'). Defaults to the oldest
 * one when `pipelineId` isn't passed — workspaces can now have more than one
 * (see `getCrmPipelines`/`createPipeline` in actions.ts), switched via the
 * `?pipeline=` query param in CrmBoardShell. */
export async function getCrmBoard(workspaceId: string, pipelineId?: string): Promise<CrmBoard | null> {
  const supabase = await createClient();

  const pipelineQuery = supabase
    .from("pipelines")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("module_key", "crm");

  const { data: pipeline } = pipelineId
    ? await pipelineQuery.eq("id", pipelineId).maybeSingle()
    : await pipelineQuery.order("created_at", { ascending: true }).limit(1).maybeSingle();

  if (!pipeline) return null;

  const [{ data: stages }, { data: items }] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name, position, is_won, is_lost")
      .eq("pipeline_id", pipeline.id)
      .order("position", { ascending: true }),
    supabase
      .from("pipeline_items")
      .select("id, stage_id, position, item_id")
      .eq("pipeline_id", pipeline.id)
      .eq("item_type", "opportunity")
      .order("position", { ascending: true }),
  ]);

  const opportunityIds = (items ?? []).map((i) => i.item_id as string);

  const { data: opportunities } = opportunityIds.length
    ? await supabase
        .from("opportunities")
        .select(
          "id, title, value, currency, priority, probability, expected_close_date, calendar_event_id, status, owner_id, created_at, updated_at, contacts(id, name, company, avatar_url, source, email, phone, custom_fields)",
        )
        .in("id", opportunityIds)
    : { data: [] };

  const contactIds = Array.from(
    new Set(
      (opportunities ?? [])
        .map((o) => {
          const contact = Array.isArray(o.contacts) ? o.contacts[0] : o.contacts;
          return contact?.id as string | undefined;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const ownerIds = Array.from(
    new Set((opportunities ?? []).map((o) => o.owner_id as string | null).filter((id): id is string => Boolean(id))),
  );

  const [
    { data: contactTagRows },
    { data: names },
    { data: conversations },
    { data: bookings },
    { data: notes },
  ] = await Promise.all([
    contactIds.length
      ? supabase.from("contact_tags").select("contact_id, tags(id, name, color)").in("contact_id", contactIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length ? supabase.rpc("workspace_member_names", { ws_id: workspaceId }) : Promise.resolve({ data: [] }),
    contactIds.length
      ? supabase
          .from("conversations")
          .select("contact_id, last_message_at")
          .eq("workspace_id", workspaceId)
          .in("contact_id", contactIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("bookings")
      .select("contact_id, subject, start_time, status")
      .eq("workspace_id", workspaceId)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true }),
    opportunityIds.length
      ? supabase
          .from("notes")
          .select("notable_id, body, created_at")
          .eq("workspace_id", workspaceId)
          .eq("notable_type", "opportunity")
          .in("notable_id", opportunityIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const tagsByContact = new Map<string, OpportunityTag[]>();
  for (const row of contactTagRows ?? []) {
    const tag = Array.isArray(row.tags) ? row.tags[0] : row.tags;
    if (!tag) continue;
    const list = tagsByContact.get(row.contact_id as string) ?? [];
    list.push({ id: tag.id as string, name: tag.name as string, color: tag.color as string });
    tagsByContact.set(row.contact_id as string, list);
  }

  const nameByOwnerId = new Map(
    ((names ?? []) as { member_id: string; full_name: string }[]).map((n) => [n.member_id, n.full_name]),
  );

  const lastContactByContact = new Map<string, string>();
  for (const c of conversations ?? []) {
    if (!c.last_message_at) continue;
    const contactId = c.contact_id as string;
    const current = lastContactByContact.get(contactId);
    if (!current || (c.last_message_at as string) > current) {
      lastContactByContact.set(contactId, c.last_message_at as string);
    }
  }

  const now = new Date();
  const nextMeetingByContact = new Map<string, { subject: string | null; startTime: string }>();
  let meetingsScheduled = 0;
  for (const b of bookings ?? []) {
    if (new Date(b.start_time as string) >= now) {
      meetingsScheduled += 1;
      const contactId = b.contact_id as string;
      if (!nextMeetingByContact.has(contactId)) {
        nextMeetingByContact.set(contactId, { subject: b.subject as string | null, startTime: b.start_time as string });
      }
    }
  }

  const lastNoteByOpportunity = new Map<string, { body: string; createdAt: string }>();
  for (const n of notes ?? []) {
    const oppId = n.notable_id as string;
    if (!lastNoteByOpportunity.has(oppId)) {
      lastNoteByOpportunity.set(oppId, { body: n.body as string, createdAt: n.created_at as string });
    }
  }

  const opportunityById = new Map((opportunities ?? []).map((o) => [o.id as string, o]));

  const cardsByStage: Record<string, OpportunityCard[]> = {};
  for (const stage of stages ?? []) {
    cardsByStage[stage.id as string] = [];
  }

  for (const item of items ?? []) {
    const opp = opportunityById.get(item.item_id as string);
    if (!opp) continue;
    const contact = Array.isArray(opp.contacts) ? opp.contacts[0] : opp.contacts;
    const contactId = (contact?.id as string) ?? "";
    const stageId = item.stage_id as string;
    const customFields = (contact?.custom_fields as Record<string, unknown> | null) ?? {};
    const lastContactAt = lastContactByContact.get(contactId) ?? null;
    const lastNote = lastNoteByOpportunity.get(opp.id as string) ?? null;
    const activityTimestamps = [lastContactAt, lastNote?.createdAt, opp.created_at as string].filter(
      (v): v is string => Boolean(v),
    );
    const mostRecentActivity = activityTimestamps.sort().at(-1) ?? null;
    const daysSinceActivity = mostRecentActivity
      ? Math.floor((now.getTime() - new Date(mostRecentActivity).getTime()) / 86_400_000)
      : null;

    const card: OpportunityCard = {
      id: opp.id as string,
      pipelineItemId: item.id as string,
      stageId,
      position: item.position as number,
      title: opp.title as string,
      value: Number(opp.value ?? 0),
      currency: opp.currency as string,
      priority: (opp.priority as "high" | "medium" | "low" | null) ?? "medium",
      probability: opp.probability === null || opp.probability === undefined ? null : Number(opp.probability),
      expectedCloseDate: (opp.expected_close_date as string | null) ?? null,
      calendarEventId: (opp.calendar_event_id as string | null) ?? null,
      contactId,
      contactName: contact?.name ?? "Sin nombre",
      contactAvatarUrl: contact?.avatar_url ?? null,
      company: contact?.company ?? null,
      jobTitle: (customFields.job_title as string | undefined) ?? null,
      source: contact?.source ?? null,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      tags: tagsByContact.get(contactId) ?? [],
      ownerId: (opp.owner_id as string | null) ?? null,
      ownerName: opp.owner_id ? (nameByOwnerId.get(opp.owner_id as string) ?? null) : null,
      createdAt: opp.created_at as string,
      lastContactAt,
      nextMeeting: nextMeetingByContact.get(contactId) ?? null,
      lastNote,
      daysSinceActivity,
    };
    if (!cardsByStage[stageId]) cardsByStage[stageId] = [];
    cardsByStage[stageId].push(card);
  }

  const stageList: PipelineStage[] = (stages ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    position: s.position as number,
    isWon: s.is_won as boolean,
    isLost: s.is_lost as boolean,
  }));

  // "Propuestas enviadas": no dedicated stage-type flag exists beyond is_won/is_lost —
  // heuristic match on stage name, documented; falls back to 0 if no stage matches.
  const proposalsStage = stageList.find((s) => !s.isWon && !s.isLost && /propuesta/i.test(s.name));
  const proposalsSent = proposalsStage ? (cardsByStage[proposalsStage.id]?.length ?? 0) : 0;

  const totalOpportunities = (opportunities ?? []).length;
  const totalPipelineValue = stageList
    .filter((s) => !s.isWon && !s.isLost)
    .reduce((sum, s) => sum + (cardsByStage[s.id] ?? []).reduce((inner, c) => inner + c.value, 0), 0);

  const thisMonth = monthBounds(0);
  const lastMonth = monthBounds(1);
  const inRange = (iso: string, range: { start: Date; end: Date }) => {
    const t = new Date(iso);
    return t >= range.start && t < range.end;
  };

  const newLeadsThisMonth = (opportunities ?? []).filter((o) => inRange(o.created_at as string, thisMonth)).length;
  const newLeadsLastMonth = (opportunities ?? []).filter((o) => inRange(o.created_at as string, lastMonth)).length;

  // Deals "won"/"lost" this month are bucketed by `opportunities.updated_at` (moveOpportunityCard
  // now stamps it on every stage change, see src/lib/crm/actions.ts) rather than `created_at` —
  // a deal opened in a prior month and won this month should count as this month's win.
  const wonStageIds = new Set(stageList.filter((s) => s.isWon).map((s) => s.id));
  const lostStageIds = new Set(stageList.filter((s) => s.isLost).map((s) => s.id));
  const stageIdByOpportunity = new Map<string, string>();
  for (const item of items ?? []) stageIdByOpportunity.set(item.item_id as string, item.stage_id as string);

  const wonThisMonth = (opportunities ?? []).filter(
    (o) => wonStageIds.has(stageIdByOpportunity.get(o.id as string) ?? "") && inRange(o.updated_at as string, thisMonth),
  ).length;
  const lostThisMonth = (opportunities ?? []).filter(
    (o) => lostStageIds.has(stageIdByOpportunity.get(o.id as string) ?? "") && inRange(o.updated_at as string, thisMonth),
  ).length;
  const wonLastMonth = (opportunities ?? []).filter(
    (o) => wonStageIds.has(stageIdByOpportunity.get(o.id as string) ?? "") && inRange(o.updated_at as string, lastMonth),
  ).length;
  const lostLastMonth = (opportunities ?? []).filter(
    (o) => lostStageIds.has(stageIdByOpportunity.get(o.id as string) ?? "") && inRange(o.updated_at as string, lastMonth),
  ).length;

  const monthlyConversionRate = wonThisMonth + lostThisMonth > 0 ? Math.round((wonThisMonth / (wonThisMonth + lostThisMonth)) * 1000) / 10 : 0;
  const conversionLastMonth = wonLastMonth + lostLastMonth > 0 ? Math.round((wonLastMonth / (wonLastMonth + lostLastMonth)) * 1000) / 10 : 0;

  const kpis: BoardKpis = {
    totalOpportunities,
    newLeadsThisMonth,
    newLeadsDeltaPct: deltaPct(newLeadsThisMonth, newLeadsLastMonth),
    meetingsScheduled,
    proposalsSent,
    dealsWonThisMonth: wonThisMonth,
    dealsWonDeltaPct: deltaPct(wonThisMonth, wonLastMonth),
    totalPipelineValue,
    monthlyConversionRate,
    monthlyConversionDeltaPct: deltaPct(monthlyConversionRate, conversionLastMonth),
  };

  return {
    pipelineId: pipeline.id as string,
    pipelineName: pipeline.name as string,
    stages: stageList,
    cardsByStage,
    kpis,
  };
}

export interface OpportunityDetail {
  id: string;
  workspaceId: string;
  title: string;
  value: number;
  currency: string;
  status: string;
  priority: "high" | "medium" | "low";
  probability: number | null;
  expectedCloseDate: string | null;
  calendarEventId: string | null;
  ownerId: string | null;
  tags: OpportunityTag[];
  contact: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
  };
  createdAt: string;
  notes: { id: string; body: string; createdAt: string }[];
}

export async function getOpportunityDetail(
  workspaceId: string,
  opportunityId: string,
): Promise<OpportunityDetail | null> {
  const supabase = await createClient();

  const { data: opp } = await supabase
    .from("opportunities")
    .select(
      "id, title, value, currency, status, priority, probability, expected_close_date, calendar_event_id, owner_id, created_at, contacts(id, name, company, email, phone)",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", opportunityId)
    .maybeSingle();

  if (!opp) return null;

  const contact = Array.isArray(opp.contacts) ? opp.contacts[0] : opp.contacts;

  const [{ data: notes }, { data: tagRows }] = await Promise.all([
    supabase
      .from("notes")
      .select("id, body, created_at")
      .eq("workspace_id", workspaceId)
      .eq("notable_type", "opportunity")
      .eq("notable_id", opportunityId)
      .order("created_at", { ascending: false }),
    contact?.id
      ? supabase.from("contact_tags").select("tags(id, name, color)").eq("contact_id", contact.id)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    id: opp.id as string,
    workspaceId,
    title: opp.title as string,
    value: Number(opp.value ?? 0),
    currency: opp.currency as string,
    status: opp.status as string,
    priority: (opp.priority as "high" | "medium" | "low" | null) ?? "medium",
    probability: opp.probability === null || opp.probability === undefined ? null : Number(opp.probability),
    expectedCloseDate: (opp.expected_close_date as string | null) ?? null,
    calendarEventId: (opp.calendar_event_id as string | null) ?? null,
    ownerId: (opp.owner_id as string | null) ?? null,
    tags: (tagRows ?? [])
      .map((r) => (Array.isArray(r.tags) ? r.tags[0] : r.tags))
      .filter((t): t is { id: string; name: string; color: string } => Boolean(t))
      .map((t) => ({ id: t.id as string, name: t.name as string, color: t.color as string })),
    contact: {
      id: contact?.id ?? "",
      name: contact?.name ?? "Sin nombre",
      company: contact?.company ?? null,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
    },
    createdAt: opp.created_at as string,
    notes: (notes ?? []).map((n) => ({
      id: n.id as string,
      body: n.body as string,
      createdAt: n.created_at as string,
    })),
  };
}

export interface OpportunityActivityEntry {
  id: string;
  action: string;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  opportunity_created: "Oportunidad creada",
  opportunity_updated: "Oportunidad actualizada",
  opportunity_deleted: "Oportunidad eliminada",
  opportunity_stage_changed: "Cambió de etapa",
};

/** Feeds CardDetailSheet's "Historial" tab — reads the same `audit_log`
 * table the AI engine already writes to (0020_agent_engine_core.sql), now
 * that CRM mutations write to it too (see logOpportunityActivity in
 * actions.ts). Never includes note text — the "Notas" tab already shows
 * that, duplicating it here would just be noise. */
export async function getOpportunityActivity(workspaceId: string, opportunityId: string): Promise<OpportunityActivityEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, actor_id, metadata, created_at")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", "opportunity")
    .eq("entity_id", opportunityId)
    .order("created_at", { ascending: false });

  const actorIds = Array.from(new Set((data ?? []).map((r) => r.actor_id as string | null).filter((id): id is string => Boolean(id))));
  const { data: names } = actorIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map(((names ?? []) as { member_id: string; full_name: string }[]).map((n) => [n.member_id, n.full_name]));

  return (data ?? []).map((r) => ({
    id: r.id as string,
    action: ACTION_LABEL[r.action as string] ?? (r.action as string),
    actorName: r.actor_id ? (nameByMember.get(r.actor_id as string) ?? null) : null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  }));
}

export interface OpportunityOption {
  id: string;
  label: string;
}

/** Lightweight options for the calendar event form's "Relacionar con >
 * Oportunidad" select — same shape/purpose as getContactOptions/
 * getConversationOptions in src/lib/tasks/queries.ts. */
export async function getOpportunityOptions(workspaceId: string): Promise<OpportunityOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select("id, title, contacts(name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((o) => {
    const contact = Array.isArray(o.contacts) ? o.contacts[0] : o.contacts;
    return { id: o.id as string, label: contact ? `${o.title as string} — ${contact.name as string}` : (o.title as string) };
  });
}
