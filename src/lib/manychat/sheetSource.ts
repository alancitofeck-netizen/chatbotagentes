import "server-only";

/** Lee la hoja de ManyChat del workspace desde el servidor (endpoint gviz de Google
 * Sheets), igual que el proxy anterior pero sin pasar por el navegador. El enlace
 * de la hoja se guarda en `integration_connections.metadata` del workspace. */

export function extractSheetRef(rawUrl: string): { sheetId: string; gid: string | null } | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.hostname !== "docs.google.com") return null;
  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const gid = url.searchParams.get("gid") ?? url.hash.match(/gid=(\d+)/)?.[1] ?? null;
  return { sheetId: match[1], gid };
}

/** Google devuelve las fechas como `Date(2026,8,24,22,44,11)` (a veces sin comillas,
 * a veces como texto). Las pasamos a "YYYY-MM-DD HH:mm:ss", sin zona, para que el
 * parseo sea sin ambigüedad. */
function gvizDateToText(args: string): string {
  const [y, mo = 0, d = 1, h = 0, mi = 0, s = 0] = args.split(",").map((n) => parseInt(n.trim(), 10));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(mo + 1)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(s)}`;
}

function sanitizeGvizDates(text: string): string {
  return text.replace(/new Date\((\d+(?:,\s*-?\d+)*)\)/g, (_match, args: string) => JSON.stringify(gvizDateToText(args)));
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const date = value.match(/^Date\((\d+(?:,\s*-?\d+)*)\)$/);
    return date ? gvizDateToText(date[1]) : value;
  }
  return String(value);
}

interface GvizResponse {
  table?: {
    cols?: { label?: string }[];
    rows?: { c?: ({ v?: unknown; f?: string } | null)[] }[];
  };
}

/** Parsea la respuesta `google.visualization.Query.setResponse({...})` a filas `{encabezado: valor}`. */
export function parseGvizResponse(raw: string): Record<string, string>[] {
  const wrapped = raw.match(/setResponse\(([\s\S]*)\);?\s*$/);
  if (!wrapped) throw new SheetError('No se pudo leer la hoja — verificá que esté compartida como "Cualquier persona con el enlace puede ver".');
  let parsed: GvizResponse;
  try {
    parsed = JSON.parse(sanitizeGvizDates(wrapped[1]));
  } catch {
    throw new SheetError("La hoja devolvió un formato inesperado.");
  }
  const headers = (parsed.table?.cols ?? []).map((c, i) => c.label?.trim() || `col${i + 1}`);
  return (parsed.table?.rows ?? []).map((row) => {
    const record: Record<string, string> = {};
    (row.c ?? []).forEach((cell, i) => {
      record[headers[i] ?? `col${i + 1}`] = cell ? cellText(cell.v ?? cell.f) : "";
    });
    return record;
  });
}

export class SheetError extends Error {}

/** Trae las filas de la hoja. Lanza `SheetError` con un mensaje para mostrar al usuario. */
export async function fetchSheetRows(sheetUrl: string): Promise<Record<string, string>[]> {
  const ref = extractSheetRef(sheetUrl);
  if (!ref) throw new SheetError("El link no parece ser de Google Sheets.");
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${ref.sheetId}/gviz/tq?tqx=out:json&headers=1${ref.gid ? `&gid=${encodeURIComponent(ref.gid)}` : ""}`;
  let res: Response;
  try {
    res = await fetch(gvizUrl, { cache: "no-store" });
  } catch {
    throw new SheetError("No se pudo conectar con Google Sheets.");
  }
  if (!res.ok) {
    throw new SheetError(
      res.status === 400 || res.status === 404
        ? 'No encontré esa hoja. Verificá que esté compartida como "Cualquier persona con el enlace puede ver".'
        : `La hoja respondió con error ${res.status}.`,
    );
  }
  return parseGvizResponse(await res.text());
}
