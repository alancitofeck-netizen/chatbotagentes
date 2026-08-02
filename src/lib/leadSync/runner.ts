import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchSheetValues, getValidGoogleSheetsAccessToken } from "@/lib/integrations/googleSheets";
import { normalizeE164 } from "@/lib/integrations/ycloud";
import { notify } from "@/lib/notifications/service";
import { logActivity } from "@/lib/activity/log";
import type { LeadSyncFieldKey } from "./fieldDictionary";

export interface LeadSheetConnection {
  id: string;
  workspace_id: string;
  spreadsheet_id: string;
  sheet_name: string;
  column_map: Record<string, LeadSyncFieldKey>;
  pipeline_id: string;
  default_stage_id: string;
  default_owner_id: string | null;
  /** Hash of the last successfully-read sheet content — the "mecanismo
   * equivalente" to modifiedTime (ver 0085_lead_sheet_sync_history.sql):
   * Sheets API v4 has no per-row or per-sheet modifiedTime, only Drive does,
   * and reading that would need a new OAuth scope + re-consent from every
   * already-connected workspace. Comparing this hash lets a run skip the
   * entire row loop when nothing changed, without a new scope. */
  last_sheet_hash: string | null;
}

export interface LeadSyncResult {
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
    .from("lead_sheet_connections")
    .update({ last_sync_status: "error", last_sync_error: message.slice(0, 500) })
    .eq("id", connectionId);
}

async function markConnectionOk(supabase: SupabaseClient, connectionId: string, rowCount: number, sheetHash: string | null) {
  await supabase
    .from("lead_sheet_connections")
    .update({ last_sync_status: "ok", last_sync_error: null, row_count: rowCount, ...(sheetHash ? { last_sheet_hash: sheetHash } : {}) })
    .eq("id", connectionId);
}

/** Best-effort "does this Estado/Agente cell match one of ours" — exact,
 * accent/case-insensitive first, then substring, so "cliente cerrado" still
 * matches a stage literally named "Cliente Cerrado" without requiring the
 * sheet's spelling to be byte-identical. No fuzzy score threshold here
 * (unlike column-header detection) — a wrong stage/owner match silently
 * misroutes a real lead, so it's exact-or-substring only, never "close enough". */
function normalizeLoose(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function resolveStageId(stageName: string | undefined, stages: { id: string; name: string }[]): string | null {
  if (!stageName) return null;
  const normalized = normalizeLoose(stageName);
  const exact = stages.find((s) => normalizeLoose(s.name) === normalized);
  if (exact) return exact.id;
  const partial = stages.find((s) => normalizeLoose(s.name).includes(normalized) || normalized.includes(normalizeLoose(s.name)));
  return partial?.id ?? null;
}

function resolveOwnerId(agentName: string | undefined, members: { member_id: string; full_name: string }[]): string | null {
  if (!agentName) return null;
  const normalized = normalizeLoose(agentName);
  const exact = members.find((m) => normalizeLoose(m.full_name) === normalized);
  if (exact) return exact.member_id;
  const partial = members.find((m) => normalizeLoose(m.full_name).includes(normalized) || normalized.includes(normalizeLoose(m.full_name)));
  return partial?.member_id ?? null;
}

/** Excel/Sheets serial date, or a handful of common plain-text formats
 * (dd/mm/yyyy, yyyy-mm-dd) — same defensive spirit as kpis/sync.ts's own
 * date parsing, deliberately not importing a date library for this. Returns
 * null (never throws) on anything unrecognized — a bad date just means no
 * calendar event for that row, not a failed sync. */
function parseSheetDate(dateValue: string, timeValue: string | undefined): Date | null {
  const trimmed = dateValue.trim();
  if (!trimmed) return null;

  let base: Date | null = null;
  const serial = Number(trimmed);
  if (!Number.isNaN(serial) && serial > 20000 && serial < 80000) {
    // Excel/Sheets epoch: day 0 = 1899-12-30.
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
  if (timeMatch) {
    base.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }
  return base;
}

type RowOutcome = "created" | "updated" | "skipped";

async function processRow(
  supabase: SupabaseClient,
  connection: LeadSheetConnection,
  headers: string[],
  row: string[],
  sheetRowNumber: number,
  stages: { id: string; name: string }[],
  members: { member_id: string; full_name: string }[],
): Promise<RowOutcome> {
  const values: Partial<Record<LeadSyncFieldKey, string>> = {};
  headers.forEach((header, idx) => {
    const fieldKey = connection.column_map[header];
    if (fieldKey) {
      const raw = row[idx];
      if (raw !== undefined && raw !== null && String(raw).trim() !== "") values[fieldKey] = String(raw).trim();
    }
  });

  if (!values.contactName || !values.phone) return "skipped";
  const phone = normalizeE164(values.phone);
  const hash = sha256(JSON.stringify(values));
  const rowKey = values.externalId ? `ext:${values.externalId}` : `row:${sheetRowNumber}`;

  const { data: existingRow } = await supabase
    .from("lead_sheet_rows")
    .select("id, contact_id, opportunity_id, booking_id, last_row_hash")
    .eq("connection_id", connection.id)
    .eq("row_key", rowKey)
    .maybeSingle();

  if (existingRow && existingRow.last_row_hash === hash) return "skipped";

  // Contact: find-or-create by phone (same identity rule as the rest of the
  // app — mini_app_leads/CRM both dedupe contacts by (workspace_id, phone)).
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", connection.workspace_id)
    .eq("phone", phone)
    .maybeSingle();

  let contactId: string;
  if (existingContact) {
    contactId = existingContact.id as string;
    await supabase
      .from("contacts")
      .update({
        name: values.contactName,
        ...(values.email ? { email: values.email } : {}),
        ...(values.country ? { custom_fields: { country: values.country } } : {}),
      })
      .eq("id", contactId);
  } else {
    const { data: newContact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        workspace_id: connection.workspace_id,
        name: values.contactName,
        phone,
        email: values.email ?? null,
        source: "google_sheets",
        custom_fields: values.country ? { country: values.country } : {},
      })
      .select("id")
      .single();
    if (contactError || !newContact) throw new Error(contactError?.message ?? "No se pudo crear el contacto.");
    contactId = newContact.id as string;
  }

  const stageId = resolveStageId(values.stage, stages) ?? connection.default_stage_id;
  const ownerId = resolveOwnerId(values.ownerAgent, members) ?? connection.default_owner_id;

  let opportunityId = existingRow?.opportunity_id as string | null | undefined;
  let outcome: RowOutcome;

  if (opportunityId) {
    await supabase.from("opportunities").update({ title: values.contactName, owner_id: ownerId, updated_at: new Date().toISOString() }).eq("id", opportunityId);
    const { data: opp } = await supabase.from("opportunities").select("pipeline_item_id").eq("id", opportunityId).maybeSingle();
    if (opp?.pipeline_item_id) await supabase.from("pipeline_items").update({ stage_id: stageId }).eq("id", opp.pipeline_item_id);
    outcome = "updated";
  } else {
    const { data: opp, error: oppError } = await supabase
      .from("opportunities")
      .insert({ workspace_id: connection.workspace_id, contact_id: contactId, title: values.contactName, value: 0, currency: "USD", owner_id: ownerId })
      .select("id")
      .single();
    if (oppError || !opp) throw new Error(oppError?.message ?? "No se pudo crear la oportunidad.");
    opportunityId = opp.id as string;

    const { data: item, error: itemError } = await supabase
      .from("pipeline_items")
      .insert({ pipeline_id: connection.pipeline_id, stage_id: stageId, item_type: "opportunity", item_id: opportunityId, position: 0 })
      .select("id")
      .single();
    if (itemError || !item) throw new Error(itemError?.message ?? "No se pudo agregar el lead al pipeline.");
    await supabase.from("opportunities").update({ pipeline_item_id: item.id }).eq("id", opportunityId);

    await logActivity(supabase, connection.workspace_id, null, "opportunity", opportunityId, "opportunity_created_from_sheet", {
      source: "google_sheets",
      spreadsheet_id: connection.spreadsheet_id,
      sheet_row: sheetRowNumber,
    });

    if (ownerId) {
      await notify({
        workspaceId: connection.workspace_id,
        memberId: ownerId,
        eventType: "lead_assigned",
        title: "Nuevo lead asignado",
        message: `${values.contactName} (sincronizado desde Google Sheets)`,
        actionUrl: `/crm?opportunity=${opportunityId}`,
      });
    }
    outcome = "created";
  }

  if (values.notes) {
    await supabase.from("notes").insert({
      workspace_id: connection.workspace_id,
      notable_type: "opportunity",
      notable_id: opportunityId,
      body: values.notes,
    });
  }

  let bookingId = existingRow?.booking_id as string | null | undefined;
  const meetingAt = parseSheetDate(values.meetingDate ?? "", values.meetingTime);
  if (meetingAt) {
    const startTime = meetingAt.toISOString();
    const endTime = new Date(meetingAt.getTime() + 30 * 60000).toISOString();
    if (bookingId) {
      await supabase.from("bookings").update({ start_time: startTime, end_time: endTime, updated_at: new Date().toISOString() }).eq("id", bookingId);
    } else {
      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          workspace_id: connection.workspace_id,
          contact_id: contactId,
          created_by: ownerId,
          owner_id: ownerId,
          subject: `Reunión: ${values.contactName}`,
          event_type: "meeting",
          start_time: startTime,
          end_time: endTime,
          related_type: "opportunity",
          related_id: opportunityId,
          provider: "internal",
          status: "scheduled",
        })
        .select("id")
        .single();
      bookingId = booking?.id as string | undefined;
    }
  }

  await supabase.from("lead_sheet_rows").upsert(
    {
      connection_id: connection.id,
      row_key: rowKey,
      contact_id: contactId,
      opportunity_id: opportunityId,
      booking_id: bookingId ?? null,
      last_row_hash: hash,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "connection_id,row_key" },
  );

  return outcome;
}

async function startRun(supabase: SupabaseClient, connectionId: string, trigger: "cron" | "manual"): Promise<string> {
  const { data } = await supabase
    .from("lead_sheet_sync_runs")
    .insert({ connection_id: connectionId, trigger, status: "running" })
    .select("id")
    .single();
  return data?.id as string;
}

async function finishRun(
  supabase: SupabaseClient,
  runId: string | undefined,
  patch: { status: "ok" | "error"; error_message?: string; rows_read: number; created_count: number; updated_count: number; skipped_count: number; error_count: number },
) {
  if (!runId) return;
  await supabase.from("lead_sheet_sync_runs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", runId);
}

/** Entry point for both the cron path and manual "Sincronizar ahora" — same
 * function backs both, mirroring runKpiSyncForSetter's own doc comment.
 * Never throws: every row is isolated in its own try/catch (one bad row
 * can't abort the rest, and gets logged to lead_sheet_sync_row_errors so
 * it's visible in the historial screen, not just console.error), and the
 * function itself always resolves to a result object so Promise.allSettled
 * at the call site is purely defensive. */
export async function runLeadSheetSync(connection: LeadSheetConnection, trigger: "cron" | "manual" = "cron"): Promise<LeadSyncResult> {
  const supabase = createServiceRoleClient();

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

  if (rows.length < 2) {
    await markConnectionOk(supabase, connection.id, 0, sha256(JSON.stringify(rows)));
    return { ok: true, processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  }

  // Sincronización incremental — "mecanismo equivalente" a modifiedTime (ver
  // el comentario de last_sheet_hash arriba): si el contenido completo de la
  // hoja es idéntico al de la corrida anterior, no hace falta ni siquiera
  // recorrer las filas — se registra la corrida igual (para el historial)
  // pero como un no-op, sin tocar contactos/oportunidades.
  const sheetHash = sha256(JSON.stringify(rows));
  if (connection.last_sheet_hash && sheetHash === connection.last_sheet_hash) {
    const runId = await startRun(supabase, connection.id, trigger);
    await markConnectionOk(supabase, connection.id, rows.length - 1, sheetHash);
    await finishRun(supabase, runId, {
      status: "ok",
      rows_read: rows.length - 1,
      created_count: 0,
      updated_count: 0,
      skipped_count: rows.length - 1,
      error_count: 0,
    });
    return { ok: true, processed: rows.length - 1, created: 0, updated: 0, skipped: rows.length - 1, errors: 0 };
  }

  const runId = await startRun(supabase, connection.id, trigger);
  const [headers, ...dataRows] = rows;
  const [{ data: stages }, { data: members }] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name").eq("pipeline_id", connection.pipeline_id),
    supabase.rpc("workspace_member_names", { ws_id: connection.workspace_id }),
  ]);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const sheetRowNumber = i + 2;
    try {
      const outcome = await processRow(
        supabase,
        connection,
        headers,
        dataRows[i],
        sheetRowNumber,
        (stages ?? []) as { id: string; name: string }[],
        (members ?? []) as { member_id: string; full_name: string }[],
      );
      if (outcome === "created") created++;
      else if (outcome === "updated") updated++;
      else skipped++;
    } catch (err) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[leadSync] fila ${sheetRowNumber} de la conexión ${connection.id} falló:`, err);
      await supabase.from("lead_sheet_sync_row_errors").insert({
        run_id: runId,
        row_number: sheetRowNumber,
        row_key: dataRows[i]?.[0] ?? null,
        message: message.slice(0, 1000),
      });
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
