"use server";

import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";

export interface ParsedImportFile {
  headers: string[];
  rows: Record<string, string>[];
}

const MAX_IMPORT_ROWS = 1000;

/** Same quote-aware, hand-rolled parser style as ImportLeadsSheet.tsx
 * (src/app/(protected)/crm/ImportLeadsSheet.tsx) — no new CSV dependency,
 * just reused for a generic (not fixed-column) header set here. */
function parseCsvText(text: string): ParsedImportFile {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields.map((f) => f.trim());
  }

  const headers = splitLine(lines[0]);
  const rows = lines
    .slice(1, 1 + MAX_IMPORT_ROWS)
    .map((line) => {
      const values = splitLine(line);
      const row: Record<string, string> = {};
      headers.forEach((key, i) => {
        row[key] = values[i] ?? "";
      });
      return row;
    });
  return { headers, rows };
}

async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<ParsedImportFile> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || rows.length >= MAX_IMPORT_ROWS) return;
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      const cell = row.getCell(i + 1);
      record[header] = cell.value != null ? String(cell.value) : "";
    });
    rows.push(record);
  });

  return { headers, rows };
}

/** Reads an uploaded file (CSV or XLSX) into a generic header+rows shape for
 * the import wizard's column-mapping step. Takes a FormData (`file` field)
 * so the client can hand over the real File object directly. */
export async function parseImportFile(formData: FormData): Promise<ParsedImportFile> {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Ningún archivo recibido.");

  const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.type.includes("spreadsheetml");
  if (isXlsx) return parseXlsxBuffer(await file.arrayBuffer());
  return parseCsvText(await file.text());
}

export interface ContactColumnMapping {
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  title: string | null;
  notes: string | null;
}

/** Maps arbitrary uploaded columns onto Contacto fields and upserts —
 * reuses the same upsert-by-phone dedupe as createContact
 * (src/lib/contacts/actions.ts), extended here with `custom_fields.cargo`
 * and a `notes` row, neither of which createContact's narrower signature
 * accepts. Only Contactos is wired as an import target this pass (see plan). */
export async function importContactsFromRows(
  rows: Record<string, string>[],
  mapping: ContactColumnMapping,
): Promise<{ imported: number; skipped: { row: number; reason: string }[] }> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const skipped: { row: number; reason: string }[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = mapping.name ? (row[mapping.name] ?? "").trim() : "";
    if (!name) {
      skipped.push({ row: i + 1, reason: "Falta el nombre." });
      continue;
    }

    const phone = mapping.phone ? (row[mapping.phone] ?? "").trim() : "";
    const email = mapping.email ? (row[mapping.email] ?? "").trim() : "";
    const company = mapping.company ? (row[mapping.company] ?? "").trim() : "";
    const title = mapping.title ? (row[mapping.title] ?? "").trim() : "";
    const notes = mapping.notes ? (row[mapping.notes] ?? "").trim() : "";

    const payload = {
      workspace_id: workspaceId,
      name,
      email: email || null,
      company: company || null,
      custom_fields: title ? { cargo: title } : {},
    };

    const { data: contact, error } = phone
      ? await supabase.from("contacts").upsert({ ...payload, phone }, { onConflict: "workspace_id,phone" }).select("id").single()
      : await supabase.from("contacts").insert(payload).select("id").single();

    if (error || !contact) {
      skipped.push({ row: i + 1, reason: "No se pudo guardar el contacto." });
      continue;
    }

    if (notes) {
      await supabase.from("notes").insert({ workspace_id: workspaceId, notable_type: "contact", notable_id: contact.id, body: notes });
    }
    imported++;
  }

  return { imported, skipped };
}
