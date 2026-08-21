import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface ConversationTag {
  id: string;
  name: string;
  color: string;
}

export interface ConversationListItem {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  company: string | null;
  avatarUrl: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  status: string;
  assignedMemberId: string | null;
  tags: ConversationTag[];
  /** Count of inbound messages after this agent's own last_read_at
   * (conversation_reads, supabase/migrations/0014_conversation_reads.sql) —
   * or every inbound message if this agent never opened the conversation.
   * Per-agent, not a global unread flag: each agent has their own count. */
  unreadCount: number;
}

const MEDIA_PREVIEW_LABELS: Record<string, string> = { image: "📷 Imagen", audio: "🎤 Audio", document: "📄 Documento" };

/** El body de un mensaje de media sin caption es "" (nunca null/undefined),
 * así que el `??` de antes no alcanzaba para mostrar algo útil en la
 * bandeja — se resuelve acá con un label por tipo. */
function previewBody(type: string, body: string | undefined): string {
  const trimmed = body?.trim();
  if (trimmed) return trimmed;
  return MEDIA_PREVIEW_LABELS[type] ?? `[${type}]`;
}

/** Same last-message-preview pattern as getRecentConversations (src/lib/dashboard/queries.ts),
 * extended with status/search filters, assignment, tags, and per-agent unread
 * counts for the full Inbox list. `currentMemberId` is optional so existing
 * callers that don't care about unread state (there are none today, but this
 * keeps the function from hard-requiring it) still work — unreadCount is 0
 * without it. */
export async function getConversationList(
  workspaceId: string,
  filters: { status?: string; search?: string } = {},
  currentMemberId?: string | null,
): Promise<ConversationListItem[]> {
  const supabase = await createClient();

  let contactIdFilter: string[] | null = null;
  const search = filters.search?.trim();
  if (search) {
    const { data: matchingContacts } = await supabase
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .or(`name.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%`);
    contactIdFilter = (matchingContacts ?? []).map((c) => c.id as string);
    if (contactIdFilter.length === 0) return [];
  }

  let query = supabase
    .from("conversations")
    .select(
      "id, status, last_message_at, assigned_user_id, contact_id, contacts(id, name, phone, company, avatar_url), messages(direction, content, created_at, type)",
    )
    .eq("workspace_id", workspaceId)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (contactIdFilter) query = query.in("contact_id", contactIdFilter);

  const { data } = await query;
  const conversations = data ?? [];
  const contactIds = conversations.map((c) => c.contact_id as string);
  const conversationIds = conversations.map((c) => c.id as string);

  const [{ data: tagRows }, { data: readRows }] = await Promise.all([
    contactIds.length
      ? supabase.from("contact_tags").select("contact_id, tags(id, name, color)").in("contact_id", contactIds)
      : Promise.resolve({ data: [] }),
    currentMemberId && conversationIds.length
      ? supabase
          .from("conversation_reads")
          .select("conversation_id, last_read_at")
          .eq("member_id", currentMemberId)
          .in("conversation_id", conversationIds)
      : Promise.resolve({ data: [] }),
  ]);

  const tagsByContact = new Map<string, ConversationTag[]>();
  for (const row of tagRows ?? []) {
    const tag = Array.isArray(row.tags) ? row.tags[0] : row.tags;
    if (!tag) continue;
    const list = tagsByContact.get(row.contact_id as string) ?? [];
    list.push({ id: tag.id as string, name: tag.name as string, color: tag.color as string });
    tagsByContact.set(row.contact_id as string, list);
  }

  const lastReadByConversation = new Map<string, string>();
  for (const row of readRows ?? []) {
    lastReadByConversation.set(row.conversation_id as string, row.last_read_at as string);
  }

  return conversations.map((row) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    const msgs = (row.messages ?? []) as {
      direction: string;
      content: { body?: string };
      created_at: string;
      type: string;
    }[];
    const last = msgs.length ? msgs.reduce((a, b) => (a.created_at > b.created_at ? a : b)) : null;
    const lastReadAt = lastReadByConversation.get(row.id as string);
    const unreadCount = msgs.filter((m) => m.direction === "inbound" && (!lastReadAt || m.created_at > lastReadAt)).length;
    return {
      id: row.id as string,
      contactId: row.contact_id as string,
      contactName: contact?.name ?? "Sin nombre",
      contactPhone: contact?.phone ?? null,
      company: contact?.company ?? null,
      avatarUrl: contact?.avatar_url ?? null,
      lastMessagePreview: last ? previewBody(last.type, last.content?.body) : "Sin mensajes",
      lastMessageAt: row.last_message_at as string | null,
      status: row.status as string,
      assignedMemberId: row.assigned_user_id as string | null,
      tags: tagsByContact.get(row.contact_id as string) ?? [],
      unreadCount,
    };
  });
}

export interface MessageItem {
  id: string;
  direction: "inbound" | "outbound";
  senderType: string;
  body: string;
  type: string;
  status: string | null;
  createdAt: string;
  /** Populated from content.error.message when YCloud reports a delivery
   * failure via `whatsapp.message.updated` (src/app/api/webhooks/ycloud/route.ts's
   * processMessageStatusUpdate) — null for every message that never failed. */
  errorReason: string | null;
  /** Signed URL (60s) ya resuelta server-side — nunca el `storagePath`
   * crudo, mismo criterio que getDownloadUrl de Documentos. Null para
   * mensajes de texto o si la resolución falló. */
  mediaUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  /** Mensaje citado, ya resuelto a partir de content.quotedMessageId — null
   * si no es una respuesta a nada, o si el mensaje citado no se encontró. */
  quotedMessage: { id: string; body: string; senderType: string } | null;
  /** Reacción del contacto a ESTE mensaje (nunca reacciones nuestras, ver
   * ingestWhatsAppReaction) — null si no tiene. */
  reaction: string | null;
}

export interface ConversationDetail {
  id: string;
  status: string;
  /** human | ai | hybrid (docs/blueprint/13-agent-engine.md, Motor de IA) —
   * decide si el Buffer Inteligente invoca al Agent Runtime al hacer flush. */
  mode: string;
  assignedMemberId: string | null;
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    company: string | null;
    avatarUrl: string | null;
    /** contacts.source (e.g. "whatsapp", "manual") — "de dónde vino el lead". */
    source: string | null;
    /** contacts.custom_fields.job_title — same field/pattern CRM's lead form
     * already reads (src/lib/crm/queries.ts), no schema change needed. */
    jobTitle: string | null;
  };
  messages: MessageItem[];
  notes: { id: string; body: string; createdAt: string }[];
  tags: ConversationTag[];
}

interface MessageRow {
  id: string;
  direction: string;
  sender_type: string;
  type: string;
  content: { body?: string; error?: { message?: string }; mediaPath?: string; mimeType?: string; fileName?: string; quotedMessageId?: string; reaction?: string | null } | null;
  status: string | null;
  created_at: string;
}

/** Arma MessageItem[] con signed URLs y mensajes citados YA resueltos —
 * server-side, un solo batch cada uno (no una consulta por mensaje). Usa
 * service-role para las signed URLs, mismo criterio que getDownloadUrl de
 * Documentos (src/lib/documents/actions.ts) — el Storage de este proyecto
 * no valida bien RLS por auth.uid() directo. */
async function resolveMessageItems(rows: MessageRow[]): Promise<MessageItem[]> {
  const mediaPaths = [...new Set(rows.map((r) => r.content?.mediaPath).filter((p): p is string => !!p))];
  const quotedIds = [...new Set(rows.map((r) => r.content?.quotedMessageId).filter((id): id is string => !!id))];

  const urlByPath = new Map<string, string>();
  if (mediaPaths.length > 0) {
    const service = createServiceRoleClient();
    const { data: signedUrls } = await service.storage.from("whatsapp-media").createSignedUrls(mediaPaths, 60);
    for (const row of signedUrls ?? []) {
      if (row.path && row.signedUrl) urlByPath.set(row.path, row.signedUrl);
    }
  }

  const quotedById = new Map<string, { id: string; body: string; senderType: string }>();
  if (quotedIds.length > 0) {
    const service = createServiceRoleClient();
    const { data: quotedRows } = await service.from("messages").select("id, content, sender_type").in("id", quotedIds);
    for (const q of quotedRows ?? []) {
      const qContent = q.content as { body?: string } | null;
      quotedById.set(q.id as string, { id: q.id as string, body: qContent?.body ?? "", senderType: q.sender_type as string });
    }
  }

  return rows.map((m) => {
    const content = m.content;
    return {
      id: m.id,
      direction: m.direction as "inbound" | "outbound",
      senderType: m.sender_type,
      body: content?.body ?? "",
      type: m.type,
      status: m.status,
      createdAt: m.created_at,
      errorReason: content?.error?.message ?? null,
      mediaUrl: content?.mediaPath ? (urlByPath.get(content.mediaPath) ?? null) : null,
      mimeType: content?.mimeType ?? null,
      fileName: content?.fileName ?? null,
      quotedMessage: content?.quotedMessageId ? (quotedById.get(content.quotedMessageId) ?? null) : null,
      reaction: content?.reaction ?? null,
    };
  });
}

export async function getConversationDetail(
  workspaceId: string,
  conversationId: string,
): Promise<ConversationDetail | null> {
  const supabase = await createClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select(
      "id, status, mode, assigned_user_id, contact_id, contacts(id, name, phone, email, company, avatar_url, source, custom_fields)",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) return null;
  const contact = Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts;
  if (!contact) return null;

  const [{ data: messages }, { data: notes }, { data: tagRows }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, direction, sender_type, type, content, status, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("notes")
      .select("id, body, created_at")
      .eq("workspace_id", workspaceId)
      .eq("notable_type", "conversation")
      .eq("notable_id", conversationId)
      .order("created_at", { ascending: false }),
    supabase.from("contact_tags").select("tags(id, name, color)").eq("contact_id", contact.id as string),
  ]);

  return {
    id: conv.id as string,
    status: conv.status as string,
    mode: conv.mode as string,
    assignedMemberId: conv.assigned_user_id as string | null,
    contact: {
      id: contact.id as string,
      name: contact.name as string,
      phone: contact.phone as string | null,
      email: contact.email as string | null,
      company: contact.company as string | null,
      avatarUrl: contact.avatar_url as string | null,
      source: contact.source as string | null,
      jobTitle: ((contact.custom_fields as { job_title?: string } | null)?.job_title as string | undefined) ?? null,
    },
    messages: await resolveMessageItems((messages ?? []) as MessageRow[]),
    notes: (notes ?? []).map((n) => ({
      id: n.id as string,
      body: n.body as string,
      createdAt: n.created_at as string,
    })),
    tags: (tagRows ?? [])
      .map((r) => {
        const tag = Array.isArray(r.tags) ? r.tags[0] : r.tags;
        return tag ? { id: tag.id as string, name: tag.name as string, color: tag.color as string } : null;
      })
      .filter((t): t is ConversationTag => t !== null),
  };
}

export interface ContactCrmOpportunity {
  opportunityId: string;
  pipelineItemId: string;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  stages: { id: string; name: string; position: number }[];
  value: number;
  currency: string;
  ownerId: string | null;
  ownerName: string | null;
  status: string;
  createdAt: string;
}

export interface ContactUpcomingBooking {
  id: string;
  subject: string;
  startTime: string;
  eventType: string;
}

export interface ContactRelatedTask {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
}

export interface ContactCrmSummary {
  /** Most recent non-closed opportunity for this contact — a contact can have
   * several over time (won/lost ones from before), but the Inbox panel only
   * ever shows the one currently "live" in a pipeline, same "most recent
   * open thing wins" convention already used for conversations themselves. */
  opportunity: ContactCrmOpportunity | null;
  upcomingBookings: ContactUpcomingBooking[];
  relatedTasks: ContactRelatedTask[];
  /** Real counts for the "KPIs del contacto" section — never invented
   * numbers, only what's actually derivable from messages/opportunities. */
  totalMessages: number;
  firstContactAt: string | null;
}

/** Everything the redesigned Inbox contact panel's CRM-linkage/KPI/tasks/
 * meetings sections need, in one batched call — mirrors getConversationDetail's
 * own Promise.all batching style. Reuses existing tables/relations (no new
 * schema): opportunities/pipeline_items/pipeline_stages/pipelines already
 * power the CRM board (src/lib/crm/queries.ts); tasks/bookings already link
 * to a contact via related_id/contact_id from the composer's "Crear tarea"
 * and the booking flow respectively. */
export async function getContactCrmSummary(workspaceId: string, contactId: string, conversationId: string): Promise<ContactCrmSummary> {
  const supabase = await createClient();

  const [{ data: opportunities }, { data: bookings }, { data: tasksByConversation }, { count: messageCount }, { data: firstMessage }] =
    await Promise.all([
      supabase
        .from("opportunities")
        .select("id, pipeline_item_id, title, value, currency, owner_id, status, created_at, pipeline_items(pipeline_id, stage_id)")
        .eq("workspace_id", workspaceId)
        .eq("contact_id", contactId)
        .neq("status", "lost")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("bookings")
        .select("id, subject, start_time, event_type")
        .eq("workspace_id", workspaceId)
        .eq("contact_id", contactId)
        .gte("start_time", new Date().toISOString())
        .neq("status", "cancelled")
        .order("start_time", { ascending: true })
        .limit(5),
      supabase
        .from("tasks")
        .select("id, title, status, due_at")
        .eq("workspace_id", workspaceId)
        .eq("related_type", "conversation")
        .eq("related_id", conversationId)
        .is("completed_at", null)
        .order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId),
      supabase.from("messages").select("created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    ]);

  const opp = opportunities?.[0] ?? null;
  let opportunity: ContactCrmOpportunity | null = null;
  let relatedTasks = (tasksByConversation ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    status: t.status as string,
    dueAt: t.due_at as string | null,
  }));

  if (opp) {
    const pipelineItem = Array.isArray(opp.pipeline_items) ? opp.pipeline_items[0] : opp.pipeline_items;
    const pipelineId = pipelineItem?.pipeline_id as string | undefined;
    const stageId = pipelineItem?.stage_id as string | undefined;

    const [{ data: pipeline }, { data: stages }, { data: owner }, { data: tasksByOpportunity }] = await Promise.all([
      pipelineId ? supabase.from("pipelines").select("id, name").eq("id", pipelineId).maybeSingle() : Promise.resolve({ data: null }),
      pipelineId
        ? supabase.from("pipeline_stages").select("id, name, position").eq("pipeline_id", pipelineId).order("position", { ascending: true })
        : Promise.resolve({ data: [] }),
      opp.owner_id ? supabase.rpc("workspace_member_names", { ws_id: workspaceId }) : Promise.resolve({ data: null }),
      supabase
        .from("tasks")
        .select("id, title, status, due_at")
        .eq("workspace_id", workspaceId)
        .eq("related_type", "opportunity")
        .eq("related_id", opp.id as string)
        .is("completed_at", null)
        .order("due_at", { ascending: true, nullsFirst: false }),
    ]);

    const ownerRow = (owner as { member_id: string; full_name: string }[] | null)?.find((m) => m.member_id === opp.owner_id);
    const currentStage = (stages ?? []).find((s) => s.id === stageId);

    opportunity = {
      opportunityId: opp.id as string,
      pipelineItemId: opp.pipeline_item_id as string,
      pipelineId: pipelineId ?? "",
      pipelineName: (pipeline?.name as string | undefined) ?? "",
      stageId: stageId ?? "",
      stageName: (currentStage?.name as string | undefined) ?? "",
      stages: (stages ?? []).map((s) => ({ id: s.id as string, name: s.name as string, position: s.position as number })),
      value: (opp.value as number | null) ?? 0,
      currency: (opp.currency as string | null) ?? "USD",
      ownerId: (opp.owner_id as string | null) ?? null,
      ownerName: ownerRow?.full_name ?? null,
      status: opp.status as string,
      createdAt: opp.created_at as string,
    };

    relatedTasks = [
      ...relatedTasks,
      ...(tasksByOpportunity ?? []).map((t) => ({
        id: t.id as string,
        title: t.title as string,
        status: t.status as string,
        dueAt: t.due_at as string | null,
      })),
    ];
  }

  return {
    opportunity,
    upcomingBookings: (bookings ?? []).map((b) => ({
      id: b.id as string,
      subject: b.subject as string,
      startTime: b.start_time as string,
      eventType: b.event_type as string,
    })),
    relatedTasks,
    totalMessages: messageCount ?? 0,
    firstContactAt: (firstMessage?.created_at as string | undefined) ?? null,
  };
}

/** For "Fusionar contacto" — search candidates by name/phone/email within the
 * same workspace, excluding the contact being merged FROM. */
export async function searchContactsForMerge(workspaceId: string, excludeContactId: string, query: string) {
  const supabase = await createClient();
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data } = await supabase
    .from("contacts")
    .select("id, name, phone, email")
    .eq("workspace_id", workspaceId)
    .neq("id", excludeContactId)
    .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
    .limit(8);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    phone: c.phone as string | null,
    email: c.email as string | null,
  }));
}

export interface WorkspaceMemberOption {
  memberId: string;
  fullName: string;
  avatarUrl: string | null;
}

/** Resolves member display names via public.workspace_member_names (supabase/migrations/0003_inbox.sql)
 * — workspace_members has no name column and the client has no access to auth.users. */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  return (data ?? []).map((r: { member_id: string; full_name: string; avatar_url: string | null }) => ({
    memberId: r.member_id,
    fullName: r.full_name,
    avatarUrl: r.avatar_url,
  }));
}

export interface WorkspaceTag {
  id: string;
  name: string;
  color: string;
}

export async function getWorkspaceTags(workspaceId: string): Promise<WorkspaceTag[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  return (data ?? []).map((t) => ({ id: t.id as string, name: t.name as string, color: t.color as string }));
}

export interface WorkspaceTagWithUsage extends WorkspaceTag {
  contactCount: number;
}

/** For the Etiquetas management screen (src/app/(protected)/inbox/etiquetas).
 * contact_tags has no workspace_id of its own, but every tag_id it can
 * reference already belongs to exactly one workspace (tags.workspace_id +
 * the FK), so counting rows per tag_id needs no extra contacts join. */
export async function getWorkspaceTagsWithUsage(workspaceId: string): Promise<WorkspaceTagWithUsage[]> {
  const supabase = await createClient();
  const tags = await getWorkspaceTags(workspaceId);
  if (tags.length === 0) return [];

  const { data: assignments } = await supabase
    .from("contact_tags")
    .select("tag_id")
    .in(
      "tag_id",
      tags.map((t) => t.id),
    );

  const counts = new Map<string, number>();
  for (const row of assignments ?? []) {
    const tagId = row.tag_id as string;
    counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
  }

  return tags.map((tag) => ({ ...tag, contactCount: counts.get(tag.id) ?? 0 }));
}
