import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/auth/session";

export type EstadoCita = "agendada" | "confirmada" | "realizada" | "no_show" | "cancelada" | "venta";

export interface AgendaViewer {
  memberId: string | null;
  role: WorkspaceRole;
}

export interface AgendaAppointment {
  id: string;
  bookingWorkspaceId: string;
  startTime: string;
  endTime: string;
  subject: string;
  eventType: string;
  estadoCita: EstadoCita | null;
  status: string;
  attended: boolean | null;
  contactId: string | null;
  contactName: string | null;
  advisorClientId: string;
  advisorName: string;
  setterId: string | null;
  setterName: string | null;
}

interface AdvisorLookup {
  clientId: string;
  linkedWorkspaceId: string;
  advisorName: string;
}

/** Fuente de verdad de "qué asesores gestiona este workspace". A propósito
 * NO reusa getRealAdvisorWorkspaces (src/lib/clients/queries.ts): esa
 * función lee `workspaces`/`workspace_members` con el cliente de sesión
 * normal, cuya RLS (`workspaces_select_own` → core.is_workspace_member)
 * solo deja ver otros workspaces a un platform_admin real — un setter
 * (rol 'agent', nunca platform_admin, exactamente el caso que este gate
 * existe para cubrir) vería nombres de asesor en blanco. Se resuelve acá
 * con service-role, mismo criterio que ya usa appointmentSync/runner.ts. */
async function getAdvisorLookup(workspaceId: string): Promise<AdvisorLookup[]> {
  const client = await createClient();
  const { data: clientRows } = await client.from("clients").select("id, linked_workspace_id").eq("workspace_id", workspaceId).not("linked_workspace_id", "is", null);
  const rows = (clientRows ?? []) as { id: string; linked_workspace_id: string }[];
  if (rows.length === 0) return [];

  const supabase = createServiceRoleClient();
  const linkedWorkspaceIds = rows.map((r) => r.linked_workspace_id);
  const { data: memberRows } = await supabase.from("workspace_members").select("workspace_id, user_id, created_at").in("workspace_id", linkedWorkspaceIds).order("created_at", { ascending: true });
  const primaryUserByWorkspace = new Map<string, string>();
  for (const m of memberRows ?? []) {
    const wid = m.workspace_id as string;
    if (!primaryUserByWorkspace.has(wid)) primaryUserByWorkspace.set(wid, m.user_id as string);
  }
  const nameByWorkspace = new Map<string, string>();
  await Promise.all(
    Array.from(primaryUserByWorkspace.entries()).map(async ([wid, uid]) => {
      const { data } = await supabase.auth.admin.getUserById(uid);
      const name = (data?.user?.user_metadata?.full_name as string | undefined) || data?.user?.email || "—";
      nameByWorkspace.set(wid, name);
    }),
  );

  return rows.map((c) => ({
    clientId: c.id,
    linkedWorkspaceId: c.linked_workspace_id,
    advisorName: nameByWorkspace.get(c.linked_workspace_id) ?? "—",
  }));
}

/** Pestaña Agenda — agrega, cross-tenant, las citas de TODOS los asesores
 * gestionados por este workspace (lente sobre los mismos `bookings` que ya
 * lee getClientAppointments, generalizada a todos los clients en vez de
 * uno). A diferencia de getClientAppointments (que confía en el carve-out
 * de platform_admin sobre core.is_workspace_member), acá se usa
 * service-role: los setters (rol 'agent', nunca platform_admin) también
 * necesitan ver sus propias citas generadas — el filtro de visibilidad se
 * aplica en código, no en RLS: un 'agent' solo recibe sus propias citas
 * (setter_id = su memberId), owner/admin reciben las del equipo completo. */
export async function getAgendaAppointments(workspaceId: string, range: { start: string; end: string }, viewer: AgendaViewer): Promise<AgendaAppointment[]> {
  const advisorLookup = await getAdvisorLookup(workspaceId);
  if (advisorLookup.length === 0) return [];
  const advisorByWorkspace = new Map(advisorLookup.map((a) => [a.linkedWorkspaceId, a]));
  const linkedWorkspaceIds = advisorLookup.map((a) => a.linkedWorkspaceId);

  const supabase = createServiceRoleClient();
  let query = supabase
    .from("bookings")
    .select("id, workspace_id, contact_id, setter_id, start_time, end_time, subject, event_type, estado_cita, status, attended, contacts(name)")
    .in("workspace_id", linkedWorkspaceIds)
    .gte("start_time", range.start)
    .lt("start_time", range.end)
    .order("start_time", { ascending: true });

  if (viewer.role === "agent") {
    if (!viewer.memberId) return [];
    query = query.eq("setter_id", viewer.memberId);
  }

  const { data } = await query;
  if (!data || data.length === 0) return [];

  const setterIds = [...new Set(data.map((r) => r.setter_id as string | null).filter((id): id is string => !!id))];
  const setterNameById = new Map<string, string>();
  if (setterIds.length > 0) {
    const { data: members } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
    for (const m of (members ?? []) as { member_id: string; full_name: string }[]) {
      if (setterIds.includes(m.member_id)) setterNameById.set(m.member_id, m.full_name);
    }
  }

  return data.map((r) => {
    const advisor = advisorByWorkspace.get(r.workspace_id as string);
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    const setterId = r.setter_id as string | null;
    return {
      id: r.id as string,
      bookingWorkspaceId: r.workspace_id as string,
      startTime: r.start_time as string,
      endTime: r.end_time as string,
      subject: r.subject as string,
      eventType: r.event_type as string,
      estadoCita: (r.estado_cita as EstadoCita | null) ?? null,
      status: r.status as string,
      attended: r.attended as boolean | null,
      contactId: r.contact_id as string | null,
      contactName: (contact?.name as string | undefined) ?? null,
      advisorClientId: advisor?.clientId ?? "",
      advisorName: advisor?.advisorName ?? "—",
      setterId,
      setterName: setterId ? (setterNameById.get(setterId) ?? "—") : null,
    };
  });
}

export interface AgendaSetterPerformance {
  setterId: string;
  setterName: string;
  citas: number;
  realizadas: number;
  noShow: number;
  canceladas: number;
  ventas: number;
}

export interface AgendaAdvisorPerformance {
  clientId: string;
  advisorName: string;
  citas: number;
  realizadas: number;
  noShow: number;
  canceladas: number;
  ventas: number;
}

/** KPIs → Agendas: rendimiento por setter y por asesor del período, ambos
 * derivados de la misma lectura de bookings (una sola query, dos
 * agrupaciones en JS) — mismo criterio "agregado en vivo, sin rollups" que
 * getClientSetterPerformance. Siempre vista completa del equipo (nunca
 * filtrada por viewer): la pantalla de KPIs ya está gateada a owner/admin
 * en la Server Action, un setter no llega a llamar esto. */
export async function getAgendaPerformance(
  workspaceId: string,
  range: { start: string; end: string },
): Promise<{ bySetter: AgendaSetterPerformance[]; byAdvisor: AgendaAdvisorPerformance[]; totals: Record<EstadoCita | "total", number> }> {
  const advisorLookup = await getAdvisorLookup(workspaceId);
  const totals: Record<EstadoCita | "total", number> = { total: 0, agendada: 0, confirmada: 0, realizada: 0, no_show: 0, cancelada: 0, venta: 0 };
  if (advisorLookup.length === 0) return { bySetter: [], byAdvisor: [], totals };

  const advisorByWorkspace = new Map(advisorLookup.map((a) => [a.linkedWorkspaceId, a]));
  const linkedWorkspaceIds = advisorLookup.map((a) => a.linkedWorkspaceId);

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("bookings")
    .select("workspace_id, setter_id, estado_cita")
    .in("workspace_id", linkedWorkspaceIds)
    .gte("start_time", range.start)
    .lt("start_time", range.end)
    .not("estado_cita", "is", null);

  const rows = (data ?? []) as { workspace_id: string; setter_id: string | null; estado_cita: EstadoCita }[];
  if (rows.length === 0) return { bySetter: [], byAdvisor: [], totals };

  const setterIds = [...new Set(rows.map((r) => r.setter_id).filter((id): id is string => !!id))];
  const setterNameById = new Map<string, string>();
  if (setterIds.length > 0) {
    const { data: members } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
    for (const m of (members ?? []) as { member_id: string; full_name: string }[]) {
      if (setterIds.includes(m.member_id)) setterNameById.set(m.member_id, m.full_name);
    }
  }

  const bySetterMap = new Map<string, AgendaSetterPerformance>();
  const byAdvisorMap = new Map<string, AgendaAdvisorPerformance>();

  for (const r of rows) {
    totals.total += 1;
    totals[r.estado_cita] += 1;

    if (r.setter_id) {
      const entry = bySetterMap.get(r.setter_id) ?? { setterId: r.setter_id, setterName: setterNameById.get(r.setter_id) ?? "—", citas: 0, realizadas: 0, noShow: 0, canceladas: 0, ventas: 0 };
      entry.citas += 1;
      if (r.estado_cita === "realizada") entry.realizadas += 1;
      if (r.estado_cita === "no_show") entry.noShow += 1;
      if (r.estado_cita === "cancelada") entry.canceladas += 1;
      if (r.estado_cita === "venta") entry.ventas += 1;
      bySetterMap.set(r.setter_id, entry);
    }

    const advisor = advisorByWorkspace.get(r.workspace_id);
    if (advisor) {
      const entry = byAdvisorMap.get(advisor.clientId) ?? { clientId: advisor.clientId, advisorName: advisor.advisorName, citas: 0, realizadas: 0, noShow: 0, canceladas: 0, ventas: 0 };
      entry.citas += 1;
      if (r.estado_cita === "realizada") entry.realizadas += 1;
      if (r.estado_cita === "no_show") entry.noShow += 1;
      if (r.estado_cita === "cancelada") entry.canceladas += 1;
      if (r.estado_cita === "venta") entry.ventas += 1;
      byAdvisorMap.set(advisor.clientId, entry);
    }
  }

  return {
    bySetter: [...bySetterMap.values()].sort((a, b) => b.citas - a.citas),
    byAdvisor: [...byAdvisorMap.values()].sort((a, b) => b.citas - a.citas),
    totals,
  };
}

/** Actualiza estado_cita de una cita puntual (y status/attended en
 * sincronía, mismo criterio que el sync — ver appointmentSync/runner.ts)
 * — usado desde la card de Agenda. bookingWorkspaceId viene de la card ya
 * cargada (no hace falta re-resolverlo), pero se re-valida que ese
 * workspace sea uno de los gestionados por el caller antes de escribir. */
export async function updateEstadoCita(workspaceId: string, bookingId: string, bookingWorkspaceId: string, estadoCita: EstadoCita): Promise<void> {
  const advisorLookup = await getAdvisorLookup(workspaceId);
  const managed = advisorLookup.some((a) => a.linkedWorkspaceId === bookingWorkspaceId);
  if (!managed) throw new Error("Esa cita no pertenece a un asesor gestionado por este workspace.");

  const statusByEstado: Record<EstadoCita, { status: string; attended: boolean | null }> = {
    agendada: { status: "scheduled", attended: null },
    confirmada: { status: "scheduled", attended: null },
    realizada: { status: "completed", attended: true },
    no_show: { status: "completed", attended: false },
    cancelada: { status: "cancelled", attended: null },
    venta: { status: "completed", attended: true },
  };

  const supabase = createServiceRoleClient();
  await supabase
    .from("bookings")
    .update({ estado_cita: estadoCita, ...statusByEstado[estadoCita], updated_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("workspace_id", bookingWorkspaceId);
}
