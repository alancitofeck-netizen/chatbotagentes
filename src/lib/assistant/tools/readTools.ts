import type { AssistantToolContext } from "@/lib/assistant/tools/shared";
import { getPolicyDashboardKpis, getPolicyCommissionAnalytics } from "@/lib/policies/queries";
import { getCollectionsList } from "@/lib/collections/queries";
import { rankCollectionsByPriority } from "@/lib/collections/insights";
import { deriveCollectionBucket } from "@/lib/collections/constants";

/** Herramientas de solo lectura — se ejecutan siempre, nunca piden
 * confirmación (no cambian nada). */

export async function searchContact(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const phone = typeof args.phone === "string" ? args.phone.trim() : "";

  let query = ctx.supabase.from("contacts").select("id, name, phone, email, company").eq("workspace_id", ctx.workspaceId).limit(5);
  if (name) query = query.ilike("name", `%${name}%`);
  if (phone) query = query.ilike("phone", `%${phone}%`);
  const { data } = await query;
  return { contacts: data ?? [] };
}

export async function getTodaySummary(_args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  const [{ data: meetings }, { data: tasks }, collections] = await Promise.all([
    ctx.supabase
      .from("bookings")
      .select("id, subject, start_time, contacts(name)")
      .eq("workspace_id", ctx.workspaceId)
      .eq("owner_id", ctx.memberId)
      .gte("start_time", todayStart.toISOString())
      .lt("start_time", todayEnd.toISOString())
      .order("start_time", { ascending: true }),
    ctx.supabase.from("tasks").select("id, title, due_at").eq("workspace_id", ctx.workspaceId).eq("assigned_to", ctx.memberId).is("completed_at", null).eq("archived", false),
    getCollectionsList(ctx.workspaceId),
  ]);

  const overdueCount = collections.filter((c) => deriveCollectionBucket(c.status, c.dueDate) === "vencido").length;

  const meetingRows = (meetings ?? []) as { id: string; subject: string; start_time: string; contacts: { name: string } | { name: string }[] | null }[];
  return {
    meetingsToday: meetingRows.map((m) => ({ id: m.id, subject: m.subject, startTime: m.start_time, contactName: Array.isArray(m.contacts) ? (m.contacts[0]?.name ?? null) : (m.contacts?.name ?? null) })),
    pendingTasksCount: (tasks ?? []).length,
    overdueCollectionsCount: overdueCount,
  };
}

export async function queryKpis(_args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const [policyKpis, commission] = await Promise.all([getPolicyDashboardKpis(ctx.workspaceId), getPolicyCommissionAnalytics(ctx.workspaceId)]);
  return {
    monthlyPremium: policyKpis.monthlyPremium,
    annualPremium: policyKpis.annualPremium,
    totalActivePolicies: policyKpis.totalActive,
    renewalsUpcoming30: policyKpis.renewalsUpcoming30,
    commissionCollected: commission.collectedCommission,
    commissionPending: commission.pendingCommission,
  };
}

export async function listUpcomingMeetings(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const days = typeof args.days === "number" ? args.days : 7;
  const now = new Date();
  const until = new Date(now.getTime() + days * 86_400_000);
  const { data } = await ctx.supabase
    .from("bookings")
    .select("id, subject, start_time, contacts(name)")
    .eq("workspace_id", ctx.workspaceId)
    .eq("owner_id", ctx.memberId)
    .gte("start_time", now.toISOString())
    .lte("start_time", until.toISOString())
    .order("start_time", { ascending: true })
    .limit(10);
  const rows = (data ?? []) as { id: string; subject: string; start_time: string; contacts: { name: string } | { name: string }[] | null }[];
  return {
    meetings: rows.map((m) => ({ id: m.id, subject: m.subject, startTime: m.start_time, contactName: Array.isArray(m.contacts) ? (m.contacts[0]?.name ?? null) : (m.contacts?.name ?? null) })),
  };
}

export async function listOverdueCollections(_args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const list = await getCollectionsList(ctx.workspaceId);
  const ranked = rankCollectionsByPriority(list).filter((c) => deriveCollectionBucket(c.status, c.dueDate) === "vencido");
  return { overdue: ranked.slice(0, 10).map((c) => ({ id: c.id, contactName: c.contactName, company: c.company, amount: c.amount, currency: c.currency, dueDate: c.dueDate })) };
}

export async function listExpiringPolicies(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const days = typeof args.days === "number" ? args.days : 30;
  const now = new Date();
  const until = new Date(now.getTime() + days * 86_400_000);
  const { data } = await ctx.supabase
    .from("policies")
    .select("id, policy_number, company, end_date, contacts(name)")
    .eq("workspace_id", ctx.workspaceId)
    .gte("end_date", now.toISOString().slice(0, 10))
    .lte("end_date", until.toISOString().slice(0, 10))
    .order("end_date", { ascending: true })
    .limit(10);
  const rows = (data ?? []) as { id: string; policy_number: string | null; company: string; end_date: string; contacts: { name: string } | { name: string }[] | null }[];
  return {
    expiring: rows.map((p) => ({ id: p.id, policyNumber: p.policy_number, company: p.company, endDate: p.end_date, contactName: Array.isArray(p.contacts) ? (p.contacts[0]?.name ?? null) : (p.contacts?.name ?? null) })),
  };
}

export async function summarizeContact(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const contactId = String(args.contact_id ?? "");
  const { data: contact } = await ctx.supabase.from("contacts").select("id, name, phone, email, company").eq("id", contactId).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!contact) return { error: "contact_not_found" };

  const [{ data: policies }, { data: notes }] = await Promise.all([
    ctx.supabase.from("policies").select("policy_number, company, product, status, premium, premium_currency").eq("workspace_id", ctx.workspaceId).eq("contact_id", contactId),
    ctx.supabase.from("notes").select("body, created_at").eq("notable_type", "contact").eq("notable_id", contactId).order("created_at", { ascending: false }).limit(3),
  ]);

  return { contact, policies: policies ?? [], recentNotes: (notes ?? []).map((n) => n.body) };
}
