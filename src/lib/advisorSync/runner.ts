import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchSheetValues, getValidGoogleSheetsAccessToken } from "@/lib/integrations/googleSheets";
import { getValidGoogleSheetsExportAccessToken } from "@/lib/integrations/googleSheetsExport";
import { normalizeForMatch } from "@/lib/advisors/import/fuzzyMatch";
import { ESTADO_VALUES, resolveEquivalence, type ValueMap } from "@/lib/agenda/sheetValueOptions";
import type { EstadoCita } from "@/lib/agenda/queries";
import type { AdvisorSyncFieldKey } from "./fieldDictionary";
import { parseContactado, phoneDigits, phoneLookupCandidates } from "./rowParsing";
import { parseAgendaSheetRows, isBlockingProblem, AGENDA_ROW_PROBLEM_LABELS } from "./sheetRows";

export interface AgendaSheetOptions {
  /** Crear el lead (contacto) si no existe — si está apagado, las filas de leads nuevos se reportan. */
  create_leads: boolean;
  /** Escribir el estado de vuelta en la hoja cuando cambia en el CRM (ver writeBack.ts). */
  write_back: boolean;
}

export const DEFAULT_AGENDA_SHEET_OPTIONS: AgendaSheetOptions = { create_leads: true, write_back: true };

export interface AdvisorSheetConnection {
  id: string;
  workspace_id: string;
  /** null = conexión propia del workspace (autoservicio, ver
   * 0155_advisor_sheet_self_service.sql) — el destino de los datos es el
   * propio workspace_id, sin pasar por el roster de una agencia. */
  advisor_client_id: string | null;
  spreadsheet_id: string;
  sheet_name: string;
  column_map: Record<string, AdvisorSyncFieldKey>;
  /** 1-based — algunas hojas tienen una fila de título arriba de los
   * encabezados reales (ver inspectAdvisorSheetColumnsAction). */
  header_row: number;
  last_sheet_hash: string | null;
  /** Equivalencias hoja → CRM (0199). */
  value_map: ValueMap;
  options: AgendaSheetOptions;
  /** Convención Date#getTimezoneOffset (México 360, Argentina 180) — 0199. */
  utc_offset_minutes: number;
}

/** Fila cruda de advisor_sheet_connections → lo que necesita el runner. Un solo lugar, para que
 * la acción manual, la del panel de Agenda y el cron (si se vuelve a programar) no diverjan. */
export function toAdvisorSheetConnection(row: Record<string, unknown>): AdvisorSheetConnection {
  return {
    id: row.id as string,
    workspace_id: row.workspace_id as string,
    advisor_client_id: (row.advisor_client_id as string | null) ?? null,
    spreadsheet_id: row.spreadsheet_id as string,
    sheet_name: row.sheet_name as string,
    column_map: (row.column_map as Record<string, AdvisorSyncFieldKey>) ?? {},
    header_row: (row.header_row as number) ?? 1,
    last_sheet_hash: (row.last_sheet_hash as string | null) ?? null,
    value_map: (row.value_map as ValueMap) ?? {},
    options: { ...DEFAULT_AGENDA_SHEET_OPTIONS, ...((row.options as Partial<AgendaSheetOptions>) ?? {}) },
    utc_offset_minutes: typeof row.utc_offset_minutes === "number" ? row.utc_offset_minutes : 180,
  };
}

export interface AdvisorSyncResult {
  ok: boolean;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  newLeads: number;
  deletedInSheet: number;
  message?: string;
}

/** Origen de los contactos creados desde la hoja de agendas (se muestra "Hoja de agendas"). */
export const AGENDA_SHEET_CONTACT_SOURCE = "agenda_sheet";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Lectura: la cuenta de Google con escritura ("Exportar referidos", la que conecta el panel de
 * Agenda) también lee; si no está, la de solo lectura de Perfil → Integraciones. */
export async function getSheetReadToken(workspaceId: string): Promise<string | null> {
  return (await getValidGoogleSheetsExportAccessToken(workspaceId)) ?? (await getValidGoogleSheetsAccessToken(workspaceId));
}

/** `last_synced_at` se actualiza acá (no solo en claim_pending_advisor_sheet_syncs,
 * que es del cron) para que "Sincronizar ahora" también quede reflejado en
 * la UI — si no, un sync manual exitoso seguía mostrando "Todavía no
 * sincronizó" porque ese campo nunca se tocaba fuera del claim del cron. */
async function markConnectionError(supabase: SupabaseClient, connectionId: string, message: string) {
  await supabase
    .from("advisor_sheet_connections")
    .update({ last_sync_status: "error", last_sync_error: message.slice(0, 500), last_synced_at: new Date().toISOString() })
    .eq("id", connectionId);
}

async function markConnectionOk(supabase: SupabaseClient, connectionId: string, rowCount: number, sheetHash: string | null) {
  await supabase
    .from("advisor_sheet_connections")
    .update({
      last_sync_status: "ok",
      last_sync_error: null,
      row_count: rowCount,
      last_synced_at: new Date().toISOString(),
      ...(sheetHash ? { last_sheet_hash: sheetHash } : {}),
    })
    .eq("id", connectionId);
}

/** Exacto→substring — una coincidencia de nombre equivocada asocia la fila
 * al setter equivocado, así que nunca es "aproximado por puntaje". */
function resolveByName<T extends { name: string }>(needle: string | undefined, candidates: T[]): T | null {
  if (!needle) return null;
  const normalized = normalizeForMatch(needle);
  const exact = candidates.find((c) => normalizeForMatch(c.name) === normalized);
  if (exact) return exact;
  return candidates.find((c) => normalizeForMatch(c.name).includes(normalized) || normalized.includes(normalizeForMatch(c.name))) ?? null;
}

interface SetterCandidate {
  memberId: string;
  name: string;
}

/** Mismas 7 etapas que crm/actions.ts::DEFAULT_CRM_STAGES — duplicadas acá
 * en vez de importadas porque ensureCrmPipeline usa el cliente de sesión
 * (createClient/next-headers) para el primer chequeo, lo cual no sirve en
 * este contexto (cron/service-role, sin cookies de usuario real): bajo RLS
 * sin sesión esa lectura devolvería "no existe" aunque el pipeline ya
 * exista, y crearía uno duplicado en cada corrida. Acá todo el flujo va con
 * el mismo cliente service-role de punta a punta. */
const DEFAULT_CRM_STAGES = [
  { name: "Nuevo", isWon: false, isLost: false },
  { name: "Contactado", isWon: false, isLost: false },
  { name: "Calificado", isWon: false, isLost: false },
  { name: "Propuesta", isWon: false, isLost: false },
  { name: "Negociación", isWon: false, isLost: false },
  { name: "Ganado", isWon: true, isLost: false },
  { name: "Perdido", isWon: false, isLost: true },
];

interface PipelineTarget {
  pipelineId: string;
  stageId: string;
}

/** Resuelve (o crea) el pipeline de CRM del asesor + su primera etapa —
 * nunca se le pide al admin de la agencia que elija pipeline/etapa a mano
 * (a diferencia de leadSync antes de esta unificación): el lead siempre
 * entra por la primera columna del pipeline de ventas del asesor. */
async function ensureCrmPipelineTarget(supabase: SupabaseClient, workspaceId: string, cache: Map<string, PipelineTarget>): Promise<PipelineTarget> {
  const cached = cache.get(workspaceId);
  if (cached) return cached;

  const { data: existing } = await supabase.from("pipelines").select("id").eq("workspace_id", workspaceId).eq("module_key", "crm").limit(1).maybeSingle();
  let pipelineId = existing?.id as string | undefined;

  if (!pipelineId) {
    const { data: pipeline, error } = await supabase.from("pipelines").insert({ workspace_id: workspaceId, module_key: "crm", name: "Pipeline de ventas" }).select("id").single();
    if (error || !pipeline) throw new Error(error?.message ?? "No se pudo crear el pipeline de ventas.");
    pipelineId = pipeline.id as string;
    await supabase.from("pipeline_stages").insert(DEFAULT_CRM_STAGES.map((s, i) => ({ pipeline_id: pipelineId, name: s.name, position: i, is_won: s.isWon, is_lost: s.isLost })));
  }

  const { data: firstStage } = await supabase.from("pipeline_stages").select("id").eq("pipeline_id", pipelineId).order("position", { ascending: true }).limit(1).maybeSingle();
  if (!firstStage) throw new Error("El pipeline de ventas del asesor no tiene etapas.");

  const target: PipelineTarget = { pipelineId, stageId: firstStage.id as string };
  cache.set(workspaceId, target);
  return target;
}

interface AdvisorContext {
  /** null en conexiones propias (autoservicio) — no hay fila de `clients`
   * de agencia detrás, así que no hay con qué asociar advisor_setter_assignments
   * ni agenda_appointments.advisor_client_id (ambos quedan null). */
  clientId: string | null;
  linkedWorkspaceId: string;
  agencyWorkspaceId: string;
}

interface ContactRef {
  id: string;
  name: string;
  custom_fields: Record<string, unknown> | null;
  isNew: boolean;
  phone?: string;
  email?: string | null;
}

interface IndexRow {
  contact_id: string | null;
  appointment_id: string | null;
  opportunity_id: string | null;
  last_row_hash: string;
}

interface ExistingAppointment {
  id: string;
  contact_id: string | null;
  start_time: string;
  sheet_connection_id: string | null;
}

function localDayKey(date: Date, utcOffsetMinutes: number): string {
  return new Date(date.getTime() - utcOffsetMinutes * 60000).toISOString().slice(0, 10);
}

/** `select ... in (...)` partido en tandas (PostgREST tiene límite de largo de URL). */
async function selectIn<T>(ids: string[], size: number, run: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await run(ids.slice(i, i + size));
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
  }
  return out;
}

async function upsertInChunks(supabase: SupabaseClient, table: string, rows: Record<string, unknown>[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 200), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

/** Oportunidad en el pipeline: solo conexiones de agencia (comportamiento previo a 0199). En las
 * conexiones propias el lead queda guardado en la sección Leads de la Agenda (pedido explícito). */
async function ensureAgencyOpportunity(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string,
  leadName: string,
  notes: string | undefined,
  opportunityId: string | null,
  pipelineCache: Map<string, PipelineTarget>,
): Promise<string> {
  if (opportunityId) {
    await supabase.from("opportunities").update({ title: leadName, updated_at: new Date().toISOString() }).eq("id", opportunityId);
    return opportunityId;
  }
  const { pipelineId, stageId } = await ensureCrmPipelineTarget(supabase, workspaceId, pipelineCache);
  const { data: opp, error: oppError } = await supabase.from("opportunities").insert({ workspace_id: workspaceId, contact_id: contactId, title: leadName, value: 0, currency: "USD" }).select("id").single();
  if (oppError || !opp) throw new Error(oppError?.message ?? "No se pudo crear la oportunidad.");
  const { data: pipelineItem, error: itemError } = await supabase
    .from("pipeline_items")
    .insert({ pipeline_id: pipelineId, stage_id: stageId, item_type: "opportunity", item_id: opp.id, position: 0 })
    .select("id")
    .single();
  if (itemError || !pipelineItem) throw new Error(itemError?.message ?? "No se pudo agregar el lead al pipeline.");
  await supabase.from("opportunities").update({ pipeline_item_id: pipelineItem.id }).eq("id", opp.id);
  if (notes) await supabase.from("notes").insert({ workspace_id: workspaceId, notable_type: "opportunity", notable_id: opp.id, body: notes });
  return opp.id as string;
}

async function startRun(supabase: SupabaseClient, connectionId: string, trigger: "cron" | "manual"): Promise<string | undefined> {
  const { data } = await supabase.from("advisor_sheet_sync_runs").insert({ connection_id: connectionId, trigger, status: "running" }).select("id").single();
  return data?.id as string | undefined;
}

async function finishRun(
  supabase: SupabaseClient,
  runId: string | undefined,
  patch: { status: "ok" | "error"; error_message?: string; rows_read: number; created_count: number; updated_count: number; skipped_count: number; error_count: number },
) {
  if (!runId) return;
  await supabase.from("advisor_sheet_sync_runs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", runId);
}

const EMPTY_RESULT: Omit<AdvisorSyncResult, "ok"> = { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0, newLeads: 0, deletedInSheet: 0 };

async function failRun(supabase: SupabaseClient, connectionId: string, trigger: "cron" | "manual", message: string, runId?: string): Promise<AdvisorSyncResult> {
  const id = runId ?? (await startRun(supabase, connectionId, trigger));
  await markConnectionError(supabase, connectionId, message);
  await finishRun(supabase, id, { status: "error", error_message: message, rows_read: 0, created_count: 0, updated_count: 0, skipped_count: 0, error_count: 0 });
  return { ok: false, ...EMPTY_RESULT, message };
}

/** Entry point de "Actualizar" (manual). Trabaja en lote — unas pocas lecturas para todo el índice,
 * los contactos y las citas, todo se resuelve en memoria y se escribe con un upsert por tabla (antes
 * eran ~10 round trips por fila: una hoja de 60 filas tardaba ~1 minuto). Las filas con problemas
 * se reportan sin frenar al resto. Al final, las citas de esta hoja cuya fila ya no está quedan
 * "Eliminada en la hoja" (nunca se borran del CRM). Nunca lanza. */
export async function runAdvisorSheetSync(connection: AdvisorSheetConnection, trigger: "cron" | "manual" = "cron"): Promise<AdvisorSyncResult> {
  const supabase = createServiceRoleClient();

  let advisor: AdvisorContext;
  if (connection.advisor_client_id) {
    const { data: clientRow } = await supabase.from("clients").select("id, linked_workspace_id").eq("id", connection.advisor_client_id).maybeSingle();
    if (!clientRow?.linked_workspace_id) return failRun(supabase, connection.id, trigger, "El asesor de esta conexión no tiene una cuenta real vinculada.");
    advisor = { clientId: connection.advisor_client_id, linkedWorkspaceId: clientRow.linked_workspace_id as string, agencyWorkspaceId: connection.workspace_id };
  } else {
    // Conexión propia (autoservicio) — el propio workspace_id es el destino,
    // sin agencia/roster de clients de por medio.
    advisor = { clientId: null, linkedWorkspaceId: connection.workspace_id, agencyWorkspaceId: connection.workspace_id };
  }
  const ws = advisor.linkedWorkspaceId;

  const accessToken = await getSheetReadToken(connection.workspace_id);
  if (!accessToken) return failRun(supabase, connection.id, trigger, "No hay una cuenta de Google conectada para leer la hoja.");

  let rows: string[][];
  try {
    rows = await fetchSheetValues(accessToken, connection.spreadsheet_id, connection.sheet_name);
  } catch (err) {
    return failRun(supabase, connection.id, trigger, err instanceof Error ? err.message : "No se pudo leer la hoja.");
  }

  // La configuración entra al hash: cambiar equivalencias/mapeo/zona horaria re-procesa todo.
  const configHash = sha256(JSON.stringify({ m: connection.column_map, v: connection.value_map, o: connection.options, tz: connection.utc_offset_minutes, h: connection.header_row }));
  const sheetHash = sha256(JSON.stringify({ rows, configHash }));
  const { items } = parseAgendaSheetRows(rows, connection.header_row, connection.column_map, connection.utc_offset_minutes);

  if (connection.last_sheet_hash && sheetHash === connection.last_sheet_hash) {
    const runId = await startRun(supabase, connection.id, trigger);
    await markConnectionOk(supabase, connection.id, items.length, sheetHash);
    await finishRun(supabase, runId, { status: "ok", rows_read: items.length, created_count: 0, updated_count: 0, skipped_count: items.length, error_count: 0 });
    return { ok: true, ...EMPTY_RESULT, processed: items.length, skipped: items.length };
  }

  const runId = await startRun(supabase, connection.id, trigger);
  const syncStartedAt = new Date().toISOString();
  await supabase.from("advisor_sheet_connections").update({ last_sync_started_at: syncStartedAt }).eq("id", connection.id);

  try {
    const rowErrors: { row_number: number; row_key: string | null; message: string }[] = [];
    const valid = items.filter((item) => {
      const blocking = item.problems.filter(isBlockingProblem);
      if (blocking.length === 0 && item.key) return true;
      rowErrors.push({ row_number: item.rowNumber, row_key: null, message: blocking.map((p) => AGENDA_ROW_PROBLEM_LABELS[p]).join(", ") || "Fila incompleta" });
      return false;
    });

    // ── Lecturas en lote ───────────────────────────────────────────────────────────────────────
    const { data: indexData, error: indexError } = await supabase.from("advisor_sheet_rows").select("row_key, contact_id, appointment_id, opportunity_id, last_row_hash").eq("connection_id", connection.id);
    if (indexError) throw new Error(indexError.message);
    const index = new Map<string, IndexRow>((indexData ?? []).map((r) => [r.row_key as string, r as unknown as IndexRow]));

    const phoneCandidates = [...new Set(valid.flatMap((i) => phoneLookupCandidates(i.digits)))];
    const contactsByPhone = await selectIn<{ id: string; name: string; phone: string; custom_fields: Record<string, unknown> | null; created_at: string }>(phoneCandidates, 150, (chunk) =>
      supabase.from("contacts").select("id, name, phone, custom_fields, created_at").eq("workspace_id", ws).in("phone", chunk),
    );
    const indexContactIds = [...new Set([...index.values()].map((r) => r.contact_id).filter((id): id is string => !!id))];
    const contactsById = await selectIn<{ id: string; name: string; phone: string | null; custom_fields: Record<string, unknown> | null; created_at: string }>(indexContactIds, 150, (chunk) =>
      supabase.from("contacts").select("id, name, phone, custom_fields, created_at").in("id", chunk),
    );

    const contactRefs = new Map<string, ContactRef>();
    for (const c of [...contactsByPhone, ...contactsById]) contactRefs.set(c.id, { id: c.id, name: c.name, custom_fields: c.custom_fields, isNew: false });
    // dígitos (cualquier variante) → contacto más antiguo con ese teléfono
    const contactByDigits = new Map<string, string>();
    for (const c of [...contactsByPhone].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const d = phoneDigits(c.phone);
      if (!contactByDigits.has(d)) contactByDigits.set(d, c.id);
    }
    const findByDigits = (digits: string) => {
      for (const candidate of phoneLookupCandidates(digits)) {
        const id = contactByDigits.get(phoneDigits(candidate));
        if (id) return id;
      }
      return null;
    };

    const knownContactIds = [...contactRefs.keys()];
    const existingAppointments = await selectIn<ExistingAppointment>(knownContactIds, 150, (chunk) =>
      supabase.from("agenda_appointments").select("id, contact_id, start_time, sheet_connection_id").eq("workspace_id", ws).in("contact_id", chunk),
    );
    // Citas que ya tienen dueño en el índice de esta hoja — no se "adoptan" para otra fila.
    const claimed = new Set([...index.values()].map((r) => r.appointment_id).filter((id): id is string => !!id));

    const { data: memberRows } = await supabase.rpc("workspace_member_names", { ws_id: connection.workspace_id });
    const setters: SetterCandidate[] = ((memberRows ?? []) as { member_id: string; full_name: string }[]).map((m) => ({ memberId: m.member_id, name: m.full_name }));

    // ── Resolución en memoria ──────────────────────────────────────────────────────────────────
    const now = new Date().toISOString();
    const appointmentUpserts: Record<string, unknown>[] = [];
    const indexUpserts: Record<string, unknown>[] = [];
    const agencyRows: { key: string; contactId: string; leadName: string; notes?: string; opportunityId: string | null }[] = [];
    const setterAssignments = new Set<string>();
    const touchedContactIds = new Set<string>();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of valid) {
      const key = item.key!;
      const parsed = item.parsed!;
      const values = item.values;
      const leadName = values.leadName!;
      // El número de fila entra al hash: si la fila se movió (se borró una de arriba), la cita
      // actualiza su sheet_row_number aunque el contenido no haya cambiado — así la escritura de
      // vuelta apunta a la fila correcta.
      const hash = sha256(JSON.stringify({ values, row: item.rowNumber, cfg: configHash }));
      const existing = index.get(key);
      if (existing?.appointment_id && existing.last_row_hash === hash) {
        skipped++;
        continue;
      }

      // Lead (contacto): el del índice, o por teléfono, o uno nuevo (una sola vez por teléfono).
      let contactId = existing?.contact_id && contactRefs.has(existing.contact_id) ? existing.contact_id : findByDigits(item.digits);
      if (!contactId) {
        if (!connection.options.create_leads) {
          rowErrors.push({ row_number: item.rowNumber, row_key: key, message: `El lead ${leadName} no existe en el CRM (crear leads está desactivado).` });
          continue;
        }
        contactId = randomUUID();
        contactRefs.set(contactId, { id: contactId, name: leadName, custom_fields: null, isNew: true, phone: item.digits, email: values.email ?? null });
        contactByDigits.set(item.digits, contactId);
      }
      const contact = contactRefs.get(contactId)!;
      touchedContactIds.add(contactId);
      const producto = resolveEquivalence("producto", values.producto, connection.value_map);
      const appointmentType = resolveEquivalence("appointmentType", values.appointmentType, connection.value_map);
      const estadoRaw = resolveEquivalence("estado", values.estado, connection.value_map) ?? "agendada";
      const estadoCita: EstadoCita = (ESTADO_VALUES as string[]).includes(estadoRaw) ? (estadoRaw as EstadoCita) : "agendada";
      // Producto y notas del lead viven en custom_fields.agenda (sin columnas nuevas en contacts).
      const agenda = { ...((contact.custom_fields?.agenda as Record<string, unknown> | undefined) ?? {}), ...(producto ? { producto } : {}), ...(values.notes ? { notas: values.notes } : {}) };
      contact.custom_fields = { ...(contact.custom_fields ?? {}), agenda };
      contact.name = leadName;
      if (values.email) contact.email = values.email;

      // Cita: la del índice, o la que ya existía para ese lead ese día, o una nueva.
      let appointmentId = existing?.appointment_id ?? null;
      if (!appointmentId) {
        const day = localDayKey(parsed.date, connection.utc_offset_minutes);
        const adopt = existingAppointments.find(
          (a) => a.contact_id === contactId && !claimed.has(a.id) && (!a.sheet_connection_id || a.sheet_connection_id === connection.id) && localDayKey(new Date(a.start_time), connection.utc_offset_minutes) === day,
        );
        appointmentId = adopt?.id ?? null;
      }
      const isNewAppointment = !appointmentId;
      if (!appointmentId) appointmentId = randomUUID();
      claimed.add(appointmentId);
      if (isNewAppointment) created++;
      else updated++;

      const setter = resolveByName(values.setterName, setters);
      if (setter && advisor.clientId) setterAssignments.add(setter.memberId);

      appointmentUpserts.push({
        id: appointmentId,
        workspace_id: ws,
        contact_id: contactId,
        advisor_client_id: advisor.clientId,
        setter_id: setter?.memberId ?? null,
        // Respaldo de visualización para cuando el setter no tiene cuenta real (0147).
        setter_name: values.setterName ?? null,
        // Snapshot de la columna NOTAS de la hoja (0149).
        notes: values.notes ?? null,
        subject: appointmentType ? `${appointmentType}: ${leadName}` : `Cita: ${leadName}`,
        appointment_type: appointmentType,
        producto,
        contactado: parseContactado(values.contactado),
        sin_hora: parsed.sinHora,
        start_time: parsed.date.toISOString(),
        end_time: new Date(parsed.date.getTime() + 30 * 60000).toISOString(),
        estado_cita: estadoCita,
        source: "google_sheets_kpi",
        deleted_in_sheet: false,
        sheet_connection_id: connection.id,
        sheet_row_number: item.rowNumber,
        updated_at: now,
      });
      indexUpserts.push({ connection_id: connection.id, row_key: key, contact_id: contactId, appointment_id: appointmentId, opportunity_id: existing?.opportunity_id ?? null, status: "ok", error_message: null, last_row_hash: hash, synced_at: now });
      if (advisor.clientId) agencyRows.push({ key, contactId, leadName, notes: values.notes, opportunityId: existing?.opportunity_id ?? null });
    }

    // ── Escrituras en lote ─────────────────────────────────────────────────────────────────────
    const touched = [...contactRefs.values()].filter((c) => touchedContactIds.has(c.id));
    const newContacts = touched.filter((c) => c.isNew);
    const updatedContacts = touched.filter((c) => !c.isNew);
    for (let i = 0; i < newContacts.length; i += 200) {
      const { error } = await supabase.from("contacts").insert(
        newContacts.slice(i, i + 200).map((c) => ({ id: c.id, workspace_id: ws, name: c.name, phone: c.phone, email: c.email ?? null, source: AGENDA_SHEET_CONTACT_SOURCE, custom_fields: c.custom_fields })),
      );
      if (error) throw new Error(`contacts: ${error.message}`);
    }
    // Mismas columnas en todas las filas (upsert en lote pondría en null las que falten).
    await upsertInChunks(
      supabase,
      "contacts",
      updatedContacts.map((c) => ({ id: c.id, workspace_id: ws, name: c.name, custom_fields: c.custom_fields, updated_at: now })),
      "id",
    );
    for (const c of updatedContacts.filter((x) => x.email)) await supabase.from("contacts").update({ email: c.email }).eq("id", c.id);

    await upsertInChunks(supabase, "agenda_appointments", appointmentUpserts, "id");

    if (advisor.clientId) {
      for (const memberId of setterAssignments) {
        await supabase.from("advisor_setter_assignments").upsert({ workspace_id: advisor.agencyWorkspaceId, client_id: advisor.clientId, setter_id: memberId }, { onConflict: "client_id,setter_id", ignoreDuplicates: true });
      }
      const pipelineCache = new Map<string, PipelineTarget>();
      for (const row of agencyRows) {
        try {
          const opportunityId = await ensureAgencyOpportunity(supabase, ws, row.contactId, row.leadName, row.notes, row.opportunityId, pipelineCache);
          const entry = indexUpserts.find((u) => u.row_key === row.key);
          if (entry) entry.opportunity_id = opportunityId;
        } catch (err) {
          rowErrors.push({ row_number: 0, row_key: row.key, message: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    await upsertInChunks(supabase, "advisor_sheet_rows", indexUpserts, "connection_id,row_key");

    // ── Filas que ya no están en la hoja ───────────────────────────────────────────────────────
    // advisor_sheet_rows es solo el índice clave→cita: se limpian las claves que no aparecieron
    // (incluidas las viejas "row:N" de antes de 0199), y sus citas quedan "Eliminada en la hoja".
    const seen = new Set(valid.map((i) => i.key!));
    const staleKeys = [...index.keys()].filter((k) => !seen.has(k));
    for (let i = 0; i < staleKeys.length; i += 150) {
      await supabase.from("advisor_sheet_rows").delete().eq("connection_id", connection.id).in("row_key", staleKeys.slice(i, i + 150));
    }
    const liveAppointmentIds = new Set([...claimed].filter((id) => appointmentUpserts.some((a) => a.id === id) || [...index.entries()].some(([k, r]) => seen.has(k) && r.appointment_id === id)));
    const { data: sheetAppointments } = await supabase.from("agenda_appointments").select("id").eq("sheet_connection_id", connection.id).eq("deleted_in_sheet", false);
    const goneIds = (sheetAppointments ?? []).map((a) => a.id as string).filter((id) => !liveAppointmentIds.has(id));
    for (let i = 0; i < goneIds.length; i += 150) {
      await supabase.from("agenda_appointments").update({ deleted_in_sheet: true, updated_at: now }).in("id", goneIds.slice(i, i + 150));
    }

    if (rowErrors.length > 0 && runId) {
      await supabase.from("advisor_sheet_sync_row_errors").insert(rowErrors.map((e) => ({ run_id: runId, row_number: e.row_number, row_key: e.row_key, message: e.message.slice(0, 1000) })));
    }

    await markConnectionOk(supabase, connection.id, items.length, sheetHash);
    await finishRun(supabase, runId, {
      status: rowErrors.length > 0 ? "error" : "ok",
      error_message: rowErrors.length > 0 ? `${rowErrors.length} fila(s) con problemas.` : undefined,
      rows_read: items.length,
      created_count: created,
      updated_count: updated,
      skipped_count: skipped,
      error_count: rowErrors.length,
    });
    return { ok: true, processed: items.length, created, updated, skipped, errors: rowErrors.length, newLeads: newContacts.length, deletedInSheet: goneIds.length };
  } catch (err) {
    console.error(`[advisorSync] la conexión ${connection.id} falló:`, err);
    return failRun(supabase, connection.id, trigger, err instanceof Error ? err.message : String(err), runId);
  }
}
