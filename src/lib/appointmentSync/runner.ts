import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchSheetValues, getValidGoogleSheetsAccessToken } from "@/lib/integrations/googleSheets";
import { normalizeE164 } from "@/lib/integrations/ycloud";
import { normalizeForMatch } from "@/lib/advisors/import/fuzzyMatch";
import { pushEventToGoogle } from "@/lib/integrations/googleCalendar";
import { resolveEstadoCita, type AppointmentSyncFieldKey } from "./fieldDictionary";
import type { CalendarEvent } from "@/lib/calendar/queries";

export interface AppointmentSheetConnection {
  id: string;
  workspace_id: string;
  spreadsheet_id: string;
  sheet_name: string;
  column_map: Record<string, AppointmentSyncFieldKey>;
  last_sheet_hash: string | null;
}

export interface AppointmentSyncResult {
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
    .from("appointment_sheet_connections")
    .update({ last_sync_status: "error", last_sync_error: message.slice(0, 500) })
    .eq("id", connectionId);
}

async function markConnectionOk(supabase: SupabaseClient, connectionId: string, rowCount: number, sheetHash: string | null) {
  await supabase
    .from("appointment_sheet_connections")
    .update({ last_sync_status: "ok", last_sync_error: null, row_count: rowCount, ...(sheetHash ? { last_sheet_hash: sheetHash } : {}) })
    .eq("id", connectionId);
}

/** Excel/Sheets serial date, o formatos comunes dd/mm/yyyy | yyyy-mm-dd —
 * mismo parser (deliberadamente sin librería de fechas) que
 * src/lib/leadSync/runner.ts::parseSheetDate. Nunca lanza — una fecha mala
 * simplemente descarta la fila (sin fecha no hay cita que crear). */
function parseSheetDate(dateValue: string, timeValue: string | undefined): Date | null {
  const trimmed = dateValue.trim();
  if (!trimmed) return null;

  let base: Date | null = null;
  const serial = Number(trimmed);
  if (!Number.isNaN(serial) && serial > 20000 && serial < 80000) {
    base = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  } else {
    const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      base = new Date(Number(y.length === 2 ? `20${y}` : y), Number(m) - 1, Number(d));
    } else if (ymd) {
      const [, y, m, d] = ymd;
      base = new Date(Number(y), Number(m) - 1, Number(d));
    }
  }
  if (!base || Number.isNaN(base.getTime())) return null;

  const timeMatch = timeValue?.trim().match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) base.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  return base;
}

/** Exacto→substring, mismo criterio que resolveOwnerId/resolveStageId de
 * leadSync/runner.ts — una coincidencia de nombre equivocada asocia la cita
 * al asesor/setter equivocado, así que nunca es "aproximado por puntaje". */
function resolveByName<T extends { name: string }>(needle: string | undefined, candidates: T[]): T | null {
  if (!needle) return null;
  const normalized = normalizeForMatch(needle);
  const exact = candidates.find((c) => normalizeForMatch(c.name) === normalized);
  if (exact) return exact;
  return candidates.find((c) => normalizeForMatch(c.name).includes(normalized) || normalized.includes(normalizeForMatch(c.name))) ?? null;
}

interface AdvisorCandidate {
  clientId: string;
  linkedWorkspaceId: string;
  name: string;
  sheetAlias: string | null;
}

interface SetterCandidate {
  memberId: string;
  name: string;
}

function resolveAdvisor(advisorText: string | undefined, advisors: AdvisorCandidate[]): AdvisorCandidate | null {
  if (!advisorText) return null;
  const normalized = normalizeForMatch(advisorText);
  const byAlias = advisors.find((a) => a.sheetAlias && normalizeForMatch(a.sheetAlias) === normalized);
  if (byAlias) return byAlias;
  return resolveByName(
    advisorText,
    advisors.map((a) => ({ ...a, name: a.name })),
  );
}

const EVENT_TYPE_ALIASES: Record<string, string> = {
  llamada: "call",
  call: "call",
  reunion: "meeting",
  meeting: "meeting",
  seguimiento: "follow_up",
  "follow up": "follow_up",
  demo: "demo",
};

function resolveEventType(typeText: string | undefined): string {
  if (!typeText) return "meeting";
  const normalized = normalizeForMatch(typeText);
  return EVENT_TYPE_ALIASES[normalized] ?? "meeting";
}

/** status/attended derivados de estado_cita — para que /calendar y el push
 * a Google Calendar del asesor sigan mostrando algo coherente aunque no
 * conozcan estado_cita (ver decisión de diseño #1 del plan). */
function deriveStatusAttended(estadoCita: string): { status: string; attended: boolean | null } {
  switch (estadoCita) {
    case "realizada":
    case "venta":
      return { status: "completed", attended: true };
    case "no_show":
      return { status: "completed", attended: false };
    case "cancelada":
      return { status: "cancelled", attended: null };
    default:
      return { status: "scheduled", attended: null };
  }
}

type RowOutcome = "created" | "updated" | "skipped";

async function processRow(
  supabase: SupabaseClient,
  connection: AppointmentSheetConnection,
  headers: string[],
  row: string[],
  sheetRowNumber: number,
  advisors: AdvisorCandidate[],
  setters: SetterCandidate[],
  assignmentsBySetterId: Map<string, Set<string>>,
): Promise<RowOutcome> {
  const values: Partial<Record<AppointmentSyncFieldKey, string>> = {};
  headers.forEach((header, idx) => {
    const fieldKey = connection.column_map[header];
    if (fieldKey) {
      const raw = row[idx];
      if (raw !== undefined && raw !== null && String(raw).trim() !== "") values[fieldKey] = String(raw).trim();
    }
  });

  if (!values.leadName || !values.phone || !values.advisorName || !values.setterName || !values.date) return "skipped";

  const phone = normalizeE164(values.phone);
  const hash = sha256(JSON.stringify(values));
  const rowKey = values.externalId ? `ext:${values.externalId}` : `row:${sheetRowNumber}`;

  const { data: existingRow } = await supabase
    .from("appointment_sheet_rows")
    .select("id, booking_id, contact_id, last_row_hash")
    .eq("connection_id", connection.id)
    .eq("row_key", rowKey)
    .maybeSingle();

  if (existingRow && existingRow.last_row_hash === hash) return "skipped";

  const advisor = resolveAdvisor(values.advisorName, advisors);
  if (!advisor) throw new Error(`Asesor "${values.advisorName}" no reconocido.`);
  const setter = resolveByName(values.setterName, setters);
  if (!setter) throw new Error(`Setter "${values.setterName}" no reconocido.`);

  // Validación blanda: si el setter tiene asesores asignados, el asesor de
  // la fila debe estar entre ellos. Un setter sin asignaciones configuradas
  // todavía no se bloquea (permite usar el sync antes de armar el roster).
  const assigned = assignmentsBySetterId.get(setter.memberId);
  if (assigned && assigned.size > 0 && !assigned.has(advisor.clientId)) {
    throw new Error(`El setter "${values.setterName}" no tiene asignado al asesor "${values.advisorName}".`);
  }

  const meetingAt = parseSheetDate(values.date, values.time);
  if (!meetingAt) throw new Error(`Fecha "${values.date}" no reconocida.`);

  // Contact + booking viven en el workspace REAL del asesor — nunca en el
  // de la agencia. Mismo criterio de find-or-create por (workspace_id,
  // phone) que src/lib/miniApps/ingest.ts::linkLeadToContact.
  const linkedWorkspaceId = advisor.linkedWorkspaceId;
  const { data: upsertedContact } = await supabase
    .from("contacts")
    .upsert({ workspace_id: linkedWorkspaceId, name: values.leadName, phone, source: "google_sheets" }, { onConflict: "workspace_id,phone", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  let contactId = upsertedContact?.id as string | undefined;
  if (!contactId) {
    const { data: existingContact } = await supabase.from("contacts").select("id").eq("workspace_id", linkedWorkspaceId).eq("phone", phone).maybeSingle();
    contactId = existingContact?.id as string | undefined;
  }
  if (!contactId) throw new Error("No se pudo resolver el contacto del lead.");

  // owner_id/created_by = el usuario principal del workspace del asesor
  // (getRealAdvisorWorkspaces ya asume que existe exactamente uno) — así la
  // cita queda "asignada a él" en su propio /calendar. setter_id (columna
  // nueva) es quien la consiguió, un member de OTRO workspace (la agencia)
  // — mismo patrón cross-tenant que clients.setter_id.
  const { data: primaryMember } = await supabase.from("workspace_members").select("id").eq("workspace_id", linkedWorkspaceId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  const advisorMemberId = (primaryMember?.id as string | undefined) ?? null;

  const estadoCita = resolveEstadoCita(values.estado);
  const { status, attended } = deriveStatusAttended(estadoCita);
  const startTime = meetingAt.toISOString();
  const endTime = new Date(meetingAt.getTime() + 30 * 60000).toISOString();
  const eventType = resolveEventType(values.appointmentType);

  let bookingId = existingRow?.booking_id as string | null | undefined;
  let outcome: RowOutcome;
  const bookingPayload = {
    contact_id: contactId,
    client_id: advisor.clientId,
    setter_id: setter.memberId,
    owner_id: advisorMemberId,
    subject: values.appointmentType ? `${values.appointmentType}: ${values.leadName}` : `Cita: ${values.leadName}`,
    event_type: eventType,
    start_time: startTime,
    end_time: endTime,
    status,
    attended,
    estado_cita: estadoCita,
    source: "google_sheets",
    provider: "internal",
    updated_at: new Date().toISOString(),
  };

  if (bookingId) {
    await supabase.from("bookings").update(bookingPayload).eq("id", bookingId);
    outcome = "updated";
  } else {
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({ workspace_id: linkedWorkspaceId, created_by: advisorMemberId, ...bookingPayload })
      .select("id, start_time, end_time, subject, event_type, provider")
      .single();
    if (bookingError || !booking) throw new Error(bookingError?.message ?? "No se pudo crear la cita.");
    bookingId = booking.id as string;
    outcome = "created";

    // Push a Google Calendar del asesor — reuso directo, fire-and-forget
    // (mismo criterio que createEvent en src/lib/calendar/actions.ts: un
    // fallo acá nunca revierte la cita ya guardada).
    const calendarEvent = {
      id: bookingId,
      title: bookingPayload.subject,
      startTime,
      endTime,
      provider: "internal",
      externalId: null,
    } as unknown as CalendarEvent;
    void pushEventToGoogle(linkedWorkspaceId, calendarEvent); // nunca lanza, ya se auto-atrapa
  }

  await supabase.from("appointment_sheet_rows").upsert(
    { connection_id: connection.id, row_key: rowKey, booking_id: bookingId, contact_id: contactId, status: "ok", error_message: null, last_row_hash: hash, synced_at: new Date().toISOString() },
    { onConflict: "connection_id,row_key" },
  );

  return outcome;
}

async function recordRowError(supabase: SupabaseClient, connectionId: string, rowKey: string, hash: string, message: string) {
  await supabase.from("appointment_sheet_rows").upsert(
    { connection_id: connectionId, row_key: rowKey, status: "error", error_message: message.slice(0, 500), last_row_hash: hash, synced_at: new Date().toISOString() },
    { onConflict: "connection_id,row_key" },
  );
}

/** Entry point para el cron y para "Sincronizar ahora" — mismo criterio que
 * runLeadSheetSync: nunca lanza, cada fila aislada en su propio try/catch
 * (una fila mala no aborta el resto; el error queda visible en
 * appointment_sheet_rows.error_message). */
export async function runAppointmentSheetSync(connection: AppointmentSheetConnection): Promise<AppointmentSyncResult> {
  const supabase = createServiceRoleClient();

  const accessToken = await getValidGoogleSheetsAccessToken(connection.workspace_id);
  if (!accessToken) {
    await markConnectionError(supabase, connection.id, "No hay una conexión de Google Sheets activa para este workspace.");
    return { ok: false, processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  }

  let rows: string[][];
  try {
    rows = await fetchSheetValues(accessToken, connection.spreadsheet_id, connection.sheet_name);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo leer la hoja.";
    await markConnectionError(supabase, connection.id, message);
    return { ok: false, processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  }

  if (rows.length < 2) {
    await markConnectionOk(supabase, connection.id, 0, sha256(JSON.stringify(rows)));
    return { ok: true, processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  }

  const sheetHash = sha256(JSON.stringify(rows));
  if (connection.last_sheet_hash && sheetHash === connection.last_sheet_hash) {
    await markConnectionOk(supabase, connection.id, rows.length - 1, sheetHash);
    return { ok: true, processed: rows.length - 1, created: 0, updated: 0, skipped: rows.length - 1, errors: 0 };
  }

  const [headers, ...dataRows] = rows;

  const [{ data: clientRows }, { data: memberRows }, { data: assignmentRows }] = await Promise.all([
    supabase.from("clients").select("id, linked_workspace_id, sheet_alias").eq("workspace_id", connection.workspace_id).not("linked_workspace_id", "is", null),
    supabase.rpc("workspace_member_names", { ws_id: connection.workspace_id }),
    supabase.from("advisor_setter_assignments").select("client_id, setter_id").eq("workspace_id", connection.workspace_id),
  ]);

  const linkedWorkspaceIds = ((clientRows ?? []) as { linked_workspace_id: string }[]).map((c) => c.linked_workspace_id);
  const advisorNamesByWorkspace = new Map<string, string>();
  if (linkedWorkspaceIds.length > 0) {
    const { data: primaryMembers } = await supabase.from("workspace_members").select("workspace_id, user_id, created_at").in("workspace_id", linkedWorkspaceIds).order("created_at", { ascending: true });
    const primaryUserByWorkspace = new Map<string, string>();
    for (const m of primaryMembers ?? []) {
      const wid = m.workspace_id as string;
      if (!primaryUserByWorkspace.has(wid)) primaryUserByWorkspace.set(wid, m.user_id as string);
    }
    await Promise.all(
      Array.from(primaryUserByWorkspace.entries()).map(async ([wid, uid]) => {
        const { data } = await supabase.auth.admin.getUserById(uid);
        const name = (data?.user?.user_metadata?.full_name as string | undefined) || data?.user?.email || "—";
        advisorNamesByWorkspace.set(wid, name);
      }),
    );
  }

  const advisors: AdvisorCandidate[] = ((clientRows ?? []) as { id: string; linked_workspace_id: string; sheet_alias: string | null }[]).map((c) => ({
    clientId: c.id,
    linkedWorkspaceId: c.linked_workspace_id,
    name: advisorNamesByWorkspace.get(c.linked_workspace_id) ?? "—",
    sheetAlias: c.sheet_alias,
  }));
  const setters: SetterCandidate[] = ((memberRows ?? []) as { member_id: string; full_name: string }[]).map((m) => ({ memberId: m.member_id, name: m.full_name }));
  const assignmentsBySetterId = new Map<string, Set<string>>();
  for (const a of (assignmentRows ?? []) as { client_id: string; setter_id: string }[]) {
    const set = assignmentsBySetterId.get(a.setter_id) ?? new Set<string>();
    set.add(a.client_id);
    assignmentsBySetterId.set(a.setter_id, set);
  }

  const externalIdHeader = Object.entries(connection.column_map).find(([, fieldKey]) => fieldKey === "externalId")?.[0];
  const externalIdColIdx = externalIdHeader ? headers.indexOf(externalIdHeader) : -1;

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const sheetRowNumber = i + 2;
    try {
      const outcome = await processRow(supabase, connection, headers, dataRows[i], sheetRowNumber, advisors, setters, assignmentsBySetterId);
      if (outcome === "created") created++;
      else if (outcome === "updated") updated++;
      else skipped++;
    } catch (err) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[appointmentSync] fila ${sheetRowNumber} de la conexión ${connection.id} falló:`, err);
      const externalId = externalIdColIdx >= 0 ? dataRows[i]?.[externalIdColIdx] : undefined;
      const rowKey = externalId ? `ext:${externalId}` : `row:${sheetRowNumber}`;
      await recordRowError(supabase, connection.id, rowKey, sha256(JSON.stringify(dataRows[i])), message);
    }
  }

  await markConnectionOk(supabase, connection.id, dataRows.length, sheetHash);
  return { ok: true, processed: dataRows.length, created, updated, skipped, errors };
}
