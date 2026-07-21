import "server-only";
import { createClient } from "@/lib/supabase/server";

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
      lastMessagePreview: last?.content?.body ?? (last ? `[${last.type}]` : "Sin mensajes"),
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
    messages: (messages ?? []).map((m) => {
      const content = m.content as { body?: string; error?: { message?: string } } | null;
      return {
        id: m.id as string,
        direction: m.direction as "inbound" | "outbound",
        senderType: m.sender_type as string,
        body: content?.body ?? `[${m.type as string}]`,
        type: m.type as string,
        status: m.status as string | null,
        createdAt: m.created_at as string,
        errorReason: content?.error?.message ?? null,
      };
    }),
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

export interface WorkspaceMemberOption {
  memberId: string;
  fullName: string;
}

/** Resolves member display names via public.workspace_member_names (supabase/migrations/0003_inbox.sql)
 * — workspace_members has no name column and the client has no access to auth.users. */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  return (data ?? []).map((r: { member_id: string; full_name: string }) => ({
    memberId: r.member_id,
    fullName: r.full_name,
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
