import "server-only";
import { createClient } from "@/lib/supabase/server";
import { findOrCreateContact } from "@/lib/contacts/match";
import { logActivity } from "@/lib/activity/log";

export interface ImportRowError {
  row: number;
  message: string;
}
export interface ImportResult {
  created: number;
  errors: ImportRowError[];
}

/** YYYY-MM-DD, DD/MM/YYYY, o lo que ya venga en YYYY-MM-DD desde
 * parseExcelSheet (cellToString castea Date a YYYY-MM-DD) — mismo criterio
 * que normalizeDate en policies/import.ts, copiado en vez de importado
 * porque ese vive en un archivo con lógica propia de Pólizas y esto no
 * depende de nada específico de ese módulo. */
function normalizeDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function normalizeTime(raw: string | undefined): string {
  if (!raw?.trim()) return "09:00";
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "09:00";
  const [, h, m] = match;
  return `${h.padStart(2, "0")}:${m}`;
}

function normalizeNumber(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.replace(/[^0-9.,-]/g, "").replace(/\.(?=\d{3},)/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function field(row: Record<string, string>, mapping: Record<string, string | null>, key: string): string | undefined {
  const header = Object.keys(mapping).find((h) => mapping[h] === key);
  return header ? row[header] : undefined;
}

export async function importContactRows(workspaceId: string, rows: Record<string, string>[], mapping: Record<string, string | null>): Promise<ImportResult> {
  const supabase = await createClient();
  const result: ImportResult = { created: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const name = field(row, mapping, "name")?.trim();
      const phone = field(row, mapping, "phone")?.trim();
      const email = field(row, mapping, "email")?.trim();
      if (!name && !phone && !email) throw new Error("Falta nombre, teléfono o email.");

      const contactId = await findOrCreateContact(supabase, workspaceId, { name, phone, email }, "import");

      const dni = field(row, mapping, "dni")?.trim();
      const cuit = field(row, mapping, "cuit")?.trim();
      const company = field(row, mapping, "company")?.trim();
      if (dni || cuit || company) {
        await supabase.from("contacts").update({ ...(dni ? { dni } : {}), ...(cuit ? { cuit } : {}), ...(company ? { company } : {}) }).eq("id", contactId);
      }
      result.created++;
    } catch (err) {
      result.errors.push({ row: i + 2, message: err instanceof Error ? err.message : "Error desconocido." });
    }
  }
  return result;
}

export async function importTaskRows(workspaceId: string, memberId: string | null, rows: Record<string, string>[], mapping: Record<string, string | null>): Promise<ImportResult> {
  const supabase = await createClient();
  const result: ImportResult = { created: 0, errors: [] };

  const { data: memberNames } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  const memberIdByName = new Map(((memberNames ?? []) as { member_id: string; full_name: string }[]).map((m) => [m.full_name.trim().toLowerCase(), m.member_id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const title = field(row, mapping, "title")?.trim();
      if (!title) throw new Error("Falta el título.");

      const assignedName = field(row, mapping, "assignedToName")?.trim().toLowerCase();
      const assignedTo = assignedName ? (memberIdByName.get(assignedName) ?? null) : null;
      const dueDate = normalizeDate(field(row, mapping, "dueDate"));
      const priorityRaw = field(row, mapping, "priority")?.trim().toLowerCase();
      const priority = (["low", "medium", "high", "urgent"] as const).includes(priorityRaw as "low") ? priorityRaw : "medium";
      const statusRaw = field(row, mapping, "status")?.trim().toLowerCase();
      const status = (["pending", "in_progress", "completed"] as const).includes(statusRaw as "pending") ? statusRaw : "pending";

      const { error } = await supabase.from("tasks").insert({
        workspace_id: workspaceId,
        title,
        description: field(row, mapping, "description")?.trim() || null,
        due_at: dueDate ? new Date(`${dueDate}T09:00:00`).toISOString() : null,
        priority,
        status,
        assigned_to: assignedTo,
        created_by: memberId,
      });
      if (error) throw new Error(error.message);
      result.created++;
    } catch (err) {
      result.errors.push({ row: i + 2, message: err instanceof Error ? err.message : "Error desconocido." });
    }
  }
  return result;
}

export async function importEventRows(workspaceId: string, memberId: string | null, rows: Record<string, string>[], mapping: Record<string, string | null>): Promise<ImportResult> {
  const supabase = await createClient();
  const result: ImportResult = { created: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const subject = field(row, mapping, "subject")?.trim();
      const startDate = normalizeDate(field(row, mapping, "startDate"));
      if (!subject || !startDate) throw new Error("Faltan el título o la fecha de inicio.");

      const startTime = normalizeTime(field(row, mapping, "startTime"));
      const endDate = normalizeDate(field(row, mapping, "endDate")) ?? startDate;
      const endTime = field(row, mapping, "endTime")?.trim() ? normalizeTime(field(row, mapping, "endTime")) : null;

      const startIso = new Date(`${startDate}T${startTime}:00`).toISOString();
      // Sin hora de fin explícita: 1 hora de duración por defecto — mismo
      // criterio que usa el formulario manual de Calendario.
      const endIso = endTime ? new Date(`${endDate}T${endTime}:00`).toISOString() : new Date(new Date(startIso).getTime() + 60 * 60000).toISOString();

      const contactName = field(row, mapping, "contactName")?.trim();
      const contactId = contactName ? await findOrCreateContact(supabase, workspaceId, { name: contactName }, "import") : null;

      const { error } = await supabase.from("bookings").insert({
        workspace_id: workspaceId,
        subject,
        description: field(row, mapping, "description")?.trim() || null,
        start_time: startIso,
        end_time: endIso,
        location: field(row, mapping, "location")?.trim() || null,
        contact_id: contactId,
        owner_id: memberId,
        created_by: memberId,
        provider: "internal",
        status: "scheduled",
      });
      if (error) throw new Error(error.message);
      result.created++;
    } catch (err) {
      result.errors.push({ row: i + 2, message: err instanceof Error ? err.message : "Error desconocido." });
    }
  }
  return result;
}

/** A diferencia de los otros, este NUNCA crea una póliza — solo agrega una
 * cuota a una que ya exista (matcheada por número de póliza dentro del
 * workspace). Un "Cobro" sin póliza real no tiene dónde vivir; filas sin
 * match quedan como error explícito, no se inventa una póliza nueva. */
export async function importPaymentRows(workspaceId: string, rows: Record<string, string>[], mapping: Record<string, string | null>): Promise<ImportResult> {
  const supabase = await createClient();
  const result: ImportResult = { created: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const policyNumber = field(row, mapping, "policyNumber")?.trim();
      const dueDate = normalizeDate(field(row, mapping, "dueDate"));
      const amount = normalizeNumber(field(row, mapping, "amount"));
      if (!policyNumber || !dueDate || amount === null) throw new Error("Faltan el número de póliza, la fecha o el monto.");

      const { data: policy } = await supabase.from("policies").select("id").eq("workspace_id", workspaceId).eq("policy_number", policyNumber).maybeSingle();
      if (!policy) throw new Error(`No se encontró ninguna póliza con el número "${policyNumber}" en este workspace.`);

      const statusRaw = field(row, mapping, "status")?.trim().toLowerCase();
      const status = (["pendiente", "en_seguimiento", "pagado", "cancelado"] as const).includes(statusRaw as "pendiente") ? statusRaw : "pendiente";

      const { error } = await supabase.from("policy_payments").insert({
        policy_id: policy.id,
        due_date: dueDate,
        amount,
        currency: field(row, mapping, "currency")?.trim() || "USD",
        status,
      });
      if (error) throw new Error(error.message);
      result.created++;
    } catch (err) {
      result.errors.push({ row: i + 2, message: err instanceof Error ? err.message : "Error desconocido." });
    }
  }
  return result;
}

export async function logImportJob(
  workspaceId: string,
  memberId: string | null,
  entityType: string,
  fileName: string,
  totalRows: number,
  result: ImportResult,
): Promise<void> {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("data_import_jobs")
    .insert({
      workspace_id: workspaceId,
      entity_type: entityType,
      file_name: fileName,
      status: "completed",
      total_rows: totalRows,
      success_count: result.created,
      error_count: result.errors.length,
      created_by: memberId,
    })
    .select("id")
    .single();
  if (job && result.errors.length > 0) {
    await supabase.from("data_import_errors").insert(result.errors.map((e) => ({ job_id: job.id as string, row_number: e.row, message: e.message })));
  }
  await logActivity(supabase, workspaceId, memberId, "data_transfer", (job?.id as string) ?? workspaceId, "data_import_completed", {
    entityType,
    fileName,
    created: result.created,
    errors: result.errors.length,
  });
}
