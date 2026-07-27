import "server-only";
import ExcelJS from "exceljs";
import { parseCsvRows } from "@/lib/utils/csv";

/** Fase 1 accepts .xlsx and .csv only — this repo's only spreadsheet
 * dependency (exceljs) reads OOXML .xlsx, not legacy binary .xls, and no
 * .xls parser exists anywhere in the codebase (confirmed before starting
 * this feature). Users with a legacy .xls re-save as .xlsx — decided with
 * the user rather than adding a second spreadsheet dependency for Fase 1. */
export function isSupportedFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".csv");
}

export function isXlsxFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".xlsx");
}

export interface SheetInfo {
  name: string;
  /** Data rows only (header row excluded) — what Paso 1 shows as "cantidad
   * estimada de registros" per sheet. */
  rowCount: number;
}

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
  /** Total data rows actually in the sheet/file, independent of how many
   * were materialized into `rows` (capped by `maxRows`) — Paso 1/4 need the
   * real total even when only a sample was parsed. */
  totalRows: number;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    // Rich text runs ({ richText: [...] }) or a formula result ({ result, formula }).
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((run) => run.text).join("");
    }
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue);
    if ("text" in value) return String((value as { text: unknown }).text ?? "");
    return "";
  }
  return String(value);
}

/** Paso 1's "si el archivo tiene varias hojas, preguntar cuál desea
 * importar" — lists every worksheet with its row count before any specific
 * sheet is chosen. Loads the whole workbook into memory (not exceljs'
 * streaming WorkbookReader): at Fase 1's 10,000-row scale this is a few MB,
 * comfortably inside a Vercel function's memory budget — streaming would add
 * real complexity not justified until a future higher-scale phase. */
export async function listWorkbookSheets(buffer: ArrayBuffer): Promise<SheetInfo[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets.map((sheet) => ({
    name: sheet.name,
    rowCount: Math.max(0, sheet.rowCount - 1),
  }));
}

function parseWorksheet(sheet: ExcelJS.Worksheet, maxRows: number): ParsedTable {
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = cellToString(cell.value).trim();
  });

  const rows: Record<string, string>[] = [];
  let totalRows = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    totalRows++;
    if (rows.length >= maxRows) return;
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (!header) return;
      record[header] = cellToString(row.getCell(i + 1).value);
    });
    rows.push(record);
  });

  return { headers: headers.filter(Boolean), rows, totalRows };
}

/** Parses one specific sheet by name out of an already-loaded workbook
 * buffer — the second round trip after listWorkbookSheets() when a
 * multi-sheet file needs the user's choice first (Paso 1). */
export async function parseExcelSheet(buffer: ArrayBuffer, sheetName: string, maxRows: number): Promise<ParsedTable> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`No se encontró la hoja "${sheetName}" en el archivo.`);
  return parseWorksheet(sheet, maxRows);
}

/** CSV has no concept of multiple sheets — this is the single-round-trip
 * path Paso 1 takes directly for .csv uploads. */
export function parseCsvFile(text: string, maxRows: number): ParsedTable {
  // Excel-exported CSVs commonly carry a UTF-8 BOM, which would otherwise
  // corrupt the first header's name (e.g. "﻿Nombre" fails every
  // dictionary match fieldDictionary.ts would otherwise make cleanly).
  const withoutBom = text.replace(/^﻿/, "");
  const allLines = withoutBom.trim().split(/\r?\n/).filter((l) => l.trim());
  const { headers, rows } = parseCsvRows(withoutBom, maxRows);
  return { headers, rows, totalRows: Math.max(0, allLines.length - 1) };
}
