export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/** Quote-aware, hand-rolled CSV line splitter — no parsing dependency, by
 * this project's established convention. Extracted here as a shared
 * utility: it used to be copy-pasted independently in
 * src/app/(protected)/crm/ImportLeadsSheet.tsx and src/lib/documents/import.ts;
 * src/lib/advisors/import/parseFile.ts is its third consumer. Not
 * "server-only" — the CRM call site is a Client Component parsing pasted
 * text in the browser. */
export function splitCsvLine(line: string): string[] {
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

/** Splits CSV text into a header row + record rows — headers exactly as
 * they appear in the file (case preserved); callers needing
 * case-insensitive matching (e.g. ImportLeadsSheet's fixed column set)
 * lowercase the returned headers themselves rather than this shared
 * utility silently doing it for everyone. `maxRows` caps how many data
 * rows are parsed (documents/import.ts's 1,000-row cap and the Importador
 * de Cartera's 10,000-row cap both call this with their own limit). */
export function parseCsvRows(text: string, maxRows?: number): ParsedCsv {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]);
  const dataLines = maxRows ? lines.slice(1, 1 + maxRows) : lines.slice(1);
  const rows = dataLines.map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((key, i) => {
      row[key] = values[i] ?? "";
    });
    return row;
  });
  return { headers, rows };
}
