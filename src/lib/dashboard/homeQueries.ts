import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMonday, addDays as addDaysWeek } from "@/lib/calendar/week";
import { getCollectionsKpis } from "@/lib/collections/queries";
import { getProductBreakdown } from "@/lib/goals/queries";
import { getTasks, type TaskItem } from "@/lib/tasks/queries";
import { getGoalsBoardAction } from "@/lib/goals/actions";

export type DashboardPeriod = "day" | "week" | "month" | "year";

interface PeriodRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Rangos [start, end) + el rango anterior de igual duración, para las
 * variaciones "vs. período previo" de los KPIs. "week" usa lunes-domingo
 * (mismo criterio que el resto del Calendario, getMonday/addDays). */
function resolvePeriodRange(period: DashboardPeriod, now: Date): PeriodRange {
  if (period === "day") {
    const start = startOfDay(now);
    const end = addDaysWeek(start, 1);
    return { start, end, prevStart: addDaysWeek(start, -1), prevEnd: start };
  }
  if (period === "week") {
    const start = getMonday(now);
    const end = addDaysWeek(start, 7);
    return { start, end, prevStart: addDaysWeek(start, -7), prevEnd: start };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { start, end, prevStart, prevEnd: start };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  const prevStart = new Date(now.getFullYear() - 1, 0, 1);
  return { start, end, prevStart, prevEnd: start };
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0; // sin base de comparación real — mostrar "—", no un "+∞%" o "+100%" engañoso
  return Math.round(((current - previous) / previous) * 100);
}

export interface DashboardHomeGreeting {
  firstName: string;
  appointmentsToday: number;
  pendingTasksToday: number;
  collectionsThisWeekAmount: number;
}

export interface DashboardHomeKpis {
  citasAgendadas: { count: number; deltaPct: number | null };
  sePresentaron: { attendedCount: number; markedCount: number; attendanceRatePct: number | null };
  embudoActivo: { amount: number; currency: string; count: number };
  carteraEnRiesgo: { count: number; amount: number };
}

export interface MonthlyActivityPoint {
  month: string;
  count: number;
}

export interface EficaciaVentas {
  avgCloseDays: number | null;
  closedSampleCount: number;
  conversionRatePct: number;
  porRamo: { insuranceType: string; pct: number; count: number }[];
}

export interface GoalProgressSummary {
  id: string;
  name: string;
  currentValue: number;
  targetValue: number;
  progressPct: number;
  rewardLabel: string | null;
}

export interface DashboardHomeData {
  greeting: DashboardHomeGreeting;
  kpis: DashboardHomeKpis;
  monthlyActivity: MonthlyActivityPoint[];
  eficaciaVentas: EficaciaVentas;
  pendingTasksToday: TaskItem[];
  goals: GoalProgressSummary[];
}

const MONTH_LABEL = new Intl.DateTimeFormat("es", { month: "short" });

async function getMonthlyActivity(workspaceId: string, now: Date): Promise<MonthlyActivityPoint[]> {
  const supabase = await createClient();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const { data } = await supabase
    .from("bookings")
    .select("start_time")
    .eq("workspace_id", workspaceId)
    .neq("status", "cancelled")
    .gte("start_time", rangeStart.toISOString())
    .lt("start_time", rangeEnd.toISOString());

  const buckets = new Map<string, { label: string; count: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(`${d.getFullYear()}-${d.getMonth()}`, { label: MONTH_LABEL.format(d), count: 0 });
  }
  for (const row of data ?? []) {
    const d = new Date(row.start_time as string);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.count += 1;
  }
  return [...buckets.values()].map((b) => ({ month: b.label, count: b.count }));
}

async function getEficaciaVentas(workspaceId: string, range: PeriodRange): Promise<EficaciaVentas> {
  const supabase = await createClient();
  // getProductBreakdown espera un periodEnd INCLUSIVE ("<= end T23:59:59")
  // — range.end es el inicio del período SIGUIENTE (exclusive), así que hay
  // que restarle un día para no sumar de más el primer día del próximo mes.
  const inclusiveEnd = addDaysWeek(range.end, -1);

  const [{ data: createdInPeriod }, { data: closedRows }, porRamoRaw] = await Promise.all([
    supabase.from("opportunities").select("id, status").eq("workspace_id", workspaceId).gte("created_at", range.start.toISOString()).lt("created_at", range.end.toISOString()),
    // Tiempo de cierre: todo lo que YA tiene closed_at (0113) — nunca
    // period-scoped por diseño, para no vaciar la muestra en rangos cortos
    // mientras el dato todavía es nuevo.
    supabase.from("opportunities").select("created_at, closed_at").eq("workspace_id", workspaceId).not("closed_at", "is", null),
    getProductBreakdown(workspaceId, null, range.start.toISOString().slice(0, 10), inclusiveEnd.toISOString().slice(0, 10)),
  ]);

  const created = createdInPeriod ?? [];
  const won = created.filter((o) => o.status === "won").length;
  const conversionRatePct = created.length > 0 ? Math.round((won / created.length) * 100) : 0;

  const closedDurationsDays = (closedRows ?? []).map((r) => (new Date(r.closed_at as string).getTime() - new Date(r.created_at as string).getTime()) / 86400000);
  const avgCloseDays = closedDurationsDays.length > 0 ? Math.round(closedDurationsDays.reduce((a, b) => a + b, 0) / closedDurationsDays.length) : null;

  // Top 3 por volumen, tal cual — sin esconder "otro" para forzar que
  // parezca que solo hay 3 ramos reales cuando el dato dice otra cosa.
  const totalRamoCount = porRamoRaw.reduce((s, r) => s + r.count, 0);
  const porRamo = porRamoRaw
    .map((r) => ({ insuranceType: r.insuranceType, count: r.count, pct: totalRamoCount > 0 ? Math.round((r.count / totalRamoCount) * 100) : 0 }))
    .slice(0, 3);

  return { avgCloseDays, closedSampleCount: closedDurationsDays.length, conversionRatePct, porRamo };
}

async function getKpis(workspaceId: string, range: PeriodRange, collectionsKpis: Awaited<ReturnType<typeof getCollectionsKpis>>): Promise<DashboardHomeKpis> {
  const supabase = await createClient();
  const now = new Date();
  // "Se presentaron" solo tiene sentido para citas que ya pasaron — si el
  // período todavía no terminó (ej. "Semana" corriendo hoy miércoles), el
  // límite superior es "ahora", no el fin del período completo.
  const pastBoundary = range.end.getTime() < now.getTime() ? range.end : now;

  const [{ count: citasCount }, { count: citasPrevCount }, { data: pastBookings }, { data: activePolicies }] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).neq("status", "cancelled").gte("start_time", range.start.toISOString()).lt("start_time", range.end.toISOString()),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).neq("status", "cancelled").gte("start_time", range.prevStart.toISOString()).lt("start_time", range.prevEnd.toISOString()),
    supabase.from("bookings").select("attended").eq("workspace_id", workspaceId).neq("status", "cancelled").gte("start_time", range.start.toISOString()).lt("start_time", pastBoundary.toISOString()),
    supabase.from("policies").select("premium, premium_currency").eq("workspace_id", workspaceId).in("status", ["cotizacion", "documentacion", "pendiente_emision"]),
  ]);

  const marked = (pastBookings ?? []).filter((b) => b.attended !== null);
  const attended = marked.filter((b) => b.attended === true);

  const policyRows = (activePolicies ?? []) as { premium: number | null; premium_currency: string }[];
  const currencyCounts = new Map<string, number>();
  for (const p of policyRows) currencyCounts.set(p.premium_currency, (currencyCounts.get(p.premium_currency) ?? 0) + 1);
  const dominantCurrency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  return {
    citasAgendadas: { count: citasCount ?? 0, deltaPct: pctDelta(citasCount ?? 0, citasPrevCount ?? 0) },
    sePresentaron: { attendedCount: attended.length, markedCount: marked.length, attendanceRatePct: marked.length > 0 ? Math.round((attended.length / marked.length) * 100) : null },
    embudoActivo: { amount: policyRows.reduce((s, p) => s + (p.premium ?? 0), 0), currency: dominantCurrency, count: policyRows.length },
    carteraEnRiesgo: { count: collectionsKpis.overdueCount, amount: collectionsKpis.overdueAmount },
  };
}

/** KPIs de actividad quedan a nivel workspace (mismo criterio que el
 * getDashboardKpis existente, que tampoco filtra por miembro) — "Metas"
 * es la única sección personal, porque getGoalsBoardAction ya resuelve el
 * miembro actual internamente (los objetivos son por asesor, no de equipo). */
export async function getDashboardHome(workspaceId: string, firstName: string, period: DashboardPeriod): Promise<DashboardHomeData> {
  const now = new Date();
  const range = resolvePeriodRange(period, now);
  const todayStart = startOfDay(now);
  const todayEnd = addDaysWeek(todayStart, 1);
  const supabase = await createClient();

  const [collectionsKpis, monthlyActivity, eficaciaVentas, tasksToday, goalsBoard, { count: appointmentsToday }] = await Promise.all([
    getCollectionsKpis(workspaceId),
    getMonthlyActivity(workspaceId, now),
    getEficaciaVentas(workspaceId, range),
    getTasks(workspaceId, { dueRange: "today" }),
    getGoalsBoardAction(),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).neq("status", "cancelled").gte("start_time", todayStart.toISOString()).lt("start_time", todayEnd.toISOString()),
  ]);
  const kpis = await getKpis(workspaceId, range, collectionsKpis);

  const pendingTasksToday = tasksToday.filter((t) => t.status !== "completed");

  const goals: GoalProgressSummary[] = goalsBoard.goals.slice(0, 2).map((g) => ({
    id: g.id,
    name: g.name,
    currentValue: g.currentValue,
    targetValue: g.targetValue,
    progressPct: Math.round(g.projection.progressPct),
    rewardLabel: g.rewardLabel,
  }));

  return {
    greeting: {
      firstName,
      appointmentsToday: appointmentsToday ?? 0,
      pendingTasksToday: pendingTasksToday.length,
      collectionsThisWeekAmount: collectionsKpis.upcoming7Amount,
    },
    kpis,
    monthlyActivity,
    eficaciaVentas,
    pendingTasksToday,
    goals,
  };
}
