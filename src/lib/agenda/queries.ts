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
  workspaceId: string;
  startTime: string;
  endTime: string;
  subject: string | null;
  appointmentType: string | null;
  estadoCita: EstadoCita;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  advisorClientId: string;
  advisorName: string;
  setterId: string | null;
  setterName: string | null;
  setterAvatarUrl: string | null;
}

interface SetterInfo {
  name: string;
  avatarUrl: string | null;
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
 * con service-role, mismo criterio que ya usa appointmentSync/runner.ts.
 *
 * Devuelve `[]` para cualquier workspace que NO sea la agencia (un
 * workspace real de asesor no tiene `clients` propias) — ese vacío es
 * exactamente el discriminador que usa resolveAgendaScope() más abajo. */
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

/** Nombre a mostrar para el propio workspace, cuando ESE workspace es el
 * del asesor (no la agencia) — mismo criterio de "primer miembro +
 * auth.admin.getUserById" que getAdvisorLookup, pero para un solo
 * workspace en vez de una lista. */
async function getOwnWorkspaceDisplayName(workspaceId: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data: member } = await supabase.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!member) return "—";
  const { data } = await supabase.auth.admin.getUserById(member.user_id as string);
  return (data?.user?.user_metadata?.full_name as string | undefined) || data?.user?.email || "—";
}

export type AgendaScope = { kind: "agency"; advisors: AdvisorLookup[] } | { kind: "advisor"; workspaceId: string };

/** Único punto que decide "vista agregada de agencia" vs "workspace propio
 * de un asesor" — getAdvisorLookup(workspaceId) es no-vacío únicamente
 * para el workspace de la agencia (tiene `clients` con
 * linked_workspace_id); un workspace real de asesor no tiene esas filas
 * propias, así que cae naturalmente en el otro caso. */
async function resolveAgendaScope(workspaceId: string): Promise<AgendaScope> {
  const advisors = await getAdvisorLookup(workspaceId);
  if (advisors.length > 0) return { kind: "agency", advisors };
  return { kind: "advisor", workspaceId };
}

/** Pestaña Agenda — fuente única: `agenda_appointments` (espejo interno de
 * la hoja KPI, ver appointmentSync/runner.ts), NUNCA `bookings`/Calendar.
 * En scope "agency" agrega, cross-tenant, las citas de TODOS los asesores
 * gestionados (service-role: los setters, rol 'agent', nunca
 * platform_admin, también necesitan ver sus propias citas — el filtro de
 * visibilidad se aplica en código, no en RLS). En scope "advisor" el
 * workspace ES el del asesor: es una lectura same-tenant, así que usa el
 * cliente de sesión normal (la policy `agenda_appointments_select` ya
 * permite `core.is_workspace_member(workspace_id)`) — más simple y más
 * seguro por construcción que forzar service-role también ahí. */
export async function getAgendaAppointments(workspaceId: string, range: { start: string; end: string }, viewer: AgendaViewer): Promise<AgendaAppointment[]> {
  const scope = await resolveAgendaScope(workspaceId);

  if (scope.kind === "advisor") {
    const client = await createClient();
    const { data } = await client
      .from("agenda_appointments")
      .select("id, workspace_id, contact_id, setter_id, start_time, end_time, subject, appointment_type, estado_cita, contacts(name, phone)")
      .eq("workspace_id", scope.workspaceId)
      .gte("start_time", range.start)
      .lt("start_time", range.end)
      .order("start_time", { ascending: true });
    if (!data || data.length === 0) return [];

    const advisorName = await getOwnWorkspaceDisplayName(scope.workspaceId);
    const setterIds = [...new Set(data.map((r) => r.setter_id as string | null).filter((id): id is string => !!id))];
    const setterInfoById = await resolveSetterNames(setterIds);

    return data.map((r) => mapAppointmentRow(r, "", advisorName, setterInfoById));
  }

  const advisorByWorkspace = new Map(scope.advisors.map((a) => [a.linkedWorkspaceId, a]));
  const linkedWorkspaceIds = scope.advisors.map((a) => a.linkedWorkspaceId);

  const supabase = createServiceRoleClient();
  let query = supabase
    .from("agenda_appointments")
    .select("id, workspace_id, contact_id, setter_id, start_time, end_time, subject, appointment_type, estado_cita, contacts(name, phone)")
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
  const setterInfoById = await resolveSetterNamesForWorkspace(workspaceId, setterIds);

  return data.map((r) => {
    const advisor = advisorByWorkspace.get(r.workspace_id as string);
    return mapAppointmentRow(r, advisor?.clientId ?? "", advisor?.advisorName ?? "—", setterInfoById);
  });
}

function mapAppointmentRow(
  r: {
    id: string;
    workspace_id: string;
    contact_id: string | null;
    setter_id: string | null;
    start_time: string;
    end_time: string;
    subject: string | null;
    appointment_type: string | null;
    estado_cita: string;
    contacts: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
  },
  advisorClientId: string,
  advisorName: string,
  setterInfoById: Map<string, SetterInfo>,
): AgendaAppointment {
  const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
  const setterId = r.setter_id;
  const setterInfo = setterId ? setterInfoById.get(setterId) : undefined;
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    startTime: r.start_time,
    endTime: r.end_time,
    subject: r.subject,
    appointmentType: r.appointment_type,
    estadoCita: r.estado_cita as EstadoCita,
    contactId: r.contact_id,
    contactName: contact?.name ?? null,
    contactPhone: contact?.phone ?? null,
    advisorClientId,
    advisorName,
    setterId,
    setterName: setterId ? (setterInfo?.name ?? "—") : null,
    setterAvatarUrl: setterInfo?.avatarUrl ?? null,
  };
}

async function resolveSetterNamesForWorkspace(agencyWorkspaceId: string, setterIds: string[]): Promise<Map<string, SetterInfo>> {
  if (setterIds.length === 0) return new Map();
  const supabase = createServiceRoleClient();
  const { data: members } = await supabase.rpc("workspace_member_names", { ws_id: agencyWorkspaceId });
  const map = new Map<string, SetterInfo>();
  for (const m of (members ?? []) as { member_id: string; full_name: string; avatar_url: string | null }[]) {
    if (setterIds.includes(m.member_id)) map.set(m.member_id, { name: m.full_name, avatarUrl: m.avatar_url ?? null });
  }
  return map;
}

/** En scope "advisor" no sabemos a qué agencia pertenecen los setters sin
 * otra vuelta — se resuelve directo por auth.admin.getUserById sobre cada
 * setter_id (mismo patrón que getOwnWorkspaceDisplayName), evitando
 * depender de `workspace_member_names` (que está scopeado a un workspace
 * que acá no conocemos de antemano). user_metadata.avatar_url — mismo campo
 * que ya usa el resto del proyecto para fotos de perfil de Google/email. */
async function resolveSetterNames(setterIds: string[]): Promise<Map<string, SetterInfo>> {
  if (setterIds.length === 0) return new Map();
  const supabase = createServiceRoleClient();
  const map = new Map<string, SetterInfo>();
  await Promise.all(
    setterIds.map(async (id) => {
      const { data: member } = await supabase.from("workspace_members").select("user_id").eq("id", id).maybeSingle();
      if (!member) return;
      const { data } = await supabase.auth.admin.getUserById(member.user_id as string);
      const name = (data?.user?.user_metadata?.full_name as string | undefined) || data?.user?.email || "—";
      const avatarUrl = (data?.user?.user_metadata?.avatar_url as string | undefined) ?? null;
      map.set(id, { name, avatarUrl });
    }),
  );
  return map;
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

export interface AgendaTypeBreakdown {
  type: string;
  count: number;
}

export interface AgendaPerformance {
  scope: "agency" | "advisor";
  bySetter: AgendaSetterPerformance[];
  byAdvisor: AgendaAdvisorPerformance[];
  byType: AgendaTypeBreakdown[];
  totals: Record<EstadoCita | "total", number>;
  /** Mismos totales, mismo shape, del período inmediatamente anterior (misma
   * duración, corrido hacia atrás) — para las flechas "+X% vs período
   * anterior" en las tiles de KPI. `null` solo si el período pedido dura
   * <1ms (no debería pasar con los presets de la UI). */
  previousTotals: Record<EstadoCita | "total", number> | null;
}

function emptyTotals(): Record<EstadoCita | "total", number> {
  return { total: 0, agendada: 0, confirmada: 0, realizada: 0, no_show: 0, cancelada: 0, venta: 0 };
}

/** Solo el conteo por estado (sin desglose por setter/asesor/tipo) — usado
 * para el período anterior de comparación, donde no hace falta el detalle
 * completo, solo los totales. */
async function fetchEstadoTotals(scope: AgendaScope, workspaceId: string, range: { start: string; end: string }): Promise<Record<EstadoCita | "total", number>> {
  const totals = emptyTotals();
  if (scope.kind === "advisor") {
    const client = await createClient();
    const { data } = await client.from("agenda_appointments").select("estado_cita").eq("workspace_id", scope.workspaceId).gte("start_time", range.start).lt("start_time", range.end);
    for (const r of (data ?? []) as { estado_cita: EstadoCita }[]) {
      totals.total += 1;
      totals[r.estado_cita] += 1;
    }
    return totals;
  }
  if (scope.advisors.length === 0) return totals;
  const supabase = createServiceRoleClient();
  const linkedWorkspaceIds = scope.advisors.map((a) => a.linkedWorkspaceId);
  const { data } = await supabase.from("agenda_appointments").select("estado_cita").in("workspace_id", linkedWorkspaceIds).gte("start_time", range.start).lt("start_time", range.end);
  for (const r of (data ?? []) as { estado_cita: EstadoCita }[]) {
    totals.total += 1;
    totals[r.estado_cita] += 1;
  }
  return totals;
}

function previousRangeFor(range: { start: string; end: string }): { start: string; end: string } | null {
  const start = new Date(range.start).getTime();
  const end = new Date(range.end).getTime();
  const duration = end - start;
  if (duration <= 0) return null;
  return { start: new Date(start - duration).toISOString(), end: range.start };
}

function applyType(byTypeMap: Map<string, number>, appointmentType: string | null) {
  const type = appointmentType?.trim();
  if (!type) return;
  byTypeMap.set(type, (byTypeMap.get(type) ?? 0) + 1);
}

/** KPIs → Agendas: rendimiento por setter/asesor/tipo del período, todos
 * derivados de la misma lectura de agenda_appointments (una sola query,
 * varias agrupaciones en JS) + una segunda lectura liviana (solo estado_cita)
 * del período anterior para las comparaciones. En scope "advisor" `byAdvisor`
 * siempre queda vacío (un solo asesor, la tabla no aporta nada) — la UI lo
 * oculta según `scope`, no según `byAdvisor.length` (eso sería ambiguo con
 * "sin datos en el período"). `byType` cuenta solo citas con tipo cargado en
 * la hoja — sin tipo queda afuera, nunca agrupado como "otro" inventado
 * (mismo criterio que FuenteDonutChart con las citas sin fuente). Siempre
 * vista completa del equipo/asesor (nunca filtrada por viewer): la pantalla
 * de KPIs ya gatea owner/admin en la Server Action. */
export async function getAgendaPerformance(workspaceId: string, range: { start: string; end: string }): Promise<AgendaPerformance> {
  const scope = await resolveAgendaScope(workspaceId);
  const totals = emptyTotals();
  const previousRange = previousRangeFor(range);
  const previousTotals = previousRange ? await fetchEstadoTotals(scope, workspaceId, previousRange) : null;

  if (scope.kind === "advisor") {
    const client = await createClient();
    const { data } = await client
      .from("agenda_appointments")
      .select("setter_id, estado_cita, appointment_type")
      .eq("workspace_id", scope.workspaceId)
      .gte("start_time", range.start)
      .lt("start_time", range.end);
    const rows = (data ?? []) as { setter_id: string | null; estado_cita: EstadoCita; appointment_type: string | null }[];
    if (rows.length === 0) return { scope: "advisor", bySetter: [], byAdvisor: [], byType: [], totals, previousTotals };

    const setterIds = [...new Set(rows.map((r) => r.setter_id).filter((id): id is string => !!id))];
    const setterInfoById = await resolveSetterNames(setterIds);
    const bySetterMap = new Map<string, AgendaSetterPerformance>();
    const byTypeMap = new Map<string, number>();
    for (const r of rows) {
      totals.total += 1;
      totals[r.estado_cita] += 1;
      applyType(byTypeMap, r.appointment_type);
      if (!r.setter_id) continue;
      const entry = bySetterMap.get(r.setter_id) ?? { setterId: r.setter_id, setterName: setterInfoById.get(r.setter_id)?.name ?? "—", citas: 0, realizadas: 0, noShow: 0, canceladas: 0, ventas: 0 };
      applyEstado(entry, r.estado_cita);
      bySetterMap.set(r.setter_id, entry);
    }
    const byType = [...byTypeMap.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
    return { scope: "advisor", bySetter: [...bySetterMap.values()].sort((a, b) => b.citas - a.citas), byAdvisor: [], byType, totals, previousTotals };
  }

  if (scope.advisors.length === 0) return { scope: "agency", bySetter: [], byAdvisor: [], byType: [], totals, previousTotals };
  const advisorByWorkspace = new Map(scope.advisors.map((a) => [a.linkedWorkspaceId, a]));
  const linkedWorkspaceIds = scope.advisors.map((a) => a.linkedWorkspaceId);

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("agenda_appointments")
    .select("workspace_id, setter_id, estado_cita, appointment_type")
    .in("workspace_id", linkedWorkspaceIds)
    .gte("start_time", range.start)
    .lt("start_time", range.end);
  const rows = (data ?? []) as { workspace_id: string; setter_id: string | null; estado_cita: EstadoCita; appointment_type: string | null }[];
  if (rows.length === 0) return { scope: "agency", bySetter: [], byAdvisor: [], byType: [], totals, previousTotals };

  const setterIds = [...new Set(rows.map((r) => r.setter_id).filter((id): id is string => !!id))];
  const setterInfoById = await resolveSetterNamesForWorkspace(workspaceId, setterIds);

  const bySetterMap = new Map<string, AgendaSetterPerformance>();
  const byAdvisorMap = new Map<string, AgendaAdvisorPerformance>();
  const byTypeMap = new Map<string, number>();

  for (const r of rows) {
    totals.total += 1;
    totals[r.estado_cita] += 1;
    applyType(byTypeMap, r.appointment_type);

    if (r.setter_id) {
      const entry = bySetterMap.get(r.setter_id) ?? { setterId: r.setter_id, setterName: setterInfoById.get(r.setter_id)?.name ?? "—", citas: 0, realizadas: 0, noShow: 0, canceladas: 0, ventas: 0 };
      applyEstado(entry, r.estado_cita);
      bySetterMap.set(r.setter_id, entry);
    }

    const advisor = advisorByWorkspace.get(r.workspace_id);
    if (advisor) {
      const entry = byAdvisorMap.get(advisor.clientId) ?? { clientId: advisor.clientId, advisorName: advisor.advisorName, citas: 0, realizadas: 0, noShow: 0, canceladas: 0, ventas: 0 };
      applyEstado(entry, r.estado_cita);
      byAdvisorMap.set(advisor.clientId, entry);
    }
  }

  return {
    scope: "agency",
    bySetter: [...bySetterMap.values()].sort((a, b) => b.citas - a.citas),
    byAdvisor: [...byAdvisorMap.values()].sort((a, b) => b.citas - a.citas),
    byType: [...byTypeMap.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    totals,
    previousTotals,
  };
}

function applyEstado(entry: { citas: number; realizadas: number; noShow: number; canceladas: number; ventas: number }, estado: EstadoCita) {
  entry.citas += 1;
  if (estado === "realizada") entry.realizadas += 1;
  if (estado === "no_show") entry.noShow += 1;
  if (estado === "cancelada") entry.canceladas += 1;
  if (estado === "venta") entry.ventas += 1;
}

/** Actualiza estado_cita de una cita puntual — usado desde la card de
 * Agenda, disponible para los 3 roles (owner/admin/agent — pedido explícito
 * del usuario: "las agendas las tienen que poder usar todos los roles").
 * Siempre vía service-role (la policy RLS de agenda_appointments solo
 * permite SELECT desde sesión, nunca UPDATE), previa validación de que el
 * workspace de la cita es uno de los gestionados por el caller (scope
 * "agency") o el propio workspace del caller (scope "advisor"). Dentro de
 * scope "agency", un 'agent' (setter) solo puede tocar sus propias citas —
 * mismo filtro por setter_id que ya aplica getAgendaAppointments del lado
 * de lectura, ahora espejado del lado de escritura. En scope "advisor" no
 * hay ese filtro adicional: getAgendaAppointments tampoco filtra por rol
 * ahí (un solo asesor, todos sus compañeros de workspace ven y pueden
 * actualizar las mismas citas). */
export async function updateEstadoCita(
  workspaceId: string,
  appointmentId: string,
  appointmentWorkspaceId: string,
  estadoCita: EstadoCita,
  viewer: AgendaViewer,
): Promise<void> {
  const scope = await resolveAgendaScope(workspaceId);
  const authorized = scope.kind === "advisor" ? appointmentWorkspaceId === scope.workspaceId : scope.advisors.some((a) => a.linkedWorkspaceId === appointmentWorkspaceId);
  if (!authorized) throw new Error("Esa cita no pertenece a un asesor gestionado por este workspace.");

  const supabase = createServiceRoleClient();

  if (scope.kind === "agency" && viewer.role === "agent") {
    if (!viewer.memberId) throw new Error("No se pudo identificar tu usuario.");
    const { data: appointment } = await supabase.from("agenda_appointments").select("setter_id").eq("id", appointmentId).eq("workspace_id", appointmentWorkspaceId).maybeSingle();
    if (!appointment || appointment.setter_id !== viewer.memberId) throw new Error("Solo podés actualizar el estado de tus propias citas.");
  }

  await supabase.from("agenda_appointments").update({ estado_cita: estadoCita, updated_at: new Date().toISOString() }).eq("id", appointmentId).eq("workspace_id", appointmentWorkspaceId);
}
