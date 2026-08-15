import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchSheetValues, getValidGoogleSheetsAccessToken } from "@/lib/integrations/googleSheets";
import { normalizeE164 } from "@/lib/integrations/ycloud";
import { normalizeForMatch } from "@/lib/advisors/import/fuzzyMatch";
import { resolveEstadoCita, type AdvisorSyncFieldKey } from "./fieldDictionary";

export interface AdvisorSheetConnection {
  id: string;
  workspace_id: string;
  advisor_client_id: string;
  spreadsheet_id: string;
  sheet_name: string;
  column_map: Record<string, AdvisorSyncFieldKey>;
  /** 1-based — algunas hojas tienen una fila de título arriba de los
   * encabezados reales (ver inspectAdvisorSheetColumnsAction). */
  header_row: number;
  last_sheet_hash: string | null;
}

export interface AdvisorSyncResult {
  ok: boolean;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function markConnectionError(supabase: SupabaseClient, connectionId: string, message: string) {
  await supabase
    .from("advisor_sheet_connections")
    .update({ last_sync_status: "error", last_sync_error: message.slice(0, 500) })
    .eq("id", connectionId);
}

async function markConnectionOk(supabase: SupabaseClient, connectionId: string, rowCount: number, sheetHash: string | null) {
  await supabase
    .from("advisor_sheet_connections")
    .update({ last_sync_status: "ok", last_sync_error: null, row_count: rowCount, ...(sheetHash ? { last_sheet_hash: sheetHash } : {}) })
    .eq("id", connectionId);
}

/** El equipo opera en Argentina/Uruguay (UTC-3, sin horario de verano) —
 * mismo criterio de offset fijo (sin librería de timezone) que
 * src/lib/ai/businessHours.ts. Sin esto, la hora de la hoja se interpretaba
 * como si ya fuera UTC: con `valueRenderOption=UNFORMATTED_VALUE` (ver
 * googleSheets.ts) una celda de Hora le llega a este parser como fracción
 * de día (ej. 0.875 = 21:00), y como nunca matcheaba el regex "HH:MM" la
 * hora nunca se aplicaba — todas las citas terminaban mostrando la misma
 * hora "fantasma" (medianoche UTC renderizada en horario local). */
const SHEET_TIMEZONE_UTC_OFFSET_HOURS = 3;

/** Excel/Sheets serial date (con o sin fracción de hora embebida), dd/mm/yyyy
 * o yyyy-mm-dd para la fecha; "HH:MM" o fracción de día (0-1) para la hora.
 * Nunca lanza — una fecha mala descarta la fila (sin fecha no hay cita). */
function parseSheetDate(dateValue: string, timeValue: string | undefined): Date | null {
  const trimmed = dateValue.trim();
  if (!trimmed) return null;

  let year: number;
  let month: number; // 0-based
  let day: number;
  let hour = 0;
  let minute = 0;

  const serial = Number(trimmed);
  if (!Number.isNaN(serial) && serial > 20000 && serial < 80000) {
    const wholeDays = Math.floor(serial);
    const fractionalDay = serial - wholeDays;
    const epoch = new Date(Date.UTC(1899, 11, 30) + wholeDays * 86400000);
    year = epoch.getUTCFullYear();
    month = epoch.getUTCMonth();
    day = epoch.getUTCDate();
    if (fractionalDay > 0) {
      const totalMinutes = Math.round(fractionalDay * 24 * 60);
      hour = Math.floor(totalMinutes / 60);
      minute = totalMinutes % 60;
    }
  } else {
    const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      year = Number(y.length === 2 ? `20${y}` : y);
      month = Number(m) - 1;
      day = Number(d);
    } else if (ymd) {
      const [, y, m, d] = ymd;
      year = Number(y);
      month = Number(m) - 1;
      day = Number(d);
    } else {
      return null;
    }
  }

  const timeTrimmed = timeValue?.trim();
  if (timeTrimmed) {
    const timeMatch = timeTrimmed.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      hour = Number(timeMatch[1]);
      minute = Number(timeMatch[2]);
    } else {
      const timeSerial = Number(timeTrimmed);
      if (!Number.isNaN(timeSerial) && timeSerial >= 0 && timeSerial < 1) {
        const totalMinutes = Math.round(timeSerial * 24 * 60);
        hour = Math.floor(totalMinutes / 60);
        minute = totalMinutes % 60;
      }
    }
  }

  const utcMs = Date.UTC(year, month, day, hour, minute, 0) + SHEET_TIMEZONE_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  const result = new Date(utcMs);
  return Number.isNaN(result.getTime()) ? null : result;
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

type RowOutcome = "created" | "updated" | "skipped";

interface AdvisorContext {
  clientId: string;
  linkedWorkspaceId: string;
  agencyWorkspaceId: string;
}

async function processRow(
  supabase: SupabaseClient,
  connection: AdvisorSheetConnection,
  advisor: AdvisorContext,
  headers: string[],
  row: string[],
  sheetRowNumber: number,
  setters: SetterCandidate[],
  pipelineCache: Map<string, PipelineTarget>,
): Promise<RowOutcome> {
  const values: Partial<Record<AdvisorSyncFieldKey, string>> = {};
  headers.forEach((header, idx) => {
    const fieldKey = connection.column_map[header];
    if (fieldKey) {
      const raw = row[idx];
      if (raw !== undefined && raw !== null && String(raw).trim() !== "") values[fieldKey] = String(raw).trim();
    }
  });

  if (!values.leadName || !values.phone || !values.date) return "skipped";

  const phone = normalizeE164(values.phone);
  const hash = sha256(JSON.stringify(values));
  const rowKey = values.externalId ? `ext:${values.externalId}` : `row:${sheetRowNumber}`;

  const { data: existingRow } = await supabase
    .from("advisor_sheet_rows")
    .select("id, contact_id, appointment_id, opportunity_id, last_row_hash")
    .eq("connection_id", connection.id)
    .eq("row_key", rowKey)
    .maybeSingle();

  if (existingRow && existingRow.last_row_hash === hash) return "skipped";

  // El Setter es opcional: muchos setters no tienen cuenta de Growth Link
  // (no son workspace_members), así que no reconocerlo nunca bloquea la
  // fila — la cita/lead se crean igual, simplemente sin setter asignado.
  const setter = resolveByName(values.setterName, setters);

  // Deriva la relación setter↔asesor de la propia fila en vez de requerir
  // configurarla aparte (reemplaza AdvisorSetterAssignmentsManager como
  // paso manual). Se dispara en paralelo con la consulta de contacto de
  // abajo (no depende de su resultado ni lo bloquea) — con hojas de 50-60+
  // filas, cada round trip evitado por fila suma.
  const assignmentPromise = setter
    ? supabase
        .from("advisor_setter_assignments")
        .upsert({ workspace_id: advisor.agencyWorkspaceId, client_id: advisor.clientId, setter_id: setter.memberId }, { onConflict: "client_id,setter_id", ignoreDuplicates: true })
    : null;

  const meetingAt = parseSheetDate(values.date, values.time);
  if (!meetingAt) throw new Error(`Fecha "${values.date}" no reconocida.`);

  const linkedWorkspaceId = advisor.linkedWorkspaceId;

  const [{ data: existingContact }] = await Promise.all([
    supabase.from("contacts").select("id").eq("workspace_id", linkedWorkspaceId).eq("phone", phone).maybeSingle(),
    assignmentPromise,
  ]);
  let contactId: string;
  if (existingContact) {
    contactId = existingContact.id as string;
    await supabase
      .from("contacts")
      .update({ name: values.leadName, ...(values.email ? { email: values.email } : {}) })
      .eq("id", contactId);
  } else {
    const { data: newContact, error: contactError } = await supabase
      .from("contacts")
      .insert({ workspace_id: linkedWorkspaceId, name: values.leadName, phone, email: values.email ?? null, source: "google_sheets" })
      .select("id")
      .single();
    if (contactError || !newContact) throw new Error(contactError?.message ?? "No se pudo crear el contacto.");
    contactId = newContact.id as string;
  }

  const estadoCita = resolveEstadoCita(values.estado);
  const startTime = meetingAt.toISOString();
  const endTime = new Date(meetingAt.getTime() + 30 * 60000).toISOString();

  let appointmentId = existingRow?.appointment_id as string | null | undefined;
  const appointmentPayload = {
    contact_id: contactId,
    advisor_client_id: advisor.clientId,
    setter_id: setter?.memberId ?? null,
    // Respaldo de visualización para cuando el setter no tiene cuenta real
    // (setter_id null) — ver 0147_agenda_appointments_setter_name.sql.
    setter_name: values.setterName ?? null,
    subject: values.appointmentType ? `${values.appointmentType}: ${values.leadName}` : `Cita: ${values.leadName}`,
    appointment_type: values.appointmentType ?? null,
    start_time: startTime,
    end_time: endTime,
    estado_cita: estadoCita,
    source: "google_sheets_kpi",
    updated_at: new Date().toISOString(),
  };

  let outcome: RowOutcome;
  if (appointmentId) {
    await supabase.from("agenda_appointments").update(appointmentPayload).eq("id", appointmentId);
    outcome = "updated";
  } else {
    const { data: appointment, error: appointmentError } = await supabase
      .from("agenda_appointments")
      .insert({ workspace_id: linkedWorkspaceId, ...appointmentPayload })
      .select("id")
      .single();
    if (appointmentError || !appointment) throw new Error(appointmentError?.message ?? "No se pudo crear la cita.");
    appointmentId = appointment.id as string;
    outcome = "created";
  }

  const { pipelineId, stageId } = await ensureCrmPipelineTarget(supabase, linkedWorkspaceId, pipelineCache);
  let opportunityId = existingRow?.opportunity_id as string | null | undefined;
  if (opportunityId) {
    await supabase.from("opportunities").update({ title: values.leadName, updated_at: new Date().toISOString() }).eq("id", opportunityId);
  } else {
    const { data: opp, error: oppError } = await supabase
      .from("opportunities")
      .insert({ workspace_id: linkedWorkspaceId, contact_id: contactId, title: values.leadName, value: 0, currency: "USD" })
      .select("id")
      .single();
    if (oppError || !opp) throw new Error(oppError?.message ?? "No se pudo crear la oportunidad.");
    opportunityId = opp.id as string;

    const { data: item, error: itemError } = await supabase
      .from("pipeline_items")
      .insert({ pipeline_id: pipelineId, stage_id: stageId, item_type: "opportunity", item_id: opportunityId, position: 0 })
      .select("id")
      .single();
    if (itemError || !item) throw new Error(itemError?.message ?? "No se pudo agregar el lead al pipeline.");
    await supabase.from("opportunities").update({ pipeline_item_id: item.id }).eq("id", opportunityId);
  }

  if (values.notes) {
    await supabase.from("notes").insert({ workspace_id: linkedWorkspaceId, notable_type: "opportunity", notable_id: opportunityId, body: values.notes });
  }

  await supabase.from("advisor_sheet_rows").upsert(
    {
      connection_id: connection.id,
      row_key: rowKey,
      contact_id: contactId,
      appointment_id: appointmentId,
      opportunity_id: opportunityId,
      status: "ok",
      error_message: null,
      last_row_hash: hash,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "connection_id,row_key" },
  );

  return outcome;
}

async function recordRowError(supabase: SupabaseClient, connectionId: string, rowKey: string, hash: string, message: string) {
  await supabase.from("advisor_sheet_rows").upsert(
    { connection_id: connectionId, row_key: rowKey, status: "error", error_message: message.slice(0, 500), last_row_hash: hash, synced_at: new Date().toISOString() },
    { onConflict: "connection_id,row_key" },
  );
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

/** Entry point para el cron y para "Sincronizar ahora" — nunca lanza, cada
 * fila aislada en su propio try/catch (una fila mala no aborta el resto, el
 * error queda visible en advisor_sheet_rows.error_message y en el
 * historial de corridas). */
export async function runAdvisorSheetSync(connection: AdvisorSheetConnection, trigger: "cron" | "manual" = "cron"): Promise<AdvisorSyncResult> {
  const supabase = createServiceRoleClient();

  const { data: clientRow } = await supabase.from("clients").select("id, linked_workspace_id").eq("id", connection.advisor_client_id).maybeSingle();
  if (!clientRow?.linked_workspace_id) {
    const runId = await startRun(supabase, connection.id, trigger);
    const message = "El asesor de esta conexión no tiene una cuenta real vinculada.";
    await markConnectionError(supabase, connection.id, message);
    await finishRun(supabase, runId, { status: "error", error_message: message, rows_read: 0, created_count: 0, updated_count: 0, skipped_count: 0, error_count: 0 });
    return { ok: false, processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  }
  const advisor: AdvisorContext = { clientId: connection.advisor_client_id, linkedWorkspaceId: clientRow.linked_workspace_id as string, agencyWorkspaceId: connection.workspace_id };

  const accessToken = await getValidGoogleSheetsAccessToken(connection.workspace_id);
  if (!accessToken) {
    const runId = await startRun(supabase, connection.id, trigger);
    const message = "No hay una conexión de Google Sheets activa para este workspace.";
    await markConnectionError(supabase, connection.id, message);
    await finishRun(supabase, runId, { status: "error", error_message: message, rows_read: 0, created_count: 0, updated_count: 0, skipped_count: 0, error_count: 0 });
    return { ok: false, processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  }

  let rows: string[][];
  try {
    rows = await fetchSheetValues(accessToken, connection.spreadsheet_id, connection.sheet_name);
  } catch (err) {
    const runId = await startRun(supabase, connection.id, trigger);
    const message = err instanceof Error ? err.message : "No se pudo leer la hoja.";
    await markConnectionError(supabase, connection.id, message);
    await finishRun(supabase, runId, { status: "error", error_message: message, rows_read: 0, created_count: 0, updated_count: 0, skipped_count: 0, error_count: 0 });
    return { ok: false, processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  }

  const headerIdx = connection.header_row - 1;
  if (rows.length <= headerIdx + 1) {
    await markConnectionOk(supabase, connection.id, 0, sha256(JSON.stringify(rows)));
    return { ok: true, processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  }

  const sheetHash = sha256(JSON.stringify(rows));
  if (connection.last_sheet_hash && sheetHash === connection.last_sheet_hash) {
    const runId = await startRun(supabase, connection.id, trigger);
    await markConnectionOk(supabase, connection.id, rows.length - 1, sheetHash);
    await finishRun(supabase, runId, { status: "ok", rows_read: rows.length - 1, created_count: 0, updated_count: 0, skipped_count: rows.length - 1, error_count: 0 });
    return { ok: true, processed: rows.length - 1, created: 0, updated: 0, skipped: rows.length - 1, errors: 0 };
  }

  const runId = await startRun(supabase, connection.id, trigger);
  const headers = rows[headerIdx] ?? [];
  const dataRows = rows.slice(headerIdx + 1);

  const { data: memberRows } = await supabase.rpc("workspace_member_names", { ws_id: connection.workspace_id });
  const setters: SetterCandidate[] = ((memberRows ?? []) as { member_id: string; full_name: string }[]).map((m) => ({ memberId: m.member_id, name: m.full_name }));

  const externalIdHeader = Object.entries(connection.column_map).find(([, fieldKey]) => fieldKey === "externalId")?.[0];
  const externalIdColIdx = externalIdHeader ? headers.indexOf(externalIdHeader) : -1;
  const pipelineCache = new Map<string, PipelineTarget>();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const sheetRowNumber = i + connection.header_row + 1;
    try {
      const outcome = await processRow(supabase, connection, advisor, headers, dataRows[i], sheetRowNumber, setters, pipelineCache);
      if (outcome === "created") created++;
      else if (outcome === "updated") updated++;
      else skipped++;
    } catch (err) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[advisorSync] fila ${sheetRowNumber} de la conexión ${connection.id} falló:`, err);
      const externalId = externalIdColIdx >= 0 ? dataRows[i]?.[externalIdColIdx] : undefined;
      const rowKey = externalId ? `ext:${externalId}` : `row:${sheetRowNumber}`;
      await recordRowError(supabase, connection.id, rowKey, sha256(JSON.stringify(dataRows[i])), message);
      await supabase.from("advisor_sheet_sync_row_errors").insert({ run_id: runId, row_number: sheetRowNumber, row_key: rowKey, message: message.slice(0, 1000) });
    }
  }

  await markConnectionOk(supabase, connection.id, dataRows.length, sheetHash);
  await finishRun(supabase, runId, {
    status: errors > 0 ? "error" : "ok",
    error_message: errors > 0 ? `${errors} fila(s) fallaron.` : undefined,
    rows_read: dataRows.length,
    created_count: created,
    updated_count: updated,
    skipped_count: skipped,
    error_count: errors,
  });
  return { ok: true, processed: dataRows.length, created, updated, skipped, errors };
}
