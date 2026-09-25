import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";

/** Extrae el ID de hoja (+ gid de pestaña, si viene en la URL) de cualquier
 * link normal de Google Sheets — a propósito NO exige el formato especial
 * de "Publicar en la web": el pedido explícito del usuario fue leer la
 * hoja pública tal cual se comparte (Compartir → Cualquier persona con el
 * enlace), no una URL de publicación aparte. */
function extractSheetRef(rawUrl: string): { sheetId: string; gid: string | null } | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.hostname !== "docs.google.com") return null;
  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const gidFromQuery = url.searchParams.get("gid");
  const gidFromHash = url.hash.match(/gid=(\d+)/)?.[1] ?? null;
  return { sheetId: match[1], gid: gidFromQuery ?? gidFromHash };
}

/** Bug conocido del endpoint gviz: una celda de tipo Fecha real (no texto)
 * viene serializada como el literal `Date(2026,8,24)` SIN comillas — texto
 * JS válido, pero JSON inválido, así que `JSON.parse` revienta apenas la
 * hoja tiene una sola celda de fecha (el caso normal para una columna
 * "Fecha" real). La arreglamos antes de parsear, convirtiendo cada
 * `Date(y,m,d[,h,mi,s])` en un string ISO entre comillas — igual de válido
 * como JSON, y ya no hace falta: preferimos `cell.f` (el valor formateado,
 * siempre texto plano) en el resto del archivo de todos modos. */
function sanitizeGvizDates(text: string): string {
  return text.replace(/new Date\((\d+(?:,\s*-?\d+)*)\)/g, (_match, args: string) => {
    const parts = args.split(",").map((n) => parseInt(n.trim(), 10));
    const [y, mo = 0, d = 1, h = 0, mi = 0, s = 0] = parts;
    const iso = new Date(y, mo, d, h, mi, s).toISOString();
    return JSON.stringify(iso);
  });
}

interface GvizCell {
  v?: unknown;
  f?: string;
}
interface GvizResponse {
  table?: {
    cols?: { label?: string }[];
    rows?: { c?: (GvizCell | null)[] }[];
  };
}

/** Sirve como proxy same-origin del endpoint público `gviz/tq` de Google
 * Sheets (usado por el propio Google Sheets/Data Studio para leer una hoja
 * como JSON estructurado, sin exportarla a CSV) — llamado desde el
 * dashboard de ManyChat (src/lib/manychat/dashboardTemplate.ts,
 * DataSource.sheets) al tocar "Actualizar". Proxear server-side evita
 * depender de que Google habilite CORS para el origen del iframe, y deja
 * la respuesta ya en la misma forma `{header: valor}` por fila que el
 * resto del dashboard espera (igual shape que Papa.parse con header:true),
 * así `normalize()` no necesita saber de dónde vinieron las filas. */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "Sin workspace activo." }, { status: 401 });

  const moduleStatus = await getWorkspaceModuleStatus(active.workspaceId);
  const enabled = moduleStatus.some((m) => m.moduleKey === "manychat" && m.enabled);
  if (!enabled) return NextResponse.json({ error: "Módulo no activo." }, { status: 403 });

  const sheetUrl = request.nextUrl.searchParams.get("url");
  if (!sheetUrl) return NextResponse.json({ error: "Falta el link de la hoja." }, { status: 400 });

  const ref = extractSheetRef(sheetUrl);
  if (!ref) return NextResponse.json({ error: "El link no parece ser de Google Sheets." }, { status: 400 });

  const gvizUrl = `https://docs.google.com/spreadsheets/d/${ref.sheetId}/gviz/tq?tqx=out:json&headers=1${ref.gid ? `&gid=${encodeURIComponent(ref.gid)}` : ""}`;

  let raw: string;
  try {
    const res = await fetch(gvizUrl, { cache: "no-store" });
    if (!res.ok) {
      const message =
        res.status === 400 || res.status === 404
          ? 'No encontré esa hoja. Verificá que esté compartida como "Cualquier persona con el enlace puede ver".'
          : `La hoja respondió con error ${res.status}.`;
      return NextResponse.json({ error: message }, { status: 502 });
    }
    raw = await res.text();
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con Google Sheets." }, { status: 502 });
  }

  // La respuesta viene envuelta en `google.visualization.Query.setResponse({...});` —
  // nunca JSON puro (es el mismo formato que usa el propio Google Sheets internamente).
  const wrapped = raw.match(/setResponse\(([\s\S]*)\);?\s*$/);
  if (!wrapped) {
    return NextResponse.json(
      { error: 'No se pudo leer la hoja — verificá que esté compartida como "Cualquier persona con el enlace puede ver".' },
      { status: 502 },
    );
  }

  let parsed: GvizResponse;
  try {
    parsed = JSON.parse(sanitizeGvizDates(wrapped[1]));
  } catch {
    return NextResponse.json({ error: "La hoja devolvió un formato inesperado." }, { status: 502 });
  }

  const cols = parsed.table?.cols ?? [];
  const headers = cols.map((c, i) => c.label?.trim() || `col${i + 1}`);
  const rows = (parsed.table?.rows ?? []).map((row) => {
    const record: Record<string, string> = {};
    (row.c ?? []).forEach((cell, i) => {
      const header = headers[i];
      if (!header) return;
      record[header] = cell?.f ?? (cell?.v != null ? String(cell.v) : "");
    });
    return record;
  });

  return NextResponse.json({ rows });
}
