import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toUsd } from "./exchangeRates";
import { FINANZAS_CATEGORIES, deriveFinanzasBucket, type FinanzasCategoria, type FinanzasRecurrencia, type FinanzasTipo } from "./constants";

const SELECT = "id, workspace_id, tipo, categoria, descripcion, contraparte, monto, moneda, fecha_vencimiento, medio_pago, detalle_medio, estado, fecha_pago, recurrencia, notas, created_by, created_at";

export interface FinanzasMovimiento {
  id: string;
  workspaceId: string;
  tipo: FinanzasTipo;
  categoria: FinanzasCategoria;
  descripcion: string;
  contraparte: string | null;
  monto: number;
  moneda: string;
  fechaVencimiento: string;
  medioPago: string | null;
  detalleMedio: string | null;
  estado: "pendiente" | "pagado";
  fechaPago: string | null;
  recurrencia: FinanzasRecurrencia;
  notas: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface FinanzasMovimientoInput {
  tipo: FinanzasTipo;
  categoria: FinanzasCategoria;
  descripcion: string;
  contraparte: string | null;
  monto: number;
  moneda: string;
  fechaVencimiento: string;
  medioPago: string | null;
  detalleMedio: string | null;
  estado: "pendiente" | "pagado";
  recurrencia: FinanzasRecurrencia;
  notas: string | null;
}

function mapRow(r: Record<string, unknown>): FinanzasMovimiento {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    tipo: r.tipo as FinanzasTipo,
    categoria: r.categoria as FinanzasCategoria,
    descripcion: r.descripcion as string,
    contraparte: (r.contraparte as string | null) ?? null,
    monto: Number(r.monto),
    moneda: r.moneda as string,
    fechaVencimiento: r.fecha_vencimiento as string,
    medioPago: (r.medio_pago as string | null) ?? null,
    detalleMedio: (r.detalle_medio as string | null) ?? null,
    estado: r.estado as "pendiente" | "pagado",
    fechaPago: (r.fecha_pago as string | null) ?? null,
    recurrencia: r.recurrencia as FinanzasRecurrencia,
    notas: (r.notas as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

interface MovimientoFilters {
  search?: string;
  medioPago?: string;
  categoria?: string;
  tipo?: FinanzasTipo;
}

function applyFilters(items: FinanzasMovimiento[], f: MovimientoFilters): FinanzasMovimiento[] {
  let rows = items;
  if (f.tipo) rows = rows.filter((i) => i.tipo === f.tipo);
  if (f.medioPago) rows = rows.filter((i) => i.medioPago === f.medioPago);
  if (f.categoria) rows = rows.filter((i) => i.categoria === f.categoria);
  const q = f.search?.trim().toLowerCase();
  if (q) rows = rows.filter((i) => `${i.descripcion} ${i.contraparte ?? ""} ${i.detalleMedio ?? ""}`.toLowerCase().includes(q));
  return rows;
}

async function getMovimientosInRange(workspaceId: string, from: string, to: string): Promise<FinanzasMovimiento[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("finanzas_movimientos")
    .select(SELECT)
    .eq("workspace_id", workspaceId)
    .gte("fecha_vencimiento", from)
    .lte("fecha_vencimiento", to)
    .order("fecha_vencimiento", { ascending: false });
  return (data ?? []).map(mapRow);
}

export interface GastosKpis {
  totalMesUsd: number;
  yaPagadoUsd: number;
  pendienteUsd: number;
  pendienteVencidosCount: number;
  gastosFijosUsd: number;
  gastosFijosCount: number;
  itemsCount: number;
}

export interface BarDatum {
  label: string;
  totalUsd: number;
}

export interface GastosTabData {
  items: FinanzasMovimiento[];
  kpis: GastosKpis;
  porCategoria: BarDatum[];
  porMedioPago: BarDatum[];
}

/** Pestaña Gastos: todos los movimientos tipo "out" con fecha_vencimiento en
 * el mes pedido (`month` = "YYYY-MM"), más KPIs y los 2 agregados para los
 * gráficos — mismo cálculo que `renderGastos()` del prototipo de referencia. */
export async function getGastosTabData(workspaceId: string, params: { month: string } & MovimientoFilters): Promise<GastosTabData> {
  const [year, m] = params.month.split("-").map(Number);
  const from = `${params.month}-01`;
  const to = `${year}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  const lastDay = addDaysIso(to, -1);
  const all = await getMovimientosInRange(workspaceId, from, lastDay);
  const items = applyFilters(all, { ...params, tipo: "out" }).sort((a, b) => b.fechaVencimiento.localeCompare(a.fechaVencimiento));

  const totalMesUsd = items.reduce((s, i) => s + toUsd(i.monto, i.moneda), 0);
  const pagados = items.filter((i) => i.estado === "pagado");
  const pendientes = items.filter((i) => i.estado === "pendiente");
  const fijos = items.filter((i) => i.recurrencia !== "ninguna");
  const kpis: GastosKpis = {
    totalMesUsd,
    yaPagadoUsd: pagados.reduce((s, i) => s + toUsd(i.monto, i.moneda), 0),
    pendienteUsd: pendientes.reduce((s, i) => s + toUsd(i.monto, i.moneda), 0),
    pendienteVencidosCount: pendientes.filter((i) => deriveFinanzasBucket(i.estado, i.fechaVencimiento) === "vencido").length,
    gastosFijosUsd: fijos.reduce((s, i) => s + toUsd(i.monto, i.moneda), 0),
    gastosFijosCount: fijos.length,
    itemsCount: items.length,
  };

  const byCat = new Map<string, number>();
  const byMet = new Map<string, number>();
  for (const i of items) {
    const catLabel = FINANZAS_CATEGORIES[i.categoria]?.label ?? i.categoria;
    byCat.set(catLabel, (byCat.get(catLabel) ?? 0) + toUsd(i.monto, i.moneda));
    const met = i.medioPago ?? "Sin medio";
    byMet.set(met, (byMet.get(met) ?? 0) + toUsd(i.monto, i.moneda));
  }
  const toSorted = (m: Map<string, number>) => [...m.entries()].map(([label, totalUsd]) => ({ label, totalUsd })).sort((a, b) => b.totalUsd - a.totalUsd);

  return { items, kpis, porCategoria: toSorted(byCat), porMedioPago: toSorted(byMet) };
}

export interface CalendarioKpis {
  porCobrar15Usd: number;
  porCobrar15Count: number;
  porPagar15Usd: number;
  porPagar15Count: number;
  enRiesgoUsd: number;
  enRiesgoCount: number;
  pagosVencidosCount: number;
  balanceMesUsd: number;
  cobradoMesUsd: number;
  pagadoMesUsd: number;
}

export interface CalendarioTabData {
  items: FinanzasMovimiento[];
  kpis: CalendarioKpis;
  /** Pendientes que vencen dentro de 15 días, incluidos los ya vencidos —
   * para el panel lateral "Próximos 15 días" (mismo criterio que
   * `renderList()` del prototipo: "incluye vencidos sin resolver"). No se
   * limita al rango de la grilla visible, por si hay algo vencido de hace
   * más de 6 semanas. */
  pendientes15: FinanzasMovimiento[];
}

/** Pestaña Calendario: movimientos dentro del rango de la grilla (42 celdas,
 * puede incluir días de meses vecinos), más los 4 KPIs globales (no acotados
 * a la grilla) — mismo criterio que `renderKPIs()` del prototipo. */
export async function getCalendarioTabData(workspaceId: string, params: { gridStart: string; gridEnd: string } & MovimientoFilters): Promise<CalendarioTabData> {
  const today = todayIso();
  const in15 = addDaysIso(today, 15);
  const wideFrom = addDaysIso(today, -120);
  const wideTo = addDaysIso(today, 120);
  const [gridRows, wideRows] = await Promise.all([
    getMovimientosInRange(workspaceId, params.gridStart, params.gridEnd),
    getMovimientosInRange(workspaceId, wideFrom, wideTo),
  ]);
  const items = applyFilters(gridRows, params);
  const wideFiltered = applyFilters(wideRows, params);

  const pend = wideFiltered.filter((i) => i.estado === "pendiente");
  const cobrar15 = pend.filter((i) => i.tipo === "in" && i.fechaVencimiento >= today && i.fechaVencimiento <= in15);
  const pagar15 = pend.filter((i) => i.tipo === "out" && i.fechaVencimiento >= today && i.fechaVencimiento <= in15);
  const vencidosIn = pend.filter((i) => i.tipo === "in" && i.fechaVencimiento < today);
  const vencidosOut = pend.filter((i) => i.tipo === "out" && i.fechaVencimiento < today);

  const monthPrefix = today.slice(0, 7);
  const pagadosEsteMes = wideFiltered.filter((i) => i.estado === "pagado" && i.fechaPago && i.fechaPago.slice(0, 7) === monthPrefix);
  const cobradoMesUsd = pagadosEsteMes.filter((i) => i.tipo === "in").reduce((s, i) => s + toUsd(i.monto, i.moneda), 0);
  const pagadoMesUsd = pagadosEsteMes.filter((i) => i.tipo === "out").reduce((s, i) => s + toUsd(i.monto, i.moneda), 0);

  const kpis: CalendarioKpis = {
    porCobrar15Usd: cobrar15.reduce((s, i) => s + toUsd(i.monto, i.moneda), 0),
    porCobrar15Count: cobrar15.length,
    porPagar15Usd: pagar15.reduce((s, i) => s + toUsd(i.monto, i.moneda), 0),
    porPagar15Count: pagar15.length,
    enRiesgoUsd: vencidosIn.reduce((s, i) => s + toUsd(i.monto, i.moneda), 0),
    enRiesgoCount: vencidosIn.length,
    pagosVencidosCount: vencidosOut.length,
    balanceMesUsd: cobradoMesUsd - pagadoMesUsd,
    cobradoMesUsd,
    pagadoMesUsd,
  };

  const pendientes15 = pend.filter((i) => i.fechaVencimiento <= in15).sort((a, b) => b.fechaVencimiento.localeCompare(a.fechaVencimiento));

  return { items, kpis, pendientes15 };
}

async function assertMovimientoInWorkspace(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, id: string): Promise<FinanzasMovimiento> {
  const { data } = await supabase.from("finanzas_movimientos").select(SELECT).eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) throw new Error("Movimiento no encontrado en este workspace.");
  return mapRow(data);
}

function validateInput(input: FinanzasMovimientoInput) {
  if (!input.descripcion.trim()) throw new Error("Falta la descripción.");
  if (!(input.monto > 0)) throw new Error("Ingresá un monto válido.");
  if (!input.fechaVencimiento) throw new Error("La fecha de vencimiento es obligatoria.");
  if (input.tipo === "out" && !input.medioPago) throw new Error("El medio de pago es obligatorio para los gastos.");
}

export async function createMovimiento(workspaceId: string, memberId: string | null, input: FinanzasMovimientoInput): Promise<void> {
  validateInput(input);
  const supabase = await createClient();
  const { error } = await supabase.from("finanzas_movimientos").insert({
    workspace_id: workspaceId,
    tipo: input.tipo,
    categoria: input.categoria,
    descripcion: input.descripcion.trim(),
    contraparte: input.contraparte?.trim() || null,
    monto: input.monto,
    moneda: input.moneda,
    fecha_vencimiento: input.fechaVencimiento,
    medio_pago: input.medioPago,
    detalle_medio: input.detalleMedio?.trim() || null,
    estado: input.estado,
    fecha_pago: input.estado === "pagado" ? todayIso() : null,
    recurrencia: input.recurrencia,
    notas: input.notas?.trim() || null,
    created_by: memberId,
  });
  if (error) throw new Error("No se pudo crear el movimiento.");
}

export async function updateMovimiento(workspaceId: string, id: string, input: FinanzasMovimientoInput): Promise<void> {
  validateInput(input);
  const supabase = await createClient();
  const existing = await assertMovimientoInWorkspace(supabase, workspaceId, id);
  const fechaPago = input.estado === "pagado" ? (existing.estado === "pagado" && existing.fechaPago ? existing.fechaPago : todayIso()) : null;

  const { error } = await supabase
    .from("finanzas_movimientos")
    .update({
      tipo: input.tipo,
      categoria: input.categoria,
      descripcion: input.descripcion.trim(),
      contraparte: input.contraparte?.trim() || null,
      monto: input.monto,
      moneda: input.moneda,
      fecha_vencimiento: input.fechaVencimiento,
      medio_pago: input.medioPago,
      detalle_medio: input.detalleMedio?.trim() || null,
      estado: input.estado,
      fecha_pago: fechaPago,
      recurrencia: input.recurrencia,
      notas: input.notas?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el movimiento.");
}

export async function deleteMovimiento(workspaceId: string, id: string): Promise<void> {
  const supabase = await createClient();
  await assertMovimientoInWorkspace(supabase, workspaceId, id);
  const { error } = await supabase.from("finanzas_movimientos").delete().eq("id", id).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo borrar el movimiento.");
}

function nextOccurrence(fechaVencimiento: string, recurrencia: FinanzasRecurrencia): string {
  const [y, m, d] = fechaVencimiento.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (recurrencia === "mensual") dt.setMonth(dt.getMonth() + 1);
  else dt.setFullYear(dt.getFullYear() + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Marca un movimiento como cobrado/pagado — si es recurrente, además crea
 * la próxima ocurrencia (+1 mes o +1 año) como pendiente, clonando la fila
 * (mismo criterio que el `handleAction` del prototipo de referencia). */
export async function markMovimientoPaid(workspaceId: string, memberId: string | null, id: string, fechaPago?: string): Promise<void> {
  const supabase = await createClient();
  const existing = await assertMovimientoInWorkspace(supabase, workspaceId, id);
  const paidAt = fechaPago || todayIso();

  const { error } = await supabase
    .from("finanzas_movimientos")
    .update({ estado: "pagado", fecha_pago: paidAt, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo marcar el movimiento.");

  if (existing.recurrencia !== "ninguna") {
    await supabase.from("finanzas_movimientos").insert({
      workspace_id: workspaceId,
      tipo: existing.tipo,
      categoria: existing.categoria,
      descripcion: existing.descripcion,
      contraparte: existing.contraparte,
      monto: existing.monto,
      moneda: existing.moneda,
      fecha_vencimiento: nextOccurrence(existing.fechaVencimiento, existing.recurrencia),
      medio_pago: existing.medioPago,
      detalle_medio: existing.detalleMedio,
      estado: "pendiente",
      fecha_pago: null,
      recurrencia: existing.recurrencia,
      notas: existing.notas,
      created_by: memberId,
    });
  }
}

export async function markMovimientoPending(workspaceId: string, id: string): Promise<void> {
  const supabase = await createClient();
  await assertMovimientoInWorkspace(supabase, workspaceId, id);
  const { error } = await supabase
    .from("finanzas_movimientos")
    .update({ estado: "pendiente", fecha_pago: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo deshacer el movimiento.");
}
