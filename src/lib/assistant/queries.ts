import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCollectionsList } from "@/lib/collections/queries";
import { rankCollectionsByPriority } from "@/lib/collections/insights";
import { deriveCollectionBucket } from "@/lib/collections/constants";

/** Las 7 tarjetas de la columna derecha — todas lecturas determinísticas
 * sobre datos reales (mismo criterio de todo el módulo y de toda la
 * sesión: nada de puntajes/porcentajes fabricados). "Recomendaciones" es
 * la única con un texto de IA, y corre bajo demanda (actions.ts), no acá. */

export interface TodaySummaryCard {
  meetingsCount: number;
  meetingsPreview: { subject: string; startTime: string; contactName: string | null }[];
  pendingTasksCount: number;
  overdueCollectionsCount: number;
}

export async function getTodaySummaryCard(workspaceId: string, memberId: string): Promise<TodaySummaryCard> {
  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  const [{ data: meetings }, { data: tasks }, collections] = await Promise.all([
    supabase
      .from("bookings")
      .select("subject, start_time, contacts(name)")
      .eq("workspace_id", workspaceId)
      .eq("owner_id", memberId)
      .gte("start_time", todayStart.toISOString())
      .lt("start_time", todayEnd.toISOString())
      .order("start_time", { ascending: true }),
    supabase.from("tasks").select("id").eq("workspace_id", workspaceId).eq("assigned_to", memberId).is("completed_at", null).eq("archived", false),
    getCollectionsList(workspaceId),
  ]);

  const rows = (meetings ?? []) as { subject: string; start_time: string; contacts: { name: string } | { name: string }[] | null }[];
  return {
    meetingsCount: rows.length,
    meetingsPreview: rows.slice(0, 3).map((m) => ({ subject: m.subject, startTime: m.start_time, contactName: Array.isArray(m.contacts) ? (m.contacts[0]?.name ?? null) : (m.contacts?.name ?? null) })),
    pendingTasksCount: (tasks ?? []).length,
    overdueCollectionsCount: collections.filter((c) => deriveCollectionBucket(c.status, c.dueDate) === "vencido").length,
  };
}

export interface PriorityItem {
  label: string;
  detail: string;
  urgency: number;
}

/** Reusa exactamente la priorización determinística de Cobranza
 * (collections/insights.ts) + pólizas por vencer — no un ranking nuevo. */
export async function getPriorityItems(workspaceId: string): Promise<PriorityItem[]> {
  const supabase = await createClient();
  const [collections, { data: expiring }] = await Promise.all([
    getCollectionsList(workspaceId),
    supabase
      .from("policies")
      .select("policy_number, company, end_date, contacts(name)")
      .eq("workspace_id", workspaceId)
      .gte("end_date", new Date().toISOString().slice(0, 10))
      .lte("end_date", new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10))
      .order("end_date", { ascending: true })
      .limit(10),
  ]);

  const overdue = rankCollectionsByPriority(collections)
    .filter((c) => deriveCollectionBucket(c.status, c.dueDate) === "vencido")
    .slice(0, 5)
    .map((c) => ({ label: `Cobro vencido: ${c.contactName}`, detail: `${c.company} · ${c.currency} ${c.amount}`, urgency: c.priorityScore }));

  const rows = (expiring ?? []) as { policy_number: string | null; company: string; end_date: string; contacts: { name: string } | { name: string }[] | null }[];
  const expiringItems = rows.map((p) => {
    const daysLeft = Math.round((new Date(p.end_date).getTime() - Date.now()) / 86_400_000);
    const contactName = Array.isArray(p.contacts) ? p.contacts[0]?.name : p.contacts?.name;
    return { label: `Vence en ${daysLeft} días: ${contactName ?? "sin nombre"}`, detail: `${p.company}${p.policy_number ? ` · ${p.policy_number}` : ""}`, urgency: 1000 - daysLeft };
  });

  return [...overdue, ...expiringItems].sort((a, b) => b.urgency - a.urgency).slice(0, 8);
}

export interface CrossSellCandidate {
  contactId: string;
  contactName: string;
  hasTypes: string[];
  missingTypes: string[];
}

const ALL_TYPES = ["auto", "hogar", "vida", "otro"];

/** Regla determinística, no IA: un cliente con pólizas activas en algunos
 * ramos pero no en otros es un candidato de cross-sell obvio — sin
 * inventar una "probabilidad de conversión" (mismo criterio que
 * policies/aiAnalysis.ts). */
export async function getCrossSellCandidates(workspaceId: string): Promise<CrossSellCandidate[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("policies").select("contact_id, insurance_type, status, contacts(name)").eq("workspace_id", workspaceId).neq("status", "cancelada");
  const rows = (data ?? []) as { contact_id: string; insurance_type: string; contacts: { name: string } | { name: string }[] | null }[];

  const byContact = new Map<string, { name: string; types: Set<string> }>();
  for (const r of rows) {
    const name = Array.isArray(r.contacts) ? r.contacts[0]?.name : r.contacts?.name;
    const entry = byContact.get(r.contact_id) ?? { name: name ?? "Sin nombre", types: new Set<string>() };
    entry.types.add(r.insurance_type);
    byContact.set(r.contact_id, entry);
  }

  return [...byContact.entries()]
    .filter(([, v]) => v.types.size > 0 && v.types.size < ALL_TYPES.length)
    .map(([contactId, v]) => ({ contactId, contactName: v.name, hasTypes: [...v.types], missingTypes: ALL_TYPES.filter((t) => !v.types.has(t)) }))
    .slice(0, 8);
}

export interface WeeklyPerformance {
  premiumThisWeek: number;
  premiumLastWeek: number;
  changePct: number | null;
  policiesThisWeek: number;
}

export async function getWeeklyPerformance(workspaceId: string): Promise<WeeklyPerformance> {
  const supabase = await createClient();
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 86_400_000);
  const prevWeekStart = new Date(now.getTime() - 14 * 86_400_000);

  const { data } = await supabase.from("policies").select("premium, created_at, status").eq("workspace_id", workspaceId).neq("status", "cancelada").gte("created_at", prevWeekStart.toISOString());
  const rows = (data ?? []) as { premium: number | null; created_at: string }[];

  const thisWeek = rows.filter((r) => new Date(r.created_at) >= weekStart);
  const lastWeek = rows.filter((r) => new Date(r.created_at) >= prevWeekStart && new Date(r.created_at) < weekStart);

  const premiumThisWeek = thisWeek.reduce((s, r) => s + (r.premium ?? 0), 0);
  const premiumLastWeek = lastWeek.reduce((s, r) => s + (r.premium ?? 0), 0);

  return {
    premiumThisWeek,
    premiumLastWeek,
    changePct: premiumLastWeek > 0 ? Math.round(((premiumThisWeek - premiumLastWeek) / premiumLastWeek) * 100) : null,
    policiesThisWeek: thisWeek.length,
  };
}

export interface UpcomingMeeting {
  id: string;
  subject: string;
  startTime: string;
  contactName: string | null;
}

export async function getUpcomingMeetings(workspaceId: string, memberId: string, days = 5): Promise<UpcomingMeeting[]> {
  const supabase = await createClient();
  const now = new Date();
  const until = new Date(now.getTime() + days * 86_400_000);
  const { data } = await supabase
    .from("bookings")
    .select("id, subject, start_time, contacts(name)")
    .eq("workspace_id", workspaceId)
    .eq("owner_id", memberId)
    .gte("start_time", now.toISOString())
    .lte("start_time", until.toISOString())
    .order("start_time", { ascending: true })
    .limit(6);
  return ((data ?? []) as { id: string; subject: string; start_time: string; contacts: { name: string } | { name: string }[] | null }[]).map((m) => ({
    id: m.id,
    subject: m.subject,
    startTime: m.start_time,
    contactName: Array.isArray(m.contacts) ? (m.contacts[0]?.name ?? null) : (m.contacts?.name ?? null),
  }));
}

export interface AssistantAlerts {
  overdueCollectionsCount: number;
  expiringPoliciesCount: number;
}

export async function getAlerts(workspaceId: string): Promise<AssistantAlerts> {
  const supabase = await createClient();
  const [collections, { count: expiringCount }] = await Promise.all([
    getCollectionsList(workspaceId),
    supabase
      .from("policies")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("end_date", new Date().toISOString().slice(0, 10))
      .lte("end_date", new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)),
  ]);
  return {
    overdueCollectionsCount: collections.filter((c) => deriveCollectionBucket(c.status, c.dueDate) === "vencido").length,
    expiringPoliciesCount: expiringCount ?? 0,
  };
}
