import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ContactTag {
  id: string;
  name: string;
  color: string;
}

export interface ContactListItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  avatarUrl: string | null;
  whatsappOptStatus: string;
  tags: ContactTag[];
  createdAt: string;
}

/** Same search + batched-tags pattern as getConversationList (src/lib/inbox/queries.ts),
 * applied directly to `contacts` instead of joining through `conversations`. */
export async function getContactList(
  workspaceId: string,
  filters: { search?: string; company?: string; tagId?: string; optStatus?: string } = {},
): Promise<ContactListItem[]> {
  const supabase = await createClient();

  let idFilter: string[] | null = null;
  if (filters.tagId) {
    const { data: tagRows } = await supabase
      .from("contact_tags")
      .select("contact_id")
      .eq("tag_id", filters.tagId);
    idFilter = (tagRows ?? []).map((r) => r.contact_id as string);
    if (idFilter.length === 0) return [];
  }

  let query = supabase
    .from("contacts")
    .select("id, name, phone, email, company, avatar_url, whatsapp_opt_status, created_at")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  const search = filters.search?.trim();
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`,
    );
  }
  if (filters.company) query = query.eq("company", filters.company);
  if (filters.optStatus) query = query.eq("whatsapp_opt_status", filters.optStatus);
  if (idFilter) query = query.in("id", idFilter);

  const { data } = await query;
  const contacts = data ?? [];
  const contactIds = contacts.map((c) => c.id as string);

  const { data: tagRows } = contactIds.length
    ? await supabase.from("contact_tags").select("contact_id, tags(id, name, color)").in("contact_id", contactIds)
    : { data: [] };

  const tagsByContact = new Map<string, ContactTag[]>();
  for (const row of tagRows ?? []) {
    const tag = Array.isArray(row.tags) ? row.tags[0] : row.tags;
    if (!tag) continue;
    const list = tagsByContact.get(row.contact_id as string) ?? [];
    list.push({ id: tag.id as string, name: tag.name as string, color: tag.color as string });
    tagsByContact.set(row.contact_id as string, list);
  }

  return contacts.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    phone: c.phone as string | null,
    email: c.email as string | null,
    company: c.company as string | null,
    avatarUrl: c.avatar_url as string | null,
    whatsappOptStatus: c.whatsapp_opt_status as string,
    tags: tagsByContact.get(c.id as string) ?? [],
    createdAt: c.created_at as string,
  }));
}

export interface ContactActivity {
  conversationsCount: number;
  opportunitiesCount: number;
  hasCandidateProfile: boolean;
  lastConversationAt: string | null;
}

export interface ContactDetail {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: string | null;
  avatarUrl: string | null;
  whatsappOptStatus: string;
  createdAt: string;
  tags: ContactTag[];
  notes: { id: string; body: string; createdAt: string }[];
  activity: ContactActivity;
}

/** Related-activity counts are deliberately simple, separate queries (not a
 * mega-join) — conversations/opportunities/candidates each get their own
 * small scoped lookup, run in parallel. */
export async function getContactDetail(workspaceId: string, contactId: string): Promise<ContactDetail | null> {
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, phone, email, company, source, avatar_url, whatsapp_opt_status, created_at")
    .eq("workspace_id", workspaceId)
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return null;

  const [
    { data: tagRows },
    { data: notes },
    { count: conversationsCount },
    { count: opportunitiesCount },
    { data: candidate },
    { data: lastConversation },
  ] = await Promise.all([
    supabase.from("contact_tags").select("tags(id, name, color)").eq("contact_id", contactId),
    supabase
      .from("notes")
      .select("id, body, created_at")
      .eq("workspace_id", workspaceId)
      .eq("notable_type", "contact")
      .eq("notable_id", contactId)
      .order("created_at", { ascending: false }),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("contact_id", contactId),
    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("contact_id", contactId),
    supabase.from("candidates").select("id").eq("workspace_id", workspaceId).eq("contact_id", contactId).maybeSingle(),
    supabase
      .from("conversations")
      .select("last_message_at")
      .eq("workspace_id", workspaceId)
      .eq("contact_id", contactId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    id: contact.id as string,
    name: contact.name as string,
    phone: contact.phone as string | null,
    email: contact.email as string | null,
    company: contact.company as string | null,
    source: contact.source as string | null,
    avatarUrl: contact.avatar_url as string | null,
    whatsappOptStatus: contact.whatsapp_opt_status as string,
    createdAt: contact.created_at as string,
    tags: (tagRows ?? [])
      .map((r) => {
        const tag = Array.isArray(r.tags) ? r.tags[0] : r.tags;
        return tag ? { id: tag.id as string, name: tag.name as string, color: tag.color as string } : null;
      })
      .filter((t): t is ContactTag => t !== null),
    notes: (notes ?? []).map((n) => ({
      id: n.id as string,
      body: n.body as string,
      createdAt: n.created_at as string,
    })),
    activity: {
      conversationsCount: conversationsCount ?? 0,
      opportunitiesCount: opportunitiesCount ?? 0,
      hasCandidateProfile: Boolean(candidate),
      lastConversationAt: (lastConversation?.last_message_at as string | null) ?? null,
    },
  };
}

export interface CompanyGroup {
  company: string;
  contactCount: number;
}

/** Grouped presentation view over contacts.company — no `companies` table
 * exists or should exist (docs/blueprint/02-database.md:27-31 designed
 * `company` as a plain column specifically for this future section). */
export async function getCompanyGroups(workspaceId: string): Promise<CompanyGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("company")
    .eq("workspace_id", workspaceId)
    .not("company", "is", null)
    .neq("company", "");

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const company = (row.company as string).trim();
    if (!company) continue;
    counts.set(company, (counts.get(company) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([company, contactCount]) => ({ company, contactCount }))
    .sort((a, b) => b.contactCount - a.contactCount || a.company.localeCompare(b.company));
}
