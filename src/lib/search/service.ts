import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SearchResult } from "@/lib/search/types";

const PER_CATEGORY_LIMIT = 5;

/** Comma/parens tienen significado sintáctico dentro del DSL de `.or()` de
 * PostgREST (separan condiciones) — se quitan en vez de escaparse porque no
 * son caracteres esperables en un nombre/teléfono/número de póliza real, y
 * dejarlos pasar sin filtrar permitiría a alguien inyectar una condición de
 * filtro adicional en la query. `%`/`_` son wildcards de ILIKE — se escapan
 * para que buscar "50%" busque el texto literal, no "cualquier cosa que
 * empiece con 5 y termine en 0". */
function sanitizeSearchTerm(raw: string): string {
  return raw
    .replace(/[,()]/g, "")
    .trim()
    .slice(0, 100)
    .replace(/[%_\\]/g, (c) => `\\${c}`);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function searchContacts(supabase: Supabase, workspaceId: string, q: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("contacts")
    .select("id, name, phone, email, dni")
    .eq("workspace_id", workspaceId)
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,dni.ilike.%${q}%`)
    .limit(PER_CATEGORY_LIMIT);

  return (data ?? []).map((c) => ({
    id: c.id as string,
    title: c.name as string,
    subtitle: (c.phone as string | null) ?? (c.email as string | null),
    type: "contact",
    icon: "User",
    route: `/inbox/contactos?contact=${c.id}`,
  }));
}

async function searchConversationsByContact(supabase: Supabase, workspaceId: string, q: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("conversations")
    .select("id, last_message_at, contacts!inner(name)")
    .eq("workspace_id", workspaceId)
    .ilike("contacts.name", `%${q}%`)
    .order("last_message_at", { ascending: false })
    .limit(PER_CATEGORY_LIMIT);

  return ((data ?? []) as { id: string; contacts: { name: string } | { name: string }[] | null }[]).map((c) => {
    const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
    return {
      id: c.id,
      title: contact?.name ?? "Conversación",
      subtitle: "Conversación",
      type: "conversation" as const,
      icon: "MessageCircle",
      route: `/inbox?conversation=${c.id}`,
    };
  });
}

async function searchConversationsByMessage(supabase: Supabase, workspaceId: string, q: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("messages")
    .select("conversation_id, content, created_at, conversations!inner(id, workspace_id, contacts(name))")
    .eq("workspace_id", workspaceId)
    .eq("type", "text")
    .ilike("content->>body", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(PER_CATEGORY_LIMIT);

  type MessageRow = {
    conversation_id: string;
    content: { body?: string } | null;
    conversations: { contacts: { name: string } | { name: string }[] | null } | { contacts: { name: string } | { name: string }[] | null }[] | null;
  };
  return ((data ?? []) as unknown as MessageRow[]).map((m) => {
    const conversation = Array.isArray(m.conversations) ? m.conversations[0] : m.conversations;
    const contact = Array.isArray(conversation?.contacts) ? conversation?.contacts[0] : conversation?.contacts;
    return {
      id: m.conversation_id,
      title: contact?.name ?? "Conversación",
      subtitle: m.content?.body?.slice(0, 80) ?? null,
      type: "conversation" as const,
      icon: "MessageCircle",
      route: `/inbox?conversation=${m.conversation_id}`,
    };
  });
}

async function searchPoliciesByOwnFields(supabase: Supabase, workspaceId: string, q: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("policies")
    .select("id, policy_number, company, insurance_type, status, contacts(name)")
    .eq("workspace_id", workspaceId)
    .or(`policy_number.ilike.%${q}%,company.ilike.%${q}%`)
    .limit(PER_CATEGORY_LIMIT);
  return mapPolicyRows(data ?? []);
}

async function searchPoliciesByContact(supabase: Supabase, workspaceId: string, q: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("policies")
    .select("id, policy_number, company, insurance_type, status, contacts!inner(name)")
    .eq("workspace_id", workspaceId)
    .ilike("contacts.name", `%${q}%`)
    .limit(PER_CATEGORY_LIMIT);
  return mapPolicyRows(data ?? []);
}

function mapPolicyRows(
  rows: { id: string; policy_number: string | null; company: string; insurance_type: string; status: string; contacts: { name: string } | { name: string }[] | null }[],
): SearchResult[] {
  return rows.map((p) => {
    const contact = Array.isArray(p.contacts) ? p.contacts[0] : p.contacts;
    return {
      id: p.id,
      title: p.policy_number ? `${p.company} — ${p.policy_number}` : p.company,
      subtitle: contact?.name ?? null,
      type: "policy" as const,
      icon: "FileCheck2",
      route: `/polizas?policy=${p.id}`,
    };
  });
}

async function searchTasks(supabase: Supabase, workspaceId: string, q: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("tasks")
    .select("id, title, description, status")
    .eq("workspace_id", workspaceId)
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .limit(PER_CATEGORY_LIMIT);

  return (data ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    subtitle: (t.description as string | null)?.slice(0, 80) ?? null,
    type: "task",
    icon: "CheckSquare",
    route: `/tasks/${t.id}`,
  }));
}

async function searchEvents(supabase: Supabase, workspaceId: string, q: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("bookings")
    .select("id, subject, description, start_time, contacts(name)")
    .eq("workspace_id", workspaceId)
    .or(`subject.ilike.%${q}%,description.ilike.%${q}%`)
    .order("start_time", { ascending: false })
    .limit(PER_CATEGORY_LIMIT);

  return ((data ?? []) as { id: string; subject: string | null; start_time: string; contacts: { name: string } | { name: string }[] | null }[]).map((e) => {
    const contact = Array.isArray(e.contacts) ? e.contacts[0] : e.contacts;
    return {
      id: e.id,
      title: e.subject ?? "Evento",
      subtitle: contact?.name ?? new Date(e.start_time).toLocaleDateString("es"),
      type: "event" as const,
      icon: "CalendarDays",
      route: `/calendar?event=${e.id}`,
    };
  });
}

async function searchCompanies(supabase: Supabase, workspaceId: string, q: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("contacts")
    .select("company")
    .eq("workspace_id", workspaceId)
    .not("company", "is", null)
    .ilike("company", `%${q}%`)
    .limit(50);

  const distinct = [...new Set((data ?? []).map((c) => c.company as string).filter(Boolean))].slice(0, PER_CATEGORY_LIMIT);
  return distinct.map((name) => ({
    id: name,
    title: name,
    subtitle: "Empresa",
    type: "company",
    icon: "Building2",
    route: `/inbox/contactos?empresa=${encodeURIComponent(name)}`,
  }));
}

async function searchAutomations(supabase: Supabase, q: string): Promise<SearchResult[]> {
  // Catálogo global (0110) — no filtra por workspace_id, no le pertenece a
  // ninguno en particular.
  const { data } = await supabase.from("automation_catalog").select("key, name, description").or(`name.ilike.%${q}%,description.ilike.%${q}%`).limit(PER_CATEGORY_LIMIT);

  return (data ?? []).map((a) => ({
    id: a.key as string,
    title: a.name as string,
    subtitle: a.description as string,
    type: "automation",
    icon: "Zap",
    route: `/automatizaciones?open=${a.key}`,
  }));
}

async function searchDocuments(supabase: Supabase, workspaceId: string, q: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("documents")
    .select("id, name, folder_id")
    .eq("workspace_id", workspaceId)
    .eq("is_trashed", false)
    .ilike("name", `%${q}%`)
    .limit(PER_CATEGORY_LIMIT);

  return (data ?? []).map((d) => ({
    id: d.id as string,
    title: d.name as string,
    subtitle: "Documento",
    type: "document",
    icon: "File",
    route: d.folder_id ? `/documents?folder=${d.folder_id}` : "/documents",
  }));
}

/** Servicio centralizado de búsqueda global — un único punto de entrada que
 * consulta todos los módulos en paralelo y devuelve resultados normalizados
 * ({id, title, subtitle, type, icon, route}). Sumar un módulo nuevo al
 * buscador es agregar una función acá + una entrada en SEARCH_TYPE_LABEL/
 * SEARCH_TYPE_ORDER (types.ts) — nunca un buscador nuevo por módulo. */
export async function searchGlobal(workspaceId: string, rawQuery: string): Promise<SearchResult[]> {
  const q = sanitizeSearchTerm(rawQuery);
  if (q.length < 2) return [];

  const supabase = await createClient();

  const [contacts, conversationsByContact, conversationsByMessage, policiesByOwn, policiesByContact, tasks, events, companies, automations, documents] = await Promise.all([
    searchContacts(supabase, workspaceId, q),
    searchConversationsByContact(supabase, workspaceId, q),
    searchConversationsByMessage(supabase, workspaceId, q),
    searchPoliciesByOwnFields(supabase, workspaceId, q),
    searchPoliciesByContact(supabase, workspaceId, q),
    searchTasks(supabase, workspaceId, q),
    searchEvents(supabase, workspaceId, q),
    searchCompanies(supabase, workspaceId, q),
    searchAutomations(supabase, q),
    searchDocuments(supabase, workspaceId, q),
  ]);

  const conversations = dedupeById([...conversationsByContact, ...conversationsByMessage]).slice(0, PER_CATEGORY_LIMIT);
  const policies = dedupeById([...policiesByOwn, ...policiesByContact]).slice(0, PER_CATEGORY_LIMIT);

  return [...contacts, ...policies, ...tasks, ...conversations, ...events, ...automations, ...companies, ...documents];
}

function dedupeById(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
